import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_APP_TINT } from "@/lib/onstage/appName";
import { defaultDoc } from "@/lib/onstage/docOps";
import { bgCss } from "@/lib/onstage/data";
import { docImageIds, imageIdsInJson } from "../imageRefs";
import { closeImageStore } from "../imageStore";
import { localBackend } from "../local";
import { SET_DOCS_KEY } from "../migrateImages";
import * as sample from "../sample";
import type { App, ScreenshotSet, SetDoc } from "../types";
import { blobBytes, doc, frame, resetImageDb } from "./helpers";
import { seedLibrary, storageSnapshot } from "./library";

/**
 * The library as records (plan S2.2): the sample seeded once as ordinary
 * records, set records that follow their documents, rename, and delete with
 * the screenshot reference check. Real local backend, real (fake) IndexedDB.
 */

const APPS_KEY = "onstage:apps:v1";
const SETS_KEY = "onstage:sets:v1";
const SEEDED_KEY = "onstage:seeded:v1";
const DOCS_KEY = SET_DOCS_KEY;

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

const FULL = "This browser's storage is full.";
const NEEDS_NAME = "A set needs a name.";
const GONE = "That set isn't in this browser any more.";
const IMAGES_LEFT = "The set was deleted, but its screenshots couldn't be removed from this browser's storage.";

const storedApps = (): App[] | null => JSON.parse(localStorage.getItem(APPS_KEY) ?? "null");
const storedSets = (): ScreenshotSet[] | null => JSON.parse(localStorage.getItem(SETS_KEY) ?? "null");
const storedDocs = (): Record<string, unknown> | null => JSON.parse(localStorage.getItem(DOCS_KEY) ?? "null");
const ids = (rows: { id: string }[] | null) => (rows ?? []).map((r) => r.id);

const FIXTURE_APP = sample.APPS.find((a) => a.id === "trailhead")!;
const FIXTURE_SET = sample.SETS.find((x) => x.id === "trailhead-69")!;

/** The seeded sample set's record when no document is saved under its id:
 *  a summary of the default document it opens on. */
function seededDefaultRecord() {
  const d = defaultDoc();
  return {
    id: "trailhead-69",
    appId: "trailhead",
    name: FIXTURE_SET.name,
    frameCount: d.frames.length,
    status: "Draft",
    sub: "App Store · EN",
    store: "apple",
    swatch: bgCss(d.frames[0].bg),
    swatches: d.frames.slice(0, 4).map((f) => bgCss(f.bg)),
    updatedAt: expect.stringMatching(ISO),
  };
}

/** Make localStorage.setItem throw the way a full store does — for every key,
 *  or only for `only`. */
function refuseSetItem(only?: string) {
  const real = Storage.prototype.setItem;
  return vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key: string, value: string) {
    if (only === undefined || key === only) throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
    return real.call(this, key, value);
  });
}

/** Store a small screenshot; its bytes are [n, n+1, n+2]. */
const putShot = (n: number) =>
  localBackend.putImage(new Blob([new Uint8Array([n, n + 1, n + 2])], { type: "image/png" }));

const bytesOf = async (id: string) => {
  const blob = await localBackend.getImage(id);
  return blob ? blobBytes(blob) : null;
};

/** Close connections opened by module graphs booted in a test. */
const freshStores: (() => Promise<void>)[] = [];

/** A fresh backend (and store), as on a page load: module state such as
 *  "the sample couldn't be stored" starts over, localStorage doesn't. */
async function boot() {
  vi.resetModules();
  const { localBackend: backend } = await import("../local");
  const images = await import("../imageStore");
  freshStores.push(images.closeImageStore);
  return backend;
}

async function bootWithStore() {
  vi.resetModules();
  const store = await import("@/store/onstage");
  const { localBackend: backend } = await import("@/lib/data/local");
  const images = await import("@/lib/data/imageStore");
  freshStores.push(images.closeImageStore);
  return { ...store, localBackend: backend };
}

beforeEach(resetImageDb);
afterEach(async () => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  while (freshStores.length) await freshStores.pop()!();
});

/* ── seeding ─────────────────────────────────────────────────────────────── */

describe("seeding the sample as ordinary records (S2.2, plan D2)", () => {
  it("a fresh browser lists exactly the Trailhead app and set — stored as records, marker set, no document written", async () => {
    const backend = await boot();
    expect(Object.keys(localStorage)).toEqual([]);

    const apps = await backend.listApps();
    const sets = await backend.listSets();

    // Exactly the one sample app and set: no ferry / lumen / other fixtures.
    expect(ids(apps)).toEqual(["trailhead"]);
    expect(ids(sets)).toEqual(["trailhead-69"]);
    expect(apps[0]).toMatchObject({
      id: "trailhead",
      name: FIXTURE_APP.name,
      initial: FIXTURE_APP.initial,
      tint: FIXTURE_APP.tint,
      thumbs: FIXTURE_APP.thumbs,
      // The fixture's listing tags describe a store listing this browser doesn't have.
      tags: [],
    });
    expect(sets[0]).toEqual(seededDefaultRecord());

    // What is listed is what is stored.
    expect(storedApps()).toEqual(apps);
    expect(storedSets()).toEqual(sets);
    const marker = JSON.parse(localStorage.getItem(SEEDED_KEY)!);
    expect(marker).toMatch(ISO);

    // Seeding never writes or creates a document.
    expect(localStorage.getItem(DOCS_KEY)).toBeNull();
    expect(Object.keys(localStorage).sort()).toEqual([APPS_KEY, SEEDED_KEY, SETS_KEY].sort());
    expect(await backend.loadSetDoc("trailhead-69")).toBeNull();

    // Filtering by app works on the seeded records.
    expect(ids(await backend.listSets("trailhead"))).toEqual(["trailhead-69"]);
    expect(await backend.listSets("ferry")).toEqual([]);

    // Listing again changes nothing.
    const after = storageSnapshot();
    await backend.listApps();
    await backend.listSets();
    expect(storageSnapshot()).toEqual(after);
  });

  it("attaches a document already saved under trailhead-69: listed, summarised, byte-identical, and opens with its frames", async () => {
    const saved = doc(
      [
        frame({ caption: "Saved one", bg: "moss", screenshot: "img:11111111-aaaa-4aaa-8aaa-111111111111" }),
        frame({ caption: "Saved two", bg: "dusk", screenshot: "img:22222222-bbbb-4bbb-8bbb-222222222222" }),
        frame({ caption: "Saved three", bg: "sun", screenshot: "img:33333333-cccc-4ccc-8ccc-333333333333" }),
      ],
      { store: "play", lang: "DE", device: "pixel" },
    );
    const other = doc([frame({ caption: "Someone else's set", screenshot: "img:44444444-dddd-4ddd-8ddd-444444444444" })]);
    localStorage.setItem(DOCS_KEY, JSON.stringify({ "trailhead-69": saved, "set_other": other }));
    const docsBefore = localStorage.getItem(DOCS_KEY);

    const { localBackend: backend, openSet, useOnstage } = await bootWithStore();
    const sets = await backend.listSets();
    await backend.listApps();

    expect(ids(sets)).toEqual(["trailhead-69"]);
    expect(sets[0]).toEqual({
      id: "trailhead-69",
      appId: "trailhead",
      name: FIXTURE_SET.name,
      frameCount: 3,
      status: "Ready",
      sub: "Google Play · EN",
      store: "play",
      swatch: bgCss("moss"),
      swatches: [bgCss("moss"), bgCss("dusk"), bgCss("sun")],
      updatedAt: expect.stringMatching(ISO),
    });
    expect(storedSets()).toEqual(sets);
    // Seeding only read the documents.
    expect(localStorage.getItem(DOCS_KEY)).toBe(docsBefore);
    expect(await backend.loadSetDoc("trailhead-69")).toEqual(saved);

    // Opening it shows the saved frames, not the default.
    await openSet("trailhead-69");
    const st = useOnstage.getState();
    expect(st.loadedSetId).toBe("trailhead-69");
    expect(st.frames).toEqual(saved.frames);
    expect(st.frames.map((f) => f.caption)).toEqual(["Saved one", "Saved two", "Saved three"]);
    expect(st.store).toBe("play");
    expect(st.device).toBe("pixel");
    expect(st.saveError).toBeNull();
    expect(localStorage.getItem(DOCS_KEY)).toBe(docsBefore);
  });

  it("a damaged document saved under trailhead-69 is left alone and the record describes the default", async () => {
    const damaged = { ...doc([]), frames: [] };
    localStorage.setItem(DOCS_KEY, JSON.stringify({ "trailhead-69": damaged }));
    const docsBefore = localStorage.getItem(DOCS_KEY);
    const backend = await boot();

    expect(await backend.listSets()).toEqual([seededDefaultRecord()]);
    expect(localStorage.getItem(DOCS_KEY)).toBe(docsBefore);
  });

  it("once the sample is deleted, a later page load never seeds it again", async () => {
    const first = await boot();
    expect(ids(await first.listSets())).toEqual(["trailhead-69"]);
    await first.saveSetDoc("trailhead-69", doc([frame({ caption: "Mine now" })]));
    await first.deleteSet("trailhead-69");
    expect(await first.listSets()).toEqual([]);
    const marker = localStorage.getItem(SEEDED_KEY);
    const after = storageSnapshot();

    const second = await boot();
    expect(await second.listSets()).toEqual([]);
    expect(await second.listSets("trailhead")).toEqual([]);
    expect(await second.loadSetDoc("trailhead-69")).toBeNull();
    // Its app stays (only the set was deleted), and still only once.
    expect(ids(await second.listApps())).toEqual(["trailhead"]);
    expect(localStorage.getItem(SEEDED_KEY)).toBe(marker);
    expect(storageSnapshot()).toEqual(after);
  });

  it("seeding again (marker gone, records present) adds nothing twice", async () => {
    const first = await boot();
    await first.listApps();
    const appsRaw = localStorage.getItem(APPS_KEY);
    const setsRaw = localStorage.getItem(SETS_KEY);
    localStorage.removeItem(SEEDED_KEY);

    const second = await boot();
    const apps = await second.listApps();
    const sets = await second.listSets();

    expect(ids(apps)).toEqual(["trailhead"]);
    expect(ids(sets)).toEqual(["trailhead-69"]);
    expect(localStorage.getItem(APPS_KEY)).toBe(appsRaw);
    expect(localStorage.getItem(SETS_KEY)).toBe(setsRaw);
    expect(JSON.parse(localStorage.getItem(SEEDED_KEY)!)).toMatch(ISO);
  });

  it("a retry after a partial seed adds only what is missing", async () => {
    // The app was stored, the set and the marker weren't.
    localStorage.setItem(APPS_KEY, JSON.stringify([{ ...FIXTURE_APP, meta: "kept as it was", tags: [] }]));
    const appsRaw = localStorage.getItem(APPS_KEY);
    const backend = await boot();

    expect(ids(await backend.listApps())).toEqual(["trailhead"]);
    expect(localStorage.getItem(APPS_KEY)).toBe(appsRaw);
    expect(await backend.listSets()).toEqual([seededDefaultRecord()]);
    expect(localStorage.getItem(SEEDED_KEY)).not.toBeNull();
  });

  it("when storage refuses the seed, the lists still resolve with the sample from memory; it is stored once storage recovers", async () => {
    const backend = await boot();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    refuseSetItem();

    const apps = await backend.listApps();
    const sets = await backend.listSets();
    expect(ids(apps)).toEqual(["trailhead"]);
    expect(ids(sets)).toEqual(["trailhead-69"]);
    expect(sets[0]).toEqual(seededDefaultRecord());
    expect(ids(await backend.listSets("trailhead"))).toEqual(["trailhead-69"]);
    expect(Object.keys(localStorage)).toEqual([]);
    expect(warn).toHaveBeenCalled();

    vi.restoreAllMocks();
    expect(ids(await backend.listApps())).toEqual(["trailhead"]);
    expect(ids(await backend.listSets())).toEqual(["trailhead-69"]);
    expect(ids(storedApps())).toEqual(["trailhead"]);
    expect(ids(storedSets())).toEqual(["trailhead-69"]);
    expect(JSON.parse(localStorage.getItem(SEEDED_KEY)!)).toMatch(ISO);
  });

  it("when only the set record can't be stored, the stored app is listed once and the set comes from memory until it can be", async () => {
    const backend = await boot();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    refuseSetItem(SETS_KEY);

    expect(ids(await backend.listApps())).toEqual(["trailhead"]);
    expect(ids(await backend.listSets())).toEqual(["trailhead-69"]);
    expect(ids(storedApps())).toEqual(["trailhead"]);
    expect(localStorage.getItem(SETS_KEY)).toBeNull();
    expect(localStorage.getItem(SEEDED_KEY)).toBeNull();

    vi.restoreAllMocks();
    expect(ids(await backend.listSets())).toEqual(["trailhead-69"]);
    expect(ids(await backend.listApps())).toEqual(["trailhead"]);
    expect(ids(storedSets())).toEqual(["trailhead-69"]);
    expect(ids(storedApps())).toEqual(["trailhead"]);
    expect(localStorage.getItem(SEEDED_KEY)).not.toBeNull();
  });

  it("deleting the sample while its seed couldn't be stored settles seeding: it is not seeded again or shown from memory", async () => {
    // A document from before sets were real, then a seed that couldn't be
    // stored (storage near full): the sample is listed from memory.
    localStorage.setItem(DOCS_KEY, JSON.stringify({ "trailhead-69": doc([frame({ caption: "Old" })]) }));
    const backend = await boot();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    refuseSetItem(SETS_KEY);
    expect(ids(await backend.listSets())).toEqual(["trailhead-69"]);
    expect(localStorage.getItem(SEEDED_KEY)).toBeNull();

    // The user deletes it, which frees room; storage now accepts writes.
    vi.restoreAllMocks();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await backend.deleteSet("trailhead-69");

    expect(ids(await backend.listSets())).toEqual([]);
    expect(localStorage.getItem(SEEDED_KEY)).not.toBeNull();
    expect(JSON.parse(localStorage.getItem(DOCS_KEY) ?? "{}")).toEqual({});
    // …and on the next page load too.
    const again = await boot();
    expect(ids(await again.listSets())).toEqual([]);
  });

  it("deleting the in-memory sample with nothing stored for it still takes it off the list", async () => {
    const backend = await boot();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    refuseSetItem(SETS_KEY);
    expect(ids(await backend.listSets())).toEqual(["trailhead-69"]);
    vi.restoreAllMocks();
    // No record and no document: before, this was a no-op and the sample
    // stayed listed from memory for good.
    refuseSetItem(SETS_KEY);
    await backend.deleteSet("trailhead-69");
    expect(ids(await backend.listSets())).toEqual([]);
  });

  it("renaming or duplicating the sample while it is only in memory names the storage problem", async () => {
    const backend = await boot();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    refuseSetItem(SETS_KEY);
    expect(ids(await backend.listSets())).toEqual(["trailhead-69"]);
    const why = "This browser's storage is full or blocked, so the sample set couldn't be stored.";
    await expect(backend.renameSet("trailhead-69", "Mine")).rejects.toThrow(why);
    await expect(backend.duplicateSet("trailhead-69")).rejects.toThrow(why);
    // Any other missing set is simply gone.
    await expect(backend.renameSet("set_gone", "Mine")).rejects.toThrow("That set isn't in this browser any more.");
  });

  it("when storage is blocked outright (reads throw too), the lists resolve with the sample", async () => {
    const backend = await boot();
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    expect(ids(await backend.listApps())).toEqual(["trailhead"]);
    expect(ids(await backend.listSets())).toEqual(["trailhead-69"]);
  });

  it("an unreadable stored library isn't written over by the seed", async () => {
    localStorage.setItem(APPS_KEY, "[{broken");
    const backend = await boot();
    vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(ids(await backend.listApps())).toEqual(["trailhead"]);
    expect(localStorage.getItem(APPS_KEY)).toBe("[{broken");
    expect(localStorage.getItem(SETS_KEY)).toBeNull();
    expect(localStorage.getItem(SEEDED_KEY)).toBeNull();
  });

  it("the user's own stored app and set survive seeding, listed after the sample", async () => {
    const userApp: App = {
      id: "app_user",
      name: "Pocket",
      initial: "P",
      meta: "0 SETS · DRAFT",
      tint: "#5d5294",
      thumbs: [],
      tags: [{ label: "Draft", kind: "neutral" }],
    };
    const userSet: ScreenshotSet = {
      id: "set_user",
      appId: "app_user",
      name: "Pocket — launch",
      sub: "App Store · EN",
      frameCount: 2,
      status: "Draft",
      updatedAt: "2026-09-01T08:00:00.000Z",
      swatch: bgCss("sun"),
    };
    localStorage.setItem(APPS_KEY, JSON.stringify([userApp]));
    localStorage.setItem(SETS_KEY, JSON.stringify([userSet]));
    const backend = await boot();

    const apps = await backend.listApps();
    const sets = await backend.listSets();
    expect(ids(apps)).toEqual(["trailhead", "app_user"]);
    expect(ids(sets)).toEqual(["trailhead-69", "set_user"]);
    expect(apps[1]).toEqual(userApp);
    expect(sets[1]).toEqual(userSet);
    expect(storedApps()).toEqual(apps);
    expect(storedSets()).toEqual(sets);
    expect(ids(await backend.listSets("app_user"))).toEqual(["set_user"]);
  });
});

/* ── records follow their documents ──────────────────────────────────────── */

describe("app records", () => {
  it("a new app gets its initial and the default tint the store previews fall back to (S3.4)", async () => {
    seedLibrary();
    const app = await localBackend.createApp({ name: "harbour" });
    expect(app).toMatchObject({ name: "harbour", initial: "H", tint: DEFAULT_APP_TINT });
    expect((await localBackend.listApps()).find((a) => a.id === app.id)?.tint).toBe(DEFAULT_APP_TINT);
  });
});

describe("set records (S2.2, GAP-10)", () => {
  it("createSet summarises its document; each saveSetDoc updates the record's summary and time", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-26T10:00:00.000Z"));
    const library = seedLibrary();

    const created = await localBackend.createSet({
      appId: "trailhead",
      name: "Autumn",
      doc: doc([frame({ bg: "dusk", screenshot: "img:a1" }), frame({ bg: "moss" })]),
    });
    expect(created).toEqual({
      id: expect.stringMatching(/^set_/),
      appId: "trailhead",
      name: "Autumn",
      frameCount: 2,
      status: "Draft",
      sub: "App Store · EN",
      store: "apple",
      swatch: bgCss("dusk"),
      swatches: [bgCss("dusk"), bgCss("moss")],
      updatedAt: "2026-09-26T10:00:00.000Z",
    });
    expect(storedSets()).toEqual([...library.sets, created]);

    vi.setSystemTime(new Date("2026-09-26T11:30:00.000Z"));
    const next = doc(
      ["moss", "sun", "iris", "ember"].map((bg, i) => frame({ bg, caption: `F${i}`, screenshot: `img:s${i}` })),
      { store: "play" },
    );
    await localBackend.saveSetDoc(created.id, next);

    const listed = (await localBackend.listSets()).find((x) => x.id === created.id)!;
    expect(listed).toEqual({
      ...created,
      frameCount: 4,
      status: "Ready",
      sub: "Google Play · EN",
      store: "play",
      swatch: bgCss(next.frames[0].bg),
      swatches: next.frames.map((f) => bgCss(f.bg)),
      updatedAt: "2026-09-26T11:30:00.000Z",
    });
    expect(listed.updatedAt > created.updatedAt).toBe(true);
    // Only that record changed.
    expect(storedSets()).toEqual([...library.sets, listed]);
    expect(await localBackend.loadSetDoc(created.id)).toEqual(next);
  });

  it("createSet with no document describes the default document it opens on, and stores no document", async () => {
    seedLibrary();
    const created = await localBackend.createSet({ appId: "ferry", name: "Blank" });
    const d = defaultDoc();
    expect(created).toMatchObject({
      appId: "ferry",
      name: "Blank",
      frameCount: d.frames.length,
      status: "Draft",
      sub: "App Store · EN",
      store: "apple",
      swatch: bgCss(d.frames[0].bg),
    });
    expect(created.updatedAt).toMatch(ISO);
    expect(localStorage.getItem(DOCS_KEY)).toBeNull();
  });

  it("saveSetDoc updates a seeded record (no document yet) from the saved document", async () => {
    const library = seedLibrary();
    await localBackend.saveSetDoc("ferry-69", doc([frame({ bg: "bone" })], { lang: "FR" }));
    const record = storedSets()!.find((x) => x.id === "ferry-69")!;
    const fixture = library.sets.find((x) => x.id === "ferry-69")!;
    expect(record).toEqual({
      ...fixture,
      frameCount: 1,
      status: "Draft",
      sub: "App Store · EN",
      store: "apple",
      swatch: bgCss("bone"),
      swatches: [bgCss("bone")],
      updatedAt: expect.stringMatching(ISO),
    });
  });

  it("saveSetDoc for a set with no record writes only its document", async () => {
    seedLibrary();
    const setsBefore = localStorage.getItem(SETS_KEY);
    const appsBefore = localStorage.getItem(APPS_KEY);
    const d = doc([frame({ caption: "From before sets were real" })]);

    await localBackend.saveSetDoc("legacy-doc", d);

    expect(localStorage.getItem(SETS_KEY)).toBe(setsBefore);
    expect(localStorage.getItem(APPS_KEY)).toBe(appsBefore);
    expect(storedDocs()).toEqual({ "legacy-doc": d });
    expect(ids(await localBackend.listSets())).not.toContain("legacy-doc");
  });

  it("when the documents can't be written, saveSetDoc rejects and the record and documents are byte-identical", async () => {
    seedLibrary();
    const created = await localBackend.createSet({
      appId: "trailhead",
      name: "Kept",
      doc: doc([frame({ caption: "Stored" })]),
    });
    const before = storageSnapshot();
    const setItem = refuseSetItem(DOCS_KEY);

    await expect(
      localBackend.saveSetDoc(created.id, doc([frame(), frame(), frame()], { store: "play" })),
    ).rejects.toThrow(FULL);

    // The record was written first and then put back.
    expect(setItem.mock.calls.map(([key]) => key)).toContain(SETS_KEY);
    vi.restoreAllMocks();
    expect(storageSnapshot()).toEqual(before);
    expect((await localBackend.listSets()).find((x) => x.id === created.id)).toEqual(created);
  });

  it("…including when no documents were stored yet", async () => {
    seedLibrary();
    const before = storageSnapshot();
    refuseSetItem(DOCS_KEY);

    await expect(localBackend.saveSetDoc("trailhead-69", doc([frame()]))).rejects.toThrow(FULL);

    vi.restoreAllMocks();
    expect(storageSnapshot()).toEqual(before);
    expect(localStorage.getItem(DOCS_KEY)).toBeNull();
  });

  it("renameSet trims the name and changes only that record's name", async () => {
    const library = seedLibrary();
    await localBackend.renameSet("ferry-69", "   Ferry — spring   ");

    const fixture = library.sets.find((x) => x.id === "ferry-69")!;
    expect(storedSets()).toEqual(library.sets.map((x) => (x.id === "ferry-69" ? { ...fixture, name: "Ferry — spring" } : x)));
    expect((await localBackend.listSets()).find((x) => x.id === "ferry-69")!.name).toBe("Ferry — spring");
  });

  it("renameSet rejects a blank name and an unknown set, leaving storage unchanged", async () => {
    seedLibrary();
    localStorage.setItem(DOCS_KEY, JSON.stringify({ "doc-only": doc([frame()]) }));
    const before = storageSnapshot();

    for (const blank of ["", "   ", "\n\t "]) {
      await expect(localBackend.renameSet("ferry-69", blank)).rejects.toThrow(NEEDS_NAME);
    }
    await expect(localBackend.renameSet("no-such-set", "Anything")).rejects.toThrow(GONE);
    // A document without a record isn't a set in the library.
    await expect(localBackend.renameSet("doc-only", "Anything")).rejects.toThrow(GONE);

    expect(storageSnapshot()).toEqual(before);
  });
});

/* ── delete ───────────────────────────────────────────────────────────────── */

describe("deleteSet — record, document and unshared screenshots (S2.2, GAP-11)", () => {
  it("removes the record, the document and its own screenshots, but keeps one another stored document uses", async () => {
    const library = seedLibrary();
    const [own, shared, otherOwn] = [await putShot(10), await putShot(20), await putShot(30)];
    const x = await localBackend.createSet({
      appId: "trailhead",
      name: "X",
      doc: doc([frame({ screenshot: `img:${own}` }), frame({ screenshot: `img:${shared}` })]),
    });
    const y = await localBackend.createSet({
      appId: "trailhead",
      name: "Y (a duplicate of X)",
      doc: doc([frame({ screenshot: `img:${shared}` }), frame({ screenshot: `img:${otherOwn}` })]),
    });
    const yDoc = JSON.stringify(storedDocs()![y.id]);

    await localBackend.deleteSet(x.id);

    expect(ids(storedSets())).toEqual([...ids(library.sets), y.id]);
    expect(Object.keys(storedDocs()!)).toEqual([y.id]);
    expect(JSON.stringify(storedDocs()![y.id])).toBe(yDoc);
    expect(await localBackend.loadSetDoc(x.id)).toBeNull();
    expect(ids(await localBackend.listSets())).not.toContain(x.id);

    expect(await localBackend.getImage(own)).toBeNull();
    expect(await bytesOf(shared)).toEqual([20, 21, 22]);
    expect(await bytesOf(otherOwn)).toEqual([30, 31, 32]);
  });

  it("keeps a screenshot named in keepImages (e.g. the open set's undo history)", async () => {
    seedLibrary();
    const [held, loose] = [await putShot(1), await putShot(2)];
    const x = await localBackend.createSet({
      appId: "trailhead",
      name: "X",
      doc: doc([frame({ screenshot: `img:${held}` }), frame({ screenshot: `img:${loose}` })]),
    });

    await localBackend.deleteSet(x.id, { keepImages: [held, "not-referenced-anywhere"] });

    expect(await bytesOf(held)).toEqual([1, 2, 3]);
    expect(await localBackend.getImage(loose)).toBeNull();
    expect(ids(storedSets())).not.toContain(x.id);
  });

  it("keeps a screenshot another document mentions in any shape — damaged frames, an unknown field", async () => {
    seedLibrary();
    const [inDamaged, inUnknownField, onlyMine] = [await putShot(3), await putShot(4), await putShot(5)];
    const x = await localBackend.createSet({
      appId: "trailhead",
      name: "X",
      doc: doc([
        frame({ screenshot: `img:${inDamaged}` }),
        frame({ screenshot: `img:${inUnknownField}` }),
        frame({ screenshot: `img:${onlyMine}` }),
      ]),
    });
    const damaged = { frames: { "0": { screenshot: `img:${inDamaged}` } } };
    const future = { ...doc([frame()]), tabletShots: [{ ref: `img:${inUnknownField}` }] };
    localStorage.setItem(DOCS_KEY, JSON.stringify({ ...storedDocs(), damaged, future }));

    await localBackend.deleteSet(x.id);

    expect(await bytesOf(inDamaged)).toEqual([3, 4, 5]);
    expect(await bytesOf(inUnknownField)).toEqual([4, 5, 6]);
    expect(await localBackend.getImage(onlyMine)).toBeNull();
    expect(storedDocs()).toEqual({ damaged, future });
  });

  for (const [label, damagedDoc] of [
    ["frames is an object", (id: string) => ({ frames: { "0": { screenshot: `img:${id}` } } })],
    ["frames is a string", (id: string) => ({ frames: `img:${id}` })],
    ["the document is null", () => null],
  ] as const) {
    it(`a damaged document being deleted (${label}) goes with its record, deleting no screenshots`, async () => {
      const shot = await putShot(7);
      const record: ScreenshotSet = { ...FIXTURE_SET, id: "D", name: "Damaged" };
      seedLibrary({ sets: [record] });
      const keep = doc([frame({ caption: "Other" })]);
      localStorage.setItem(DOCS_KEY, JSON.stringify({ D: damagedDoc(shot), other: keep }));

      await expect(localBackend.deleteSet("D")).resolves.toBeUndefined();

      expect(storedSets()).toEqual([]);
      expect(storedDocs()).toEqual({ other: keep });
      expect(await bytesOf(shot)).toEqual([7, 8, 9]);
    });
  }

  it("when the document can't be removed, deleteSet rejects and the record, document and screenshots are exactly as before", async () => {
    seedLibrary();
    const shot = await putShot(40);
    const x = await localBackend.createSet({
      appId: "trailhead",
      name: "X",
      doc: doc([frame({ screenshot: `img:${shot}` })]),
    });
    const before = storageSnapshot();
    refuseSetItem(DOCS_KEY);

    await expect(localBackend.deleteSet(x.id)).rejects.toThrow(FULL);

    vi.restoreAllMocks();
    expect(storageSnapshot()).toEqual(before);
    expect(ids(await localBackend.listSets())).toContain(x.id);
    expect(await bytesOf(shot)).toEqual([40, 41, 42]);
  });

  it("when the record can't be removed, deleteSet rejects before touching the document or screenshots", async () => {
    seedLibrary();
    const shot = await putShot(50);
    const x = await localBackend.createSet({
      appId: "trailhead",
      name: "X",
      doc: doc([frame({ screenshot: `img:${shot}` })]),
    });
    const before = storageSnapshot();
    refuseSetItem(SETS_KEY);

    await expect(localBackend.deleteSet(x.id)).rejects.toThrow(FULL);

    vi.restoreAllMocks();
    expect(storageSnapshot()).toEqual(before);
    expect(await bytesOf(shot)).toEqual([50, 51, 52]);
  });

  it("when the screenshots can't be removed, it says so — the record and document are already gone", async () => {
    seedLibrary();
    const shot = await putShot(60);
    const x = await localBackend.createSet({
      appId: "trailhead",
      name: "X",
      doc: doc([frame({ screenshot: `img:${shot}` })]),
    });

    await closeImageStore();
    const real = globalThis.indexedDB;
    // @ts-expect-error — IndexedDB goes away between the document and the screenshots
    delete globalThis.indexedDB;
    try {
      await expect(localBackend.deleteSet(x.id)).rejects.toThrow(IMAGES_LEFT);
    } finally {
      globalThis.indexedDB = real;
    }

    expect(ids(storedSets())).not.toContain(x.id);
    expect(storedDocs()).toEqual({});
    expect(await bytesOf(shot)).toEqual([60, 61, 62]); // left behind, not lost
  });

  it("won't delete anything when the stored documents are unreadable", async () => {
    seedLibrary();
    localStorage.setItem(DOCS_KEY, "{broken");
    const before = storageSnapshot();

    await expect(localBackend.deleteSet("ferry-69")).rejects.toThrow(/unreadable/);
    expect(storageSnapshot()).toEqual(before);
  });

  it("deleting a set that doesn't exist resolves and writes nothing", async () => {
    seedLibrary();
    localStorage.setItem(DOCS_KEY, JSON.stringify({ "ferry-69": doc([frame()]) }));
    const before = storageSnapshot();
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const removeItem = vi.spyOn(Storage.prototype, "removeItem");

    await expect(localBackend.deleteSet("no-such-set")).resolves.toBeUndefined();

    expect(setItem).not.toHaveBeenCalled();
    expect(removeItem).not.toHaveBeenCalled();
    expect(storageSnapshot()).toEqual(before);
  });

  it("a document with no record (from before sets were real) is deleted with its screenshots", async () => {
    seedLibrary();
    const shot = await putShot(70);
    localStorage.setItem(DOCS_KEY, JSON.stringify({ legacy: doc([frame({ screenshot: `img:${shot}` })]) }));
    const setsBefore = localStorage.getItem(SETS_KEY);

    await localBackend.deleteSet("legacy");

    expect(localStorage.getItem(SETS_KEY)).toBe(setsBefore);
    expect(storedDocs()).toEqual({});
    expect(await localBackend.getImage(shot)).toBeNull();
  });

  it("deleting twice (one after the other, or both at once) is safe", async () => {
    const library = seedLibrary();
    const [own, shared] = [await putShot(80), await putShot(90)];
    const mk = (name: string, refs: string[]) =>
      localBackend.createSet({
        appId: "trailhead",
        name,
        doc: doc(refs.map((id) => frame({ screenshot: `img:${id}` }))),
      });
    const x = await mk("X", [own, shared]);
    const y = await mk("Y", [shared]);

    await localBackend.deleteSet(x.id);
    const after = storageSnapshot();
    await expect(localBackend.deleteSet(x.id)).resolves.toBeUndefined();
    expect(storageSnapshot()).toEqual(after);
    expect(await localBackend.getImage(own)).toBeNull();
    expect(await bytesOf(shared)).toEqual([90, 91, 92]);

    await Promise.all([localBackend.deleteSet(y.id), localBackend.deleteSet(y.id)]);
    expect(ids(storedSets())).toEqual(ids(library.sets));
    expect(storedDocs()).toEqual({});
    expect(await localBackend.getImage(shared)).toBeNull();
    // No duplicate records were left or created along the way.
    const listed = ids(await localBackend.listSets());
    expect(new Set(listed).size).toBe(listed.length);
  });
});

/* ── the reference scan deleteSet relies on ──────────────────────────────── */

describe("image reference scan (imageRefs)", () => {
  it("docImageIds reads only string img: refs in the screenshot field of each frame", () => {
    const d = {
      frames: [
        frame({ screenshot: "img:ok" }),
        frame({ screenshot: 42 as unknown as string }),
        frame({ screenshot: { id: "obj" } as unknown as string }),
        frame({ screenshot: ["img:in-array"] as unknown as string }),
        frame({ screenshot: "img:" }),
        frame({ screenshot: "data:image/png;base64,AAAA" }),
        null,
        undefined,
        "img:bare-string-frame",
        frame({ screenshot: "img:ok" }),
        frame({ screenshot: "img:second" }),
      ],
    } as unknown as SetDoc;
    expect([...docImageIds(d)].sort()).toEqual(["ok", "second"]);
  });

  it("docImageIds finds nothing in a damaged document instead of throwing", () => {
    for (const damaged of [
      { frames: { "0": { screenshot: "img:a" } } },
      { frames: "img:a" },
      { frames: null },
      {},
      null,
      undefined,
    ]) {
      expect(docImageIds(damaged as unknown as SetDoc).size).toBe(0);
    }
  });

  it("imageIdsInJson finds every img: value anywhere, in any shape, once each", () => {
    const json = JSON.stringify({
      a: { frames: [{ screenshot: "img:one" }, { screenshot: "img:one" }] },
      b: { frames: { "0": { screenshot: "img:two" } } },
      c: { later: { tablet: ["img:three"] } },
      d: { frames: [{ screenshot: "data:image/png;base64,AAAA", caption: "see img:not-a-ref" }] },
      e: { frames: [{ screenshot: "img:" }] },
    });
    expect([...imageIdsInJson(json)].sort()).toEqual(["one", "three", "two"]);
    expect(imageIdsInJson("{}").size).toBe(0);
    expect(imageIdsInJson("{not json").size).toBe(0);
    // A damaged, even truncated, value still yields the refs it mentions.
    expect([...imageIdsInJson('{"x":{"frames":"img:four", "y": "img:five", "z": "img:tr')].sort()).toEqual([
      "five",
      "four",
    ]);
  });
});
