import { describe, expect, it } from "vitest";
import { defaultDoc } from "@/lib/onstage/docOps";
import { CAPTIONS } from "@/lib/onstage/data";
import {
  EXPORT_SLOTS,
  LOCALE_FOLDER,
  MAX_FRAMES,
  defaultExportPicks,
  exportableLocales,
  localise,
  usableLocales,
} from "../slots";

const indexOfFolder = (folder: string) => EXPORT_SLOTS.findIndex((s) => s.folder === folder);
const featureIndex = () => EXPORT_SLOTS.findIndex((s) => s.kind === "feature");

/** The sample set's frames, as a new set starts. */
const sample = () => defaultDoc().frames;
/** The sample with one headline rewritten. */
const edited = (index = 2, caption = "My own headline") =>
  sample().map((f, i) => (i === index ? { ...f, caption } : f));

describe("MAX_FRAMES", () => {
  it("is 10 per device for the App Store and 8 for Google Play", () => {
    expect(MAX_FRAMES).toEqual({ apple: 10, play: 8 });
  });
});

describe("defaultExportPicks (GAP-5 / GAP-7)", () => {
  it("apple: the 6.9″ and 6.5″ iPhone sizes, in that order", () => {
    const picks = defaultExportPicks("apple");
    expect(picks).toEqual([indexOfFolder("APP_IPHONE_69"), indexOfFolder("APP_IPHONE_65")]);
    expect(picks).toEqual([0, 1]);
    expect(picks.map((i) => EXPORT_SLOTS[i].label)).toEqual(["Apple — iPhone 6.9″", "Apple — iPhone 6.5″"]);
  });

  it("play: the phone size and the feature graphic", () => {
    const picks = defaultExportPicks("play");
    expect(picks).toEqual([indexOfFolder("PHONE"), featureIndex()]);
    expect(picks).toEqual([3, 5]);
    expect(picks.map((i) => EXPORT_SLOTS[i].label)).toEqual(["Google — Phone", "Google — Feature graphic"]);
  });

  it("never picks a tablet size or the other store's sizes", () => {
    const apple = defaultExportPicks("apple").map((i) => EXPORT_SLOTS[i]);
    const play = defaultExportPicks("play").map((i) => EXPORT_SLOTS[i]);
    expect(apple.every((s) => s.cls === "iphone")).toBe(true);
    expect(play.every((s) => s.cls === "android-phone")).toBe(true);
    for (const s of [...apple, ...play]) expect(["ipad", "android-tablet"]).not.toContain(s.cls);
  });

  it("every pick is a real slot index, with no duplicates", () => {
    for (const store of ["apple", "play"] as const) {
      const picks = defaultExportPicks(store);
      expect(picks.length).toBe(2);
      expect(new Set(picks).size).toBe(picks.length);
      for (const i of picks) expect(EXPORT_SLOTS[i]).toBeDefined();
    }
  });

  it("returns a fresh array each call, so toggling one set's picks can't change the defaults", () => {
    const a = defaultExportPicks("apple");
    a.push(4);
    expect(defaultExportPicks("apple")).toEqual([0, 1]);
    expect(defaultExportPicks("play")).not.toBe(defaultExportPicks("play"));
  });
});

describe("exportableLocales (EDITOR-6 interim)", () => {
  it("the untouched sample offers EN plus every locale its headlines are translated into", () => {
    expect(exportableLocales(sample())).toEqual(["EN", "DE", "JA", "ES"]);
  });

  it("every offered locale has a folder name", () => {
    for (const l of exportableLocales(sample())) expect(LOCALE_FOLDER[l]).toBeTruthy();
  });

  it("any subset of the sample's headlines is still fully translated", () => {
    expect(exportableLocales([{ caption: CAPTIONS[3] }])).toEqual(["EN", "DE", "JA", "ES"]);
    expect(exportableLocales([{ caption: CAPTIONS[0] }, { caption: CAPTIONS[0] }])).toEqual(["EN", "DE", "JA", "ES"]);
  });

  it("one edited caption leaves EN alone — that folder would otherwise hold English", () => {
    expect(exportableLocales(edited())).toEqual(["EN"]);
    expect(exportableLocales(edited(0, ""))).toEqual(["EN"]);
  });

  it("a caption that differs only by whitespace or case has no translation", () => {
    expect(exportableLocales(edited(1, `${CAPTIONS[1]} `))).toEqual(["EN"]);
    expect(exportableLocales(edited(1, CAPTIONS[1].toUpperCase()))).toEqual(["EN"]);
  });

  it("a frame added to the sample (\"New headline\") leaves EN alone", () => {
    expect(exportableLocales([...sample(), { caption: "New headline" }])).toEqual(["EN"]);
  });

  it("no frames: EN alone", () => {
    expect(exportableLocales([])).toEqual(["EN"]);
  });

  it("always starts with the source language", () => {
    for (const frames of [sample(), edited(), []]) expect(exportableLocales(frames)[0]).toBe("EN");
  });

  it("a caption named like an Object.prototype member is not a translation (own keys only)", () => {
    for (const caption of ["constructor", "toString", "hasOwnProperty", "valueOf", "__proto__"]) {
      expect(exportableLocales([{ caption }])).toEqual(["EN"]);
      expect(exportableLocales(edited(4, caption))).toEqual(["EN"]);
    }
  });
});

describe("localise", () => {
  it("returns the locale's copy of a sample headline", () => {
    expect(localise("Every run, mapped", "DE")).toBe("Jeder Lauf, kartiert");
    expect(localise("Know your pace", "JA")).toBe("ペースを知る");
    expect(localise("Share the route", "ES")).toBe("Comparte la ruta");
  });

  it("every sample headline has a translation in DE, JA and ES that differs from the English", () => {
    for (const locale of ["DE", "JA", "ES"]) {
      for (const caption of CAPTIONS) {
        const out = localise(caption, locale);
        expect(typeof out).toBe("string");
        expect(out).not.toBe(caption);
        expect(out.length).toBeGreaterThan(0);
      }
    }
  });

  it("EN, and a locale with no table, return the caption as written", () => {
    expect(localise("Every run, mapped", "EN")).toBe("Every run, mapped");
    expect(localise("Every run, mapped", "FR")).toBe("Every run, mapped");
  });

  it("an untranslated caption comes back unchanged", () => {
    expect(localise("My own headline", "DE")).toBe("My own headline");
    expect(localise("", "JA")).toBe("");
  });

  it("an inherited property name is a caption, not a lookup: it comes back as a string, unchanged", () => {
    for (const caption of ["constructor", "toString", "hasOwnProperty", "valueOf", "__proto__"]) {
      for (const locale of ["DE", "JA", "ES"]) {
        const out = localise(caption, locale);
        expect(typeof out).toBe("string");
        expect(out).toBe(caption);
      }
    }
  });
});

describe("usableLocales", () => {
  it("keeps the picked locales the set can be exported in, in the order picked", () => {
    expect(usableLocales(sample(), ["EN", "DE"])).toEqual(["EN", "DE"]);
    expect(usableLocales(sample(), ["ES", "EN", "JA"])).toEqual(["ES", "EN", "JA"]);
    // EN isn't forced in when a translated locale alone is picked.
    expect(usableLocales(sample(), ["DE"])).toEqual(["DE"]);
  });

  it("drops a picked locale the set has no captions in", () => {
    expect(usableLocales(edited(), ["EN", "DE"])).toEqual(["EN"]);
    expect(usableLocales(sample(), ["EN", "FR", "DE"])).toEqual(["EN", "DE"]);
  });

  it("falls back to EN when nothing picked is usable, or nothing is picked", () => {
    expect(usableLocales(edited(), ["DE", "JA"])).toEqual(["EN"]);
    expect(usableLocales(sample(), [])).toEqual(["EN"]);
    expect(usableLocales([], ["DE"])).toEqual(["EN"]);
    expect(usableLocales(sample(), ["constructor", "toString"])).toEqual(["EN"]);
  });

  it("never returns a locale exportableLocales doesn't offer", () => {
    const all = ["EN", "DE", "JA", "ES", "FR", "PT-BR"];
    for (const frames of [sample(), edited(), []]) {
      const ok = exportableLocales(frames);
      for (const l of usableLocales(frames, all)) expect(ok).toContain(l);
    }
  });
});
