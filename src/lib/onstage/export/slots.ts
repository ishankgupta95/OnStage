import type { DeviceClass } from "./geometry";
import { SOURCE_LOCALE } from "../locales";

/**
 * The six rows of the export dialog, with the exact pixel dimensions each
 * store accepts and the folder each lands in — the folder names are the ones
 * the design's export tree shows.
 */
export type ExportSlot = {
  label: string;
  w: number;
  h: number;
  folder: string;
  cls: DeviceClass;
  kind: "frames" | "feature";
};

export const EXPORT_SLOTS: ExportSlot[] = [
  { label: "Apple — iPhone 6.9″", w: 1320, h: 2868, folder: "APP_IPHONE_69", cls: "iphone", kind: "frames" },
  { label: "Apple — iPhone 6.5″", w: 1242, h: 2688, folder: "APP_IPHONE_65", cls: "iphone", kind: "frames" },
  { label: "Apple — iPad Pro 13″", w: 2064, h: 2752, folder: "APP_IPAD_PRO_3GEN_129", cls: "ipad", kind: "frames" },
  { label: "Google — Phone", w: 1080, h: 1920, folder: "PHONE", cls: "android-phone", kind: "frames" },
  { label: "Google — Tablet 7″", w: 1200, h: 1920, folder: "TABLET_7", cls: "android-tablet", kind: "frames" },
  { label: "Google — Feature graphic", w: 1024, h: 500, folder: "", cls: "android-phone", kind: "feature" },
];

/** The most screenshots each store takes per device (S4.5 caps Add frame
 *  and warns on it; a multi-file drop fills up to it now). */
export const MAX_FRAMES = { apple: 10, play: 8 } as const;

/** Index of the slot with this folder (the feature graphic has none, so it
 *  is found by kind). Picks are indices until S4.5 moves them to ids. */
const slotIndex = (match: (slot: ExportSlot) => boolean): number => EXPORT_SLOTS.findIndex(match);

/** The sizes an export starts with for a set's store (GAP-5/GAP-7): Apple's
 *  6.9″ + 6.5″ iPhone, or Play's phone + feature graphic. */
export function defaultExportPicks(store: "apple" | "play"): number[] {
  const picks =
    store === "play"
      ? [slotIndex((s) => s.folder === "PHONE"), slotIndex((s) => s.kind === "feature")]
      : [slotIndex((s) => s.folder === "APP_IPHONE_69"), slotIndex((s) => s.folder === "APP_IPHONE_65")];
  return picks.filter((i) => i >= 0);
}

/** Export-folder name per locale chip. */
export const LOCALE_FOLDER: Record<string, string> = {
  EN: "en-US",
  DE: "de-DE",
  JA: "ja-JP",
  ES: "es-ES",
};

/**
 * The sample set's headlines in each locale it ships, so an untouched sample
 * exports real German, Japanese and Spanish frames. A caption not listed
 * here has no translation, and its locale isn't offered (`exportableLocales`).
 */
const CAPTION_LOCALES: Record<string, Record<string, string>> = {
  DE: {
    "Every run, mapped": "Jeder Lauf, kartiert",
    "Know your pace": "Kenne dein Tempo",
    "Trails near you": "Wege in deiner Nähe",
    "Share the route": "Teile die Route",
    "Built for the long haul": "Gemacht für lange Strecken",
  },
  JA: {
    "Every run, mapped": "すべてのランを地図に",
    "Know your pace": "ペースを知る",
    "Trails near you": "近くのトレイル",
    "Share the route": "ルートを共有",
    "Built for the long haul": "長い道のりのために",
  },
  ES: {
    "Every run, mapped": "Cada carrera, en el mapa",
    "Know your pace": "Conoce tu ritmo",
    "Trails near you": "Rutas cerca de ti",
    "Share the route": "Comparte la ruta",
    "Built for the long haul": "Hecho para la larga distancia",
  },
};

/** The locale's own copy of a caption (own keys only: "constructor" is a
 *  caption, not an inherited property). */
const own = (o: object, key: string) => Object.prototype.hasOwnProperty.call(o, key);
const translationOf = (caption: string, locale: string): string | undefined =>
  own(CAPTION_LOCALES, locale) && own(CAPTION_LOCALES[locale], caption) ? CAPTION_LOCALES[locale][caption] : undefined;

export const localise = (caption: string, locale: string): string => translationOf(caption, locale) ?? caption;

/**
 * The locales a set can really be exported in (interim EDITOR-6 fix, until
 * S9.1): its source language, plus a locale only when every frame's caption
 * has a translation there — otherwise that folder would hold English.
 */
export function exportableLocales(frames: readonly { caption: string }[]): string[] {
  const translated = Object.keys(CAPTION_LOCALES).filter(
    (locale) => frames.length > 0 && frames.every((f) => translationOf(f.caption, locale) !== undefined),
  );
  return [SOURCE_LOCALE, ...translated];
}

/** The picked locales a set can really be exported in; EN when none is. */
export function usableLocales(frames: readonly { caption: string }[], langs: readonly string[]): string[] {
  const ok = exportableLocales(frames);
  const kept = langs.filter((l) => ok.includes(l));
  return kept.length ? kept : [SOURCE_LOCALE];
}
