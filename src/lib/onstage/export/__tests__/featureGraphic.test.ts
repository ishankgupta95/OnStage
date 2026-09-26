import { describe, expect, it } from "vitest";
import { BGS, CAPTIONS, bgCss } from "@/lib/onstage/data";
import { FEATURE_SAFE, featureGraphicLayout, type FeatureText } from "../featureGraphic";

/**
 * Plan S3.4 / EXPORT-7: the Play feature graphic is laid out from the set
 * itself — frame 0's background and caption, the app name only when something
 * names the app — and every line stays inside Play's uncropped centre
 * (x 8–92 %, y 12–88 %). The layout is pure, so it is checked here without
 * Konva.
 */

// Play's feature graphic, and the size it doubles to.
const W = 1024;
const H = 500;

// The safe zone written out from the spec rather than read from FEATURE_SAFE,
// so a drift in the constant is caught too.
const SAFE = { left: 0.08, right: 0.92, top: 0.12, bottom: 0.88 };

const SHORT = CAPTIONS[0]; // "Every run, mapped"
const LONG =
  "Plan every trail, log every mile and share every summit with friends who hike at your pace — even offline, even abroad, even when the signal drops for days at a time";
// One unbroken run with no space to wrap at.
const UNBROKEN = "Supercalifragilisticexpialidocious".repeat(6);

const layout = (over: Partial<Parameters<typeof featureGraphicLayout>[0]> = {}) =>
  featureGraphicLayout({ appName: "Pathfinder", caption: SHORT, bg: "ember", w: W, h: H, ...over });

/** Asserts a text box (x, y, x + width, y + height) lies inside the safe zone. */
function expectInSafeZone(t: FeatureText, w: number, h: number, label: string) {
  expect(t.x, `${label}: left edge`).toBeGreaterThanOrEqual(w * SAFE.left);
  expect(t.x + t.width, `${label}: right edge`).toBeLessThanOrEqual(w * SAFE.right);
  expect(t.y, `${label}: top edge`).toBeGreaterThanOrEqual(h * SAFE.top);
  expect(t.y + t.height, `${label}: bottom edge`).toBeLessThanOrEqual(h * SAFE.bottom);
}

/** One drawn line of this text, in px. */
const drawnLine = (t: FeatureText) => t.fontSize * t.lineHeight;

/** How many whole lines of this text fit in its box. */
const linesThatFit = (t: FeatureText) => Math.floor(t.height / drawnLine(t));

describe("FEATURE_SAFE", () => {
  it("is Play's uncropped centre: x 8–92 %, y 12–88 %", () => {
    expect(FEATURE_SAFE).toEqual({ left: 0.08, right: 0.92, top: 0.12, bottom: 0.88 });
  });
});

describe("featureGraphicLayout: the safe zone", () => {
  const cases: [string, string | null, string][] = [
    ["named, short caption", "Pathfinder", SHORT],
    ["named, long caption", "Pathfinder", LONG],
    ["named, unbroken caption", "Pathfinder", UNBROKEN],
    ["named, long app name", "The Extremely Long Name Of An Outdoor Navigation App For Hikers", LONG],
    ["unnamed, short caption", null, SHORT],
    ["unnamed, long caption", null, LONG],
    ["unnamed, unbroken caption", null, UNBROKEN],
  ];

  it.each(cases)("keeps every text box inside it at 1024×500 (%s)", (_label, appName, caption) => {
    const { texts } = layout({ appName, caption });
    expect(texts.length).toBeGreaterThan(0);
    texts.forEach((t, i) => expectInSafeZone(t, W, H, `text ${i}`));
  });

  it.each(cases)("keeps every text box inside it at 2048×1000 (%s)", (_label, appName, caption) => {
    const { texts } = layout({ appName, caption, w: 2 * W, h: 2 * H });
    texts.forEach((t, i) => expectInSafeZone(t, 2 * W, 2 * H, `text ${i}`));
  });

  it("gives a long caption the same box as a short one — it wraps and ends in … instead of growing", () => {
    // The box is what bounds the drawing (Konva wraps inside width and cuts
    // at height), so a long caption must not stretch it past the safe zone.
    for (const appName of ["Pathfinder", null]) {
      const short = layout({ appName, caption: SHORT }).texts;
      const long = layout({ appName, caption: LONG }).texts;
      const pick = ({ x, y, width, height }: FeatureText) => ({ x, y, width, height });
      expect(long.map(pick)).toEqual(short.map(pick));
    }
  });
});

describe("featureGraphicLayout: without an app name", () => {
  it("draws exactly one text, the caption, and never the sample's 'Trailhead'", () => {
    const { texts } = layout({ appName: null });
    expect(texts).toHaveLength(1);
    expect(texts[0].text).toBe(SHORT);
    expect(texts.some((t) => t.text.includes("Trailhead"))).toBe(false);
  });

  it("treats an empty name as no name", () => {
    const { texts } = layout({ appName: "" });
    expect(texts).toHaveLength(1);
    expect(texts[0].text).toBe(SHORT);
  });

  it("sets the caption larger and bolder, wrapping to at most four lines", () => {
    const [cap] = layout({ appName: null }).texts;
    expect(cap.fontSize).toBe(44);
    expect(cap.fontStyle).toBe("600");
    expect(cap.wrap).toBe("word");
    expect(linesThatFit(cap)).toBe(4);
  });

  it.each([1, 2, 3, 4])(
    "centres the %i line(s) the caption really takes in the safe zone (within 1px)",
    (captionLines) => {
      const [cap] = layout({ appName: null, captionLines }).texts;
      const drawn = captionLines * drawnLine(cap);
      const above = cap.y - H * SAFE.top;
      const below = H * SAFE.bottom - (cap.y + drawn);
      expect(Math.abs(above - below)).toBeLessThanOrEqual(1);
      // The box still holds exactly those lines.
      expect(linesThatFit(cap)).toBe(captionLines);
    },
  );

  it("before it is measured, the caption gets the room of four lines", () => {
    expect(linesThatFit(layout({ appName: null }).texts[0])).toBe(4);
  });
});

describe("featureGraphicLayout: with an app name", () => {
  it("draws the name first, on one line, then the caption, wrapping", () => {
    const { texts } = layout({ appName: "Pathfinder", caption: SHORT });
    expect(texts).toHaveLength(2);
    const [name, cap] = texts;
    expect(name.text).toBe("Pathfinder");
    expect(name.fontStyle).toBe("600");
    expect(name.wrap).toBe("none");
    expect(name.fontSize).toBe(68);
    expect(cap.text).toBe(SHORT);
    expect(cap.wrap).toBe("word");
    expect(cap.fontStyle).toBe("normal");
    expect(cap.fontSize).toBe(32);
  });

  it("gives the caption room for at most three lines", () => {
    const [, cap] = layout().texts;
    expect(linesThatFit(cap)).toBe(3);
  });

  it("sets the caption below the name without overlapping it", () => {
    for (const caption of [SHORT, LONG]) {
      for (const captionLines of [undefined, 1, 3]) {
        const [name, cap] = layout({ caption, captionLines }).texts;
        expect(cap.y).toBeGreaterThanOrEqual(name.y + name.height);
        // Same column: both start at the safe zone's left edge.
        expect(cap.x).toBe(name.x);
      }
    }
  });

  it.each([1, 2, 3])(
    "centres the name and the %i caption line(s) really drawn in the safe zone (within 1px)",
    (captionLines) => {
      const [name, cap] = layout({ captionLines }).texts;
      const above = name.y - H * SAFE.top;
      const below = H * SAFE.bottom - (cap.y + captionLines * drawnLine(cap));
      expect(above).toBeGreaterThan(0);
      expect(Math.abs(above - below)).toBeLessThanOrEqual(1);
      expect(linesThatFit(cap)).toBe(captionLines);
    },
  );

  it("before it is measured, the caption under a name gets the room of three lines", () => {
    expect(linesThatFit(layout().texts[1])).toBe(3);
  });

  it("a measured line count outside 1…max is clamped", () => {
    expect(linesThatFit(layout({ captionLines: 0 }).texts[1])).toBe(1);
    expect(linesThatFit(layout({ captionLines: 9 }).texts[1])).toBe(3);
    expect(linesThatFit(layout({ appName: null, captionLines: 9 }).texts[0])).toBe(4);
  });

  it("uses the name it is given, whatever the sample calls itself", () => {
    const { texts } = layout({ appName: "Moss Notes" });
    expect(texts[0].text).toBe("Moss Notes");
    expect(texts.some((t) => t.text.includes("Trailhead"))).toBe(false);
  });
});

describe("featureGraphicLayout: ink", () => {
  it.each(["bone", "sun"])("uses dark ink on the light %s ground: name full, caption at 78 %%", (bg) => {
    const [name, cap] = layout({ bg }).texts;
    expect(name.fill).toBe("#1a1614");
    expect(cap.fill).toBe("rgba(26,22,20,0.78)");
  });

  it.each(["ember", "dusk"])("uses white ink on the dark %s ground: name full, caption at 78 %%", (bg) => {
    const [name, cap] = layout({ bg }).texts;
    expect(name.fill).toBe("#fff");
    expect(cap.fill).toBe("rgba(255,255,255,0.78)");
  });

  it("gives the caption full ink when there is no name to soften it against", () => {
    expect(layout({ appName: null, bg: "bone" }).texts[0].fill).toBe("#1a1614");
    expect(layout({ appName: null, bg: "sun" }).texts[0].fill).toBe("#1a1614");
    expect(layout({ appName: null, bg: "ember" }).texts[0].fill).toBe("#fff");
    expect(layout({ appName: null, bg: "dusk" }).texts[0].fill).toBe("#fff");
  });
});

describe("featureGraphicLayout: background", () => {
  it.each(BGS.map((b) => b.id))("paints frame 0's own %s background", (bg) => {
    expect(layout({ bg }).background).toBe(bgCss(bg));
    expect(layout({ bg, appName: null }).background).toBe(bgCss(bg));
  });

  it("falls back to the first background, with white ink, for an unknown id", () => {
    const { background, texts } = layout({ bg: "no-such-bg" });
    expect(background).toBe(BGS[0].css);
    expect(texts[0].fill).toBe("#fff");
  });
});

describe("featureGraphicLayout: scale", () => {
  it.each([
    ["named", "Pathfinder"],
    ["unnamed", null],
  ] as const)("doubles every size and position at 2048×1000 (%s)", (_label, appName) => {
    const small = layout({ appName, w: W, h: H }).texts;
    const big = layout({ appName, w: 2 * W, h: 2 * H }).texts;
    expect(big).toHaveLength(small.length);
    small.forEach((s, i) => {
      const b = big[i];
      // Every value is rounded to whole pixels, so allow the rounding.
      expect(Math.abs(b.fontSize - 2 * s.fontSize), `text ${i} fontSize`).toBeLessThanOrEqual(1);
      for (const key of ["x", "y", "width", "height"] as const) {
        expect(Math.abs(b[key] - 2 * s[key]), `text ${i} ${key}`).toBeLessThanOrEqual(2);
      }
      // Nothing else changes with size.
      expect(b.lineHeight).toBe(s.lineHeight);
      expect(b.fontStyle).toBe(s.fontStyle);
      expect(b.wrap).toBe(s.wrap);
      expect(b.fill).toBe(s.fill);
      expect(b.text).toBe(s.text);
      expect(linesThatFit(b)).toBe(linesThatFit(s));
    });
  });

  it("scales with height, not width", () => {
    // k = h / 500: the same height at a wider width keeps the type size.
    const base = layout().texts;
    const wide = layout({ w: 2 * W }).texts;
    expect(wide.map((t) => t.fontSize)).toEqual(base.map((t) => t.fontSize));
    expect(wide.map((t) => t.y)).toEqual(base.map((t) => t.y));
  });
});

describe("featureGraphicLayout: room for the ellipsis", () => {
  // Konva fits a line to the box, then may swap its last three characters for
  // a wider "…" without measuring again: a font size of slack on the right
  // keeps that inside the safe zone.
  it.each([null, "Pathfinder"])("every box ends at least a font size inside the zone's right edge (name %s)", (appName) => {
    for (const t of layout({ appName, caption: LONG }).texts) {
      expect(t.x + t.width + t.fontSize).toBeLessThanOrEqual(W * SAFE.right);
    }
  });
});

describe("featureGraphicLayout: the caption as one clean paragraph", () => {
  it("joins lines and collapses spaces, so blank lines and trailing spaces never count as drawn", () => {
    const [, cap] = layout({ caption: "  Every run,\n\n  mapped \n" }).texts;
    expect(cap.text).toBe("Every run, mapped");
    expect(cap.role).toBe("caption");
  });

  it("names each text's role: the name, then the caption", () => {
    expect(layout().texts.map((t) => t.role)).toEqual(["name", "caption"]);
    expect(layout({ appName: null }).texts.map((t) => t.role)).toEqual(["caption"]);
  });

  it("a blank caption leaves the name alone, centred in the zone", () => {
    const { texts } = layout({ caption: " \n\t " });
    expect(texts).toHaveLength(1);
    const [name] = texts;
    expect(name.role).toBe("name");
    const mid = name.y + drawnLine(name) / 2;
    expect(Math.abs(mid - H / 2)).toBeLessThanOrEqual(1);
    expectInSafeZone(name, W, H, "name alone");
  });

  it("nothing to write — no name, no caption — draws no text", () => {
    expect(layout({ appName: null, caption: "  " }).texts).toEqual([]);
  });
});
