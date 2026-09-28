import type { EditorDoc, TextLayer } from "@/lib/editorDoc";

// Per-language captions. A text layer's `content` is the default language;
// `translations` holds the same caption in other store languages, keyed by the
// App Store Connect / Play locale code. A missing translation falls back to the
// default text, so an untranslated caption still exports.

export const STORE_LOCALES: { id: string; label: string }[] = [
  { id: "en-US", label: "English (US)" },
  { id: "en-GB", label: "English (UK)" },
  { id: "de-DE", label: "German" },
  { id: "fr-FR", label: "French" },
  { id: "es-ES", label: "Spanish (Spain)" },
  { id: "es-MX", label: "Spanish (Mexico)" },
  { id: "it", label: "Italian" },
  { id: "pt-BR", label: "Portuguese (Brazil)" },
  { id: "pt-PT", label: "Portuguese (Portugal)" },
  { id: "nl-NL", label: "Dutch" },
  { id: "sv", label: "Swedish" },
  { id: "da", label: "Danish" },
  { id: "no", label: "Norwegian" },
  { id: "fi", label: "Finnish" },
  { id: "pl", label: "Polish" },
  { id: "tr", label: "Turkish" },
  { id: "ru", label: "Russian" },
  { id: "uk", label: "Ukrainian" },
  { id: "ja", label: "Japanese" },
  { id: "ko", label: "Korean" },
  { id: "zh-Hans", label: "Chinese (Simplified)" },
  { id: "zh-Hant", label: "Chinese (Traditional)" },
  { id: "id", label: "Indonesian" },
  { id: "vi", label: "Vietnamese" },
  { id: "th", label: "Thai" },
  { id: "hi", label: "Hindi" },
];

export function localeLabel(id: string | null): string {
  if (!id) return "Default";
  return STORE_LOCALES.find((l) => l.id === id)?.label ?? id;
}

// The caption to show for `locale` (null = default language).
export function textFor(l: TextLayer, locale: string | null): string {
  return (locale && l.translations?.[locale]) || l.content;
}

// The layer update that sets the caption for `locale`. Clearing a translation
// removes it, so a language nobody has written in disappears from the export.
export function withText(l: TextLayer, locale: string | null, text: string): Partial<TextLayer> {
  if (!locale) return { content: text };
  const translations = { ...l.translations };
  if (text) translations[locale] = text;
  else delete translations[locale];
  return { translations };
}

// The doc as it renders in `locale`: each caption swapped for its translation.
export function localizeDoc(doc: EditorDoc, locale: string | null): EditorDoc {
  if (!locale) return doc;
  return { ...doc, textLayers: doc.textLayers.map((l) => ({ ...l, content: textFor(l, locale) })) };
}

// Every language any caption in these docs has text for, in store-list order.
export function docLocales(docs: EditorDoc[]): string[] {
  const found = new Set<string>();
  for (const d of docs) for (const l of d.textLayers) for (const [k, v] of Object.entries(l.translations ?? {})) if (v) found.add(k);
  const known = STORE_LOCALES.map((l) => l.id).filter((id) => found.has(id));
  return [...known, ...[...found].filter((id) => !known.includes(id)).sort()];
}
