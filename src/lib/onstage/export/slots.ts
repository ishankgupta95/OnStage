import type { DeviceClass } from "./geometry";

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

/** Export-folder name per locale chip. */
export const LOCALE_FOLDER: Record<string, string> = {
  EN: "en-US",
  DE: "de-DE",
  JA: "ja-JP",
  ES: "es-ES",
};

/**
 * The sample set's headlines in each locale it ships. The AI drawer reports
 * German, Japanese and Spanish as translated, so the export writes real
 * localised frames rather than four copies of the English ones.
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

export const localise = (caption: string, locale: string): string =>
  CAPTION_LOCALES[locale]?.[caption] ?? caption;
