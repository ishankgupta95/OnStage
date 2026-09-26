import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { featureTextNodes } from "../featureGraphic";

/**
 * Plan S3.4 (EXPORT-7): the feature graphic's text drawn by the real Konva
 * wrapper — no spurious "…" on a caption that fits, a "…" when one doesn't,
 * and every line inside Play's safe zone. jsdom has no canvas, so the 2D
 * context is a stub whose text is 0.5 em per character (the ellipsis 1 em,
 * wider than the three narrow characters Konva trims for it).
 */

type Konva = typeof import("konva").default;
let Konva: Konva;

const W = 1024;
const H = 500;
const SAFE_RIGHT = W * 0.92;
const SAFE = { top: H * 0.12, bottom: H * 0.88 };

function fontPx(font: string): number {
  return Number(/(\d+(?:\.\d+)?)px/.exec(font)?.[1] ?? 10);
}

/** The stub's width of a string in a font. */
function widthOf(text: string, font: string): number {
  const px = fontPx(font);
  return [...text].reduce((w, ch) => w + (ch === "…" ? px : ch === "i" || ch === "l" ? 0.2 * px : 0.5 * px), 0);
}

beforeAll(async () => {
  const ctx = new Proxy(
    {
      font: "10px sans-serif",
      measureText: (t: string) => ({ width: widthOf(t, ctx.font) }),
      // Konva's canvas-farbling probe: an honest #282828 fill.
      getImageData: (_x: number, _y: number, w: number, h: number) => ({
        data: Uint8ClampedArray.from({ length: w * h * 4 }, (_, i) => (i % 4 === 3 ? 255 : 40)),
      }),
    } as {
      font: string;
      measureText: (t: string) => { width: number };
      getImageData: (x: number, y: number, w: number, h: number) => { data: Uint8ClampedArray };
    },
    {
      get: (target, key) => (key in target ? target[key as keyof typeof target] : () => {}),
      set: (target, key, value) => {
        (target as Record<string | symbol, unknown>)[key] = value;
        return true;
      },
    },
  );
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => ctx as never);
  Konva = (await import("konva")).default;
});

afterAll(() => {
  vi.restoreAllMocks();
});

const nodes = (appName: string | null, caption: string) =>
  featureTextNodes(Konva, { appName, caption, bg: "ember", w: W, h: H }, "Inter");

const lines = (node: ReturnType<typeof nodes>[number]) => node.textArr.map((l) => l.text);

/** Every drawn line of every node inside the safe zone. */
function expectInside(ns: ReturnType<typeof nodes>) {
  for (const n of ns) {
    const font = `${n.fontSize()}px`;
    for (const l of n.textArr) expect(n.x() + widthOf(l.text, font)).toBeLessThanOrEqual(SAFE_RIGHT);
    expect(n.y()).toBeGreaterThanOrEqual(SAFE.top);
    expect(n.y() + n.textArr.length * n.fontSize() * n.lineHeight()).toBeLessThanOrEqual(SAFE.bottom);
  }
}

describe("featureTextNodes with Konva's own wrapping", () => {
  it("a caption that fits keeps every word and no '…', even with trailing spaces or a trailing newline", () => {
    // 51 characters: exactly the named caption box's width at 32px.
    const fits = "Find every trail near you and share it with friends";
    for (const caption of [fits, `${fits} `, `${fits}\n`, `Short\n${fits}  `]) {
      const [, cap] = nodes("Pathfinder", caption);
      const drawn = lines(cap).join(" ");
      expect(drawn).not.toContain("…");
      expect(drawn).toBe(caption.replace(/\s+/g, " ").trim());
    }
  });

  it("a caption too long for its lines ends in '…' — paragraphs included — and stays inside the zone", () => {
    const long = "Pace, splits, elevation and heart rate for every route you take, on road or trail, day or night";
    for (const caption of [long.repeat(2), `Every run, mapped\n${long}\n${long}\nFree to start`]) {
      const ns = nodes("Pathfinder", caption);
      const cap = ns[1];
      expect(cap.textArr).toHaveLength(3);
      expect(lines(cap)[2].endsWith("…")).toBe(true);
      expectInside(ns);
    }
    const alone = nodes(null, long.repeat(3));
    expect(alone[0].textArr).toHaveLength(4);
    expect(lines(alone[0])[3].endsWith("…")).toBe(true);
    expectInside(alone);
  });

  it("paragraphs that fit are all drawn, joined, with no '…'", () => {
    const [, cap] = nodes("Pathfinder", "Every run, mapped\nPace and splits\n\nFree to start");
    expect(lines(cap).join(" ")).toBe("Every run, mapped Pace and splits Free to start");
  });

  it("the '…' after narrow letters still stays inside the zone", () => {
    const ns = nodes("Pathfinder", "still will fill ".repeat(40));
    expect(lines(ns[1]).at(-1)!.endsWith("…")).toBe(true);
    expectInside(ns);
    // One unbroken run of narrow letters packs every line to the box's edge:
    // Konva then swaps three of them for a much wider "…".
    for (const [name, caption] of [
      ["Pathfinder", "l".repeat(3000)],
      [null, "l".repeat(3000)],
      ["l".repeat(400), "Every run, mapped"],
    ] as const) {
      const packed = nodes(name, caption);
      expect(packed.some((n) => lines(n).some((l) => l.endsWith("…")))).toBe(true);
      expectInside(packed);
    }
  });

  it("a long name is cut with '…' inside the zone, on one line", () => {
    const ns = nodes("A remarkably long application name that goes on", "Every run, mapped");
    expect(ns[0].textArr).toHaveLength(1);
    expect(lines(ns[0])[0].endsWith("…")).toBe(true);
    expectInside(ns);
  });

  it("the block is centred on the lines drawn: one caption line sits lower than three", () => {
    const one = nodes("Pathfinder", "Every run, mapped");
    const three = nodes("Pathfinder", "word ".repeat(200));
    expect(one[1].textArr).toHaveLength(1);
    expect(one[0].y()).toBeGreaterThan(three[0].y());
    for (const ns of [one, three]) {
      const top = ns[0].y();
      const bottom = ns[1].y() + ns[1].textArr.length * ns[1].fontSize() * ns[1].lineHeight();
      expect(Math.abs(top - SAFE.top - (SAFE.bottom - bottom))).toBeLessThanOrEqual(1);
    }
  });

  it("a blank caption draws the name alone, centred; nothing names the app and no caption draws nothing", () => {
    const ns = nodes("Pathfinder", " \n ");
    expect(ns).toHaveLength(1);
    expect(lines(ns[0])).toEqual(["Pathfinder"]);
    const mid = ns[0].y() + (ns[0].fontSize() * ns[0].lineHeight()) / 2;
    expect(Math.abs(mid - H / 2)).toBeLessThanOrEqual(1);
    expect(nodes(null, "")).toHaveLength(0);
  });
});
