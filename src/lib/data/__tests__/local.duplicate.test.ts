import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { docImageIds } from "../imageRefs";
import { localBackend } from "../local";
import { SET_DOCS_KEY } from "../migrateImages";
import type { App, ScreenshotSet, SetDoc } from "../types";
import { blobBytes, doc, frame, resetImageDb } from "./helpers";
import { seedLibrary, storageSnapshot } from "./library";

/**
 * Duplicate on the project board (plan S2.3): a new record in the same app,
 * "<name> copy", its document copied as stored — sharing the original's
 * screenshots, which deleteSet keeps while any document still uses them.
 * Real local backend, real (fake) IndexedDB.
 */

const SETS_KEY = "onstage:sets:v1";
const DOCS_KEY = SET_DOCS_KEY;

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const SET_ID = /^set_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const FULL = "This browser's storage is full.";
const GONE = "That set isn't in this browser any more.";

const storedSets = (): ScreenshotSet[] | null => JSON.parse(localStorage.getItem(SETS_KEY) ?? "null");
const storedDocs = (): Record<string, unknown> | null => JSON.parse(localStorage.getItem(DOCS_KEY) ?? "null");
const ids = (rows: { id: string }[] | null) => (rows ?? []).map((r) => r.id);

const APP: App = {
  id: "app_pocket",
  name: "Pocket",
  initial: "P",
  meta: "2 SETS",
  tint: "#5d5294",
  thumbs: [],
  tags: [],
};
const OTHER_APP: App = { ...APP, id: "app_other", name: "Other", initial: "O" };

const LAUNCH: ScreenshotSet = {
  id: "set_launch",
  appId: APP.id,
  name: "Pocket — launch",
  sub: "App Store · EN",
  frameCount: 3,
  status: "Draft",
  updatedAt: "2026-09-01T08:00:00.000Z",
  swatch: "linear-gradient(1)",
  store: "apple",
  swatches: ["linear-gradient(1)", "linear-gradient(2)", "linear-gradient(3)"],
};
const SIBLING: ScreenshotSet = { ...LAUNCH, id: "set_sibling", name: "Pocket — sibling" };
const ELSEWHERE: ScreenshotSet = { ...LAUNCH, id: "set_elsewhere", appId: OTHER_APP.id, name: "Other — set" };

function seed() {
  return seedLibrary({ apps: [APP, OTHER_APP], sets: [LAUNCH, SIBLING, ELSEWHERE] });
}

/** Make localStorage.setItem throw the way a full store does, only for `only`. */
function refuseSetItem(only: string) {
  const real = Storage.prototype.setItem;
  return vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key: string, value: string) {
    if (key === only) throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
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

/** A saved document that uses two stored screenshots (plus a frame without one). */
async function savedWithTwoShots(setId = LAUNCH.id) {
  const [a, b] = [await putShot(10), await putShot(20)];
  const saved = doc(
    [
      frame({ caption: "First", bg: "moss", screenshot: `img:${a}` }),
      frame({ caption: "Second", bg: "dusk", screenshot: `img:${b}` }),
      frame({ caption: "Third", bg: "sun" }),
    ],
    { store: "play", lang: "DE" },
  );
  await localBackend.saveSetDoc(setId, saved);
  return { a, b, saved };
}

beforeEach(resetImageDb);
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("duplicateSet shares screenshots with its original (S2.3 — the plan's required test)", () => {
  it("deleting the original keeps both screenshots for the copy; deleting the copy then removes them", async () => {
    seed();
    const { a, b, saved } = await savedWithTwoShots();

    const copy = await localBackend.duplicateSet(LAUNCH.id);
    // The copy's document points at the very same screenshots — no new images.
    const copyDoc = await localBackend.loadSetDoc(copy.id);
    expect(copyDoc).toEqual(saved);
    expect([...docImageIds(copyDoc)].sort()).toEqual([a, b].sort());

    await localBackend.deleteSet(LAUNCH.id);

    // The original is gone…
    expect(await localBackend.loadSetDoc(LAUNCH.id)).toBeNull();
    expect(ids(await localBackend.listSets())).not.toContain(LAUNCH.id);
    expect(Object.keys(storedDocs()!)).toEqual([copy.id]);
    // …its screenshots are not: the copy still uses them, bytes intact.
    expect(await bytesOf(a)).toEqual([10, 11, 12]);
    expect(await bytesOf(b)).toEqual([20, 21, 22]);
    const after = await localBackend.loadSetDoc(copy.id);
    expect(after).toEqual(saved);
    expect([...docImageIds(after)].sort()).toEqual([a, b].sort());
    expect(ids(await localBackend.listSets(APP.id))).toEqual([SIBLING.id, copy.id]);

    await localBackend.deleteSet(copy.id);

    // Nothing references them any more, so they go with the last set using them.
    expect(await localBackend.getImage(a)).toBeNull();
    expect(await localBackend.getImage(b)).toBeNull();
    expect(storedDocs()).toEqual({});
    expect(ids(await localBackend.listSets(APP.id))).toEqual([SIBLING.id]);
  });

  it("deleting the copy first keeps the original's screenshots too", async () => {
    seed();
    const { a, b, saved } = await savedWithTwoShots();
    const copy = await localBackend.duplicateSet(LAUNCH.id);

    await localBackend.deleteSet(copy.id);

    expect(await bytesOf(a)).toEqual([10, 11, 12]);
    expect(await bytesOf(b)).toEqual([20, 21, 22]);
    expect(await localBackend.loadSetDoc(LAUNCH.id)).toEqual(saved);
    expect(ids(await localBackend.listSets(APP.id))).toEqual([LAUNCH.id, SIBLING.id]);
  });
});

describe("duplicateSet — the copy's record and document", () => {
  it("is a new record in the same app named \"<name> copy\" with a new ISO time; other summary fields are copied", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-26T10:00:00.000Z"));
    seed();
    await savedWithTwoShots();
    const sourceRecord = storedSets()!.find((x) => x.id === LAUNCH.id)!;
    expect(sourceRecord.updatedAt).toBe("2026-09-26T10:00:00.000Z");

    vi.setSystemTime(new Date("2026-09-26T11:30:00.000Z"));
    const copy = await localBackend.duplicateSet(LAUNCH.id);

    expect(copy.id).toMatch(SET_ID);
    expect(copy.id).not.toBe(LAUNCH.id);
    expect(copy).toEqual({
      ...sourceRecord,
      id: copy.id,
      name: "Pocket — launch copy",
      updatedAt: "2026-09-26T11:30:00.000Z",
    });
    expect(copy.updatedAt).toMatch(ISO);
    expect(copy.appId).toBe(APP.id);
    // The summary the save wrote is carried over as it was.
    expect(copy).toMatchObject({
      frameCount: 3,
      status: "Draft",
      sub: "Google Play · EN",
      store: "play",
      swatch: sourceRecord.swatch,
      swatches: sourceRecord.swatches,
    });

    // Stored after the others; the source record is untouched.
    const sets = storedSets()!;
    expect(ids(sets)).toEqual([LAUNCH.id, SIBLING.id, ELSEWHERE.id, copy.id]);
    expect(sets[3]).toEqual(copy);
    expect(sets[0]).toEqual(sourceRecord);

    // Listed in its app, not in another.
    expect(ids(await localBackend.listSets(APP.id))).toEqual([LAUNCH.id, SIBLING.id, copy.id]);
    expect(ids(await localBackend.listSets(OTHER_APP.id))).toEqual([ELSEWHERE.id]);
    expect((await localBackend.listSets()).find((x) => x.id === copy.id)).toEqual(copy);
  });

  it("the copy's document deep-equals the source's, stored byte-for-byte the same, and the source is unchanged", async () => {
    seed();
    const { saved } = await savedWithTwoShots();
    const sourceJson = JSON.stringify(storedDocs()![LAUNCH.id]);
    const sourceRecord = storedSets()!.find((x) => x.id === LAUNCH.id);

    const copy = await localBackend.duplicateSet(LAUNCH.id);

    const docs = storedDocs()!;
    expect(Object.keys(docs).sort()).toEqual([LAUNCH.id, copy.id].sort());
    expect(JSON.stringify(docs[copy.id])).toBe(sourceJson);
    expect(JSON.stringify(docs[LAUNCH.id])).toBe(sourceJson);
    expect(await localBackend.loadSetDoc(copy.id)).toEqual(saved);
    expect(await localBackend.loadSetDoc(LAUNCH.id)).toEqual(saved);
    expect(storedSets()!.find((x) => x.id === LAUNCH.id)).toEqual(sourceRecord);
  });

  it("copies a document field it doesn't know, as stored", async () => {
    seed();
    const future = { ...doc([frame({ caption: "Hi" })]), tabletShots: [{ ref: "img:future-1" }] };
    localStorage.setItem(DOCS_KEY, JSON.stringify({ [LAUNCH.id]: future }));

    const copy = await localBackend.duplicateSet(LAUNCH.id);

    expect(storedDocs()![copy.id]).toEqual(future);
    expect(storedDocs()![LAUNCH.id]).toEqual(future);
  });

  it("a set with no stored document duplicates to a record with no document", async () => {
    seed();
    const other: SetDoc = doc([frame({ caption: "Sibling's" })]);
    await localBackend.saveSetDoc(SIBLING.id, other);
    const docsBefore = localStorage.getItem(DOCS_KEY);

    const copy = await localBackend.duplicateSet(LAUNCH.id);

    expect(copy).toEqual({ ...LAUNCH, id: copy.id, name: "Pocket — launch copy", updatedAt: expect.stringMatching(ISO) });
    expect(ids(storedSets())).toEqual([LAUNCH.id, SIBLING.id, ELSEWHERE.id, copy.id]);
    expect(await localBackend.loadSetDoc(copy.id)).toBeNull();
    expect(await localBackend.loadSetDoc(LAUNCH.id)).toBeNull();
    // The documents weren't touched at all.
    expect(localStorage.getItem(DOCS_KEY)).toBe(docsBefore);
    expect(Object.keys(storedDocs()!)).toEqual([SIBLING.id]);
  });

  it("with no documents stored anywhere, the documents key isn't created", async () => {
    seed();
    const copy = await localBackend.duplicateSet(LAUNCH.id);
    expect(localStorage.getItem(DOCS_KEY)).toBeNull();
    expect(ids(storedSets())).toContain(copy.id);
  });

  it("each duplicate is its own set: distinct ids, and a copy of a copy is \"… copy copy\"", async () => {
    seed();
    await savedWithTwoShots();
    const first = await localBackend.duplicateSet(LAUNCH.id);
    const second = await localBackend.duplicateSet(LAUNCH.id);
    const nested = await localBackend.duplicateSet(first.id);

    expect(new Set([LAUNCH.id, first.id, second.id, nested.id]).size).toBe(4);
    expect(first.name).toBe("Pocket — launch copy");
    expect(second.name).toBe("Pocket — launch copy");
    expect(nested.name).toBe("Pocket — launch copy copy");
    expect(nested.appId).toBe(APP.id);
    expect(ids(await localBackend.listSets(APP.id))).toEqual([LAUNCH.id, SIBLING.id, first.id, second.id, nested.id]);
    expect(Object.keys(storedDocs()!).sort()).toEqual([LAUNCH.id, first.id, second.id, nested.id].sort());
  });
});

describe("duplicateSet — failures change nothing", () => {
  it("if the record can't be written, it rejects and storage is exactly as before (documents restored byte-for-byte)", async () => {
    seed();
    const { a, b, saved } = await savedWithTwoShots();
    // Formatted differently from what writeDocs produces, so a rewrite
    // (rather than a restore) would show.
    localStorage.setItem(DOCS_KEY, JSON.stringify({ [LAUNCH.id]: saved }, null, 2));
    const before = storageSnapshot();
    refuseSetItem(SETS_KEY);

    await expect(localBackend.duplicateSet(LAUNCH.id)).rejects.toThrow(FULL);

    vi.restoreAllMocks();
    expect(storageSnapshot()).toEqual(before);
    expect(ids(await localBackend.listSets())).toEqual([LAUNCH.id, SIBLING.id, ELSEWHERE.id]);
    expect(await bytesOf(a)).toEqual([10, 11, 12]);
    expect(await bytesOf(b)).toEqual([20, 21, 22]);
  });

  it("if the document can't be written, it rejects before the record and storage is exactly as before", async () => {
    seed();
    await savedWithTwoShots();
    const before = storageSnapshot();
    refuseSetItem(DOCS_KEY);

    await expect(localBackend.duplicateSet(LAUNCH.id)).rejects.toThrow(FULL);

    vi.restoreAllMocks();
    expect(storageSnapshot()).toEqual(before);
  });

  it("an unknown id rejects with \"That set isn't in this browser any more.\" and writes nothing", async () => {
    seed();
    await savedWithTwoShots();
    // A document without a record isn't a set in the library either.
    localStorage.setItem(DOCS_KEY, JSON.stringify({ ...storedDocs(), "doc-only": doc([frame()]) }));
    const before = storageSnapshot();

    await expect(localBackend.duplicateSet("no-such-set")).rejects.toThrow(GONE);
    await expect(localBackend.duplicateSet("doc-only")).rejects.toThrow(GONE);

    expect(storageSnapshot()).toEqual(before);
  });

  it("unreadable stored documents reject rather than being written over", async () => {
    seed();
    localStorage.setItem(DOCS_KEY, "{broken");
    const before = storageSnapshot();

    await expect(localBackend.duplicateSet(LAUNCH.id)).rejects.toThrow(/unreadable/);

    expect(storageSnapshot()).toEqual(before);
  });
});

describe("the copy is independent of its original", () => {
  it("renaming either leaves the other's name alone", async () => {
    seed();
    await savedWithTwoShots();
    const copy = await localBackend.duplicateSet(LAUNCH.id);

    await localBackend.renameSet(copy.id, "Autumn variant");
    let sets = await localBackend.listSets(APP.id);
    expect(sets.find((x) => x.id === copy.id)!.name).toBe("Autumn variant");
    expect(sets.find((x) => x.id === LAUNCH.id)!.name).toBe("Pocket — launch");

    await localBackend.renameSet(LAUNCH.id, "Launch v2");
    sets = await localBackend.listSets(APP.id);
    expect(sets.find((x) => x.id === copy.id)!.name).toBe("Autumn variant");
    expect(sets.find((x) => x.id === LAUNCH.id)!.name).toBe("Launch v2");
  });

  it("saving the copy's document doesn't change the original's", async () => {
    seed();
    const { a, saved } = await savedWithTwoShots();
    const copy = await localBackend.duplicateSet(LAUNCH.id);

    const edited = doc([frame({ caption: "Only in the copy", screenshot: `img:${a}` })], { store: "apple" });
    await localBackend.saveSetDoc(copy.id, edited);

    expect(await localBackend.loadSetDoc(copy.id)).toEqual(edited);
    expect(await localBackend.loadSetDoc(LAUNCH.id)).toEqual(saved);
    const sets = await localBackend.listSets(APP.id);
    expect(sets.find((x) => x.id === copy.id)).toMatchObject({ frameCount: 1, store: "apple" });
    expect(sets.find((x) => x.id === LAUNCH.id)).toMatchObject({ frameCount: 3, store: "play" });
  });

  it("deleting the copy leaves the original's record, document and screenshots", async () => {
    seed();
    const { a, b, saved } = await savedWithTwoShots();
    const sourceRecord = storedSets()!.find((x) => x.id === LAUNCH.id);
    const copy = await localBackend.duplicateSet(LAUNCH.id);
    await localBackend.renameSet(copy.id, "Renamed copy");

    await localBackend.deleteSet(copy.id);

    expect(ids(storedSets())).toEqual([LAUNCH.id, SIBLING.id, ELSEWHERE.id]);
    expect(storedSets()!.find((x) => x.id === LAUNCH.id)).toEqual(sourceRecord);
    expect(await localBackend.loadSetDoc(LAUNCH.id)).toEqual(saved);
    expect(await localBackend.loadSetDoc(copy.id)).toBeNull();
    expect(await bytesOf(a)).toEqual([10, 11, 12]);
    expect(await bytesOf(b)).toEqual([20, 21, 22]);
  });
});
