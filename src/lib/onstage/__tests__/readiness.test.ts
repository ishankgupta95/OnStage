import { describe, expect, it } from "vitest";
import { doc, frame } from "@/lib/data/__tests__/helpers";
import type { SetDoc } from "@/lib/data/types";
import { EXPORT_SLOTS } from "../export/slots";
import { requiredSizes } from "../readiness";

/**
 * "Required sizes" on the project board (plan S2.3): one row per export size
 * of the set's store, derived from the set's own document — never fixture rows.
 */

const SHOT = "img:11111111-aaaa-4aaa-8aaa-111111111111";

/** The export slots of a store, told apart by their label's store prefix
 *  (independent of the device-class mapping the module uses). */
const slotsOf = (store: "apple" | "play") =>
  EXPORT_SLOTS.filter((s) => s.label.startsWith(store === "apple" ? "Apple — " : "Google — "));

const unprefixed = (label: string) => label.replace(/^(Apple|Google) — /, "");

/** A document as it might come out of storage, damaged or not. */
const raw = (over: Record<string, unknown>) => ({ ...doc([]), ...over }) as unknown as SetDoc;

describe("requiredSizes — Apple", () => {
  it("a set without screenshots lists iPhone 6.9″, iPhone 6.5″ and iPad Pro 13″, all Missing", () => {
    const result = requiredSizes(doc([frame(), frame(), frame()], { store: "apple" }));

    expect(result.store).toBe("apple");
    expect(result.ready).toBe(0);
    expect(result.rows).toEqual([
      { id: "APP_IPHONE_69", store: "Apple", label: "iPhone 6.9″", px: "1320 × 2868", status: "Missing", frames: 0 },
      { id: "APP_IPHONE_65", store: "Apple", label: "iPhone 6.5″", px: "1242 × 2688", status: "Missing", frames: 0 },
      { id: "APP_IPAD_PRO_3GEN_129", store: "Apple", label: "iPad Pro 13″", px: "2064 × 2752", status: "Missing", frames: 0 },
    ]);
  });

  it("one screenshot makes every size Ready, the iPad included (tablets use the phone screenshot until S4.3)", () => {
    const result = requiredSizes(doc([frame({ screenshot: SHOT }), frame(), frame()]));

    expect(result.ready).toBe(3);
    expect(result.rows.map((r) => [r.label, r.status, r.frames])).toEqual([
      ["iPhone 6.9″", "Ready", 1],
      ["iPhone 6.5″", "Ready", 1],
      ["iPad Pro 13″", "Ready", 1],
    ]);
  });

  it("counts every frame that has a screenshot, and only those", () => {
    const result = requiredSizes(
      doc([
        frame({ screenshot: SHOT }),
        frame({ screenshot: "" }),
        frame({ screenshot: null }),
        // A legacy data: URL is still a screenshot.
        frame({ screenshot: "data:image/png;base64,iVBORw0KGgo=" }),
        frame(),
      ]),
    );
    expect(result.rows.map((r) => r.frames)).toEqual([2, 2, 2]);
    expect(result.ready).toBe(3);
  });

  it("a set with no frames at all has every size Missing", () => {
    const result = requiredSizes(doc([]));
    expect(result.rows.map((r) => r.status)).toEqual(["Missing", "Missing", "Missing"]);
    expect(result.ready).toBe(0);
  });

  it("an absent or unknown store is treated as Apple", () => {
    for (const store of [undefined, null, "", "windows", "PLAY"]) {
      const result = requiredSizes(raw({ store, frames: [frame()] }));
      expect(result.store, String(store)).toBe("apple");
      expect(result.rows.map((r) => r.label)).toEqual(["iPhone 6.9″", "iPhone 6.5″", "iPad Pro 13″"]);
      expect(result.rows.every((r) => r.store === "Apple")).toBe(true);
    }
  });
});

describe("requiredSizes — Google Play", () => {
  it("lists Phone, Tablet 7″ and Feature graphic; the feature graphic is Ready from one frame, the others Missing until a screenshot", () => {
    const result = requiredSizes(doc([frame(), frame()], { store: "play" }));

    expect(result.store).toBe("play");
    expect(result.rows).toEqual([
      { id: "PHONE", store: "Google", label: "Phone", px: "1080 × 1920", status: "Missing", frames: 0 },
      { id: "TABLET_7", store: "Google", label: "Tablet 7″", px: "1200 × 1920", status: "Missing", frames: 0 },
      { id: "FEATURE", store: "Google", label: "Feature graphic", px: "1024 × 500", status: "Ready", frames: 1 },
    ]);
    expect(result.ready).toBe(1);
  });

  it("with a screenshot every size is Ready; the feature graphic still counts one frame", () => {
    const result = requiredSizes(
      doc([frame({ screenshot: SHOT }), frame({ screenshot: SHOT }), frame()], { store: "play" }),
    );
    expect(result.rows.map((r) => [r.label, r.status, r.frames])).toEqual([
      ["Phone", "Ready", 2],
      ["Tablet 7″", "Ready", 2],
      ["Feature graphic", "Ready", 1],
    ]);
    expect(result.ready).toBe(3);
  });

  it("a Play set with no frames has nothing to make the feature graphic from", () => {
    const result = requiredSizes(doc([], { store: "play" }));
    expect(result.rows.map((r) => [r.label, r.status, r.frames])).toEqual([
      ["Phone", "Missing", 0],
      ["Tablet 7″", "Missing", 0],
      ["Feature graphic", "Missing", 0],
    ]);
    expect(result.ready).toBe(0);
  });
});

describe("requiredSizes — a damaged document", () => {
  for (const [label, frames] of [
    ["frames is an object", { "0": { screenshot: SHOT } }],
    ["frames is a string", SHOT],
    ["frames is null", null],
    ["frames is missing", undefined],
  ] as const) {
    for (const store of ["apple", "play"] as const) {
      it(`${label} (${store}): every size Missing, no throw`, () => {
        let result!: ReturnType<typeof requiredSizes>;
        expect(() => {
          result = requiredSizes(raw({ frames, store }));
        }).not.toThrow();
        expect(result.store).toBe(store);
        expect(result.rows).toHaveLength(slotsOf(store).length);
        expect(result.rows.every((r) => r.status === "Missing" && r.frames === 0)).toBe(true);
        expect(result.ready).toBe(0);
      });
    }
  }

  it("null frames and non-string screenshots in the list are skipped, not counted", () => {
    const frames = [null, { ...frame(), screenshot: 42 }, { ...frame(), screenshot: { ref: SHOT } }];
    let result!: ReturnType<typeof requiredSizes>;
    expect(() => {
      result = requiredSizes(raw({ frames, store: "apple" }));
    }).not.toThrow();
    expect(result.rows.map((r) => [r.status, r.frames])).toEqual([
      ["Missing", 0],
      ["Missing", 0],
      ["Missing", 0],
    ]);
  });
});

describe("requiredSizes — rows follow EXPORT_SLOTS", () => {
  for (const store of ["apple", "play"] as const) {
    it(`${store}: exactly that store's export slots, in order, with their sizes (a new slot shows up here)`, () => {
      const slots = slotsOf(store);
      expect(slots.length).toBeGreaterThan(0);
      const { rows } = requiredSizes(doc([frame({ screenshot: SHOT })], { store }));

      expect(rows.map((r) => r.label)).toEqual(slots.map((s) => unprefixed(s.label)));
      expect(rows.map((r) => r.px)).toEqual(slots.map((s) => `${s.w} × ${s.h}`));
      expect(rows.map((r) => r.id)).toEqual(slots.map((s) => s.folder || "FEATURE"));
      // No label keeps its store prefix.
      expect(rows.some((r) => /^(Apple|Google) — /.test(r.label))).toBe(false);
    });
  }

  it("the two stores together cover every export slot exactly once", () => {
    const apple = requiredSizes(doc([frame()], { store: "apple" })).rows;
    const play = requiredSizes(doc([frame()], { store: "play" })).rows;
    expect(apple.length + play.length).toBe(EXPORT_SLOTS.length);
    expect([...apple, ...play].map((r) => `${r.store} — ${r.label}`)).toEqual(EXPORT_SLOTS.map((s) => s.label));
  });
});
