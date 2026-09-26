import { describe, expect, it } from "vitest";
import type { App, ScreenshotSet } from "@/lib/data/types";
import { appSummary, librarySummary } from "../library";

/**
 * The dashboard's derived words (plan S2.3): the library subtitle and each
 * app card's meta line, tags and thumbnail strip — from the records, never
 * fixed strings.
 */

const APP_THUMBS = ["stored-1", "stored-2", "stored-3", "stored-4"];
const app: Pick<App, "thumbs"> = { thumbs: APP_THUMBS };

let n = 0;
const set = (over: Partial<ScreenshotSet> = {}): ScreenshotSet => ({
  id: `set_${++n}`,
  appId: "app_1",
  name: `Set ${n}`,
  sub: "App Store · EN",
  frameCount: 3,
  status: "Draft",
  updatedAt: "2026-09-01T08:00:00.000Z",
  swatch: `swatch-${n}`,
  ...over,
});

describe("librarySummary", () => {
  it("singular and plural", () => {
    expect(librarySummary(1, 1)).toBe("1 app · 1 set");
    expect(librarySummary(2, 0)).toBe("2 apps · 0 sets");
    expect(librarySummary(1, 2)).toBe("1 app · 2 sets");
    expect(librarySummary(0, 0)).toBe("0 apps · 0 sets");
    expect(librarySummary(3, 12)).toBe("3 apps · 12 sets");
  });
});

describe("appSummary — meta", () => {
  it("counts sets and names each platform once", () => {
    expect(appSummary(app, [set()]).meta).toBe("1 SET");
    expect(appSummary(app, [set({ store: "apple" }), set({ store: "apple" })]).meta).toBe("2 SETS · IOS");
    expect(appSummary(app, [set({ store: "play" })]).meta).toBe("1 SET · ANDROID");
    expect(appSummary(app, [set({ store: "play" }), set({ store: "apple" })]).meta).toBe("2 SETS · IOS + ANDROID");
    expect(appSummary(app, []).meta).toBe("0 SETS");
  });

  it("records without a store (older records) add no platform", () => {
    expect(appSummary(app, [set(), set()]).meta).toBe("2 SETS");
    expect(appSummary(app, [set({ store: "apple" }), set()]).meta).toBe("2 SETS · IOS");
    expect(appSummary(app, [set(), set({ store: "play" }), set()]).meta).toBe("3 SETS · ANDROID");
  });
});

describe("appSummary — tags", () => {
  it("mixed ready and draft sets: the ready count (ok) then the drafts (neutral)", () => {
    const sets = [set({ status: "Ready" }), set({ status: "Draft" }), set({ status: "Ready" }), set({ status: "Draft" })];
    expect(appSummary(app, sets).tags).toEqual([
      { label: "2 ready", kind: "ok" },
      { label: "2 drafts", kind: "neutral" },
    ]);
    expect(appSummary(app, [set({ status: "Ready" }), set({ status: "Draft" })]).tags).toEqual([
      { label: "1 ready", kind: "ok" },
      { label: "1 draft", kind: "neutral" },
    ]);
  });

  it("all ready: only the ready tag", () => {
    expect(appSummary(app, [set({ status: "Ready" }), set({ status: "Ready" }), set({ status: "Ready" })]).tags).toEqual([
      { label: "3 ready", kind: "ok" },
    ]);
  });

  it("all drafts: only the drafts tag", () => {
    expect(appSummary(app, [set({ status: "Draft" })]).tags).toEqual([{ label: "1 draft", kind: "neutral" }]);
  });

  it("no sets: No sets yet", () => {
    expect(appSummary(app, []).tags).toEqual([{ label: "No sets yet", kind: "neutral" }]);
  });
});

describe("appSummary — thumbs", () => {
  it("the newest set's swatches (by ISO updatedAt, wherever it is listed), repeated to four", () => {
    const older = set({ updatedAt: "2026-09-01T08:00:00.000Z", swatches: ["o1", "o2", "o3", "o4"] });
    const newest = set({ updatedAt: "2026-09-20T08:00:00.000Z", swatches: ["n1", "n2"] });
    const middle = set({ updatedAt: "2026-09-10T08:00:00.000Z", swatches: ["m1", "m2", "m3", "m4"] });

    expect(appSummary(app, [older, newest, middle]).thumbs).toEqual(["n1", "n2", "n1", "n2"]);
    expect(appSummary(app, [newest, middle, older]).thumbs).toEqual(["n1", "n2", "n1", "n2"]);
    expect(appSummary(app, [middle, older]).thumbs).toEqual(["m1", "m2", "m3", "m4"]);
  });

  it("repeats an odd strip in order and never shows more than four", () => {
    expect(appSummary(app, [set({ swatches: ["a", "b", "c"] })]).thumbs).toEqual(["a", "b", "c", "a"]);
    expect(appSummary(app, [set({ swatches: ["a"] })]).thumbs).toEqual(["a", "a", "a", "a"]);
    expect(appSummary(app, [set({ swatches: ["a", "b", "c", "d", "e", "f"] })]).thumbs).toEqual(["a", "b", "c", "d"]);
  });

  it("a newest set without swatches (older record) falls back to its swatch", () => {
    const olderWithStrip = set({ updatedAt: "2026-09-01T08:00:00.000Z", swatches: ["o1", "o2"] });
    const newestNoStrip = set({ updatedAt: "2026-09-02T08:00:00.000Z", swatch: "only-swatch" });
    expect(appSummary(app, [olderWithStrip, newestNoStrip]).thumbs).toEqual([
      "only-swatch",
      "only-swatch",
      "only-swatch",
      "only-swatch",
    ]);
    const emptyStrip = set({ updatedAt: "2026-09-03T08:00:00.000Z", swatch: "fallback", swatches: [] });
    expect(appSummary(app, [olderWithStrip, emptyStrip]).thumbs).toEqual(["fallback", "fallback", "fallback", "fallback"]);
  });

  it("an undated record (a display string like \"2h ago\") sorts after every dated one", () => {
    const undated = set({ updatedAt: "2h ago", swatches: ["u1"] });
    const dated = set({ updatedAt: "2020-01-01T00:00:00.000Z", swatches: ["d1", "d2", "d3", "d4"] });
    expect(appSummary(app, [undated, dated]).thumbs).toEqual(["d1", "d2", "d3", "d4"]);
  });

  it("no sets: the app's stored strip", () => {
    expect(appSummary(app, []).thumbs).toEqual(APP_THUMBS);
    expect(appSummary({ thumbs: [] }, []).thumbs).toEqual([]);
  });

  it("doesn't reorder or change the sets it is given", () => {
    const sets = [
      set({ updatedAt: "2026-09-01T08:00:00.000Z", swatches: ["a"] }),
      set({ updatedAt: "2026-09-09T08:00:00.000Z", swatches: ["b"] }),
    ];
    const before = JSON.stringify(sets);
    appSummary(app, sets);
    expect(JSON.stringify(sets)).toBe(before);
  });
});
