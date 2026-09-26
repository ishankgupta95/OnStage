import { describe, expect, it } from "vitest";
import { BGS, TEMPLATES, bgCss, capInk, type Template } from "../data";
import { EXPORT_SLOTS } from "../export/slots";
import { TEMPLATE_FITS, angleLabel, templateFacts, templatePalette } from "../templateFacts";

/**
 * Plan S3.2 (SCREENSA-2, GAP-15): a template's detail page states only what
 * applying the template does — the background each frame gets, the device
 * angle, the sizes every export renders — never an invented figure.
 */

const tpl = (slug: string): Template => {
  const t = TEMPLATES.find((x) => x.slug === slug);
  if (!t) throw new Error(`no template ${slug}`);
  return t;
};

describe("templatePalette", () => {
  it("Blueprint (bg dusk) is Dusk's stops then white ink — not its card's preview colours", () => {
    const palette = templatePalette(tpl("blueprint"));
    expect(palette).toEqual(["#1f2b4d", "#0e1424", "#fff"]);
    // The card paints #12232e → #0a1218, but the set gets Dusk.
    expect(tpl("blueprint").preview).toContain("#12232e");
    expect(palette).not.toContain("#12232e");
    expect(palette).not.toContain("#0a1218");
    // The old palette padded every template with a paper colour it never applies.
    expect(palette).not.toContain("#f0efe9");
  });

  it("Field Notes and Bone (bg bone) end with the ink their light ground gets", () => {
    for (const slug of ["field-notes", "bone"]) {
      expect(templatePalette(tpl(slug))).toEqual(["#f4f1ea", "#ded8cb", "#1a1614"]);
    }
    // Bone's card preview is a different off-white from what it applies.
    expect(templatePalette(tpl("bone"))).not.toContain("#f7f6f3");
    expect(templatePalette(tpl("bone"))).not.toContain("#e7e3da");
  });

  it("Ember reads all three stops of the Ember background, then white ink", () => {
    expect(templatePalette(tpl("ember"))).toEqual(["#ff6b53", "#c9315f", "#6d1a4a", "#fff"]);
  });

  it("Signal's split-colour card still applies Ember, so its palette is Ember's", () => {
    expect(templatePalette(tpl("signal"))).toEqual(templatePalette(tpl("ember")));
    expect(templatePalette(tpl("signal"))).not.toContain("#1f2b4d");
  });

  it("depends only on the template's bg — every template reads its bgCss stops then capInk", () => {
    for (const t of TEMPLATES) {
      const stops = (bgCss(t.bg).match(/#[0-9a-f]{3,8}\b/gi) ?? []).map((c) => c.toLowerCase());
      const expected = [...new Set([...stops, capInk(t.bg).toLowerCase()])];
      expect(templatePalette(t), t.slug).toEqual(expected);
      expect(templatePalette({ bg: t.bg }), t.slug).toEqual(expected);
      // Never padded with a colour the background doesn't have.
      if (!bgCss(t.bg).toLowerCase().includes("#f0efe9")) {
        expect(templatePalette(t), t.slug).not.toContain("#f0efe9");
      }
    }
  });

  it("lower-cases and de-duplicates, keeping first-seen order", () => {
    // A background whose stops repeat, in mixed case, including its own ink.
    const probe = { id: "zz-probe", label: "Probe", css: "linear-gradient(160deg,#FFF,#ABCDEF 40%,#abcdef,#123456)" };
    BGS.push(probe);
    try {
      expect(capInk(probe.id)).toBe("#fff");
      expect(templatePalette({ bg: probe.id })).toEqual(["#fff", "#abcdef", "#123456"]);
    } finally {
      BGS.splice(BGS.indexOf(probe), 1);
    }
  });
});

describe("TEMPLATE_FITS", () => {
  it("lists every export size, one chip per EXPORT_SLOTS row", () => {
    expect(TEMPLATE_FITS).toHaveLength(EXPORT_SLOTS.length);
    expect(TEMPLATE_FITS).toHaveLength(6);
    expect(TEMPLATE_FITS).toEqual([
      "Apple iPhone 6.9″",
      "Apple iPhone 6.5″",
      "Apple iPad Pro 13″",
      "Google Phone",
      "Google Tablet 7″",
      "Google Feature graphic",
    ]);
  });

  it("includes the iPad and the feature graphic the old hand-written list left out or misnamed", () => {
    expect(TEMPLATE_FITS).toContain("Apple iPad Pro 13″");
    expect(TEMPLATE_FITS).toContain("Google Feature graphic");
    expect(TEMPLATE_FITS).not.toContain("Play phone");
    expect(TEMPLATE_FITS).not.toContain("Feature graphic");
  });
});

describe("angleLabel", () => {
  it("0 is Flat; negative yaw turns right, positive turns left", () => {
    expect(angleLabel(0)).toBe("Flat");
    expect(angleLabel(-14)).toBe("14° right");
    expect(angleLabel(12)).toBe("12° left");
  });

  it("labels every template's angle from its ty", () => {
    expect(TEMPLATES.map((t) => [t.slug, angleLabel(t.ty)])).toEqual([
      ["ember", "14° right"],
      ["cold-open", "Flat"],
      ["field-notes", "12° left"],
      ["moss", "8° right"],
      ["nocturne", "16° left"],
      ["sunbelt", "20° right"],
      ["iris", "8° left"],
      ["harbour", "10° right"],
      ["clay", "14° left"],
      ["blueprint", "Flat"],
      ["bone", "16° right"],
      ["signal", "10° left"],
    ]);
  });
});

describe("templateFacts", () => {
  const byLabel = (facts: { label: string; value: string }[]) =>
    Object.fromEntries(facts.map((f) => [f.label, f.value]));

  it("gives FRAMES, BACKGROUND, ANGLE and CAPTION — and no USED BY", () => {
    for (const t of TEMPLATES) {
      const facts = templateFacts(t, 5);
      expect(facts.map((f) => f.label), t.slug).toEqual(["FRAMES", "BACKGROUND", "ANGLE", "CAPTION"]);
      const all = facts.map((f) => `${f.label} ${f.value}`).join(" | ");
      expect(all, t.slug).not.toMatch(/USED BY/i);
      expect(all, t.slug).not.toContain("1,840");
    }
  });

  it("FRAMES is the frame count passed in, not the template's own frames figure", () => {
    const ember = tpl("ember");
    expect(ember.frames).toBe(5);
    expect(byLabel(templateFacts(ember, 3)).FRAMES).toBe("3");
    const coldOpen = tpl("cold-open");
    expect(coldOpen.frames).toBe(6);
    expect(byLabel(templateFacts(coldOpen, 2)).FRAMES).toBe("2");
    expect(byLabel(templateFacts(coldOpen, 11)).FRAMES).toBe("11");
  });

  it("BACKGROUND names the background and whether it runs across the set or sits on every frame", () => {
    expect(byLabel(templateFacts(tpl("ember"), 5)).BACKGROUND).toBe("Ember, across the set");
    expect(byLabel(templateFacts(tpl("moss"), 5)).BACKGROUND).toBe("Moss, across the set");
    expect(byLabel(templateFacts(tpl("cold-open"), 5)).BACKGROUND).toBe("Dusk on every frame");
    expect(byLabel(templateFacts(tpl("blueprint"), 5)).BACKGROUND).toBe("Dusk on every frame");
    expect(byLabel(templateFacts(tpl("harbour"), 5)).BACKGROUND).toBe("Sea on every frame");
    expect(byLabel(templateFacts(tpl("field-notes"), 5)).BACKGROUND).toBe("Bone on every frame");
    for (const t of TEMPLATES) {
      const label = BGS.find((b) => b.id === t.bg)!.label;
      const value = byLabel(templateFacts(t, 4)).BACKGROUND;
      expect(value.startsWith(label), t.slug).toBe(true);
      expect(value.endsWith(t.panoramic ? ", across the set" : " on every frame"), t.slug).toBe(true);
    }
  });

  it("ANGLE reads the template's ty; CAPTION is above the device", () => {
    expect(byLabel(templateFacts(tpl("ember"), 5)).ANGLE).toBe("14° right");
    expect(byLabel(templateFacts(tpl("cold-open"), 5)).ANGLE).toBe("Flat");
    expect(byLabel(templateFacts(tpl("field-notes"), 5)).ANGLE).toBe("12° left");
    for (const t of TEMPLATES) {
      const facts = byLabel(templateFacts(t, 5));
      expect(facts.ANGLE, t.slug).toBe(angleLabel(t.ty));
      expect(facts.CAPTION, t.slug).toBe("Above the device");
    }
  });
});
