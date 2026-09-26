import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SetDoc } from "@/lib/data/types";
import { doc, frame } from "@/lib/data/__tests__/helpers";

const DOCS_KEY = "onstage:set-docs:v1";

/** A fresh store and backend, as on a page load. */
async function boot() {
  vi.resetModules();
  const store = await import("../onstage");
  const { localBackend } = await import("@/lib/data/local");
  return { ...store, localBackend };
}

const stored = (): Record<string, SetDoc> => JSON.parse(localStorage.getItem(DOCS_KEY) ?? "{}");

function seed(docs: Record<string, SetDoc>) {
  localStorage.setItem(DOCS_KEY, JSON.stringify(docs));
}

/** Make loadSetDoc wait until the test releases each set's read. */
function gateLoads(backend: { loadSetDoc: (id: string) => Promise<SetDoc | null> }) {
  const real = backend.loadSetDoc.bind(backend);
  const gates = new Map<string, () => void>();
  vi.spyOn(backend, "loadSetDoc").mockImplementation(async (id: string) => {
    await new Promise<void>((resolve) => gates.set(id, resolve));
    return real(id);
  });
  return {
    /** Wait until the read of `id` is in flight. */
    started: (id: string) => vi.waitFor(() => expect(gates.has(id)).toBe(true)),
    release: async (id: string) => {
      await vi.waitFor(() => expect(gates.has(id)).toBe(true));
      gates.get(id)!();
      await vi.advanceTimersByTimeAsync(0);
    },
  };
}

const setA = doc([frame({ caption: "A one" }), frame({ caption: "A two" })], { device: "px9" });
const setB = doc([frame({ caption: "B one" })], { store: "play" });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("openSet sequencing (DATA-4, D10)", () => {
  for (const order of [
    ["B", "A"],
    ["A", "B"],
  ] as const) {
    it(`openSet('B') then openSet('A'), reads finishing ${order.join(" then ")}: A is shown, B untouched`, async () => {
      seed({ A: setA, B: setB });
      const before = localStorage.getItem(DOCS_KEY);
      const { openSet, useOnstage, localBackend } = await boot();
      const loads = gateLoads(localBackend);

      // Both reads are in flight at once before either finishes.
      const openingB = openSet("B");
      await loads.started("B");
      const openingA = openSet("A");
      await loads.started("A");
      for (const id of order) await loads.release(id);
      await Promise.all([openingA, openingB]);

      const st = useOnstage.getState();
      expect(st.setId).toBe("A");
      expect(st.loadedSetId).toBe("A");
      expect(st.frames.map((f) => f.caption)).toEqual(["A one", "A two"]);
      expect(st.device).toBe("px9");

      // An edit now goes to A, and B's stored doc is never written.
      st.patchFrame({ caption: "A edited" });
      await vi.advanceTimersByTimeAsync(1000);
      expect(stored().B).toEqual(setB);
      expect(stored().A.frames[0].caption).toBe("A edited");
      expect(JSON.parse(before!).B).toEqual(stored().B);
    });
  }

  it("opening a set with no saved doc shows the default and leaves other sets untouched", async () => {
    seed({ A: setA });
    const { openSet, useOnstage, defaultDoc } = await boot();
    await openSet("A");
    useOnstage.getState().select(1);

    await openSet("brand-new");

    const st = useOnstage.getState();
    const d = defaultDoc();
    expect(st.setId).toBe("brand-new");
    expect(st.frames).toEqual(d.frames);
    expect(st.device).toBe(d.device);
    expect(st.active).toBe(0);
    await vi.advanceTimersByTimeAsync(1000);
    // Nothing written for the new set until it is edited, and A is intact.
    expect(stored()).toEqual({ A: setA });
  });

  it("the set being left keeps its last edit, written before the switch", async () => {
    seed({ A: setA, B: setB });
    const { openSet, useOnstage } = await boot();
    await openSet("A");
    useOnstage.getState().patchFrame({ caption: "A last word" });
    // No debounce wait: switching must not drop the edit, nor save it into B.
    await openSet("B");
    expect(stored().A.frames[0].caption).toBe("A last word");
    expect(stored().B).toEqual(setB);
    expect(useOnstage.getState().frames[0].caption).toBe("B one");
  });

  it("edits to placeholder frames before any set has loaded are never saved", async () => {
    seed({ A: setA });
    const { openSet, useOnstage, localBackend } = await boot();
    const loads = gateLoads(localBackend);
    const save = vi.spyOn(localBackend, "saveSetDoc");

    const opening = openSet("A");
    expect(useOnstage.getState().loadedSetId).toBeNull();
    useOnstage.getState().patchFrame({ caption: "typed too early" });
    await vi.advanceTimersByTimeAsync(1000);
    expect(save).not.toHaveBeenCalled();

    await loads.release("A");
    await opening;
    expect(useOnstage.getState().frames[0].caption).toBe("A one");
    await vi.advanceTimersByTimeAsync(1000);
    expect(save).not.toHaveBeenCalled();
    expect(stored().A).toEqual(setA);
  });

  it("asking for the set that is already open keeps what is on screen", async () => {
    seed({ A: setA });
    const { openSet, useOnstage, localBackend } = await boot();
    await openSet("A");
    useOnstage.getState().patchFrame({ caption: "unsaved yet" });
    const load = vi.spyOn(localBackend, "loadSetDoc");

    await openSet("A"); // e.g. switching guided ⇄ canvas

    expect(load).not.toHaveBeenCalled();
    expect(useOnstage.getState().frames[0].caption).toBe("unsaved yet");
    expect(useOnstage.temporal.getState().pastStates).toHaveLength(1);
  });

  it("a saved doc missing a field gets the default, not the previous set's value", async () => {
    const legacy = { ...setB } as Partial<SetDoc>;
    delete legacy.store;
    seed({ A: { ...setA, store: "play" }, legacy: legacy as SetDoc });
    const { openSet, useOnstage, defaultDoc } = await boot();
    await openSet("A");
    expect(useOnstage.getState().store).toBe("play");
    await openSet("legacy");
    expect(useOnstage.getState().store).toBe(defaultDoc().store);
  });

  it("a set that can't be read opens as the default with the reason, and is never written over", async () => {
    localStorage.setItem(DOCS_KEY, "{broken");
    const { openSet, useOnstage } = await boot();
    await openSet("A");
    const st = useOnstage.getState();
    expect(st.saveState).toBe("error");
    expect(st.saveError).toMatch(/unreadable.*won't be saved/);
    st.patchFrame({ caption: "edit" });
    await vi.advanceTimersByTimeAsync(1000);
    expect(localStorage.getItem(DOCS_KEY)).toBe("{broken");
    expect(useOnstage.getState().saveState).toBe("error");
  });

  it("a load that fails (while saving still works) never overwrites the stored set", async () => {
    seed({ A: setA, B: setB });
    const { openSet, useOnstage, localBackend } = await boot();
    const save = vi.spyOn(localBackend, "saveSetDoc");
    vi.spyOn(localBackend, "loadSetDoc").mockRejectedValueOnce(new Error("Network down."));

    await openSet("B");
    const st = useOnstage.getState();
    expect(st.loadedSetId).toBe("B");
    expect(st.saveError).toMatch(/Network down\. Changes to this set won't be saved/);
    st.patchFrame({ caption: "tweak" });
    st.addFrame();
    await vi.advanceTimersByTimeAsync(1000);

    expect(save).not.toHaveBeenCalled();
    expect(stored().B).toEqual(setB);
    expect(useOnstage.getState().saveState).toBe("error");
  });

  it("a damaged saved doc opens as the default and is kept, not saved over", async () => {
    const damaged = { ...setB, frames: [] };
    seed({ A: setA, B: damaged });
    const { openSet, useOnstage, defaultDoc } = await boot();
    await openSet("B");
    expect(useOnstage.getState().frames).toEqual(defaultDoc().frames);
    expect(useOnstage.getState().saveError).toMatch(/damaged/);
    useOnstage.getState().patchFrame({ caption: "tweak" });
    await vi.advanceTimersByTimeAsync(1000);
    expect(stored().B).toEqual(damaged);
  });

  it("when the set being left can't be saved, the switch shows the error and keeps its edit for a retry", async () => {
    seed({ A: setA, B: setB });
    const { openSet, useOnstage, localBackend } = await boot();
    await openSet("A");
    useOnstage.getState().patchFrame({ caption: "A unsaved" });
    vi.spyOn(localBackend, "saveSetDoc")
      .mockRejectedValueOnce(new Error("Storage is full."))
      .mockRejectedValueOnce(new Error("Storage is full."));

    await openSet("B");
    expect(useOnstage.getState().frames[0].caption).toBe("B one");
    expect(useOnstage.getState().saveState).toBe("error");
    expect(useOnstage.getState().saveError).toBe("Storage is full.");
    expect(stored().A.frames[0].caption).toBe("A one");

    // Storage recovers: the next save writes A's edit too.
    useOnstage.getState().patchFrame({ caption: "B edited" });
    await vi.advanceTimersByTimeAsync(1000);
    expect(stored().A.frames[0].caption).toBe("A unsaved");
    expect(stored().B.frames[0].caption).toBe("B edited");
    expect(useOnstage.getState().saveState).toBe("saved");
  });

  it("reopening a set whose last edit couldn't be stored shows that edit, not the older stored copy", async () => {
    seed({ A: setA, B: setB });
    const { openSet, useOnstage, localBackend } = await boot();
    await openSet("A");
    useOnstage.getState().patchFrame({ caption: "A newest" });
    const save = vi.spyOn(localBackend, "saveSetDoc").mockRejectedValue(new Error("Storage is full."));
    await openSet("B");
    await openSet("A");
    expect(useOnstage.getState().frames[0].caption).toBe("A newest");
    save.mockRestore();
    await openSet("B");
    expect(stored().A.frames[0].caption).toBe("A newest");
  });

  it("reopening shows the newest edit even when it is written between the load and the install", async () => {
    seed({ A: setA, B: setB });
    const { openSet, useOnstage, localBackend } = await boot();
    await openSet("A");
    useOnstage.getState().patchFrame({ caption: "A newest" });
    const real = localBackend.saveSetDoc.bind(localBackend);
    const save = vi.spyOn(localBackend, "saveSetDoc");
    save.mockRejectedValueOnce(new Error("full")).mockRejectedValueOnce(new Error("full"));
    await openSet("B"); // A's edit is kept, unwritten
    save.mockRejectedValueOnce(new Error("full")).mockImplementation(real);
    await openSet("A"); // flush fails, load reads the old A, flush writes A newest

    expect(stored().A.frames[0].caption).toBe("A newest");
    expect(useOnstage.getState().frames[0].caption).toBe("A newest");
    useOnstage.getState().select(1);
    useOnstage.getState().patchFrame({ caption: "A two edited" });
    await vi.advanceTimersByTimeAsync(1000);
    expect(stored().A.frames.map((f) => f.caption)).toEqual(["A newest", "A two edited"]);
  });

  it("…and a load that fails then doesn't lock the set, because the newer copy is its own", async () => {
    seed({ A: setA, B: setB });
    const { openSet, useOnstage, localBackend } = await boot();
    await openSet("A");
    useOnstage.getState().patchFrame({ caption: "A newest" });
    const real = localBackend.saveSetDoc.bind(localBackend);
    const save = vi.spyOn(localBackend, "saveSetDoc");
    save.mockRejectedValueOnce(new Error("full")).mockRejectedValueOnce(new Error("full"));
    await openSet("B");
    save.mockRejectedValueOnce(new Error("full")).mockImplementation(real);
    vi.spyOn(localBackend, "loadSetDoc").mockRejectedValueOnce(new Error("Network down."));
    await openSet("A");
    expect(useOnstage.getState().frames[0].caption).toBe("A newest");
    expect(useOnstage.getState().saveState).toBe("saved");
    useOnstage.getState().patchFrame({ caption: "A later" });
    await vi.advanceTimersByTimeAsync(1000);
    expect(stored().A.frames[0].caption).toBe("A later");
  });

  it("an edit to the set being left during a slow switch isn't displaced by the new set's first edit", async () => {
    seed({ A: setA, B: setB });
    const { openSet, useOnstage, localBackend } = await boot();
    await openSet("A");
    const loads = gateLoads(localBackend);
    const opening = openSet("B");
    // B is loading; A is still on screen and still A's.
    useOnstage.getState().patchFrame({ caption: "A during the switch" });
    await loads.release("B");
    await opening;
    useOnstage.getState().patchFrame({ caption: "B first edit" });
    await vi.advanceTimersByTimeAsync(1000);
    expect(stored().A.frames[0].caption).toBe("A during the switch");
    expect(stored().B.frames[0].caption).toBe("B first edit");
  });

  it("a switch ends a drag in progress: its later moves are ignored and record nothing", async () => {
    seed({ A: setA, B: setB });
    const { openSet, useOnstage, beginHistoryGesture, endHistoryGesture, historyGestureLive } = await boot();
    await openSet("A");
    useOnstage.getState().select(1);
    const drag = beginHistoryGesture();
    useOnstage.getState().patchFrame({ tiltY: -20 });

    await openSet("B");

    expect(historyGestureLive(drag)).toBe(false);
    expect(useOnstage.temporal.getState().isTracking).toBe(true);
    endHistoryGesture(drag); // the release arrives later: a no-op
    expect(useOnstage.temporal.getState().pastStates).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1000);
    expect(stored().B).toEqual(setB);
    expect(stored().A.frames[1].tiltY).toBe(-20); // A kept the part made on A
  });

  it("a switch closes the export dialog of the set being left; the first load keeps one asked for", async () => {
    seed({ A: setA, B: setB });
    const { openSet, useOnstage } = await boot();
    useOnstage.setState({ overlay: "export" }); // e.g. the landing page's Export button
    await openSet("A");
    expect(useOnstage.getState().overlay).toBe("export");
    useOnstage.setState({ exportState: "done", exportBytes: 1234, exportDone: 8, exportTotal: 8 });
    await openSet("B");
    const st = useOnstage.getState();
    expect(st.overlay).toBeNull();
    expect(st.exportState).toBeNull();
    expect(st.exportBytes).toBe(0);
  });
});

describe("apply intents (D10)", () => {
  it("applies a template or brand defaults to the open set as one undo step", async () => {
    seed({ A: setA });
    const { openSet, useOnstage, applyIntent } = await boot();
    const { TEMPLATES } = await import("@/lib/onstage/data");
    await openSet("A");
    const tpl = TEMPLATES.find((t) => t.ty !== 0)!;

    expect(applyIntent(`template:${tpl.slug}`)).toBe(true);
    expect(useOnstage.getState().frames.every((f) => f.bg === tpl.bg && f.tiltY === tpl.ty)).toBe(true);
    expect(useOnstage.temporal.getState().pastStates).toHaveLength(1);
    useOnstage.getState().undo();
    expect(useOnstage.getState().frames[0].caption).toBe("A one");
    expect(useOnstage.getState().frames[0].bg).toBe(setA.frames[0].bg);

    expect(applyIntent("brand:trailhead")).toBe(true);
    expect(useOnstage.getState().frames.every((f) => f.tiltY === -17)).toBe(true);
    expect(applyIntent("template:no-such-template")).toBe(false);
    expect(applyIntent("nonsense")).toBe(false);
  });
});
