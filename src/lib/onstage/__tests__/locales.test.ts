import { describe, expect, it } from "vitest";
import { doc, frame } from "@/lib/data/__tests__/helpers";
import type { SetDoc } from "@/lib/data/types";
import { setLocales } from "../locales";

/**
 * The project board's Locales tab and LOCALES chips (plan S2.3, GAP-9): the
 * set's own source language, with the frames that have a headline — one row,
 * since captions aren't stored per language yet (S9.1).
 */

const raw = (over: Record<string, unknown>) => ({ ...doc([]), ...over }) as unknown as SetDoc;

describe("setLocales", () => {
  it("an English set is one source row: EN, English (US), counting its captioned frames", () => {
    expect(setLocales(doc([frame({ caption: "One" }), frame({ caption: "Two" })], { lang: "EN" }))).toEqual([
      { code: "EN", name: "English (US)", translated: 2, state: "source" },
    ]);
  });

  it("no language (absent, empty) defaults to EN", () => {
    for (const lang of [undefined, null, ""]) {
      expect(setLocales(raw({ lang, frames: [frame()] })), String(lang)).toEqual([
        { code: "EN", name: "English (US)", translated: 1, state: "source" },
      ]);
    }
  });

  it("the filmstrip's language chip (lang) doesn't change the source: captions are English until S9.1", () => {
    for (const lang of ["DE", "de", "JA", "pt-br", "ko", 5, {}]) {
      expect(setLocales(raw({ lang, frames: [frame()] })), String(lang)).toEqual([
        { code: "EN", name: "English (US)", translated: 1, state: "source" },
      ]);
    }
  });

  it("counts only non-blank captions", () => {
    const frames = [
      frame({ caption: "Every run, mapped" }),
      frame({ caption: "" }),
      frame({ caption: "   " }),
      frame({ caption: "\n\t" }),
      frame({ caption: "  padded  " }),
    ];
    expect(setLocales(doc(frames))[0].translated).toBe(2);
  });

  it("a set with no frames has nothing translated", () => {
    expect(setLocales(doc([]))).toEqual([{ code: "EN", name: "English (US)", translated: 0, state: "source" }]);
  });

  it("a damaged document counts nothing and doesn't throw", () => {
    for (const frames of [null, undefined, "caption", { "0": { caption: "Hi" } }]) {
      expect(() => setLocales(raw({ frames })), String(frames)).not.toThrow();
      expect(setLocales(raw({ frames }))[0].translated).toBe(0);
    }
    // Null frames and captions of the wrong type are skipped.
    const mixed = [null, { ...frame(), caption: 7 }, { ...frame(), caption: null }, frame({ caption: "Real" })];
    expect(setLocales(raw({ frames: mixed }))[0].translated).toBe(1);
  });

  it("always exactly one row, always the source", () => {
    const docs = [
      doc([]),
      doc([frame()], { lang: "de" }),
      doc([frame({ caption: "" })], { lang: "xx" }),
      doc(Array.from({ length: 10 }, (_, i) => frame({ caption: `C${i}` })), { store: "play", lang: "ja" }),
      raw({ frames: null, lang: null }),
    ];
    for (const d of docs) {
      const rows = setLocales(d);
      expect(rows).toHaveLength(1);
      expect(rows[0].state).toBe("source");
    }
  });
});
