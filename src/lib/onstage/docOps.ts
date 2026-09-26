import type { SetDoc } from "@/lib/data/types";
import { CAPTIONS, TEMPLATES } from "./data";

/**
 * Pure operations on a set document — the one copy of each, shared by the
 * editor's store actions and by the screens that build a new set's document
 * before `createSet` (plan D10: they never touch the open set).
 */

/**
 * A new set's document: the Trailhead sample cut the canvas has always
 * opened with. Opening a set with no saved document starts here; so do new
 * sets. S5.4 replaces it with the Ridgeline cut.
 */
export function defaultDoc(): SetDoc {
  return {
    frames: CAPTIONS.map((c, i) => ({
      caption: c,
      bg: i === 0 ? "ember" : i === 1 ? "dusk" : i === 2 ? "moss" : i === 3 ? "ember" : "ink",
      tiltX: i === 0 ? 0 : i === 1 ? 6 : i === 2 ? 0 : i === 3 ? 6 : 0,
      tiltY: i === 0 ? 0 : i === 1 ? -16 : i === 2 ? 15 : i === 3 ? -22 : 0,
      depth: i === 0 ? 0 : i === 1 ? 42 : i === 2 ? 38 : i === 3 ? 66 : 0,
      scale: 1,
      screenshot: null,
    })),
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
  };
}

/** Whether `slug` names a template that can be applied. */
export const isTemplate = (slug: string) => TEMPLATES.some((t) => t.slug === slug);

/**
 * Restyle a whole set from a template: every frame takes its background and
 * device angle, the set its panorama setting. Captions and screenshots stay.
 * Null for an unknown template.
 */
export function applyTemplateToDoc<D extends Pick<SetDoc, "frames" | "panorama">>(doc: D, slug: string): D | null {
  const tpl = TEMPLATES.find((t) => t.slug === slug);
  if (!tpl) return null;
  return {
    ...doc,
    frames: doc.frames.map((f) => ({
      ...f,
      bg: tpl.bg,
      tiltY: tpl.ty,
      tiltX: 0,
      depth: tpl.ty === 0 ? 0 : 40,
    })),
    panorama: tpl.panoramic,
  };
}

/**
 * The brand kit's frame and angle defaults on every frame. Every kit applies
 * the same ones until brand kits are real (S10.4): the kit's Defaults panel
 * reads Graphite frame, Right 17°, caption on top.
 */
export function applyBrandDefaultsToDoc<D extends Pick<SetDoc, "frames" | "frameColor" | "align">>(doc: D): D {
  return {
    ...doc,
    frameColor: "graphite",
    align: "center",
    frames: doc.frames.map((f) => ({ ...f, tiltX: 0, tiltY: -17, depth: 40 })),
  };
}
