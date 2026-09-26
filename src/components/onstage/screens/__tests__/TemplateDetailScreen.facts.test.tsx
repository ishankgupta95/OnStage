import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SetDoc } from "@/lib/data/types";
import { doc, frame } from "@/lib/data/__tests__/helpers";
import { seedLibrary } from "@/lib/data/__tests__/library";
import { CAPTIONS, TEMPLATES } from "@/lib/onstage/data";
import { panoramaSlice } from "@/lib/onstage/panorama";
import { TEMPLATE_FITS, templatePalette } from "@/lib/onstage/templateFacts";

/**
 * Plan S3.2 (SCREENSA-2, GAP-15): a template's page states facts read from
 * what applying it does — the set's real frame count, the background's own
 * colours, the export sizes — and draws a panoramic strip the way the canvas
 * does. No "USED BY 1,840 sets", no font the template doesn't set.
 */

const nav = vi.hoisted(() => ({
  params: new URLSearchParams(),
  router: {
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => nav.router,
  usePathname: () => "/templates/moss",
  useSearchParams: () => nav.params,
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const DOCS_KEY = "onstage:set-docs:v1";
const LAST_KEY = "onstage:last-set:v1";

/** The set this browser last worked on: three frames. */
const three: SetDoc = doc([
  frame({ caption: "Mine one", bg: "ember" }),
  frame({ caption: "Mine two", bg: "dusk", tiltY: 12 }),
  frame({ caption: "Mine three", bg: "moss" }),
]);

let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  seedLibrary();
  for (const fn of Object.values(nav.router)) fn.mockReset();
  nav.params = new URLSearchParams();
  vi.resetModules();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
});

function seedLastSet(d: SetDoc = three) {
  localStorage.setItem(DOCS_KEY, JSON.stringify({ "trailhead-69": d }));
  localStorage.setItem(LAST_KEY, JSON.stringify("trailhead-69"));
}

async function until(done: () => boolean, ms = 3000) {
  const end = Date.now() + ms;
  while (!done()) {
    if (Date.now() > end) throw new Error("timed out waiting for the screen");
    await act(() => new Promise((r) => setTimeout(r, 5)));
  }
}

/** Render one template's page from a fresh module graph and wait for the
 *  previewed set to load (its card names the set it will copy). */
async function mount(slug: string) {
  const { TemplateDetailScreen } = await import("../TemplateDetailScreen");
  await act(async () => root.render(<TemplateDetailScreen slug={slug} />));
  await until(() => host.textContent!.includes("A new set from"));
}

/** The innermost element showing exactly `text`. */
function leaf(text: string): HTMLElement {
  const el = [...host.querySelectorAll<HTMLElement>("*")].find(
    (e) => e.children.length === 0 && e.textContent === text,
  );
  if (!el) throw new Error(`nothing shows "${text}"`);
  return el;
}

/** A fact's value: the element after its label. */
const fact = (label: string) => leaf(label).nextElementSibling?.textContent ?? null;

/** The strip's frames, in order: each is the parent of its "01", "02"… number. */
const strip = () =>
  [...host.querySelectorAll<HTMLElement>("span")]
    .filter((el) => /^\d\d$/.test(el.textContent ?? ""))
    .map((n) => n.parentElement!);

function button(label: string): HTMLButtonElement {
  const b = [...host.querySelectorAll("button")].find((el) => el.textContent === label);
  if (!b) throw new Error(`no "${label}" button`);
  return b;
}

async function click(el: HTMLElement) {
  await act(async () => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
}

/** A colour as the DOM serialises it, so "#1f2b4d" and "rgb(31, 43, 77)" compare equal. */
function cssColour(c: string): string {
  const probe = document.createElement("div");
  probe.style.background = c;
  return probe.style.background;
}

const tpl = (slug: string) => TEMPLATES.find((t) => t.slug === slug)!;

describe("TemplateDetailScreen — facts, not figures", () => {
  it("never shows a USED BY count or the old invented 1,840", async () => {
    seedLastSet();
    for (const slug of ["moss", "cold-open", "blueprint"]) {
      await mount(slug);
      const text = host.textContent ?? "";
      expect(text, slug).not.toMatch(/USED BY/i);
      expect(text, slug).not.toContain("1,840");
    }
  });

  it("FRAMES is the previewed set's frame count, not the template's own figure", async () => {
    seedLastSet();
    await mount("cold-open");
    expect(tpl("cold-open").frames).toBe(6);
    expect(fact("FRAMES")).toBe("3");
    expect(host.textContent).toContain("Its 3 frames");
  });

  it("with no saved document for the set, FRAMES is the default document's five", async () => {
    // The seeded library with nothing stored: the set a bare /editor opens
    // has the default document.
    await mount("nocturne");
    expect(tpl("nocturne").frames).toBe(7);
    expect(fact("FRAMES")).toBe(String(CAPTIONS.length));
  });

  it("states the background, angle and caption the template actually applies", async () => {
    seedLastSet();
    await mount("moss");
    expect(fact("BACKGROUND")).toBe("Moss, across the set");
    expect(fact("ANGLE")).toBe("8° right");
    expect(fact("CAPTION")).toBe("Above the device");

    act(() => root.unmount());
    root = createRoot(host);
    await mount("field-notes");
    expect(fact("BACKGROUND")).toBe("Bone on every frame");
    expect(fact("ANGLE")).toBe("12° left");
  });

  it("PALETTE swatches are the applied background's stops then its ink — not the card's preview colours", async () => {
    seedLastSet();
    await mount("blueprint");
    const swatches = [...leaf("PALETTE").nextElementSibling!.children] as HTMLElement[];
    const expected = templatePalette(tpl("blueprint"));
    expect(expected).toEqual(["#1f2b4d", "#0e1424", "#fff"]);
    expect(swatches.map((el) => el.style.background)).toEqual(expected.map(cssColour));
    const shown = swatches.map((el) => el.style.background);
    for (const old of ["#12232e", "#0a1218", "#f0efe9"]) expect(shown).not.toContain(cssColour(old));
  });

  it("a light template's palette ends with the ink its captions get", async () => {
    seedLastSet();
    await mount("bone");
    const swatches = [...leaf("PALETTE").nextElementSibling!.children] as HTMLElement[];
    expect(swatches.map((el) => el.style.background)).toEqual(templatePalette(tpl("bone")).map(cssColour));
    expect(swatches.at(-1)!.style.background).toBe(cssColour("#1a1614"));
  });

  it("TYPE says the set keeps its own caption font", async () => {
    seedLastSet();
    await mount("ember");
    expect(leaf("TYPE").nextElementSibling!.textContent).toBe("Keeps your caption font");
    expect(host.textContent).not.toContain("Inter 500");
    expect(host.textContent).not.toContain("tracking");
  });

  it("FITS lists every export size", async () => {
    seedLastSet();
    await mount("ember");
    const chips = [...leaf("FITS").nextElementSibling!.children].map((el) => el.textContent);
    expect(chips).toEqual(TEMPLATE_FITS);
    expect(chips).toContain("Apple iPad Pro 13″");
    expect(chips).toContain("Google Feature graphic");
  });
});

describe("TemplateDetailScreen — the panoramic strip", () => {
  it.each(["moss", "ember"])(
    "%s slices one background across the strip, n frames wide, positions 0..100%%",
    async (slug) => {
      seedLastSet();
      await mount(slug);
      const frames = strip();
      // The sample set: the five sample captions.
      expect(frames).toHaveLength(CAPTIONS.length);
      const n = frames.length;
      frames.forEach((el, i) => {
        expect(el.style.backgroundSize).toBe(`${n * 100}% 100%`);
        expect(el.style.backgroundSize).toBe(panoramaSlice(i, n).size);
        expect(el.style.backgroundPosition).toBe(panoramaSlice(i, n).position);
      });
      expect(frames.map((el) => el.style.backgroundPosition)).toEqual([
        "0% 50%",
        "25% 50%",
        "50% 50%",
        "75% 50%",
        "100% 50%",
      ]);
    },
  );

  it("switching to My screens with a 3-frame set re-slices for three frames", async () => {
    seedLastSet();
    await mount("moss");
    await click(button("My screens"));
    const frames = strip();
    expect(frames).toHaveLength(3);
    expect(frames.map((el) => el.style.backgroundSize)).toEqual(["300% 100%", "300% 100%", "300% 100%"]);
    expect(frames.map((el) => el.style.backgroundPosition)).toEqual(["0% 50%", "50% 50%", "100% 50%"]);
    expect(host.textContent).toContain("Mine three");

    // And back to the sample set's five.
    await click(button("Sample set"));
    expect(strip().map((el) => el.style.backgroundSize)).toEqual(Array(5).fill("500% 100%"));
  });

  it("a non-panoramic template shows the whole background on every frame", async () => {
    seedLastSet();
    await mount("cold-open");
    const frames = strip();
    expect(frames).toHaveLength(CAPTIONS.length);
    for (const el of frames) {
      expect(el.style.backgroundSize).toBe("100% 100%");
      expect(el.style.backgroundPosition).toBe("50% 50%");
    }
  });
});

describe("TemplateDetailScreen — the body copy counts the real frames", () => {
  it("a panoramic template says the set's N frames read as one strip", async () => {
    seedLastSet();
    await mount("moss");
    const text = host.textContent ?? "";
    expect(text).toContain("the gradient runs across the set, so the 3 frames read as one strip in the store.");
    expect(text).not.toContain("the five frames");
    expect(text).not.toContain("every frame carries the same gradient");
  });

  it("with a 7-frame set, it says 7", async () => {
    seedLastSet(doc(Array.from({ length: 7 }, (_, i) => frame({ caption: `Seven ${i + 1}` }))));
    await mount("ember");
    expect(host.textContent).toContain("so the 7 frames read as one strip in the store.");
    expect(fact("FRAMES")).toBe("7");
  });

  it("with a one-frame set, it doesn't speak of '1 frames' or a strip of one", async () => {
    seedLastSet(doc([frame({ caption: "Only" })]));
    await mount("moss");
    const text = host.textContent ?? "";
    expect(fact("FRAMES")).toBe("1");
    expect(text).not.toContain("1 frames");
    expect(text).not.toContain("read as one strip");
    expect(text).toContain("the gradient is laid out to run across every frame the set gets.");
  });

  it("a per-frame template says every frame carries the same gradient", async () => {
    seedLastSet();
    await mount("cold-open");
    const text = host.textContent ?? "";
    expect(text).toContain("and every frame carries the same gradient.");
    expect(text).not.toContain("read as one strip");
    expect(text).not.toContain("the five frames");
  });
});
