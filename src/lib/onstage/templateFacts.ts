import { BGS, bgCss, capInk, type Template } from "./data";
import { EXPORT_SLOTS } from "./export/slots";

/**
 * What a template's detail page says about it — every fact read from what
 * applying the template actually does (`applyTemplateToDoc`: each frame's
 * background and device angle, the set's panorama), never a made-up figure
 * (SCREENSA-2, GAP-15).
 */

/** The colours a template puts on the set: its background's stops, then the
 *  caption ink that background gets. */
export function templatePalette(tpl: Pick<Template, "bg">): string[] {
  const stops = bgCss(tpl.bg).match(/#[0-9a-f]{3,8}\b/gi) ?? [];
  return [...new Set([...stops, capInk(tpl.bg)].map((c) => c.toLowerCase()))];
}

/** Every export size: a template sets backgrounds and angles, which every
 *  size renders, so it fits them all. */
export const TEMPLATE_FITS: string[] = EXPORT_SLOTS.map((slot) => slot.label.replace(" — ", " "));

/** The device angle a template gives every frame, in words. Negative yaw
 *  turns the phone to the right (as the Right preset does). */
export function angleLabel(ty: number): string {
  if (ty === 0) return "Flat";
  return `${Math.abs(ty)}° ${ty < 0 ? "right" : "left"}`;
}

export function templateFacts(
  tpl: Pick<Template, "bg" | "panoramic" | "ty">,
  frameCount: number,
): { label: string; value: string }[] {
  const bg = BGS.find((b) => b.id === tpl.bg)?.label ?? tpl.bg;
  return [
    { label: "FRAMES", value: String(frameCount) },
    { label: "BACKGROUND", value: tpl.panoramic ? `${bg}, across the set` : `${bg} on every frame` },
    { label: "ANGLE", value: angleLabel(tpl.ty) },
    // Templates don't move the caption; the classic layout puts it above.
    { label: "CAPTION", value: "Above the device" },
  ];
}
