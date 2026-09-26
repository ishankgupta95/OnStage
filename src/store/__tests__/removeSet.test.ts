import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { App, ScreenshotSet, SetDoc } from "@/lib/data/types";
import { blobBytes, doc, frame, resetImageDb } from "@/lib/data/__tests__/helpers";
import { seedLibrary } from "@/lib/data/__tests__/library";
import { imageIdFromRef, toImageRef } from "@/lib/data/imageRefs";

const DOCS_KEY = "onstage:set-docs:v1";
const SETS_KEY = "onstage:sets:v1";
const LAST_KEY = "onstage:last-set:v1";
const OLD_TIME = "2026-09-01T00:00:00.000Z";
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

/** A fresh store and backend, as on a page load. */
async function boot() {
  vi.resetModules();
  const store = await import("../onstage");
  const { localBackend } = await import("@/lib/data/local");
  return { ...store, localBackend };
}

const APP: App = {
  id: "app-x",
  name: "X",
  initial: "X",
  meta: "2 SETS",
  tint: "#5d5294",
  thumbs: [],
  tags: [],
};

const record = (id: string): ScreenshotSet => ({
  id,
  appId: APP.id,
  name: `Set ${id}`,
  sub: "App Store · EN",
  frameCount: 1,
  status: "Draft",
  updatedAt: OLD_TIME,
  swatch: "x",
});

/** A library holding one app whose sets are exactly `docs`, each with its
 *  record and its stored document, already seeded (no sample added). */
function seedSets(docs: Record<string, SetDoc>) {
  seedLibrary({ apps: [APP], sets: Object.keys(docs).map(record) });
  localStorage.setItem(DOCS_KEY, JSON.stringify(docs));
}

const storedDocs = (): Record<string, SetDoc> => JSON.parse(localStorage.getItem(DOCS_KEY) ?? "{}");
const storedSets = (): ScreenshotSet[] => JSON.parse(localStorage.getItem(SETS_KEY) ?? "[]");
const storedSetIds = () => storedSets().map((x) => x.id);

/** Make loadSetDoc wait until the test releases each set's read. */
function gateLoads(backend: { loadSetDoc: (id: string) => Promise<SetDoc | null> }) {
  const real = backend.loadSetDoc.bind(backend);
  const gates = new Map<string, () => void>();
  vi.spyOn(backend, "loadSetDoc").mockImplementation(async (id: string) => {
    await new Promise<void>((resolve) => gates.set(id, resolve));
    return real(id);
  });
  return {
    started: (id: string) => vi.waitFor(() => expect(gates.has(id)).toBe(true)),
    release: async (id: string) => {
      await vi.waitFor(() => expect(gates.has(id)).toBe(true));
      gates.get(id)!();
      await vi.advanceTimersByTimeAsync(0);
    },
  };
}

const png = (...bytes: number[]) => new Blob([new Uint8Array(bytes)], { type: "image/png" });

const setA = doc([frame({ caption: "A one" }), frame({ caption: "A two" })], { device: "px9" });
const setB = doc([frame({ caption: "B one" })], { store: "play" });

beforeEach(async () => {
  await resetImageDb();
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("removeSet (S2.2)", () => {
  // First in the file on purpose: it fires `pagehide`, which every booted
  // store instance listens to, and no earlier test has left one behind.
  it("removing the loaded set with a queued edit closes it, and no later save brings it back", async () => {
    seedSets({ A: setA, B: setB });
    const { openSet, removeSet, useOnstage, localBackend } = await boot();
    await openSet("A");
    useOnstage.getState().patchFrame({ caption: "A queued, never written" });
    expect(useOnstage.getState().saveState).toBe("saving");
    expect(storedDocs().A).toEqual(setA); // still inside the debounce
    const save = vi.spyOn(localBackend, "saveSetDoc");

    await removeSet("A");

    let st = useOnstage.getState();
    expect(st.loadedSetId).toBeNull();
    expect(st.setId).toBe("");
    expect(useOnstage.temporal.getState().pastStates).toHaveLength(0);
    expect(storedDocs().A).toBeUndefined();
    expect(storedSetIds()).toEqual(["B"]);

    // The debounce would have fired long ago, and the tab closes.
    await vi.advanceTimersByTimeAsync(5000);
    window.dispatchEvent(new Event("pagehide"));
    await vi.advanceTimersByTimeAsync(0);
    // An edit to the placeholder frames now on screen isn't saved either.
    useOnstage.getState().patchFrame({ caption: "typed after the delete" });
    await vi.advanceTimersByTimeAsync(5000);

    expect(save.mock.calls.filter(([id]) => id === "A")).toEqual([]);
    expect(storedDocs()).toEqual({ B: setB });
    expect(storedSetIds()).toEqual(["B"]);
    expect((await localBackend.listSets()).map((x) => x.id)).toEqual(["B"]);
    st = useOnstage.getState();
    expect(st.loadedSetId).toBeNull();
    expect(st.saveState).toBe("saved");
  });

  it("removing another set keeps a screenshot only the open set's undo history still references", async () => {
    const { openSet, removeSet, flushSaves, useOnstage, localBackend } = await boot();
    const x = await localBackend.putImage(png(1, 2, 3));
    const y = await localBackend.putImage(png(4, 5, 6));
    const z = await localBackend.putImage(png(7, 8, 9)); // B's alone
    seedSets({
      A: doc([frame({ caption: "A one", screenshot: toImageRef(x) })]),
      B: doc([frame({ caption: "B one", screenshot: toImageRef(x) }), frame({ screenshot: toImageRef(z) })]),
    });

    await openSet("A");
    expect(useOnstage.getState().frames[0].screenshot).toBe(toImageRef(x));
    useOnstage.getState().setScreenshots(0, [toImageRef(y)]);
    expect(useOnstage.temporal.getState().pastStates).toHaveLength(1);
    await flushSaves();
    // A's stored doc no longer mentions X: only its undo history does.
    expect(storedDocs().A.frames[0].screenshot).toBe(toImageRef(y));
    expect(JSON.stringify(storedDocs().A)).not.toContain(x);

    const del = vi.spyOn(localBackend, "deleteSet");
    await removeSet("B");

    expect(del).toHaveBeenCalledWith("B", { keepImages: expect.arrayContaining([x, y]) });
    expect(storedDocs().B).toBeUndefined();
    expect(storedSetIds()).toEqual(["A"]);
    // Z was B's alone and went; X is still reachable through undo, so it stays.
    expect(await localBackend.getImage(z)).toBeNull();
    const kept = await localBackend.getImage(x);
    expect(kept).not.toBeNull();
    expect(await blobBytes(kept!)).toEqual([1, 2, 3]);
    expect(useOnstage.getState().loadedSetId).toBe("A");

    // Undo in A brings X back, and it still resolves.
    useOnstage.getState().undo();
    const ref = useOnstage.getState().frames[0].screenshot;
    expect(ref).toBe(toImageRef(x));
    const back = await localBackend.getImage(imageIdFromRef(ref)!);
    expect(await blobBytes(back!)).toEqual([1, 2, 3]);
    await vi.advanceTimersByTimeAsync(1000);
    expect(storedDocs().A.frames[0].screenshot).toBe(toImageRef(x));
  });

  it("when the backend refuses the delete, it rethrows, the set stays listed, and its dropped edit is written", async () => {
    seedSets({ A: setA, B: setB });
    const { openSet, removeSet, useOnstage, localBackend } = await boot();
    await openSet("A");
    useOnstage.getState().patchFrame({ caption: "A queued" });
    vi.spyOn(localBackend, "deleteSet").mockRejectedValue(new Error("This browser's storage is full."));

    await expect(removeSet("A")).rejects.toThrow("This browser's storage is full.");

    expect((await localBackend.listSets()).map((x) => x.id)).toEqual(["A", "B"]);
    expect(storedSetIds()).toEqual(["A", "B"]);
    expect(useOnstage.getState().loadedSetId).toBeNull(); // closed, not deleted

    await vi.advanceTimersByTimeAsync(1000);
    expect(storedDocs().A.frames.map((f) => f.caption)).toEqual(["A queued", "A two"]);
    expect(storedDocs().B).toEqual(setB);
    const rec = storedSets().find((x) => x.id === "A")!;
    expect(rec.updatedAt).toMatch(ISO);
    expect(rec.updatedAt).not.toBe(OLD_TIME);
    expect(rec.frameCount).toBe(2);

    // The set isn't treated as deleted any more: it reopens with that edit
    // and keeps saving.
    await openSet("A");
    expect(useOnstage.getState().frames[0].caption).toBe("A queued");
    useOnstage.getState().patchFrame({ caption: "A later" });
    await vi.advanceTimersByTimeAsync(1000);
    expect(storedDocs().A.frames[0].caption).toBe("A later");
    expect(useOnstage.getState().saveState).toBe("saved");
  });

  for (const before of [null, "A"] as const) {
    it(`an openSet of the set still loading when it is removed never installs it (${before ?? "nothing"} open)`, async () => {
      seedSets({ A: setA, B: setB });
      const { openSet, removeSet, useOnstage, localBackend } = await boot();
      if (before) await openSet(before);
      const lastBefore = localStorage.getItem(LAST_KEY);
      const loads = gateLoads(localBackend);

      const opening = openSet("B");
      await loads.started("B");
      await removeSet("B");
      expect(storedDocs().B).toBeUndefined();
      expect(storedSetIds()).toEqual(["A"]);

      await loads.release("B");
      await opening;

      const st = useOnstage.getState();
      expect(st.loadedSetId).toBe(before);
      if (before) {
        expect(st.setId).toBe("A");
        expect(st.frames.map((f) => f.caption)).toEqual(["A one", "A two"]);
        expect(st.device).toBe("px9");
      } else {
        expect(st.setId).toBe("");
      }
      expect(localStorage.getItem(LAST_KEY)).toBe(lastBefore);

      // Edits go to what is open (if anything); B never comes back.
      st.patchFrame({ caption: "after" });
      await vi.advanceTimersByTimeAsync(1000);
      expect(storedDocs().B).toBeUndefined();
      expect(storedSetIds()).toEqual(["A"]);
      expect(storedDocs().A.frames[0].caption).toBe(before ? "after" : "A one");
    });
  }

  it("a write of the set already under way lands before the delete, never after it", async () => {
    seedSets({ A: setA, B: setB });
    const { openSet, removeSet, useOnstage, localBackend } = await boot();
    await openSet("A");
    const real = localBackend.saveSetDoc.bind(localBackend);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const save = vi.spyOn(localBackend, "saveSetDoc").mockImplementation(async (id, d) => {
      await gate;
      return real(id, d);
    });
    useOnstage.getState().patchFrame({ caption: "A in flight" });
    await vi.advanceTimersByTimeAsync(400); // the debounce fires; the write waits
    expect(save).toHaveBeenCalledTimes(1);
    const del = vi.spyOn(localBackend, "deleteSet");

    const removing = removeSet("A");
    await vi.advanceTimersByTimeAsync(0);
    expect(del).not.toHaveBeenCalled();
    release();
    await removing;

    expect(del).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(storedDocs()).toEqual({ B: setB });
    expect(storedSetIds()).toEqual(["B"]);
  });
});

describe("a set this tab has deleted stays gone", () => {
  it("can't be opened again while its delete waits, or after — and no edit to it is left queued", async () => {
    seedSets({ A: setA, B: setB });
    const { openSet, removeSet, isSetDeleted, useOnstage, localBackend } = await boot();
    // The delete waits (as it does behind the one-time screenshot migration).
    let release!: () => void;
    const real = localBackend.deleteSet.bind(localBackend);
    vi.spyOn(localBackend, "deleteSet").mockImplementation(async (id, options) => {
      await new Promise<void>((r) => (release = r));
      return real(id, options);
    });

    const removing = removeSet("B");
    expect(isSetDeleted("B")).toBe(true);
    // Opening it now (its record is still listed) shows nothing.
    await openSet("B");
    expect(useOnstage.getState().loadedSetId).toBeNull();

    await vi.waitFor(() => expect(release).toBeTypeOf("function"));
    release();
    await removing;
    await openSet("B");
    expect(useOnstage.getState().loadedSetId).toBeNull();

    // Another set still opens and saves, and the pill comes back to SAVED.
    await openSet("A");
    useOnstage.getState().patchFrame({ caption: "A edited" });
    await vi.advanceTimersByTimeAsync(1000);
    expect(storedDocs().A.frames[0].caption).toBe("A edited");
    expect(useOnstage.getState().saveState).toBe("saved");
    expect(storedSetIds()).toEqual(["A"]);
  });

  it("a write already under way never goes on to write a set deleted meanwhile", async () => {
    seedSets({ A: setA, B: setB });
    const { openSet, removeSet, useOnstage, localBackend } = await boot();
    const real = localBackend.saveSetDoc.bind(localBackend);
    // B's edit can't be written yet, so it stays queued beside A's.
    let refuseB = true;
    let hold: (() => void) | null = null;
    let holdNext = false;
    const saves: string[] = [];
    vi.spyOn(localBackend, "saveSetDoc").mockImplementation(async (id, d) => {
      saves.push(id);
      if (id === "B" && refuseB) throw new Error("This browser's storage is full.");
      if (holdNext) {
        holdNext = false;
        await new Promise<void>((r) => (hold = r));
      }
      return real(id, d);
    });
    await openSet("B");
    useOnstage.getState().patchFrame({ caption: "B edited" });
    await openSet("A");
    useOnstage.getState().patchFrame({ caption: "A edited" });

    // The next flush takes both (B first); hold it on B, delete A under it.
    refuseB = false;
    holdNext = true;
    saves.length = 0;
    await vi.advanceTimersByTimeAsync(500);
    await vi.waitFor(() => expect(hold).toBeTypeOf("function"));
    const removing = removeSet("A");
    hold!();
    await removing;
    await vi.advanceTimersByTimeAsync(1000);

    expect(saves).toEqual(["B"]);
    expect(storedDocs().B.frames[0].caption).toBe("B edited");
    expect(storedDocs().A).toBeUndefined();
    expect(storedSetIds()).toEqual(["B"]);
  });

  it("a queued edit of a set deleted meanwhile is dropped, not kept forever holding the pill at SAVING…", async () => {
    seedSets({ A: setA, B: setB });
    const { openSet, removeSet, useOnstage } = await boot();
    await openSet("A");
    useOnstage.getState().patchFrame({ caption: "A edited" });
    expect(useOnstage.getState().saveState).toBe("saving");
    await removeSet("A");
    expect(useOnstage.getState().saveState).toBe("saved");
    await vi.advanceTimersByTimeAsync(1000);
    expect(storedDocs().A).toBeUndefined();
    await openSet("B");
    useOnstage.getState().patchFrame({ caption: "B edited" });
    await vi.advanceTimersByTimeAsync(1000);
    expect(useOnstage.getState().saveState).toBe("saved");
  });
});

describe("flushSaves (S2.2)", () => {
  it("writes a queued edit, document and record, without waiting for the debounce", async () => {
    seedSets({ A: setA });
    const { openSet, flushSaves, useOnstage, localBackend } = await boot();
    await openSet("A");
    const save = vi.spyOn(localBackend, "saveSetDoc");
    useOnstage.getState().patchFrame({ caption: "A flushed" });
    useOnstage.getState().addFrame();
    expect(storedDocs().A).toEqual(setA);

    await flushSaves(); // no timer advanced

    expect(save).toHaveBeenCalledTimes(1);
    expect(storedDocs().A.frames.map((f) => f.caption)).toEqual(["A flushed", "A two", "New headline"]);
    const rec = storedSets().find((x) => x.id === "A")!;
    expect(rec.frameCount).toBe(3);
    expect(rec.updatedAt).toMatch(ISO);
    expect(rec.updatedAt).not.toBe(OLD_TIME);
    expect(useOnstage.getState().saveState).toBe("saved");

    // The debounce that edit started was cancelled: nothing is written twice.
    await vi.advanceTimersByTimeAsync(1000);
    expect(save).toHaveBeenCalledTimes(1);
  });
});
