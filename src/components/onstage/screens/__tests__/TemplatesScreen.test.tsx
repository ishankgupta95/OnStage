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

    const followed = await click(button("Use this set", card("moss")));
    // The overlay is a shortcut inside the card: it must not also follow the
    // card's link to the template page.
    expect(followed).toBe(false);
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

    await click(button("Use this set", card("moss")));
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

    await click(button("Use this set", card("moss")));
    await until(() => host.querySelector('[role="alert"]') !== null);

    const alerts = host.querySelectorAll('[role="alert"]');
    expect(alerts).toHaveLength(1);
    expect(alerts[0].textContent!.startsWith("Couldn't create the set — This browser's storage is full.")).toBe(true);
    expect(card("moss").contains(alerts[0])).toBe(true);
    expect(nav.push).not.toHaveBeenCalled();
    // Free to try again.
    const retry = button("Use this set", card("moss"));
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
