import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ScreenshotSet, SetDoc } from "@/lib/data/types";
import { doc, frame } from "@/lib/data/__tests__/helpers";
import { seedLibrary, storageSnapshot } from "@/lib/data/__tests__/library";
import { TEMPLATES, bgCss } from "@/lib/onstage/data";

/**
 * Plan S2.1 / D10: first run's "pick a look" makes a fresh set — the default
 * document in the chosen template, not a copy of whatever set came before —
 * and opens it by id in the chosen mode. It never touches the open document.
 */

const nav = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  params: new URLSearchParams(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: nav.push, replace: nav.replace, back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/onboarding",
  useSearchParams: () => nav.params,
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const DOCS_KEY = "onstage:set-docs:v1";
const SETS_KEY = "onstage:sets:v1";
const LAST_KEY = "onstage:last-set:v1";

/** A different set, last opened in this browser, with its own captions and look. */
const ferry: SetDoc = doc([
  frame({ caption: "Ferry one", bg: "bone", tiltY: 12, screenshot: "img:ferry-shot" }),
  frame({ caption: "Ferry two", bg: "bone", tiltY: 12 }),
  frame({ caption: "Ferry three", bg: "sea", tiltY: -10 }),
]);

let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  // A returning user's library: the sample apps and sets as stored records.
  seedLibrary();
  nav.push.mockReset();
  nav.replace.mockReset();
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

/** A fresh page load: the screen, the store and docOps from one module graph. */
async function load() {
  const screen = await import("../OnboardingScreen");
  const store = await import("@/store/onstage");
  const { defaultDoc } = await import("@/lib/onstage/docOps");
  return { ...screen, ...store, defaultDoc };
}

function seedFerryAsLast() {
  localStorage.setItem(DOCS_KEY, JSON.stringify({ "ferry-69": ferry }));
  localStorage.setItem(LAST_KEY, JSON.stringify("ferry-69"));
}

const storedDocs = (): Record<string, SetDoc> => JSON.parse(localStorage.getItem(DOCS_KEY) ?? "{}");
const storedSets = (): ScreenshotSet[] => JSON.parse(localStorage.getItem(SETS_KEY) ?? "[]");

/**
 * The set records added since `before` (the library is seeded, so the new set
 * is never the only one), after checking the records already there are
 * exactly as they were.
 */
function addedSets(before: ScreenshotSet[]): ScreenshotSet[] {
  const had = new Set(before.map((x) => x.id));
  const after = storedSets();
  expect(after.filter((x) => had.has(x.id))).toEqual(before);
  return after.filter((x) => !had.has(x.id));
}

async function until(done: () => boolean, ms = 3000) {
  const end = Date.now() + ms;
  while (!done()) {
    if (Date.now() > end) throw new Error("timed out waiting for the screen");
    await act(() => new Promise((r) => setTimeout(r, 5)));
  }
}

/** The innermost element showing exactly `text`. */
function byText(text: string): HTMLElement {
  const el = [...host.querySelectorAll<HTMLElement>("*")].find(
    (e) => e.textContent === text && e.children.length === 0,
  );
  if (!el) throw new Error(`nothing shows "${text}"`);
  return el;
}

async function click(el: HTMLElement) {
  await act(async () => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
}

async function toPickALook() {
  // "Upload your screens" goes straight to the look (no picker step: S3.3).
  await click(byText("Upload your screens"));
  expect(host.textContent).toContain("STEP 2 — PICK A LOOK");
}

describe("OnboardingScreen — pick a look", () => {
  it("Cold Open makes a new set from the default document (not the last set) and opens it in the canvas", async () => {
    seedFerryAsLast();
    const { OnboardingScreen, useOnstage, defaultDoc } = await load();
    const framesBefore = JSON.stringify(useOnstage.getState().frames);
    const setsBefore = storedSets();
    await act(async () => root.render(<OnboardingScreen />));
    await toPickALook();

    await click(byText("Cold Open"));
    await until(() => nav.push.mock.calls.length > 0);

    const created = addedSets(setsBefore);
    expect(created).toHaveLength(1);
    const [set] = created;
    expect(set.appId).toBe("ferry");
    expect(nav.push).toHaveBeenCalledTimes(1);
    expect(nav.push).toHaveBeenCalledWith(`/editor?set=${set.id}`);

    const docs = storedDocs();
    const made = docs[set.id];
    const base = defaultDoc();
    expect(made.frames.map((f) => f.caption)).toEqual(base.frames.map((f) => f.caption));
    expect(made.frames.map((f) => f.caption)).not.toContain("Ferry one");
    expect(made.frames.every((f) => f.bg === "dusk")).toBe(true);
    expect(made.frames.every((f) => f.tiltY === 0 && f.screenshot === null)).toBe(true);
    expect(made.panorama).toBe(false);
    // Work mode is a preference, not a document field (S3.2).
    expect("workMode" in made).toBe(false);

    // The last set is untouched and is still the one a bare /editor returns to
    // until the editor opens the new one.
    expect(JSON.stringify(docs["ferry-69"])).toBe(JSON.stringify(ferry));
    expect(localStorage.getItem(LAST_KEY)).toBe(JSON.stringify("ferry-69"));

    const st = useOnstage.getState();
    expect(st.loadedSetId).toBeNull();
    expect(JSON.stringify(st.frames)).toBe(framesBefore);
    expect(st.workMode).toBe("canvas");
  });

  it("Walk me through it makes a guided set and opens it in the guided flow", async () => {
    seedFerryAsLast();
    const { OnboardingScreen, useOnstage, defaultDoc } = await load();
    const framesBefore = JSON.stringify(useOnstage.getState().frames);
    const modeBefore = useOnstage.getState().workMode;
    const setsBefore = storedSets();
    await act(async () => root.render(<OnboardingScreen />));
    await toPickALook();

    await click(byText("Walk me through it"));
    await until(() => nav.push.mock.calls.length > 0);

    const created = addedSets(setsBefore);
    expect(created).toHaveLength(1);
    const [set] = created;
    expect(nav.push).toHaveBeenCalledTimes(1);
    expect(nav.push).toHaveBeenCalledWith(`/guided?set=${set.id}`);

    const made = storedDocs()[set.id];
    const base = defaultDoc();
    expect("workMode" in made).toBe(false);
    expect(made.frames.map((f) => f.caption)).toEqual(base.frames.map((f) => f.caption));
    expect(made.frames.map((f) => f.bg)).toEqual(base.frames.map((f) => f.bg));
    expect(JSON.stringify(storedDocs()["ferry-69"])).toBe(JSON.stringify(ferry));

    // This one set opens guided; the work-mode preference is left as it was.
    const st = useOnstage.getState();
    expect(st.workMode).toBe(modeBefore);
    expect(JSON.parse(localStorage.getItem("onstage:prefs:v1") ?? "{}").workMode ?? "canvas").toBe("canvas");
    expect(st.loadedSetId).toBeNull();
    expect(JSON.stringify(st.frames)).toBe(framesBefore);
  });

  it("Open the canvas makes a plain default set and opens it in the canvas", async () => {
    const { OnboardingScreen, useOnstage, defaultDoc } = await load();
    const framesBefore = JSON.stringify(useOnstage.getState().frames);
    const setsBefore = storedSets();
    await act(async () => root.render(<OnboardingScreen />));
    await toPickALook();

    await click(byText("Open the canvas"));
    await until(() => nav.push.mock.calls.length > 0);

    const created = addedSets(setsBefore);
    expect(created).toHaveLength(1);
    const [set] = created;
    expect(nav.push).toHaveBeenCalledWith(`/editor?set=${set.id}`);
    const made = storedDocs()[set.id];
    const base = defaultDoc();
    expect("workMode" in made).toBe(false);
    expect(made.frames).toEqual(base.frames);
    expect(useOnstage.getState().loadedSetId).toBeNull();
    expect(JSON.stringify(useOnstage.getState().frames)).toBe(framesBefore);
  });

  it("with a set open in the canvas, Cold Open still starts from the default and leaves the open set alone", async () => {
    seedFerryAsLast();
    const { OnboardingScreen, useOnstage, openSet, defaultDoc } = await load();
    await openSet("ferry-69");
    const framesBefore = JSON.stringify(useOnstage.getState().frames);
    const pastBefore = useOnstage.temporal.getState().pastStates.length;
    const setsBefore = storedSets();
    await act(async () => root.render(<OnboardingScreen />));
    await toPickALook();

    await click(byText("Cold Open"));
    await until(() => nav.push.mock.calls.length > 0);

    const created = addedSets(setsBefore);
    expect(created).toHaveLength(1);
    const [set] = created;
    expect(nav.push).toHaveBeenCalledWith(`/editor?set=${set.id}`);
    const made = storedDocs()[set.id];
    expect(made.frames.map((f) => f.caption)).toEqual(defaultDoc().frames.map((f) => f.caption));
    expect(made.frames.every((f) => f.bg === "dusk")).toBe(true);

    const st = useOnstage.getState();
    expect(st.loadedSetId).toBe("ferry-69");
    expect(JSON.stringify(st.frames)).toBe(framesBefore);
    expect(st.frames.map((f) => f.caption)).toEqual(["Ferry one", "Ferry two", "Ferry three"]);
    expect(useOnstage.temporal.getState().pastStates).toHaveLength(pastBefore);
    expect(JSON.stringify(storedDocs()["ferry-69"])).toBe(JSON.stringify(ferry));
  });

  it("when storage refuses the write, says why and opens nothing", async () => {
    seedFerryAsLast();
    const rawDocs = localStorage.getItem(DOCS_KEY);
    const before = storageSnapshot();
    const { OnboardingScreen, useOnstage } = await load();
    await act(async () => root.render(<OnboardingScreen />));
    await toPickALook();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("refused", "QuotaExceededError");
    });

    await click(byText("Cold Open"));
    await until(() => host.querySelector('[role="alert"]') !== null);

    const alert = host.querySelector('[role="alert"]')!;
    expect(alert.textContent!.startsWith("Couldn't create the set — This browser's storage is full.")).toBe(true);
    expect(nav.push).not.toHaveBeenCalled();
    expect([...host.querySelectorAll("button")].find((b) => b.textContent === "Open the canvas")!.disabled).toBe(false);

    vi.restoreAllMocks();
    // Nothing changed: no record added, no document written, nothing else.
    expect(storageSnapshot()).toEqual(before);
    expect(localStorage.getItem(DOCS_KEY)).toBe(rawDocs);
    expect(useOnstage.getState().loadedSetId).toBeNull();
  });
});

/**
 * Plan S3.3 (SCREENSA-4/5/6): first run is two honest steps. "Upload your
 * screens" goes straight to picking a look — no screenshot picker showing
 * screens nobody imported, no "we found your app", no zip import that doesn't
 * exist, and no looks "matched to the teal in your app" (nothing reads it).
 * Each look's preview is drawn from its own template.
 */
describe("OnboardingScreen — two honest steps (S3.3)", () => {
  /** Copy from the removed steps and promises, none of which may show. */
  const GONE = [
    "Import a zip instead",
    "Already have a set somewhere else?",
    "WE FOUND YOUR APP",
    "pulled from the App Store",
    "Pick the ones to bring in",
    "Continue with",
    "These three suit your screens",
    "Matched to the",
    "MATCHES YOUR",
    "STEP 3",
    "OF 3",
  ];

  function expectNoneOfTheOldCopy() {
    const t = host.textContent ?? "";
    for (const gone of GONE) expect(t).not.toContain(gone);
    expect(t.toLowerCase()).not.toContain("teal");
  }

  /** A look's tile, found by its template name: [preview, name + meta row]. */
  function lookTile(name: string) {
    const tile = byText(name).parentElement?.parentElement;
    if (!tile) throw new Error(`no look tile for ${name}`);
    const preview = tile.firstElementChild as HTMLElement;
    const phone = preview.children[1] as HTMLElement;
    const meta = byText(name).nextElementSibling?.textContent;
    return { tile, preview, phone, meta };
  }

  /** How jsdom writes `background: css` back, to compare like with like. */
  function normalizedBackground(css: string): string {
    const probe = document.createElement("div");
    probe.style.background = css;
    return probe.style.background;
  }

  const LOOKS = [
    { slug: "moss", name: "Moss", meta: "PANORAMIC", ty: -8 },
    { slug: "cold-open", name: "Cold Open", meta: "HIGH CONTRAST", ty: 0 },
    { slug: "field-notes", name: "Field Notes", meta: "LIGHT, EDITORIAL", ty: 12 },
  ];

  it("starts on step 1 of 2 with no zip import and no store-link route", async () => {
    const { OnboardingScreen } = await load();
    await act(async () => root.render(<OnboardingScreen />));

    expect(host.textContent).toContain("STEP 1 OF 2");
    expect(host.textContent).toContain("How would you like to begin?");
    expect(host.textContent).toContain("Upload your screens");
    expect(host.textContent).toContain("Start from a template");
    // Reading a listing needs a server (storeImport is off).
    expect(host.textContent).not.toContain("Paste your store URL");
    expectNoneOfTheOldCopy();
    // Two progress dots, not three.
    const label = byText("STEP 1 OF 2");
    expect(label.parentElement!.querySelectorAll("span")).toHaveLength(3);
  });

  it("Upload your screens goes straight to picking a look: step 2 of 2, no picker", async () => {
    const { OnboardingScreen } = await load();
    await act(async () => root.render(<OnboardingScreen />));

    await click(byText("Upload your screens"));

    expect(host.textContent).toContain("STEP 2 OF 2");
    expect(host.textContent).toContain("STEP 2 — PICK A LOOK");
    expect(byText("Three looks to start from").tagName).toBe("H1");
    expect(byText("Pick one to start; everything stays editable.").tagName).toBe("P");
    expectNoneOfTheOldCopy();
    // No picker: no selectable screenshots with check marks, no "Trailhead" listing.
    expect(host.textContent).not.toContain("✓");
    expect(host.textContent).not.toContain("Trailhead — Run & Trail Log");
    // The look step's own controls.
    const buttons = [...host.querySelectorAll("button")].map((b) => b.textContent);
    expect(buttons).toEqual(
      expect.arrayContaining(["Open the canvas", "Walk me through it", "Back"]),
    );
    for (const { name } of LOOKS) expect(byText(name)).toBeTruthy();
  });

  it("Back on the look step returns to step 1, and Upload leads back to the looks", async () => {
    const { OnboardingScreen } = await load();
    await act(async () => root.render(<OnboardingScreen />));
    await click(byText("Upload your screens"));
    expect(host.textContent).toContain("STEP 2 — PICK A LOOK");

    const back = [...host.querySelectorAll("button")].find((b) => b.textContent === "Back")!;
    await click(back);

    expect(host.textContent).toContain("STEP 1 OF 2");
    expect(host.textContent).toContain("How would you like to begin?");
    expect(host.textContent).not.toContain("PICK A LOOK");
    expect(nav.push).not.toHaveBeenCalled();

    await click(byText("Upload your screens"));
    expect(host.textContent).toContain("STEP 2 OF 2");
    expect(host.textContent).toContain("Three looks to start from");
  });

  it("Start from a template goes to the gallery", async () => {
    const { OnboardingScreen } = await load();
    await act(async () => root.render(<OnboardingScreen />));
    await click(byText("Start from a template"));
    expect(nav.push).toHaveBeenCalledWith("/templates");
  });

  it("each look's preview is its template's own background and angle", async () => {
    const { OnboardingScreen } = await load();
    await act(async () => root.render(<OnboardingScreen />));
    await click(byText("Upload your screens"));

    for (const look of LOOKS) {
      const tpl = TEMPLATES.find((t) => t.slug === look.slug)!;
      expect(tpl.name).toBe(look.name);
      // The angles the templates ship with (Moss was a hard-coded -12).
      expect(tpl.ty).toBe(look.ty);

      const { preview, phone, meta } = lookTile(look.name);
      const want = normalizedBackground(bgCss(tpl.bg));
      expect(want).toContain("linear-gradient");
      expect(preview.style.background).toBe(want);
      expect(phone.style.transform).toContain(`rotateY(${tpl.ty}deg)`);
      expect(meta).toBe(look.meta);
    }
    // Moss's meta says what the template is, not what it "matches".
    expect(TEMPLATES.find((t) => t.slug === "moss")!.panoramic).toBe(true);
  });

  it.each(LOOKS)("$name makes a set that looks like its tile", async ({ slug, name, ty }) => {
    const { OnboardingScreen } = await load();
    const setsBefore = storedSets();
    await act(async () => root.render(<OnboardingScreen />));
    await toPickALook();

    await click(byText(name));
    await until(() => nav.push.mock.calls.length > 0);

    const [set] = addedSets(setsBefore);
    expect(nav.push).toHaveBeenCalledWith(`/editor?set=${set.id}`);
    const tpl = TEMPLATES.find((t) => t.slug === slug)!;
    const made = storedDocs()[set.id];
    expect(made.frames.every((f) => f.bg === tpl.bg && f.tiltY === ty)).toBe(true);
    expect(made.panorama).toBe(tpl.panoramic);
  });
});
