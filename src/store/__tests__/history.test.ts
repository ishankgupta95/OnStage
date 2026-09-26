import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { localBackend } from "@/lib/data/local";
import {
  beginHistoryGesture,
  endHistoryGesture,
  historyGestureLive,
  openSet,
  useOnstage,
} from "../onstage";

const history = () => useOnstage.temporal.getState();
/** Longer than the store's typing-burst window. */
const TYPING_PAUSE = 1500;
const frames = () => useOnstage.getState().frames;

const fresh = () =>
  ["Every run, mapped", "Know your pace", "Trails near you", "Share the route", "Built for the long haul"].map(
    (caption, i) => ({ caption, bg: i === 1 ? "dusk" : "ember", tiltX: 0, tiltY: 0, depth: 0, scale: 1, screenshot: null }),
  );

let n = 0;
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  await openSet(`history-${++n}`);
  useOnstage.setState({ frames: fresh(), active: 0, sel: "device" });
  history().clear();
});
afterEach(async () => {
  await vi.runOnlyPendingTimersAsync();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("undo/redo keeps the selection valid (EDITOR-1)", () => {
  it("add frame → undo → edit leaves no malformed frame", () => {
    const before = frames().length;
    useOnstage.getState().addFrame();
    expect(useOnstage.getState().active).toBe(before);

    useOnstage.getState().undo();
    expect(frames()).toHaveLength(before);
    expect(useOnstage.getState().active).toBe(before - 1);

    useOnstage.getState().patchFrame({ caption: "After undo" });
    useOnstage.getState().setState({ sel: "bg" });
    useOnstage.getState().nudgeScale(0.06);
    useOnstage.getState().applyBgToAll();

    expect(frames()).toHaveLength(before);
    for (const f of frames()) {
      expect(Object.keys(f).sort()).toEqual(
        ["bg", "caption", "depth", "scale", "screenshot", "tiltX", "tiltY"].sort(),
      );
      expect(Number.isFinite(f.scale)).toBe(true);
    }
    expect(frames()[before - 1].caption).toBe("After undo");
  });

  it("redo of a removal clamps the selection too", () => {
    const n = frames().length;
    useOnstage.getState().select(n - 1);
    useOnstage.getState().removeFrame(n - 1);
    useOnstage.getState().undo();
    useOnstage.getState().select(n - 1);
    useOnstage.getState().redo();
    expect(useOnstage.getState().active).toBe(n - 2);
  });

  it("patchFrame is a no-op when nothing is selected in range", () => {
    const snapshot = frames();
    useOnstage.setState({ active: 99 });
    useOnstage.getState().patchFrame({ caption: "ghost" });
    useOnstage.getState().nudgeScale(0.1);
    useOnstage.getState().applyBgToAll();
    useOnstage.getState().resetTilt();
    expect(frames()).toBe(snapshot);
  });
});

describe("one gesture is one history entry (EDITOR-2)", () => {
  it("a tilt drag records a single entry that undoes the whole drag", () => {
    const start = frames()[0];
    beginHistoryGesture();
    for (let i = 1; i <= 60; i++) useOnstage.getState().patchFrame({ tiltY: -i % 34, tiltX: i % 22 });
    endHistoryGesture();

    expect(history().pastStates).toHaveLength(1);
    useOnstage.getState().undo();
    expect(frames()[0]).toEqual(start);
    useOnstage.getState().redo();
    expect(frames()[0].tiltY).toBe(-60 % 34);
  });

  it("a gesture that changes nothing records nothing", () => {
    beginHistoryGesture();
    endHistoryGesture();
    expect(history().pastStates).toHaveLength(0);
  });

  it("two drags leave earlier edits undoable", () => {
    useOnstage.getState().patchFrame({ bg: "moss" });
    for (let d = 0; d < 2; d++) {
      beginHistoryGesture();
      for (let i = 0; i < 100; i++) useOnstage.getState().patchFrame({ depth: (i + d * 7) % 100 });
      endHistoryGesture();
    }
    expect(history().pastStates).toHaveLength(3);
    useOnstage.getState().undo();
    useOnstage.getState().undo();
    useOnstage.getState().undo();
    expect(frames()[0].bg).not.toBe("moss");
  });

  it("typing a headline is one entry per burst", () => {
    const original = frames()[0].caption;
    for (const text of ["E", "Ev", "Eve", "Ever", "Every"]) {
      useOnstage.getState().typeCaption(text);
      vi.advanceTimersByTime(120);
    }
    expect(history().pastStates).toHaveLength(1);

    vi.advanceTimersByTime(2000); // a pause ends the burst
    useOnstage.getState().typeCaption("Every run");
    expect(history().pastStates).toHaveLength(2);

    useOnstage.getState().undo();
    expect(frames()[0].caption).toBe("Every");
    useOnstage.getState().undo();
    expect(frames()[0].caption).toBe(original);
  });

  it("typing into another frame's headline is a new entry", () => {
    useOnstage.getState().typeCaption("one");
    useOnstage.getState().select(1, "caption");
    useOnstage.getState().typeCaption("two");
    expect(history().pastStates).toHaveLength(2);
  });

  it("a suggestion click is its own entry, not part of the typing burst", () => {
    const original = frames()[0].caption;
    useOnstage.getState().typeCaption("Hel");
    useOnstage.getState().typeCaption("Hello");
    vi.advanceTimersByTime(300);
    useOnstage.getState().patchFrame({ caption: "Suggestion one" }); // a click
    vi.advanceTimersByTime(300);
    useOnstage.getState().patchFrame({ caption: "Suggestion two" }); // another click
    expect(history().pastStates).toHaveLength(3);
    useOnstage.getState().undo();
    expect(frames()[0].caption).toBe("Suggestion one");
    useOnstage.getState().undo();
    expect(frames()[0].caption).toBe("Hello");
    useOnstage.getState().undo();
    expect(frames()[0].caption).toBe(original);
  });

  it("typing right after an undo starts a new entry", () => {
    useOnstage.getState().typeCaption("abc");
    useOnstage.getState().undo();
    useOnstage.getState().typeCaption("abd");
    expect(history().pastStates).toHaveLength(1);
    useOnstage.getState().undo();
    expect(frames()[0].caption).not.toBe("abd");
  });

  it("⌘Z with the button still held keeps the rest of the drag one entry", () => {
    useOnstage.getState().patchFrame({ bg: "moss" });
    beginHistoryGesture();
    for (let i = 1; i <= 5; i++) useOnstage.getState().patchFrame({ depth: i });
    useOnstage.getState().undo(); // commits the drag so far, then undoes it
    expect(frames()[0].depth).toBe(0);
    for (let i = 6; i <= 40; i++) useOnstage.getState().patchFrame({ depth: i });
    endHistoryGesture();
    // The bg edit, then the rest of the drag as one entry (recording it
    // dropped the undone first part from redo).
    expect(history().pastStates).toHaveLength(2);
    useOnstage.getState().undo();
    expect(frames()[0].depth).toBe(0);
    expect(frames()[0].bg).toBe("moss");
  });

  it("an edit that changes nothing records nothing and keeps redo", () => {
    useOnstage.getState().patchFrame({ bg: "moss" });
    useOnstage.getState().undo();
    expect(history().futureStates).toHaveLength(1);
    const bg = frames()[0].bg;
    useOnstage.getState().patchFrame({ bg }); // the swatch that is already selected
    useOnstage.getState().resetTilt(); // already flat
    beginHistoryGesture();
    useOnstage.getState().patchFrame({ depth: 0 });
    endHistoryGesture();
    expect(history().pastStates).toHaveLength(0);
    expect(history().futureStates).toHaveLength(1);
    useOnstage.getState().redo();
    expect(frames()[0].bg).toBe("moss");
  });
});

describe("removing frames keeps the same frame selected (EDITOR-12)", () => {
  it("removing a frame before the selection", () => {
    const captions = frames().map((f) => f.caption);
    useOnstage.getState().select(3);
    useOnstage.getState().removeFrame(1);
    expect(useOnstage.getState().active).toBe(2);
    expect(frames()[useOnstage.getState().active].caption).toBe(captions[3]);
  });

  it("removing the selected last frame selects the new last", () => {
    const n = frames().length;
    useOnstage.getState().select(n - 1);
    useOnstage.getState().removeFrame(n - 1);
    expect(useOnstage.getState().active).toBe(n - 2);
  });

  it("removing a frame after the selection leaves it alone", () => {
    useOnstage.getState().select(1);
    useOnstage.getState().removeFrame(3);
    expect(useOnstage.getState().active).toBe(1);
  });

  it("undoing a removal keeps the same frame selected", () => {
    const d = frames()[3];
    useOnstage.getState().select(3);
    useOnstage.getState().removeFrame(1);
    useOnstage.getState().undo();
    expect(frames()[useOnstage.getState().active]).toBe(d);
    useOnstage.getState().redo();
    expect(frames()[useOnstage.getState().active]).toBe(d);
  });

  it("undoing a reorder keeps the same frame selected", () => {
    const a = frames()[0];
    useOnstage.getState().select(0);
    useOnstage.getState().moveFrame(0, 4);
    expect(frames()[useOnstage.getState().active]).toBe(a);
    useOnstage.getState().undo();
    expect(useOnstage.getState().active).toBe(0);
    useOnstage.getState().redo();
    expect(useOnstage.getState().active).toBe(4);
  });
});

describe("a drag that spans loading another set", () => {
  it("ends with the switch, so undo can't write the old set over the new one", async () => {
    const other = `history-other-${n}`;
    const otherFrames = [{ caption: "OTHER", bg: "ink", tiltX: 0, tiltY: 0, depth: 0, scale: 1, screenshot: null }];
    await localBackend.saveSetDoc(other, {
      frames: otherFrames,
      device: "ip16pm",
      frameColor: "graphite",
      captionFont: "Inter",
      align: "center",
      captionSize: 44,
      panorama: false,
      shadow: true,
      lang: "EN",
      store: "apple",
      workMode: "canvas",
    });
    const drag = beginHistoryGesture();
    useOnstage.getState().patchFrame({ tiltY: -10 });
    await openSet(other);
    expect(historyGestureLive(drag)).toBe(false); // the pad's moves now do nothing
    endHistoryGesture(drag);
    expect(history().pastStates).toHaveLength(0);
    useOnstage.getState().undo();
    expect(frames()).toHaveLength(1);
    expect(frames()[0].caption).toBe("OTHER");
    await vi.advanceTimersByTimeAsync(1000);
    expect((await localBackend.loadSetDoc(other))!.frames[0].caption).toBe("OTHER");
  });
});

describe("autosave timing (EDITOR-24)", () => {
  it("flushes the pending save when the page is hidden", async () => {
    const save = vi.spyOn(localBackend, "saveSetDoc");
    useOnstage.getState().patchFrame({ caption: "Before closing" });
    expect(save).not.toHaveBeenCalled();
    window.dispatchEvent(new Event("pagehide"));
    await vi.advanceTimersByTimeAsync(0);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][1].frames[0].caption).toBe("Before closing");
  });

  it("flushes the pending save when the tab is backgrounded", async () => {
    const save = vi.spyOn(localBackend, "saveSetDoc");
    useOnstage.getState().patchFrame({ caption: "Switching tabs" });
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(0);
    visibility.mockRestore();
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][1].frames[0].caption).toBe("Switching tabs");
  });

  it("never lets an older save land after a newer one", async () => {
    const order: string[] = [];
    const real = localBackend.saveSetDoc;
    let release!: () => void;
    vi.spyOn(localBackend, "saveSetDoc").mockImplementation(async (id, doc) => {
      const caption = doc.frames[0].caption;
      if (caption === "slow") await new Promise<void>((r) => (release = r));
      order.push(caption);
      return real(id, doc);
    });
    useOnstage.getState().patchFrame({ caption: "slow" });
    window.dispatchEvent(new Event("pagehide")); // save #1 starts and hangs
    await vi.advanceTimersByTimeAsync(0);
    vi.advanceTimersByTime(TYPING_PAUSE);
    useOnstage.getState().patchFrame({ caption: "fast" });
    window.dispatchEvent(new Event("pagehide")); // save #2 queued behind it
    await vi.advanceTimersByTimeAsync(0);
    expect(order).toEqual([]);
    release();
    await vi.advanceTimersByTimeAsync(0);
    expect(order).toEqual(["slow", "fast"]);
    expect(useOnstage.getState().saveState).toBe("saved");
  });

  it("shows SAVED only when the latest edit is stored", async () => {
    let release!: () => void;
    const real = localBackend.saveSetDoc;
    const save = vi.spyOn(localBackend, "saveSetDoc").mockImplementationOnce(async (id, doc) => {
      await new Promise<void>((r) => (release = r));
      return real(id, doc);
    });
    useOnstage.getState().patchFrame({ caption: "first" });
    await vi.advanceTimersByTimeAsync(400); // save #1 starts and hangs
    useOnstage.getState().patchFrame({ caption: "second" }); // a newer edit
    release();
    await vi.advanceTimersByTimeAsync(0);
    expect(useOnstage.getState().saveState).toBe("saving");
    await vi.advanceTimersByTimeAsync(400);
    expect(save).toHaveBeenCalledTimes(2);
    expect(useOnstage.getState().saveState).toBe("saved");
  });
});
