import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ScreenshotSet, SetDoc } from "@/lib/data/types";
import { doc, frame } from "@/lib/data/__tests__/helpers";
import { seedLibrary, storageSnapshot } from "@/lib/data/__tests__/library";

/**
 * Plan S2.1 / D10: a template never restyles the open set. "Use this set" (the
 * gallery) and "Apply and open canvas" (a template's page) make a NEW set —
 * your screens in that template — and open it by id.
 */

const nav = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  params: new URLSearchParams(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: nav.push, replace: nav.replace, back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/templates",
  useSearchParams: () => nav.params,
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const DOCS_KEY = "onstage:set-docs:v1";
const SETS_KEY = "onstage:sets:v1";
const LAST_KEY = "onstage:last-set:v1";

/** The set this browser last worked on: two frames, one with a stored screenshot. */
const mine: SetDoc = doc([
  frame({ caption: "Mine one", bg: "ember", tiltY: 0, screenshot: "img:shot-one" }),
  frame({ caption: "Mine two", bg: "dusk", tiltY: 12, depth: 30, screenshot: null }),
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

/** A fresh page load: the screens and the store from one module graph. */
async function load() {
  const gallery = await import("../TemplatesScreen");
  const detail = await import("../TemplateDetailScreen");
  const store = await import("@/store/onstage");
  return { ...gallery, ...detail, ...store };
}

function seedLastSet() {
  localStorage.setItem(DOCS_KEY, JSON.stringify({ "trailhead-69": mine }));
  localStorage.setItem(LAST_KEY, JSON.stringify("trailhead-69"));
}

const storedDocs = (): Record<string, SetDoc> => JSON.parse(localStorage.getItem(DOCS_KEY) ?? "{}");
const storedSets = (): ScreenshotSet[] => JSON.parse(localStorage.getItem(SETS_KEY) ?? "[]");

/** The set records whose ids weren't stored in `before` (the library is
 *  seeded, so a new set is never the only record). */
function addedSets(before: ScreenshotSet[]): ScreenshotSet[] {
  const had = new Set(before.map((x) => x.id));
  return storedSets().filter((x) => !had.has(x.id));
}

/** The records from `before` as they are stored now. */
function keptSets(before: ScreenshotSet[]): ScreenshotSet[] {
  const had = new Set(before.map((x) => x.id));
  return storedSets().filter((x) => had.has(x.id));
}

/** Let effects, backend reads and writes run until `done` holds. */
async function until(done: () => boolean, ms = 3000) {
  const end = Date.now() + ms;
  while (!done()) {
    if (Date.now() > end) throw new Error("timed out waiting for the screen");
    await act(() => new Promise((r) => setTimeout(r, 5)));
  }
}

function card(slug: string): HTMLAnchorElement {
  const a = [...host.querySelectorAll("a")].find((el) => el.getAttribute("href")?.endsWith(`/templates/${slug}`));
  if (!a) throw new Error(`no card for ${slug}`);
  return a;
}

/** The card's grid item: its link (the template page) and the button under it. */
const cardItem = (slug: string): HTMLElement => card(slug).parentElement!;

function button(label: string, within: ParentNode = host): HTMLButtonElement {
  const b = [...within.querySelectorAll("button")].find((el) => el.textContent === label);
  if (!b) throw new Error(`no "${label}" button`);
  return b;
}

/** Click, returning whether the browser's default (following a link) survives. */
async function click(el: HTMLElement): Promise<boolean> {
  let notCancelled = true;
  await act(async () => {
    notCancelled = el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
  return notCancelled;
}

describe("TemplatesScreen — Use this set", () => {
  it("makes a new Moss set from your screens and opens it by id, leaving your set and the store alone", async () => {
    seedLastSet();
    const { TemplatesScreen, useOnstage } = await load();
    const framesBefore = JSON.stringify(useOnstage.getState().frames);
    const setsBefore = storedSets();
    await act(async () => root.render(<TemplatesScreen />));

    // A visible button under the card, not an invisible overlay inside its
    // link (GAP-12): a tap on the card opens the template page instead.
    const use = button("Use this set", cardItem("moss"));
    expect(card("moss").contains(use)).toBe(false);
    expect(card("moss").querySelector("button")).toBeNull();
    await click(use);
    await until(() => nav.push.mock.calls.length > 0);

    const created = addedSets(setsBefore);
    expect(created).toHaveLength(1);
    expect(keptSets(setsBefore)).toEqual(setsBefore);
    const [set] = created;
    expect(set).toMatchObject({ appId: "trailhead", name: "Trailhead — Moss" });
    expect(nav.push).toHaveBeenCalledTimes(1);
    expect(nav.push).toHaveBeenCalledWith(`/editor?set=${set.id}`);
    expect(nav.replace).not.toHaveBeenCalled();

    const docs = storedDocs();
    const made = docs[set.id];
    expect(made.frames.every((f) => f.bg === "moss")).toBe(true);
    expect(made.frames.map((f) => f.caption)).toEqual(["Mine one", "Mine two"]);
    expect(made.frames.map((f) => f.screenshot)).toEqual(["img:shot-one", null]);
    expect(made.panorama).toBe(true);

    // The set it copied is untouched, byte for byte, and nothing else was written.
    expect(JSON.stringify(docs["trailhead-69"])).toBe(JSON.stringify(mine));
    expect(Object.keys(docs).sort()).toEqual([set.id, "trailhead-69"].sort());

    // Nothing was opened in (or changed on) the canvas: that is the editor's
    // job once it reaches /editor?set=<id>.
    const st = useOnstage.getState();
    expect(st.loadedSetId).toBeNull();
    expect(JSON.stringify(st.frames)).toBe(framesBefore);
    expect(useOnstage.temporal.getState().pastStates).toHaveLength(0);
    expect(localStorage.getItem(LAST_KEY)).toBe(JSON.stringify("trailhead-69"));
  });

  it("with a set open in the canvas, copies it as it is now and leaves the open set's look and history alone", async () => {
    seedLastSet();
    const { TemplatesScreen, useOnstage, openSet } = await load();
    await openSet("trailhead-69");
    useOnstage.getState().patchFrame({ caption: "Unsaved edit" });
    const framesBefore = JSON.stringify(useOnstage.getState().frames);
    const pastBefore = useOnstage.temporal.getState().pastStates.length;
    const setsBefore = storedSets();
    await act(async () => root.render(<TemplatesScreen />));

    await click(button("Use this set", cardItem("moss")));
    await until(() => nav.push.mock.calls.length > 0);

    const created = addedSets(setsBefore);
    expect(created).toHaveLength(1);
    const [set] = created;
    expect(nav.push).toHaveBeenCalledWith(`/editor?set=${set.id}`);
    const made = storedDocs()[set.id];
    expect(made.frames.map((f) => f.caption)).toEqual(["Unsaved edit", "Mine two"]);
    expect(made.frames.every((f) => f.bg === "moss")).toBe(true);

    const st = useOnstage.getState();
    expect(st.loadedSetId).toBe("trailhead-69");
    expect(JSON.stringify(st.frames)).toBe(framesBefore);
    expect(useOnstage.temporal.getState().pastStates).toHaveLength(pastBefore);

    // The open set's pending autosave stores its own edit — in its own look,
    // never the template's. (Flushed here so no timer outlives the test.)
    window.dispatchEvent(new Event("pagehide"));
    await until(() => storedDocs()["trailhead-69"].frames[0].caption === "Unsaved edit");
    expect(storedDocs()["trailhead-69"].frames.map((f) => f.bg)).toEqual(["ember", "dusk"]);
  });

  it("when storage refuses the write, says why on that card and opens nothing", async () => {
    seedLastSet();
    const rawDocs = localStorage.getItem(DOCS_KEY);
    const before = storageSnapshot();
    const { TemplatesScreen, useOnstage } = await load();
    await act(async () => root.render(<TemplatesScreen />));
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("refused", "QuotaExceededError");
    });

    await click(button("Use this set", cardItem("moss")));
    await until(() => host.querySelector('[role="alert"]') !== null);

    const alerts = host.querySelectorAll('[role="alert"]');
    expect(alerts).toHaveLength(1);
    expect(alerts[0].textContent!.startsWith("Couldn't create the set — This browser's storage is full.")).toBe(true);
    expect(cardItem("moss").contains(alerts[0])).toBe(true);
    expect(nav.push).not.toHaveBeenCalled();
    // Free to try again.
    const retry = button("Use this set", cardItem("moss"));
    expect(retry.disabled).toBe(false);

    vi.restoreAllMocks();
    // Nothing changed: no record added, no document written, nothing else.
    expect(storageSnapshot()).toEqual(before);
    expect(localStorage.getItem(DOCS_KEY)).toBe(rawDocs);
    expect(useOnstage.getState().loadedSetId).toBeNull();
  });
});

describe("TemplateDetailScreen — Apply and open canvas", () => {
  it("names the set it will copy, then makes a new set in the template and opens it by id", async () => {
    seedLastSet();
    const { TemplateDetailScreen, useOnstage } = await load();
    const framesBefore = JSON.stringify(useOnstage.getState().frames);
    const setsBefore = storedSets();
    await act(async () => root.render(<TemplateDetailScreen slug="moss" />));
    await until(() => host.textContent!.includes("A new set from"));

    expect(host.textContent).toContain("A new set from Trailhead — 6.9″ set");
    expect(host.textContent).toContain("Its 2 frames");

    await click(button("Apply and open canvas"));
    await until(() => nav.push.mock.calls.length > 0);

    const created = addedSets(setsBefore);
    expect(created).toHaveLength(1);
    expect(keptSets(setsBefore)).toEqual(setsBefore);
    const [set] = created;
    expect(set).toMatchObject({ appId: "trailhead", name: "Trailhead — Moss" });
    expect(nav.push).toHaveBeenCalledTimes(1);
    expect(nav.push).toHaveBeenCalledWith(`/editor?set=${set.id}`);

    const docs = storedDocs();
    const made = docs[set.id];
    expect(made.frames.every((f) => f.bg === "moss")).toBe(true);
    expect(made.frames.map((f) => f.caption)).toEqual(["Mine one", "Mine two"]);
    expect(made.frames.map((f) => f.screenshot)).toEqual(["img:shot-one", null]);
    expect(JSON.stringify(docs["trailhead-69"])).toBe(JSON.stringify(mine));

    const st = useOnstage.getState();
    expect(st.loadedSetId).toBeNull();
    expect(JSON.stringify(st.frames)).toBe(framesBefore);
    expect(localStorage.getItem(LAST_KEY)).toBe(JSON.stringify("trailhead-69"));
  });
});

/**
 * Plan S3.3 / GAP-12: the gallery card is a plain link to the template's page;
 * making a set is a visible button after it — never an invisible overlay
 * inside the link that a first tap (no hover on touch) would set off. The
 * template page's own buttons are ordinary, visible buttons too.
 */
describe("Template cards — the link opens, the visible button creates (GAP-12)", () => {
  /** A control hidden until hover: the reveal classes, or an inline opacity of 0. */
  function hiddenUntilHover(el: HTMLElement): boolean {
    const inline = (el.getAttribute("style") ?? "").replace(/\s+/g, "");
    return (
      el.closest(".reveal, .hov-reveal") !== null ||
      /(^|;)opacity:0(?![.\d])/.test(inline) ||
      el.style.opacity === "0" ||
      el.style.visibility === "hidden" ||
      el.style.display === "none"
    );
  }

  /** A real, reachable, visible button — not an overlay over something else. */
  function expectOrdinaryButton(b: HTMLButtonElement, label: string) {
    expect(b.tagName, label).toBe("BUTTON");
    expect(b.type, label).toBe("button");
    expect(hiddenUntilHover(b), label).toBe(false);
    expect(b.classList.contains("reveal"), label).toBe(false);
    expect(b.style.position, label).not.toBe("absolute");
    expect(b.style.inset, label).toBe("");
    expect(b.tabIndex, label).toBe(0);
    expect(b.getAttribute("aria-hidden"), label).toBeNull();
    expect(b.closest("a"), label).toBeNull();
  }

  it("every card link holds no button, and every grid item has exactly one visible 'Use this set' after it", async () => {
    const { TemplatesScreen } = await load();
    const { TEMPLATES } = await import("@/lib/onstage/data");
    await act(async () => root.render(<TemplatesScreen />));

    // One grid item per template: the link, then its button.
    const grid = cardItem(TEMPLATES[0].slug).parentElement!;
    expect(grid.children).toHaveLength(TEMPLATES.length);

    for (const t of TEMPLATES) {
      const link = card(t.slug);
      expect(link.getAttribute("href"), t.slug).toBe(`/templates/${t.slug}`);
      // Nothing clickable nested in the link: no button, no role=button.
      expect(link.querySelectorAll("button, [role='button'], input"), t.slug).toHaveLength(0);
      // The link carries the preview, the name, the angle and the tagline.
      expect(link.textContent, t.slug).toContain(t.name);
      expect(link.textContent, t.slug).toContain(t.tagline);

      const item = cardItem(t.slug);
      expect(item.parentElement, t.slug).toBe(grid);
      const uses = [...item.querySelectorAll("button")].filter((b) => b.textContent === "Use this set");
      expect(uses, t.slug).toHaveLength(1);
      const [use] = uses;
      expect(link.contains(use), t.slug).toBe(false);
      // After the link, in reading and tab order.
      expect(link.compareDocumentPosition(use) & Node.DOCUMENT_POSITION_FOLLOWING, t.slug).toBeTruthy();
      expectOrdinaryButton(use, t.slug);
      expect(use.disabled, t.slug).toBe(false);
    }

    // No hover-revealed control anywhere in the gallery.
    expect(host.querySelectorAll(".reveal, .hov-reveal")).toHaveLength(0);
    for (const b of host.querySelectorAll("button")) expect(hiddenUntilHover(b), b.textContent ?? "").toBe(false);
  });

  it("clicking anywhere on the card's link creates no set and opens no canvas", async () => {
    seedLastSet();
    const { TemplatesScreen } = await load();
    const { getBackend } = await import("@/lib/data/backend");
    const createSet = vi.spyOn(getBackend(), "createSet");
    const setsBefore = storedSets();
    const docsBefore = localStorage.getItem(DOCS_KEY);
    await act(async () => root.render(<TemplatesScreen />));

    const link = card("moss");
    // The link itself, and the preview / name / tagline inside it — what a
    // first tap on a touch screen lands on.
    const targets: HTMLElement[] = [link, link.firstElementChild as HTMLElement];
    const name = [...link.querySelectorAll("span")].find((el) => el.textContent === "Moss");
    expect(name).toBeTruthy();
    targets.push(name!, link.lastElementChild as HTMLElement);

    // After React (and Next's Link) have seen each click, note whether the
    // page left it to the browser, then stop jsdom's own navigation attempt.
    const leftToBrowser: boolean[] = [];
    const follow = (e: Event) => {
      leftToBrowser.push(!e.defaultPrevented);
      e.preventDefault();
    };
    document.addEventListener("click", follow);
    try {
      for (const el of targets) await click(el);
      // Give any (wrongly) started creation time to land.
      await act(() => new Promise((r) => setTimeout(r, 50)));
    } finally {
      document.removeEventListener("click", follow);
    }

    expect(createSet).not.toHaveBeenCalled();
    expect(addedSets(setsBefore)).toEqual([]);
    expect(localStorage.getItem(DOCS_KEY)).toBe(docsBefore);
    // A plain link: each click goes to /templates/moss — followed by the
    // browser, or pushed by Next's router — and never to the canvas.
    expect(leftToBrowser).toHaveLength(targets.length);
    for (const [href] of nav.push.mock.calls) expect(href).toBe("/templates/moss");
    leftToBrowser.forEach((followed, i) =>
      expect(followed || nav.push.mock.calls.length > i, `click ${i}`).toBe(true),
    );
    expect(nav.replace).not.toHaveBeenCalled();
    expect(host.querySelector('[role="alert"]')).toBeNull();
    // Every card's "Use this set" is still free: nothing is in flight.
    expect(button("Use this set", cardItem("moss")).disabled).toBe(false);
  });

  it("while one card's set is being created, every 'Use this set' waits — and only that card says so", async () => {
    seedLastSet();
    const { TemplatesScreen } = await load();
    const { getBackend } = await import("@/lib/data/backend");
    let release!: () => void;
    const backend = getBackend();
    const real = backend.createSet.bind(backend);
    vi.spyOn(backend, "createSet").mockImplementation(async (...args) => {
      await new Promise<void>((r) => (release = r));
      return real(...args);
    });
    await act(async () => root.render(<TemplatesScreen />));

    await click(button("Use this set", cardItem("moss")));
    await until(() => cardItem("moss").textContent!.includes("Creating…"));
    const buttons = [...host.querySelectorAll<HTMLButtonElement>("[href^='/templates/'] + button")];
    expect(buttons.length).toBeGreaterThan(1);
    expect(buttons.every((b) => b.disabled)).toBe(true);
    expect(buttons.filter((b) => b.textContent === "Creating…")).toEqual([
      button("Creating…", cardItem("moss")),
    ]);

    release();
    await until(() => nav.push.mock.calls.length > 0);
    expect(nav.push).toHaveBeenCalledTimes(1);
    expect(nav.push.mock.calls[0][0]).toMatch(/^\/editor\?set=/);
  });

  it("the template page's 'Use this set' and 'Apply and open canvas' are ordinary visible buttons", async () => {
    seedLastSet();
    const { TemplateDetailScreen } = await load();
    await act(async () => root.render(<TemplateDetailScreen slug="moss" />));
    await until(() => host.textContent!.includes("A new set from"));

    for (const label of ["Use this set", "Apply and open canvas"]) {
      const b = button(label);
      expectOrdinaryButton(b, label);
      expect(b.disabled, label).toBe(false);
    }
    expect(host.querySelectorAll(".reveal, .hov-reveal")).toHaveLength(0);
  });

  it("the template page's header 'Use this set' makes the same new set as 'Apply and open canvas'", async () => {
    seedLastSet();
    const { TemplateDetailScreen } = await load();
    const setsBefore = storedSets();
    await act(async () => root.render(<TemplateDetailScreen slug="moss" />));
    await until(() => host.textContent!.includes("A new set from"));

    await click(button("Use this set"));
    await until(() => nav.push.mock.calls.length > 0);

    const created = addedSets(setsBefore);
    expect(created).toHaveLength(1);
    const [set] = created;
    expect(set).toMatchObject({ appId: "trailhead", name: "Trailhead — Moss" });
    expect(nav.push).toHaveBeenCalledTimes(1);
    expect(nav.push).toHaveBeenCalledWith(`/editor?set=${set.id}`);
    const made = storedDocs()[set.id];
    expect(made.frames.every((f) => f.bg === "moss")).toBe(true);
    expect(made.frames.map((f) => f.caption)).toEqual(["Mine one", "Mine two"]);
    expect(JSON.stringify(storedDocs()["trailhead-69"])).toBe(JSON.stringify(mine));
  });
});

/**
 * Plan S3.2: a template never changes how many frames a set has, so its card
 * says what it does do — the device angle — not the design file's "{n} FR".
 */
describe("Template cards — the angle, not a frame count", () => {
  it("each gallery card shows its template's angle label in caps, never a frame count", async () => {
    const { TemplatesScreen } = await load();
    const { TEMPLATES } = await import("@/lib/onstage/data");
    const { angleLabel } = await import("@/lib/onstage/templateFacts");
    await act(async () => root.render(<TemplatesScreen />));

    for (const t of TEMPLATES) {
      const c = card(t.slug);
      const name = [...c.querySelectorAll("span")].find((el) => el.textContent === t.name);
      expect(name, t.slug).toBeTruthy();
      expect(name!.nextElementSibling?.textContent, t.slug).toBe(angleLabel(t.ty).toUpperCase());
      expect(c.textContent, t.slug).not.toContain(`${t.frames} FR`);
    }
    expect(card("ember").textContent).toContain("14° RIGHT");
    expect(card("cold-open").textContent).toContain("FLAT");
    expect(card("field-notes").textContent).toContain("12° LEFT");
    expect(host.textContent).not.toMatch(/\d+\s*FR\b/);
  });

  it("the landing page's template strip shows each template's angle, never '{n} frames'", async () => {
    const { LandingScreen } = await import("../LandingScreen");
    const { TEMPLATES } = await import("@/lib/onstage/data");
    const { angleLabel } = await import("@/lib/onstage/templateFacts");
    await act(async () => root.render(<LandingScreen />));

    // The strip sits under "Pick a look, not a layout", after its See all link.
    const seeAll = [...host.querySelectorAll("a")].find((a) => a.textContent === "See all →");
    expect(seeAll?.getAttribute("href")).toBe("/templates");
    const grid = seeAll!.parentElement!.nextElementSibling!;
    const cards = [...grid.children];
    expect(cards).toHaveLength(6);
    cards.forEach((el, i) => {
      const t = TEMPLATES[i];
      expect(el.children[1].textContent, t.slug).toBe(t.name);
      expect(el.children[2].textContent, t.slug).toBe(angleLabel(t.ty));
      expect(el.textContent, t.slug).not.toContain(`${t.frames} frames`);
    });
    expect(cards[0].children[2].textContent).toBe("14° right");
    expect(cards[1].children[2].textContent).toBe("Flat");
    expect(grid.textContent).not.toMatch(/\d+ frames/);
  });
});
