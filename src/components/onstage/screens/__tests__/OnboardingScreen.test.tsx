import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ScreenshotSet, SetDoc } from "@/lib/data/types";
import { doc, frame } from "@/lib/data/__tests__/helpers";
import { seedLibrary, storageSnapshot } from "@/lib/data/__tests__/library";

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
  await click(byText("Upload your screens"));
  await click(byText("Continue with 5 screens"));
  expect(host.textContent).toContain("STEP 3 — PICK A LOOK");
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
    expect(made.workMode).toBe("canvas");

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
    expect(made.workMode).toBe("guided");
    expect(made.frames.map((f) => f.caption)).toEqual(base.frames.map((f) => f.caption));
    expect(made.frames.map((f) => f.bg)).toEqual(base.frames.map((f) => f.bg));
    expect(JSON.stringify(storedDocs()["ferry-69"])).toBe(JSON.stringify(ferry));

    // The mode is the new set's, not flipped on the store's document.
    const st = useOnstage.getState();
    expect(st.workMode).toBe(modeBefore);
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
    expect(made.workMode).toBe("canvas");
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
