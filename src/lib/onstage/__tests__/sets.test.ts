import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Backend } from "@/lib/data/backend";
import type { App, ScreenshotSet, SetDoc } from "@/lib/data/types";
import { doc, frame } from "@/lib/data/__tests__/helpers";
import { TEMPLATES } from "../data";
import { applyTemplateToDoc, defaultDoc } from "../docOps";

const DOCS_KEY = "onstage:set-docs:v1";
const LAST_KEY = "onstage:last-set:v1";

/** Fresh modules, as on a page load: the store (nothing open), the sets
 *  helpers and the local backend all from one module graph. */
async function boot() {
  vi.resetModules();
  const sets = await import("../sets");
  const store = await import("@/store/onstage");
  const { localBackend } = await import("@/lib/data/local");
  return { ...sets, ...store, localBackend };
}

const storedDocs = (): Record<string, SetDoc> => JSON.parse(localStorage.getItem(DOCS_KEY) ?? "{}");

const set = (id: string, appId: string, updatedAt: string): ScreenshotSet => ({
  id,
  appId,
  name: `Set ${id}`,
  sub: "",
  frameCount: 5,
  status: "Draft",
  updatedAt,
  swatch: "",
});

const app = (id: string, name = `App ${id}`): App => ({
  id,
  name,
  initial: name.charAt(0),
  meta: "",
  tint: "",
  thumbs: [],
  tags: [],
});

/**
 * A backend whose library the test controls. `createSet` / `createApp` add
 * to that library, so a second lookup sees what the first created.
 */
function fakeBackend(
  real: Backend,
  init: { sets?: ScreenshotSet[]; apps?: App[]; lastId?: string | null; docs?: Record<string, SetDoc> } = {},
) {
  const lib = {
    sets: [...(init.sets ?? [])],
    apps: [...(init.apps ?? [])],
    docs: { ...(init.docs ?? {}) } as Record<string, SetDoc>,
  };
  let n = 0;
  const createSet = vi.fn(async ({ appId, name, doc }: { appId: string; name: string; doc?: SetDoc }) => {
    // Resolve on a later task, as storage does, so concurrent callers overlap.
    await new Promise((r) => setTimeout(r, 0));
    const s = { ...set(`created-${++n}`, appId, "Just now"), name };
    lib.sets.push(s);
    if (doc) lib.docs[s.id] = doc;
    return s;
  });
  const createApp = vi.fn(async ({ name }: { name: string }) => {
    const a = app(`app-created-${++n}`, name);
    lib.apps.push(a);
    return a;
  });
  const backend: Backend = {
    ...real,
    listSets: async (appId?: string) => lib.sets.filter((s) => !appId || s.appId === appId),
    listApps: async () => [...lib.apps],
    getLastSetId: async () => init.lastId ?? null,
    loadSetDoc: async (id: string) => lib.docs[id] ?? null,
    createSet,
    createApp,
  };
  return { backend, lib, createSet, createApp };
}

// ISO-dated sets, newest to oldest, plus sets carrying display strings.
const NEWEST = "2026-09-25T18:00:00.000Z";
const MIDDLE = "2026-09-20T09:30:00.000Z";
const OLDEST = "2026-01-02T00:00:00.000Z";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** Let the fake backend's createSet (a zero-delay timer) finish. */
async function settle<T>(p: Promise<T>): Promise<T> {
  await vi.advanceTimersByTimeAsync(0);
  await vi.advanceTimersByTimeAsync(0);
  return p;
}

describe("updatedTime", () => {
  it("reads ISO timestamps", async () => {
    const { updatedTime } = await boot();
    expect(updatedTime({ updatedAt: NEWEST })).toBe(Date.parse(NEWEST));
    expect(updatedTime({ updatedAt: "2026-03-06T12:00:00Z" })).toBe(Date.UTC(2026, 2, 6, 12));
    expect(updatedTime({ updatedAt: OLDEST })).toBeLessThan(updatedTime({ updatedAt: NEWEST }));
  });

  it("treats display strings as undated, even ones Date.parse would accept", async () => {
    const { updatedTime } = await boot();
    for (const s of ["2h ago", "Yesterday", "6 Mar", "28 Feb", "Just now", "", "March 6, 2026"]) {
      expect(updatedTime({ updatedAt: s }), s).toBe(-Infinity);
    }
  });

  it("treats a malformed ISO-looking string as undated, not NaN", async () => {
    const { updatedTime } = await boot();
    expect(updatedTime({ updatedAt: "2026-13-45T99:99:99Z" })).toBe(-Infinity);
  });
});

describe("newestFirst", () => {
  it("puts dated sets newest first, then undated ones in their listed order", async () => {
    const { newestFirst } = await boot();
    const listed = [
      set("u1", "a", "2h ago"),
      set("old", "a", OLDEST),
      set("u2", "a", "Yesterday"),
      set("new", "a", NEWEST),
      set("mid", "a", MIDDLE),
      set("u3", "a", "6 Mar"),
    ];
    const copy = [...listed];
    expect(newestFirst(listed).map((s) => s.id)).toEqual(["new", "mid", "old", "u1", "u2", "u3"]);
    expect(listed).toEqual(copy); // the input's order is left alone
  });

  it("keeps sets edited at the same moment in their listed order", async () => {
    const { newestFirst } = await boot();
    const listed = [set("x", "a", MIDDLE), set("y", "a", MIDDLE), set("z", "a", NEWEST), set("w", "a", MIDDLE)];
    expect(newestFirst(listed).map((s) => s.id)).toEqual(["z", "x", "y", "w"]);
  });
});

describe("findSetToOpen", () => {
  const library = () => [set("s-old", "a", OLDEST), set("s-new", "a", NEWEST), set("s-mid", "b", MIDDLE)];

  it("returns the set this browser last opened while the library still lists it", async () => {
    const { findSetToOpen, localBackend } = await boot();
    const { backend } = fakeBackend(localBackend, { sets: library(), lastId: "s-old" });
    expect((await findSetToOpen(backend))?.id).toBe("s-old");
  });

  it("falls back to the most recently edited set when the last one is gone", async () => {
    const { findSetToOpen, localBackend } = await boot();
    const { backend } = fakeBackend(localBackend, { sets: library(), lastId: "deleted-set" });
    expect((await findSetToOpen(backend))?.id).toBe("s-new");
  });

  it("falls back to the most recently edited set when none was remembered", async () => {
    const { findSetToOpen, localBackend } = await boot();
    const { backend } = fakeBackend(localBackend, { sets: library(), lastId: null });
    expect((await findSetToOpen(backend))?.id).toBe("s-new");
  });

  it("prefers the set open in this tab over the remembered one", async () => {
    const { findSetToOpen, openSet, useOnstage, localBackend } = await boot();
    await openSet("s-mid");
    expect(useOnstage.getState().loadedSetId).toBe("s-mid");
    const { backend } = fakeBackend(localBackend, { sets: library(), lastId: "s-old" });
    expect((await findSetToOpen(backend))?.id).toBe("s-mid");
  });

  it("ignores an open set the library no longer lists", async () => {
    const { findSetToOpen, openSet, localBackend } = await boot();
    await openSet("since-deleted");
    const { backend } = fakeBackend(localBackend, { sets: library(), lastId: "s-old" });
    expect((await findSetToOpen(backend))?.id).toBe("s-old");
  });

  it("returns null for an empty library, whatever was remembered", async () => {
    const { findSetToOpen, localBackend } = await boot();
    const { backend } = fakeBackend(localBackend, { sets: [], lastId: "s-old" });
    expect(await findSetToOpen(backend)).toBeNull();
  });

  it("with the local backend, the newest fallback is the set created most recently", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    const { findSetToOpen, localBackend } = await boot();
    // Only the user's own sets: the sample fixtures (prepended until S2.2)
    // are not part of this question.
    const sample = await import("@/lib/data/sample");
    const fixtureIds = new Set(sample.SETS.map((s) => s.id));
    const realList = localBackend.listSets.bind(localBackend);
    vi.spyOn(localBackend, "listSets").mockImplementation(async (appId?: string) =>
      (await realList(appId)).filter((s) => !fixtureIds.has(s.id)),
    );

    const a = await localBackend.createApp({ name: "Mine" });
    vi.setSystemTime(new Date("2026-09-01T10:00:00Z"));
    const older = await localBackend.createSet({ appId: a.id, name: "Older", doc: defaultDoc() });
    vi.setSystemTime(new Date("2026-09-02T10:00:00Z"));
    const newer = await localBackend.createSet({ appId: a.id, name: "Newer", doc: defaultDoc() });
    localStorage.setItem(LAST_KEY, JSON.stringify("since-deleted"));

    expect((await localBackend.listSets()).map((s) => s.id)).toEqual([older.id, newer.id]);
    expect((await findSetToOpen())?.id).toBe(newer.id);
  });

  it("reads the remembered id from onstage:last-set:v1 with the local backend", async () => {
    const { findSetToOpen, localBackend } = await boot();
    const a = await localBackend.createApp({ name: "Mine" });
    const mine = await localBackend.createSet({ appId: a.id, name: "Mine", doc: defaultDoc() });
    localStorage.setItem(LAST_KEY, JSON.stringify(mine.id));
    expect((await findSetToOpen())?.id).toBe(mine.id);
  });
});

describe("appForNewSet", () => {
  it("uses the app of the set a bare /editor would open", async () => {
    const { appForNewSet, localBackend } = await boot();
    const { backend, createApp } = fakeBackend(localBackend, {
      sets: [set("s1", "a", NEWEST), set("s2", "b", OLDEST)],
      apps: [app("a"), app("b")],
      lastId: "s2",
    });
    expect(await appForNewSet(backend)).toBe("b");
    expect(createApp).not.toHaveBeenCalled();
  });

  it("uses the first app when that set's app isn't listed", async () => {
    const { appForNewSet, localBackend } = await boot();
    const { backend, createApp } = fakeBackend(localBackend, {
      sets: [set("s1", "orphaned-app", NEWEST)],
      apps: [app("a"), app("b")],
      lastId: "s1",
    });
    expect(await appForNewSet(backend)).toBe("a");
    expect(createApp).not.toHaveBeenCalled();
  });

  it("uses the first app when there are no sets", async () => {
    const { appForNewSet, localBackend } = await boot();
    const { backend, createApp } = fakeBackend(localBackend, { sets: [], apps: [app("a"), app("b")] });
    expect(await appForNewSet(backend)).toBe("a");
    expect(createApp).not.toHaveBeenCalled();
  });

  it("creates \"My app\" when there are no apps at all", async () => {
    const { appForNewSet, localBackend } = await boot();
    const { backend, createApp, lib } = fakeBackend(localBackend, { sets: [], apps: [] });
    const id = await appForNewSet(backend);
    expect(createApp).toHaveBeenCalledTimes(1);
    expect(createApp).toHaveBeenCalledWith({ name: "My app" });
    expect(lib.apps.map((a) => a.id)).toEqual([id]);
  });
});

describe("resolveSetToOpen", () => {
  it("returns the set findSetToOpen finds, without creating anything", async () => {
    const { resolveSetToOpen, localBackend } = await boot();
    const { backend, createSet, createApp } = fakeBackend(localBackend, {
      sets: [set("s1", "a", OLDEST), set("s2", "a", NEWEST)],
      apps: [app("a")],
      lastId: "s1",
    });
    expect(await resolveSetToOpen(backend)).toBe("s1");
    expect(createSet).not.toHaveBeenCalled();
    expect(createApp).not.toHaveBeenCalled();
  });

  it("with an empty library creates one set on the default document and returns its id", async () => {
    const { resolveSetToOpen, localBackend } = await boot();
    const { backend, createSet, lib } = fakeBackend(localBackend, { sets: [], apps: [app("a")] });
    const id = await settle(resolveSetToOpen(backend));

    expect(createSet).toHaveBeenCalledTimes(1);
    const input = createSet.mock.calls[0][0];
    expect(input.appId).toBe("a");
    expect(input.doc?.frames).toEqual(defaultDoc().frames);
    expect(input.doc).toEqual(defaultDoc());
    expect(lib.sets.map((s) => s.id)).toEqual([id]);
  });

  it("two concurrent calls on an empty library create one set and agree on its id", async () => {
    const { resolveSetToOpen, localBackend } = await boot();
    const { backend, createSet, lib } = fakeBackend(localBackend, { sets: [], apps: [app("a")] });
    const [x, y] = await settle(Promise.all([resolveSetToOpen(backend), resolveSetToOpen(backend)]));
    expect(x).toBe(y);
    expect(createSet).toHaveBeenCalledTimes(1);
    expect(lib.sets).toHaveLength(1);
  });

  it("a later call looks again: it opens the set the first one created instead of making another", async () => {
    const { resolveSetToOpen, localBackend } = await boot();
    const { backend, createSet } = fakeBackend(localBackend, { sets: [], apps: [app("a")] });
    const first = await settle(resolveSetToOpen(backend));
    const second = await settle(resolveSetToOpen(backend));
    expect(second).toBe(first);
    expect(createSet).toHaveBeenCalledTimes(1);
  });

  it("with no apps either, creates one app and one set in it", async () => {
    const { resolveSetToOpen, localBackend } = await boot();
    const { backend, createSet, createApp, lib } = fakeBackend(localBackend, { sets: [], apps: [] });
    const [x, y] = await settle(Promise.all([resolveSetToOpen(backend), resolveSetToOpen(backend)]));
    expect(x).toBe(y);
    expect(createApp).toHaveBeenCalledTimes(1);
    expect(createSet).toHaveBeenCalledTimes(1);
    expect(createSet.mock.calls[0][0].appId).toBe(lib.apps[0].id);
  });

  it("with the local backend, reopens the remembered set and moves on once it is deleted", async () => {
    const { resolveSetToOpen, localBackend } = await boot();
    const a = await localBackend.createApp({ name: "Mine" });
    const mine = await localBackend.createSet({ appId: a.id, name: "Mine", doc: defaultDoc() });
    await localBackend.rememberLastSet(mine.id);
    expect(await resolveSetToOpen()).toBe(mine.id);

    await localBackend.deleteSet(mine.id);
    const next = await settle(resolveSetToOpen());
    expect(next).not.toBe(mine.id);
    expect((await localBackend.listSets()).map((s) => s.id)).toContain(next);
  });
});

describe("createSetFromTemplate", () => {
  const TPL = TEMPLATES.find((t) => t.slug === "sunbelt")!;

  /** The user's own set: screenshots as image refs, styled unlike the template. */
  const mineDoc: SetDoc = doc(
    [
      frame({ caption: "Plan runs", bg: "ember", tiltX: 6, tiltY: -16, depth: 42, screenshot: "img:abc" }),
      frame({ caption: "Share routes", bg: "moss", tiltY: 15, depth: 38, screenshot: null }),
      frame({ caption: "Log splits", bg: "iris", scale: 1.1, screenshot: "img:def" }),
    ],
    { device: "px9", store: "play", panorama: true },
  );

  /** A library with one app and the user's set in it, remembered as the
   *  last one opened. Created through the backend, the doc seeded as stored. */
  async function seedMine(localBackend: Backend) {
    const a = await localBackend.createApp({ name: "Ridgeline" });
    const mine = await localBackend.createSet({ appId: a.id, name: "Ridgeline — main", doc: mineDoc });
    localStorage.setItem(DOCS_KEY, JSON.stringify({ ...storedDocs(), [mine.id]: mineDoc }));
    localStorage.setItem(LAST_KEY, JSON.stringify(mine.id));
    return { app: a, mine };
  }

  it("never copies an old document's per-set work mode into the new set (S3.2)", async () => {
    const { createSetFromTemplate, localBackend } = await boot();
    const { mine } = await seedMine(localBackend);
    localStorage.setItem(DOCS_KEY, JSON.stringify({ ...storedDocs(), [mine.id]: { ...mineDoc, workMode: "guided" } }));
    const created = await createSetFromTemplate(TPL.slug);
    expect("workMode" in storedDocs()[created.id]).toBe(false);
    // The set it copied keeps its old field (unread).
    expect(storedDocs()[mine.id].workMode).toBe("guided");
  });

  it("with no set to copy, starts a new set on the Default store target", async () => {
    const { createSetFromTemplate, localBackend } = await boot();
    await localBackend.setPrefs({ defaultStore: "play" });
    const { backend, createSet } = fakeBackend(localBackend, { sets: [], apps: [app("a")] });
    await settle(createSetFromTemplate(TPL.slug, backend));
    expect(createSet.mock.calls[0][0].doc?.store).toBe("play");
    expect(createSet.mock.calls[0][0].doc).toEqual(applyTemplateToDoc({ ...defaultDoc(), store: "play" }, TPL.slug));
  });

  it("makes a new set of your screens restyled by the template, in the same app, leaving yours untouched", async () => {
    expect(TPL.bg).not.toBe(mineDoc.frames[0].bg);
    const { createSetFromTemplate, useOnstage, localBackend } = await boot();
    const { app: a, mine } = await seedMine(localBackend);
    const mineBefore = JSON.stringify(storedDocs()[mine.id]);

    const created = await createSetFromTemplate(TPL.slug);

    expect(created.id).not.toBe(mine.id);
    expect(created.appId).toBe(mine.appId);
    expect(created.name).toBe(`Ridgeline — ${TPL.name}`);
    expect(created.name).toBe(`${a.name} — ${TPL.name}`);

    const newDoc = storedDocs()[created.id];
    expect(newDoc).toEqual(applyTemplateToDoc(mineDoc, TPL.slug));
    expect(newDoc.frames.every((f) => f.bg === TPL.bg && f.tiltY === TPL.ty)).toBe(true);
    expect(newDoc.panorama).toBe(TPL.panoramic);
    expect(newDoc.frames.map((f) => f.caption)).toEqual(["Plan runs", "Share routes", "Log splits"]);
    // The same screenshots, shared by reference — not copied, not dropped.
    expect(newDoc.frames.map((f) => f.screenshot)).toEqual(["img:abc", null, "img:def"]);

    // Your set's stored document is byte-for-byte what it was.
    expect(JSON.stringify(storedDocs()[mine.id])).toBe(mineBefore);
    // The library lists the new set, in the same app.
    expect((await localBackend.listSets()).map((s) => s.id)).toContain(created.id);
    expect((await localBackend.listSets(mine.appId)).map((s) => s.id)).toContain(created.id);
    // Nothing was opened in the editor, and the remembered set didn't change.
    expect(useOnstage.getState().loadedSetId).toBeNull();
    expect(JSON.parse(localStorage.getItem(LAST_KEY)!)).toBe(mine.id);
  });

  it("uses the open set as it is now, including an edit the autosave hasn't written yet", async () => {
    const { createSetFromTemplate, openSet, useOnstage, localBackend } = await boot();
    const { mine } = await seedMine(localBackend);
    await openSet(mine.id);
    useOnstage.getState().patchFrame({ caption: "Edited, not saved yet" });
    // No timers advanced: the stored copy still has the old caption.
    expect(storedDocs()[mine.id].frames[0].caption).toBe("Plan runs");

    const created = await createSetFromTemplate(TPL.slug);

    const newDoc = storedDocs()[created.id];
    expect(newDoc.frames.map((f) => f.caption)).toEqual(["Edited, not saved yet", "Share routes", "Log splits"]);
    expect(newDoc.frames.map((f) => f.screenshot)).toEqual(["img:abc", null, "img:def"]);
    expect(newDoc.frames.every((f) => f.bg === TPL.bg)).toBe(true);
    // The open set itself is not restyled or switched.
    const st = useOnstage.getState();
    expect(st.loadedSetId).toBe(mine.id);
    expect(st.frames.map((f) => f.bg)).toEqual(mineDoc.frames.map((f) => f.bg));
    expect(st.frames[0].caption).toBe("Edited, not saved yet");
  });

  it("a template that doesn't exist rejects and creates nothing", async () => {
    const { createSetFromTemplate, localBackend } = await boot();
    const { mine } = await seedMine(localBackend);
    const setsBefore = (await localBackend.listSets()).map((s) => s.id);
    const appsBefore = (await localBackend.listApps()).map((a) => a.id);
    const docsBefore = localStorage.getItem(DOCS_KEY);
    const createSet = vi.spyOn(localBackend, "createSet");
    const createApp = vi.spyOn(localBackend, "createApp");

    await expect(createSetFromTemplate("no-such-template")).rejects.toThrow();

    expect(createSet).not.toHaveBeenCalled();
    expect(createApp).not.toHaveBeenCalled();
    expect((await localBackend.listSets()).map((s) => s.id)).toEqual(setsBefore);
    expect((await localBackend.listApps()).map((a) => a.id)).toEqual(appsBefore);
    expect(localStorage.getItem(DOCS_KEY)).toBe(docsBefore);
    expect(JSON.parse(localStorage.getItem(LAST_KEY)!)).toBe(mine.id);
  });

  it("with an empty library, makes the first set from the default document, in a new app", async () => {
    const { createSetFromTemplate, localBackend } = await boot();
    const { backend, createSet, createApp, lib } = fakeBackend(localBackend, { sets: [], apps: [] });
    const created = await settle(createSetFromTemplate(TPL.slug, backend));
    expect(createApp).toHaveBeenCalledTimes(1);
    expect(createApp).toHaveBeenCalledWith({ name: "My app" });
    expect(createSet).toHaveBeenCalledTimes(1);
    expect(created.appId).toBe(lib.apps[0].id);
    expect(created.name).toBe(`My app — ${TPL.name}`);
    expect(lib.docs[created.id]).toEqual(applyTemplateToDoc(defaultDoc(), TPL.slug));
  });
});

describe("createFirstSet", () => {
  const TPL = TEMPLATES.find((t) => t.slug === "moss")!;

  const lastDoc: SetDoc = doc(
    [frame({ caption: "Somebody else's", bg: "iris", screenshot: "img:zzz" }), frame({ caption: "Second" })],
    { device: "px9", store: "play" },
  );

  it("builds from the default document, not the last set, restyled by the chosen template", async () => {
    const { createFirstSet, localBackend } = await boot();
    const a = await localBackend.createApp({ name: "Trail" });
    const last = await localBackend.createSet({ appId: a.id, name: "Old", doc: lastDoc });
    localStorage.setItem(LAST_KEY, JSON.stringify(last.id));
    const lastBefore = JSON.stringify(storedDocs()[last.id]);

    const created = await createFirstSet({ slug: TPL.slug });

    const expected = applyTemplateToDoc(defaultDoc(), TPL.slug)!;
    const stored = storedDocs()[created.id];
    expect(stored).toEqual(expected);
    // Work mode is a preference now (S3.2): documents don't carry it.
    expect("workMode" in stored).toBe(false);
    expect(stored.frames.every((f) => f.bg === TPL.bg && f.tiltY === TPL.ty)).toBe(true);
    expect(stored.frames.map((f) => f.caption)).toEqual(defaultDoc().frames.map((f) => f.caption));
    expect(stored.frames.every((f) => f.screenshot === null)).toBe(true);
    expect(created.appId).toBe(a.id);
    expect(created.name).toBe(`Trail — ${TPL.name}`);
    expect(JSON.stringify(storedDocs()[last.id])).toBe(lastBefore);
    expect((await localBackend.listSets()).map((s) => s.id)).toContain(created.id);
  });

  it("with no template picked, is the plain default document", async () => {
    const { createFirstSet, localBackend } = await boot();
    const { backend, createSet } = fakeBackend(localBackend, { sets: [], apps: [app("a", "Alpha")] });
    const created = await settle(createFirstSet({}, backend));
    expect(createSet).toHaveBeenCalledTimes(1);
    expect(createSet.mock.calls[0][0].doc).toEqual(defaultDoc());
    expect(created.appId).toBe("a");
    expect(created.name).toBe("Alpha — new set");
  });

  it("starts on the store the Default store target preference names (S3.2)", async () => {
    const { createFirstSet, createBlankSet, localBackend } = await boot();
    await localBackend.setPrefs({ defaultStore: "play" });
    const { backend, createSet } = fakeBackend(localBackend, { sets: [], apps: [app("a")] });
    await settle(createFirstSet({ slug: TPL.slug }, backend));
    await settle(createBlankSet({ appId: "a" }, backend));
    expect(createSet.mock.calls.map((c) => c[0].doc?.store)).toEqual(["play", "play"]);
    // Everything else is the default document.
    expect(createSet.mock.calls[1][0].doc).toEqual({ ...defaultDoc(), store: "play" });
  });

  it("falls back to the default document's store when the preferences can't be read", async () => {
    const { createBlankSet, localBackend } = await boot();
    const { backend, createSet } = fakeBackend(localBackend, { sets: [], apps: [app("a")] });
    vi.spyOn(backend, "getPrefs").mockRejectedValue(new Error("no prefs"));
    await settle(createBlankSet({ appId: "a" }, backend));
    expect(createSet.mock.calls[0][0].doc).toEqual(defaultDoc());
  });

  it("on an empty library, creates \"My app\" and puts the set in it", async () => {
    const { createFirstSet, localBackend } = await boot();
    const { backend, createApp, createSet, lib } = fakeBackend(localBackend, { sets: [], apps: [] });
    const created = await settle(createFirstSet({ slug: TPL.slug }, backend));
    expect(createApp).toHaveBeenCalledWith({ name: "My app" });
    expect(createSet).toHaveBeenCalledTimes(1);
    expect(created.appId).toBe(lib.apps[0].id);
    expect(created.name).toBe(`My app — ${TPL.name}`);
  });

  it("an unknown template rejects and creates nothing", async () => {
    const { createFirstSet, localBackend } = await boot();
    const { backend, createApp, createSet } = fakeBackend(localBackend, { sets: [], apps: [] });
    await expect(createFirstSet({ slug: "no-such-template" }, backend)).rejects.toThrow();
    expect(createApp).not.toHaveBeenCalled();
    expect(createSet).not.toHaveBeenCalled();
  });
});
