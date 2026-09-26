import type { Locale, SetDoc } from "@/lib/data/types";

/** The languages Onstage knows by name. */
const LANGUAGE_NAMES: Record<string, string> = {
  EN: "English (US)",
  DE: "German",
  JA: "Japanese",
  ES: "Spanish",
  FR: "French",
  "PT-BR": "Portuguese (BR)",
};

/**
 * The language a set's captions are written in. Until captions are stored
 * per language (S9.1) that is English for every set: the export writes them
 * as-is into en-US. (`SetDoc.lang` is only the filmstrip's language chip —
 * which language the canvas is looking at — not the captions' language.)
 */
export const SOURCE_LOCALE = "EN";

/**
 * The languages a set ships in, and how complete each is — from the set's
 * own document (plan S2.3, GAP-9). Until S9.1 that is the source language
 * alone: "translated" counts the frames with a headline.
 */
export function setLocales(doc: Pick<SetDoc, "frames">): Locale[] {
  const code = SOURCE_LOCALE;
  const frames = Array.isArray(doc.frames) ? doc.frames : [];
  const written = frames.filter((f) => typeof f?.caption === "string" && f.caption.trim()).length;
  return [{ code, name: LANGUAGE_NAMES[code] ?? code, translated: written, state: "source" }];
}
