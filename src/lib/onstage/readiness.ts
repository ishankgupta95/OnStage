import type { SetDoc } from "@/lib/data/types";
import { EXPORT_SLOTS, type ExportSlot } from "./export/slots";

/**
 * A set's store sizes and whether each can be exported yet (plan S2.3) —
 * derived from the set's own document, never from fixture rows.
 */

export type SizeRow = {
  /** The slot's folder, or FEATURE for the Play feature graphic. */
  id: string;
  store: "Apple" | "Google";
  label: string;
  px: string;
  status: "Ready" | "Missing";
  /** Frames that go into this size: those with a screenshot (the feature
   *  graphic is made from the first frame). */
  frames: number;
};

/** Which store a size belongs to, from its device class. */
export const slotStore = (slot: Pick<ExportSlot, "cls">): "apple" | "play" =>
  slot.cls === "iphone" || slot.cls === "ipad" ? "apple" : "play";

/**
 * One row per export size of the set's store. A frames size is Ready once
 * at least one frame has a screenshot — until tablet screenshots exist
 * (S4.3), tablet sizes use the phone screenshot, as the export does; the
 * feature graphic is Ready whenever the set has a frame to make it from.
 */
export function requiredSizes(doc: Pick<SetDoc, "frames" | "store">): {
  store: "apple" | "play";
  rows: SizeRow[];
  ready: number;
} {
  const store = doc.store === "play" ? "play" : "apple";
  const frames = Array.isArray(doc.frames) ? doc.frames : [];
  const withShots = frames.filter((f) => typeof f?.screenshot === "string" && f.screenshot).length;
  const rows = EXPORT_SLOTS.filter((slot) => slotStore(slot) === store).map((slot): SizeRow => {
    const feature = slot.kind === "feature";
    const count = feature ? Math.min(1, frames.length) : withShots;
    return {
      id: slot.folder || "FEATURE",
      store: store === "apple" ? "Apple" : "Google",
      label: slot.label.replace(/^(Apple|Google) — /, ""),
      px: `${slot.w} × ${slot.h}`,
      status: count > 0 ? "Ready" : "Missing",
      frames: count,
    };
  });
  return { store, rows, ready: rows.filter((r) => r.status === "Ready").length };
}
