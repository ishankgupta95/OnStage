import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SetDoc } from "@/lib/data/types";
import { doc, frame } from "@/lib/data/__tests__/helpers";
import { CAPTIONS, TEMPLATES } from "../data";
import { applyBrandDefaultsToDoc, applyTemplateToDoc, defaultDoc } from "../docOps";

const DOCS_KEY = "onstage:set-docs:v1";

/** A set that differs from every template and from the brand defaults in
 *  every field they touch, so each change is visible. */
const base: SetDoc = doc(
  [
    frame({ caption: "Plan runs", bg: "ember", tiltX: 6, tiltY: -22, depth: 66, scale: 0.8, screenshot: "img:one" }),
    frame({ caption: "Share routes", bg: "moss", tiltX: -4, tiltY: 15, depth: 38, scale: 1.2, screenshot: null }),
    frame({ caption: "Log splits", bg: "iris", tiltX: 3, tiltY: 0, depth: 12, scale: 1, screenshot: "img:three" }),
  ],
  {
    device: "px9",
    frameColor: "silver",
    captionFont: "Fraunces",
    align: "left",
    captionSize: 52,
    panorama: false,
    shadow: false,
    lang: "DE",
    store: "play",
    workMode: "guided",
  },
);

/** Every field of a document other than its frames and panorama. */
const { frames: _frames, panorama: _panorama, ...baseRest } = base;
void _frames;
void _panorama;

describe("defaultDoc", () => {
  it("returns a fresh document each call: changing one never changes the next", () => {
    const a = defaultDoc();
    const pristine = structuredClone(a);
    a.frames[0].caption = "changed";
    a.frames[1].screenshot = "img:x";
    a.frames.push(frame({ caption: "extra" }));
    a.device = "px9";
    a.workMode = "guided";

    const b = defaultDoc();
    expect(b).toEqual(pristine);
    expect(b).not.toBe(a);
    expect(b.frames).not.toBe(a.frames);
    expect(b.frames[0]).not.toBe(a.frames[0]);
  });

  it("is the sample cut: one frame per sample caption, no screenshots", () => {
    const d = defaultDoc();
    expect(d.frames.map((f) => f.caption)).toEqual(CAPTIONS);
    expect(d.frames.every((f) => f.screenshot === null)).toBe(true);
  });
});

describe("applyTemplateToDoc", () => {
  for (const tpl of TEMPLATES) {
    it(`"${tpl.slug}" restyles every frame and the panorama, and keeps the rest`, () => {
      const input = structuredClone(base);
      const out = applyTemplateToDoc(input, tpl.slug);
      expect(out).not.toBeNull();

      for (const f of out!.frames) {
        expect(f.bg).toBe(tpl.bg);
        expect(f.tiltY).toBe(tpl.ty);
        expect(f.tiltX).toBe(0);
        expect(f.depth).toBe(tpl.ty === 0 ? 0 : 40);
      }
      expect(out!.panorama).toBe(tpl.panoramic);

      // Captions, screenshots and scale stay, frame for frame.
      expect(out!.frames.map((f) => [f.caption, f.screenshot, f.scale])).toEqual(
        base.frames.map((f) => [f.caption, f.screenshot, f.scale]),
      );
      // Every other document field stays.
      const { frames: _f, panorama: _p, ...rest } = out!;
      void _f;
      void _p;
      expect(rest).toEqual(baseRest);

      // The input is not touched.
      expect(input).toEqual(base);
    });
  }

  it("returns a new object and new frames, never the input's", () => {
    const input = structuredClone(base);
    const out = applyTemplateToDoc(input, TEMPLATES[0].slug)!;
    expect(out).not.toBe(input);
    expect(out.frames).not.toBe(input.frames);
    out.frames.forEach((f, i) => expect(f).not.toBe(input.frames[i]));
  });

  it("returns null for a template that doesn't exist, and leaves the input alone", () => {
    const input = structuredClone(base);
    expect(applyTemplateToDoc(input, "no-such-template")).toBeNull();
    expect(applyTemplateToDoc(input, "")).toBeNull();
    expect(input).toEqual(base);
  });

  it("covers a panoramic template and a flat one (the fixture really exercises both branches)", () => {
    expect(TEMPLATES.some((t) => t.panoramic)).toBe(true);
    expect(TEMPLATES.some((t) => !t.panoramic)).toBe(true);
    expect(TEMPLATES.some((t) => t.ty === 0)).toBe(true);
    expect(TEMPLATES.some((t) => t.ty !== 0)).toBe(true);
  });
});

describe("applyBrandDefaultsToDoc", () => {
  it("sets the kit defaults — Graphite frame, centred caption, Right 17° — on every frame", () => {
    const input = structuredClone(base);
    const out = applyBrandDefaultsToDoc(input);

    expect(out.frameColor).toBe("graphite");
    expect(out.align).toBe("center");
    for (const f of out.frames) {
      expect(f.tiltX).toBe(0);
      expect(f.tiltY).toBe(-17);
      expect(f.depth).toBe(40);
    }
    // Captions, screenshots, backgrounds and scale stay.
    expect(out.frames.map((f) => [f.caption, f.screenshot, f.bg, f.scale])).toEqual(
      base.frames.map((f) => [f.caption, f.screenshot, f.bg, f.scale]),
    );
    // Every other document field stays.
    expect({ ...out, frames: null, frameColor: null, align: null }).toEqual({
      ...base,
      frames: null,
      frameColor: null,
      align: null,
    });
    // The input is not touched.
    expect(input).toEqual(base);
    expect(out).not.toBe(input);
    expect(out.frames).not.toBe(input.frames);
  });
});

describe("the store's actions use the same logic", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  /** A fresh store with `base` open as set A. */
  async function bootWithBase() {
    localStorage.setItem(DOCS_KEY, JSON.stringify({ A: base }));
    vi.resetModules();
    const store = await import("@/store/onstage");
    await store.openSet("A");
    return store;
  }

  const docOf = (st: SetDoc): SetDoc => ({
    frames: st.frames,
    device: st.device,
    frameColor: st.frameColor,
    captionFont: st.captionFont,
    align: st.align,
    captionSize: st.captionSize,
    panorama: st.panorama,
    shadow: st.shadow,
    lang: st.lang,
    store: st.store,
    workMode: st.workMode,
  });

  it("applyTemplate leaves the open set exactly as applyTemplateToDoc would, for every template", async () => {
    const { useOnstage } = await bootWithBase();
    expect(docOf(useOnstage.getState())).toEqual(base);
    for (const tpl of TEMPLATES) {
      useOnstage.setState(structuredClone(base));
      useOnstage.getState().applyTemplate(tpl.slug);
      expect(docOf(useOnstage.getState())).toEqual(applyTemplateToDoc(base, tpl.slug));
    }
  });

  it("applyTemplate with an unknown template changes nothing, as applyTemplateToDoc returns null", async () => {
    const { useOnstage } = await bootWithBase();
    useOnstage.getState().applyTemplate("no-such-template");
    expect(docOf(useOnstage.getState())).toEqual(base);
    expect(useOnstage.temporal.getState().pastStates).toHaveLength(0);
  });

  it("applyBrandDefaults leaves the open set exactly as applyBrandDefaultsToDoc would", async () => {
    const { useOnstage } = await bootWithBase();
    useOnstage.getState().applyBrandDefaults();
    expect(docOf(useOnstage.getState())).toEqual(applyBrandDefaultsToDoc(base));
  });

  it("the store's defaultDoc is docOps' defaultDoc", async () => {
    vi.resetModules();
    const store = await import("@/store/onstage");
    expect(store.defaultDoc()).toEqual(defaultDoc());
  });
});
