import { describe, expect, it } from "vitest";
import {
  EXPORT_ROOT,
  FEATURE_FILE,
  exportLocales,
  exportPlan,
  formatMB,
  frameFile,
  localeFolder,
  slotFiles,
  tabletNote,
} from "../plan";
import { EXPORT_SLOTS } from "../slots";
import { exportRoot } from "../../appName";

/**
 * Plan S3.2: the export dialog's and guided step 4's numbers come from one
 * pure function, by the same rules renderSet writes the zip with — no fixed
 * "40 files", "16.8 MB" or tablet warning.
 */

// The six rows, by position (what the dialog's picks hold).
const IPHONE_69 = 0;
const IPHONE_65 = 1;
const IPAD = 2;
const PHONE = 3;
const TABLET_7 = 4;
const FEATURE = 5;

const plan = (picks: number[], langs: string[], frameCount: number, root = exportRoot("Trailhead")) =>
  exportPlan({ picks, langs, frameCount, root });

/** The size estimate, written out from its definition: every file costs its
 *  pixel count × 0.46 bytes. */
const expectedBytes = (picks: number[], locales: number, frameCount: number) =>
  picks.reduce((sum, i) => {
    const slot = EXPORT_SLOTS[i];
    const files = (slot.kind === "feature" ? 1 : frameCount) * locales;
    return sum + slot.w * slot.h * 0.46 * files;
  }, 0);

describe("the slot table the plan reads", () => {
  it("has the six rows in dialog order, the feature graphic last", () => {
    expect(EXPORT_SLOTS.map((s) => s.folder)).toEqual([
      "APP_IPHONE_69",
      "APP_IPHONE_65",
      "APP_IPAD_PRO_3GEN_129",
      "PHONE",
      "TABLET_7",
      "",
    ]);
    expect(EXPORT_SLOTS[FEATURE].kind).toBe("feature");
    expect(EXPORT_SLOTS.filter((s) => s.kind === "feature")).toHaveLength(1);
  });
});

describe("exportLocales", () => {
  it("is EN when no locale is picked", () => {
    expect(exportLocales([])).toEqual(["EN"]);
  });

  it("is the picked locales, in order, otherwise", () => {
    expect(exportLocales(["DE"])).toEqual(["DE"]);
    expect(exportLocales(["JA", "EN", "ES"])).toEqual(["JA", "EN", "ES"]);
  });

  it("returns a copy, never the caller's array", () => {
    const langs = ["EN", "DE"];
    const out = exportLocales(langs);
    expect(out).not.toBe(langs);
    out.push("JA");
    expect(langs).toEqual(["EN", "DE"]);
  });
});

describe("localeFolder", () => {
  it("names the known locales' folders", () => {
    expect(localeFolder("EN")).toBe("en-US");
    expect(localeFolder("DE")).toBe("de-DE");
    expect(localeFolder("JA")).toBe("ja-JP");
    expect(localeFolder("ES")).toBe("es-ES");
  });

  it("lower-cases an unknown locale", () => {
    expect(localeFolder("FR")).toBe("fr");
  });
});

describe("file names", () => {
  it("numbers frames from 01, two digits", () => {
    expect(frameFile(0)).toBe("01.png");
    expect(frameFile(4)).toBe("05.png");
    expect(frameFile(9)).toBe("10.png");
    expect(frameFile(11)).toBe("12.png");
  });

  it("names the feature graphic by its size", () => {
    expect(FEATURE_FILE).toBe("feature-graphic-1024x500.png");
  });

  it("zips under a neutral folder when nothing names the app", () => {
    expect(EXPORT_ROOT).toBe("onstage-export-store-assets");
    expect(EXPORT_ROOT).toBe(exportRoot(null));
  });
});

describe("slotFiles", () => {
  it("is one file per frame for a size, one for the feature graphic", () => {
    expect(slotFiles(EXPORT_SLOTS[IPHONE_69], 5)).toBe(5);
    expect(slotFiles(EXPORT_SLOTS[TABLET_7], 7)).toBe(7);
    expect(slotFiles(EXPORT_SLOTS[FEATURE], 5)).toBe(1);
    expect(slotFiles({ kind: "feature" }, 0)).toBe(1);
    expect(slotFiles({ kind: "frames" }, 0)).toBe(0);
  });
});

describe("exportPlan — the file count", () => {
  it("is every picked size's frames plus one feature graphic, per locale", () => {
    // 3·2 + 3·2 + 1·2
    expect(plan([IPHONE_69, PHONE, FEATURE], ["EN", "DE"], 3).files).toBe(14);
    // 5·1
    expect(plan([IPHONE_69], ["EN"], 5).files).toBe(5);
    // (5 + 5 + 5 + 5)·2 — the editor's default picks and locales.
    expect(plan([IPHONE_69, IPHONE_65, PHONE, TABLET_7], ["EN", "DE"], 5).files).toBe(40);
    // 7·1 — a longer set, one locale, iPad only.
    expect(plan([IPAD], ["JA"], 7).files).toBe(7);
    // Every size, four locales, ten frames: (5·10 + 1)·4
    expect(plan([0, 1, 2, 3, 4, 5], ["EN", "DE", "JA", "ES"], 10).files).toBe(204);
  });

  it("follows the frame count and the locale count, not a fixed number", () => {
    const picks = [IPHONE_69, IPHONE_65, PHONE, TABLET_7];
    expect(plan(picks, ["EN", "DE"], 5).files).toBe(40);
    expect(plan(picks, ["EN", "DE"], 6).files).toBe(48);
    expect(plan(picks, ["EN"], 5).files).toBe(20);
    expect(plan(picks, ["EN", "DE", "JA"], 3).files).toBe(36);
  });

  it("counts EN when no locale is picked", () => {
    const p = plan([IPHONE_69, FEATURE], [], 4);
    expect(p.locales).toEqual(["EN"]);
    expect(p.files).toBe(5);
  });

  it("is zero with nothing picked", () => {
    const p = plan([], ["EN", "DE"], 5);
    expect(p.slots).toEqual([]);
    expect(p.files).toBe(0);
    expect(p.estBytes).toBe(0);
  });

  it("ignores picks outside the slot table and repeated picks", () => {
    expect(plan([-1, 6, 99, IPHONE_69], ["EN"], 5).files).toBe(5);
    expect(plan([-1, 6, 99], ["EN"], 5).files).toBe(0);
    expect(plan([IPHONE_69, IPHONE_69], ["EN"], 5).files).toBe(5);
    expect(plan([-1, 6, 99, IPHONE_69], ["EN"], 5).slots.map((s) => s.index)).toEqual([IPHONE_69]);
  });

  it("treats a negative frame count as none: sizes write nothing, the feature graphic still one", () => {
    expect(plan([IPHONE_69, FEATURE], ["EN", "DE"], -3).files).toBe(2);
    expect(plan([IPHONE_69, FEATURE], ["EN", "DE"], 0).files).toBe(2);
  });

  it("is the sum of its slots' files, each counted across every locale", () => {
    const p = plan([FEATURE, IPAD, IPHONE_65], ["EN", "ES", "DE"], 4);
    expect(p.slots.map((s) => ({ index: s.index, files: s.files }))).toEqual([
      { index: IPHONE_65, files: 12 },
      { index: IPAD, files: 12 },
      { index: FEATURE, files: 3 },
    ]);
    expect(p.files).toBe(27);
    expect(p.slots.map((s) => s.slot)).toEqual([EXPORT_SLOTS[IPHONE_65], EXPORT_SLOTS[IPAD], EXPORT_SLOTS[FEATURE]]);
  });

  it("lists slots in the table's order, whatever order they were picked in", () => {
    expect(plan([FEATURE, TABLET_7, IPHONE_69, PHONE], ["EN"], 2).slots.map((s) => s.index)).toEqual([
      IPHONE_69,
      PHONE,
      TABLET_7,
      FEATURE,
    ]);
  });

  it("matches the paths an export writes, one per file", () => {
    // Every path renderSet names, built from the plan's own helpers.
    const picks = [IPHONE_69, IPAD, FEATURE];
    const langs = ["EN", "JA"];
    const frames = 3;
    const paths = new Set<string>();
    for (const l of exportLocales(langs)) {
      for (const i of picks) {
        const slot = EXPORT_SLOTS[i];
        if (slot.kind === "feature") paths.add(`${localeFolder(l)}/${FEATURE_FILE}`);
        else for (let f = 0; f < frames; f++) paths.add(`${localeFolder(l)}/${slot.folder}/${frameFile(f)}`);
      }
    }
    expect(paths.size).toBe(plan(picks, langs, frames).files);
    expect(paths).toContain("ja-JP/APP_IPAD_PRO_3GEN_129/03.png");
    expect(paths).toContain("en-US/feature-graphic-1024x500.png");
  });
});

describe("exportPlan — the size estimate", () => {
  it("is Σ width × height × 0.46 bytes over every file", () => {
    expect(plan([IPHONE_69], ["EN"], 5).estBytes).toBeCloseTo(1320 * 2868 * 0.46 * 5, 3);
    expect(plan([FEATURE], ["EN", "DE"], 5).estBytes).toBeCloseTo(1024 * 500 * 0.46 * 2, 3);
    const picks = [IPHONE_69, IPHONE_65, IPAD, PHONE, TABLET_7, FEATURE];
    expect(plan(picks, ["EN", "DE", "JA"], 7).estBytes).toBeCloseTo(expectedBytes(picks, 3, 7), 3);
  });

  it("grows with frames and locales", () => {
    const picks = [IPHONE_69, PHONE];
    const base = plan(picks, ["EN"], 5).estBytes;
    expect(plan(picks, ["EN", "DE"], 5).estBytes).toBeCloseTo(base * 2, 3);
    expect(plan(picks, ["EN"], 10).estBytes).toBeCloseTo(base * 2, 3);
  });
});

describe("exportPlan — the folder tree", () => {
  it("is the root, the locale folders, then one line per picked size in table order", () => {
    const p = plan([FEATURE, PHONE, IPHONE_69], ["EN", "DE"], 5);
    expect(p.tree).toEqual([
      { text: "trailhead-store-assets/", ind: 0 },
      { text: "en-US/ · de-DE/", ind: 1 },
      { text: "APP_IPHONE_69/ 01…05.png", ind: 2 },
      { text: "PHONE/ 01…05.png", ind: 2 },
      { text: "feature-graphic-1024x500.png", ind: 2 },
    ]);
  });

  it("uses the root it is given", () => {
    expect(plan([IPHONE_69], ["EN"], 5, "ridgeline-store-assets").tree[0]).toEqual({
      text: "ridgeline-store-assets/",
      ind: 0,
    });
  });

  it("names only the locales picked, falling back to en-US", () => {
    expect(plan([IPAD], ["JA"], 7).tree.map((l) => l.text)).toEqual([
      "trailhead-store-assets/",
      "ja-JP/",
      "APP_IPAD_PRO_3GEN_129/ 01…07.png",
    ]);
    expect(plan([IPAD], [], 7).tree[1].text).toBe("en-US/");
    expect(plan([IPAD], ["ES", "FR"], 7).tree[1].text).toBe("es-ES/ · fr/");
  });

  it("names one frame as 01.png and ten as 01…10.png", () => {
    expect(plan([TABLET_7], ["EN"], 1).tree[2].text).toBe("TABLET_7/ 01.png");
    expect(plan([TABLET_7], ["EN"], 10).tree[2].text).toBe("TABLET_7/ 01…10.png");
  });

  it("is the root alone when nothing is picked — no locale line", () => {
    expect(plan([], ["EN", "DE"], 5).tree).toEqual([{ text: "trailhead-store-assets/", ind: 0 }]);
    expect(plan([42], ["EN"], 5).tree).toHaveLength(1);
  });

  it("lists the feature graphic alone when only it is picked", () => {
    expect(plan([FEATURE], ["EN"], 5).tree.map((l) => l.text)).toEqual([
      "trailhead-store-assets/",
      "en-US/",
      "feature-graphic-1024x500.png",
    ]);
  });
});

describe("formatMB", () => {
  it("shows mebibytes to one decimal", () => {
    expect(formatMB(0)).toBe("0.0 MB");
    expect(formatMB(1_048_576)).toBe("1.0 MB");
    expect(formatMB(1_572_864)).toBe("1.5 MB");
    expect(formatMB(104_858)).toBe("0.1 MB");
    expect(formatMB(52_000)).toBe("0.0 MB");
    expect(formatMB(104_857_600)).toBe("100.0 MB");
  });

  it("formats a plan's estimate", () => {
    const p = plan([IPHONE_69], ["EN"], 5);
    expect(formatMB(p.estBytes)).toBe(`${((1320 * 2868 * 0.46 * 5) / 1_048_576).toFixed(1)} MB`);
  });
});

describe("tabletNote", () => {
  it("is absent when no tablet size is picked", () => {
    expect(tabletNote(plan([], ["EN"], 5), "ip16pm")).toBeNull();
    expect(tabletNote(plan([IPHONE_69, IPHONE_65, PHONE, FEATURE], ["EN", "DE"], 5), "ip16pm")).toBeNull();
  });

  it("is present when the iPad or the 7″ tablet is picked", () => {
    for (const picks of [[IPAD], [TABLET_7], [IPHONE_69, IPAD], [PHONE, TABLET_7, FEATURE], [IPAD, TABLET_7]]) {
      const note = tabletNote(plan(picks, ["EN"], 5), "ip16pm");
      expect(note, `picks ${picks.join(",")}`).not.toBeNull();
    }
  });

  it("says the phone screenshot is cropped, never stretched or soft", () => {
    const note = tabletNote(plan([IPAD, TABLET_7], ["EN"], 5), "ip16pm") ?? "";
    expect(note).toBe("Tablet sizes use your phone screenshots, cropped to fit the tablet screen.");
    expect(note).not.toMatch(/stretch|soft/i);
  });

  it("says nothing with No frame: no tablet is drawn, so nothing is cropped to one", () => {
    expect(tabletNote(plan([IPAD, TABLET_7], ["EN"], 5), "none")).toBeNull();
    for (const device of ["ip16pm", "ip15", "ipad", "pixel"]) {
      expect(tabletNote(plan([IPAD], ["EN"], 5), device)).not.toBeNull();
    }
  });

  it("reads only the picked slots", () => {
    expect(tabletNote({ slots: [] }, "ip16pm")).toBeNull();
    expect(tabletNote({ slots: [{ index: IPAD, slot: EXPORT_SLOTS[IPAD], files: 0 }] }, "ip16pm")).not.toBeNull();
  });
});
