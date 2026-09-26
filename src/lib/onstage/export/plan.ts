import { exportRoot } from "../appName";
import { EXPORT_SLOTS, LOCALE_FOLDER, type ExportSlot } from "./slots";

/**
 * What an export will produce, from the picks, the locales and the frame
 * count — the numbers the export dialog and guided's last step show, by the
 * same rules `renderSet` writes files with (one copy of each rule, so the
 * preview can't drift from the zip). Pure: no renderer is loaded here.
 */

/** The zip's top folder when nothing names the app ("onstage-export-store-
 *  assets"); a named app's is `exportRoot(name)` (S3.4). */
export const EXPORT_ROOT = exportRoot(null);

/** The locales an export writes: the picked ones, or EN when none is. */
export const exportLocales = (langs: readonly string[]): string[] => (langs.length ? [...langs] : ["EN"]);

/** The folder a locale's files land in. */
export const localeFolder = (locale: string): string => LOCALE_FOLDER[locale] ?? locale.toLowerCase();

/** The Play feature graphic's file name, inside each locale's folder. */
export const FEATURE_FILE = "feature-graphic-1024x500.png";

/** A frame's file name within a size folder: 01.png, 02.png, … */
export const frameFile = (index: number): string => `${String(index + 1).padStart(2, "0")}.png`;

/** Files one slot writes per locale. */
export const slotFiles = (slot: Pick<ExportSlot, "kind">, frameCount: number): number =>
  slot.kind === "feature" ? 1 : frameCount;

/**
 * Bytes per output pixel for the size estimate — measured on a gradient +
 * device PNG. Real screenshots compress worse (up to about twice this), so
 * the estimate is a floor, shown as approximate.
 */
const BYTES_PER_PIXEL = 0.46;

export type PlannedSlot = {
  /** Index into EXPORT_SLOTS (what the dialog's picks hold until S4.5). */
  index: number;
  slot: ExportSlot;
  /** Files this slot writes across every locale. */
  files: number;
};

export type ExportPlan = {
  slots: PlannedSlot[];
  locales: string[];
  /** Every file the zip will hold. */
  files: number;
  estBytes: number;
  /** The zip's folder tree, condensed the way the design shows it. */
  tree: { text: string; ind: number }[];
};

export function exportPlan(input: {
  picks: readonly number[];
  langs: readonly string[];
  frameCount: number;
  /** The zip's top folder. */
  root: string;
}): ExportPlan {
  const frameCount = Math.max(0, input.frameCount);
  const locales = exportLocales(input.langs);
  const slots = EXPORT_SLOTS.map((slot, index) => ({ slot, index }))
    .filter(({ index }) => input.picks.includes(index))
    .map(({ slot, index }) => ({ index, slot, files: slotFiles(slot, frameCount) * locales.length }));
  const files = slots.reduce((n, s) => n + s.files, 0);
  const estBytes = slots.reduce((b, s) => b + s.slot.w * s.slot.h * BYTES_PER_PIXEL * s.files, 0);

  const frameRange =
    frameCount <= 1 ? frameFile(0) : `${frameFile(0).replace(".png", "")}…${frameFile(frameCount - 1)}`;
  const tree: ExportPlan["tree"] = [{ text: `${input.root}/`, ind: 0 }];
  if (slots.length) {
    tree.push({ text: locales.map((l) => `${localeFolder(l)}/`).join(" · "), ind: 1 });
    for (const { slot } of slots) {
      tree.push({ text: slot.kind === "feature" ? FEATURE_FILE : `${slot.folder}/ ${frameRange}`, ind: 2 });
    }
  }
  return { slots, locales, files, estBytes, tree };
}

/**
 * Why an export stopped when screenshots couldn't be read (EXPORT-5) —
 * `frames` are 1-based frame numbers. Never a silent swap to the sample.
 */
export function unreadableScreenshots(frames: number[]): string {
  if (frames.length === 1) return `Frame ${frames[0]}'s screenshot couldn't be read — drop it in again.`;
  const list = `${frames.slice(0, -1).join(", ")} and ${frames[frames.length - 1]}`;
  return `The screenshots of frames ${list} couldn't be read — drop them in again.`;
}

/** Bytes as the dialog shows them. */
export const formatMB = (bytes: number): string => `${(bytes / 1_048_576).toFixed(1)} MB`;

/** Tablet sizes draw the phone screenshot in a tablet frame, cropped to fit
 *  (tablet screenshots arrive with S4.3) — said wherever a tablet size is
 *  picked with a device frame, and only then. "No frame" draws no tablet
 *  (geometryFor), so there is no tablet screen to crop to. */
export function tabletNote(plan: Pick<ExportPlan, "slots">, device: string): string | null {
  if (device === "none") return null;
  return plan.slots.some((s) => s.slot.cls === "ipad" || s.slot.cls === "android-tablet")
    ? "Tablet sizes use your phone screenshots, cropped to fit the tablet screen."
    : null;
}
