import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Prefs, SetDoc } from "@/lib/data/types";
import { doc, frame } from "@/lib/data/__tests__/helpers";
import { seedLibrary, storageSnapshot } from "@/lib/data/__tests__/library";

/**
 * Plan S3.2: the work mode is the person's preference (`onstage:prefs:v1`),
 * mirrored into the store so "open this set" links can read it at once —
 * no longer a field of each set's document.
 */

const PREFS_KEY = "onstage:prefs:v1";
const DOCS_KEY = "onstage:set-docs:v1";

/** A fresh store, backend and link helpers, as on a page load. */
async function boot() {
  vi.resetModules();
  const store = await import("../onstage");
  const { localBackend } = await import("@/lib/data/local");
  const links = await import("@/lib/onstage/setLinks");
  const sets = await import("@/lib/onstage/sets");
  return { ...store, ...links, ...sets, localBackend };
}

const storedPrefs = (): unknown => JSON.parse(localStorage.getItem(PREFS_KEY) ?? "null");
const storedDocs = (): Record<string, SetDoc> => JSON.parse(localStorage.getItem(DOCS_KEY) ?? "{}");

function seedDocs(docs: Record<string, SetDoc>) {
  localStorage.setItem(DOCS_KEY, JSON.stringify(docs));
}

const quotaFull = () =>
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new DOMException("x", "QuotaExceededError");
  });

/** A promise the test resolves when it chooses. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

/** A set document as saved before S3.2, with its own work mode. */
const legacy = (workMode: "guided" | "canvas", over: Partial<SetDoc> = {}): SetDoc =>
  doc([frame({ caption: "Legacy one" }), frame({ caption: "Legacy two", bg: "moss" })], {
    workMode,
    store: "play",
    device: "px9",
    captionSize: 52,
    ...over,
  });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("setWorkMode", () => {
  it("starts on the canvas before any preference is read", async () => {
    const { useOnstage } = await boot();
    expect(useOnstage.getState().workMode).toBe("canvas");
  });

  it("changes the store's work mode at once and stores the preference", async () => {
    const { useOnstage, setWorkMode } = await boot();
    const pending = setWorkMode("guided");
    // Before the write resolves: links read the store, so it is already there.
    expect(useOnstage.getState().workMode).toBe("guided");
    await pending;
    expect(storedPrefs()).toEqual({ workMode: "guided", defaultStore: "apple" });

    await setWorkMode("canvas");
    expect(useOnstage.getState().workMode).toBe("canvas");
    expect(storedPrefs()).toEqual({ workMode: "canvas", defaultStore: "apple" });
  });

  it("keeps the other preferences as they were", async () => {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ workMode: "canvas", defaultStore: "play" }));
    const { setWorkMode } = await boot();
    await setWorkMode("guided");
    expect(storedPrefs()).toEqual({ workMode: "guided", defaultStore: "play" });
  });

  it("writes only the preference — no set document, no library record", async () => {
    seedLibrary();
    const { setWorkMode } = await boot();
    const before = storageSnapshot();
    await setWorkMode("guided");
    const after = storageSnapshot();
    delete after[PREFS_KEY];
    expect(after).toEqual(before);
  });

  it("a write the browser refuses rejects with why, but the mode still changed for this visit", async () => {
    const { useOnstage, setWorkMode } = await boot();
    const before = storageSnapshot();
    quotaFull();
    await expect(setWorkMode("guided")).rejects.toThrow("This browser's storage is full.");
    expect(useOnstage.getState().workMode).toBe("guided");
    expect(storageSnapshot()).toEqual(before);
  });
});

describe("loadPrefs", () => {
  it("copies the stored work mode into the store", async () => {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ workMode: "guided", defaultStore: "apple" }));
    const { useOnstage, loadPrefs } = await boot();
    expect(useOnstage.getState().workMode).toBe("canvas");
    await loadPrefs();
    expect(useOnstage.getState().workMode).toBe("guided");
  });

  it("with nothing stored, the store stays on the canvas and the defaults are stored once", async () => {
    const { useOnstage, loadPrefs } = await boot();
    await loadPrefs();
    expect(useOnstage.getState().workMode).toBe("canvas");
    expect(storageSnapshot()).toEqual({ "onstage:prefs:v1": JSON.stringify({ workMode: "canvas", defaultStore: "apple" }) });
  });

  it("brings a pre-S3.2 browser's work mode (the last set's) into the store", async () => {
    seedDocs({ A: legacy("guided") });
    localStorage.setItem("onstage:last-set:v1", JSON.stringify("A"));
    const { useOnstage, loadPrefs } = await boot();
    await loadPrefs();
    expect(useOnstage.getState().workMode).toBe("guided");
    expect(storedPrefs()).toEqual({ workMode: "guided", defaultStore: "apple" });
  });

  it("a mode picked in this tab while the read was under way wins over the read", async () => {
    // Stored: the canvas. The person picks Guided before the read comes back.
    const { useOnstage, loadPrefs, setWorkMode, localBackend } = await boot();
    const read = deferred<Prefs>();
    vi.spyOn(localBackend, "getPrefs").mockReturnValue(read.promise);

    const loading = loadPrefs();
    await setWorkMode("guided");
    read.resolve({ workMode: "canvas", defaultStore: "apple" });
    await loading;

    expect(useOnstage.getState().workMode).toBe("guided");
    expect(storedPrefs()).toEqual({ workMode: "guided", defaultStore: "apple" });
  });

  it("a mode picked in this tab while reading wins even when it is the one already shown", async () => {
    // Stored: guided. The page starts on the canvas; the person picks Canvas
    // (and it is stored) before the read of the old value comes back. The
    // store must agree with what is now stored.
    localStorage.setItem(PREFS_KEY, JSON.stringify({ workMode: "guided", defaultStore: "apple" }));
    const { useOnstage, loadPrefs, setWorkMode, localBackend } = await boot();
    // The read takes the stored value now and answers later, as a
    // networked backend would.
    const answer = deferred<void>();
    const real = localBackend.getPrefs.bind(localBackend);
    vi.spyOn(localBackend, "getPrefs").mockImplementation(async () => {
      const value = await real();
      await answer.promise;
      return value;
    });

    const loading = loadPrefs();
    await setWorkMode("canvas");
    answer.resolve();
    await loading;

    expect(storedPrefs()).toEqual({ workMode: "canvas", defaultStore: "apple" });
    expect(useOnstage.getState().workMode).toBe("canvas");
  });

  it("a read that fails leaves the mode as it was and says why in the console", async () => {
    const { useOnstage, loadPrefs, localBackend } = await boot();
    useOnstage.setState({ workMode: "guided" });
    vi.spyOn(localBackend, "getPrefs").mockRejectedValue(new Error("offline"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(loadPrefs()).resolves.toBeUndefined();
    expect(useOnstage.getState().workMode).toBe("guided");
    expect(warn).toHaveBeenCalledWith("[onstage] couldn't read preferences", expect.any(Error));
  });
});

describe("the work mode is not part of a set's document", () => {
  it("opening a legacy document that says 'guided' leaves the store's mode alone", async () => {
    seedDocs({ L: legacy("guided") });
    const { useOnstage, openSet } = await boot();
    expect(useOnstage.getState().workMode).toBe("canvas");
    await openSet("L");
    expect(useOnstage.getState().loadedSetId).toBe("L");
    expect(useOnstage.getState().workMode).toBe("canvas");
  });

  it("and one that says 'canvas' doesn't undo a 'guided' preference", async () => {
    seedDocs({ L: legacy("canvas") });
    const { useOnstage, openSet, setWorkMode } = await boot();
    await setWorkMode("guided");
    await openSet("L");
    expect(useOnstage.getState().workMode).toBe("guided");
  });

  it("switching between sets never changes the mode", async () => {
    seedDocs({ A: legacy("guided"), B: legacy("canvas", { store: "apple" }) });
    const { useOnstage, openSet } = await boot();
    await openSet("A");
    expect(useOnstage.getState().workMode).toBe("canvas");
    useOnstage.setState({ workMode: "guided" });
    await openSet("B");
    expect(useOnstage.getState().workMode).toBe("guided");
    await openSet("A");
    expect(useOnstage.getState().workMode).toBe("guided");
  });

  it("a legacy document's other fields load as usual", async () => {
    seedDocs({ L: legacy("guided") });
    const { useOnstage, openSet } = await boot();
    await openSet("L");
    const st = useOnstage.getState();
    expect(st.frames.map((f) => f.caption)).toEqual(["Legacy one", "Legacy two"]);
    expect(st.frames[1].bg).toBe("moss");
    expect(st.store).toBe("play");
    expect(st.device).toBe("px9");
    expect(st.captionSize).toBe(52);
  });

  it("opening a legacy document writes no preference", async () => {
    seedDocs({ L: legacy("guided") });
    const { openSet } = await boot();
    await openSet("L");
    await vi.advanceTimersByTimeAsync(1000);
    expect(localStorage.getItem(PREFS_KEY)).toBeNull();
  });

  it("after an edit, an old document keeps its workMode field, unread — and nothing else is lost", async () => {
    seedDocs({ L: legacy("guided") });
    const { useOnstage, openSet, currentDoc } = await boot();
    await openSet("L");
    // The editor's document has no work mode…
    expect(currentDoc()).not.toHaveProperty("workMode");
    expect(useOnstage.getState().workMode).toBe("canvas");

    useOnstage.getState().patchFrame({ caption: "Edited" });
    await vi.advanceTimersByTimeAsync(400);

    // …and the stored copy keeps the old field, as rule 10 asks (an older
    // build opening the set still finds it); nothing reads it.
    const saved = storedDocs().L;
    expect(saved.workMode).toBe("guided");
    expect(saved.frames.map((f) => f.caption)).toEqual(["Edited", "Legacy two"]);
    expect({ ...saved, frames: legacy("guided").frames }).toEqual(legacy("guided"));
    expect(useOnstage.getState().workMode).toBe("canvas");
    expect(useOnstage.getState().saveState).toBe("saved");
  });

  it("a document that never had a work mode is saved without one", async () => {
    const { workMode: _unused, ...modern } = legacy("guided");
    void _unused;
    seedDocs({ M: modern });
    const { useOnstage, openSet } = await boot();
    await openSet("M");
    useOnstage.getState().patchFrame({ caption: "Edited" });
    await vi.advanceTimersByTimeAsync(400);
    expect(storedDocs().M).not.toHaveProperty("workMode");
    expect(storedDocs().M.frames[0].caption).toBe("Edited");
  });

  it("changing the work mode is not an edit: nothing is saved and there is nothing to undo", async () => {
    seedDocs({ L: legacy("canvas") });
    const { useOnstage, openSet, setWorkMode, localBackend } = await boot();
    await openSet("L");
    const save = vi.spyOn(localBackend, "saveSetDoc");
    await setWorkMode("guided");
    await vi.advanceTimersByTimeAsync(1000);
    expect(save).not.toHaveBeenCalled();
    expect(useOnstage.getState().saveState).toBe("saved");
    expect(useOnstage.temporal.getState().pastStates).toHaveLength(0);
    expect(storedDocs().L.workMode).toBe("canvas");
  });
});

describe("openSetHref follows the preference", () => {
  it("goes to the canvas by default, and to the guided flow once the mode is guided", async () => {
    const { openSetHref, setWorkMode } = await boot();
    expect(openSetHref("x")).toBe("/editor?set=x");
    await setWorkMode("guided");
    expect(openSetHref("x")).toBe("/guided?set=x");
    await setWorkMode("canvas");
    expect(openSetHref("x")).toBe("/editor?set=x");
  });

  it("reads the stored preference once loadPrefs has run", async () => {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ workMode: "guided", defaultStore: "apple" }));
    const { openSetHref, loadPrefs } = await boot();
    expect(openSetHref("x")).toBe("/editor?set=x");
    await loadPrefs();
    expect(openSetHref("x")).toBe("/guided?set=x");
  });

  it("the open set's legacy work mode doesn't steer it", async () => {
    seedDocs({ L: legacy("guided") });
    const { openSetHref, openSet } = await boot();
    await openSet("L");
    expect(openSetHref("L")).toBe("/editor?set=L");
  });

  it("a refused preference write still routes this visit by the new mode", async () => {
    const { openSetHref, setWorkMode } = await boot();
    quotaFull();
    await expect(setWorkMode("guided")).rejects.toThrow();
    expect(openSetHref("x")).toBe("/guided?set=x");
  });
});

describe("new sets start on the default store target", () => {
  it("createBlankSet and createFirstSet aim at the stored defaultStore", async () => {
    seedLibrary();
    localStorage.setItem(PREFS_KEY, JSON.stringify({ workMode: "canvas", defaultStore: "play" }));
    const { createBlankSet, createFirstSet, localBackend } = await boot();
    const blank = await createBlankSet();
    expect((await localBackend.loadSetDoc(blank.id))?.store).toBe("play");
    const first = await createFirstSet({});
    expect((await localBackend.loadSetDoc(first.id))?.store).toBe("play");
  });

  it("with no preference they stay on the App Store, and the new document carries no work mode", async () => {
    seedLibrary();
    const { createBlankSet, localBackend, setWorkMode } = await boot();
    await setWorkMode("guided");
    const blank = await createBlankSet();
    const saved = await localBackend.loadSetDoc(blank.id);
    expect(saved?.store).toBe("apple");
    expect(saved).not.toHaveProperty("workMode");
  });
});
