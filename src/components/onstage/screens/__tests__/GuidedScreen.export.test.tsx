import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { seedLibrary } from "@/lib/data/__tests__/library";
import { frame } from "@/lib/data/__tests__/helpers";
import { EXPORT_ROOT, exportPlan, formatMB } from "@/lib/onstage/export/plan";
import { EXPORT_SLOTS } from "@/lib/onstage/export/slots";
import { usableLocales } from "@/lib/onstage/export/slots";
import { CAPTIONS } from "@/lib/onstage/data";

/**
 * Plan S3.2: guided step 4 ("Check what you'll get") shows the export the
 * dialog would write — the count, the approximate size, a row per picked
 * size, the locales and the "Export N files" label all come from the export
 * plan for the set's frames and the picked sizes and locales. No fixed
 * "40 files", "16.8 MB", "stretched" tablet row or "Both stores" promise.
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
  usePathname: () => "/guided",
  useSearchParams: () => nav.params,
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const SET = "trailhead-69";

const IPHONE_69 = 0;
const IPHONE_65 = 1;
const IPAD = 2;
const PHONE = 3;
const TABLET_7 = 4;
const FEATURE = 5;

const TABLET_NOTE = "Tablet sizes use your phone screenshots, cropped to fit the tablet screen.";

type Store = typeof import("@/store/onstage");

let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  seedLibrary();
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  vi.resetModules();
  Object.values(nav.router).forEach((fn) => fn.mockClear());
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

async function settle(ms = 0) {
  for (let i = 0; i < 5; i++) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
      await new Promise((r) => setImmediate(r));
    });
  }
}

/** A page load of /guided?set=trailhead-69 (flags off), on step 4 once the
 *  set has loaded. */
async function renderExportStep(): Promise<Store> {
  nav.params = new URLSearchParams(`set=${SET}`);
  const [{ GuidedScreen }, store] = [await import("../GuidedScreen"), await import("@/store/onstage")];
  await act(async () => root.render(<GuidedScreen />));
  await settle();
  await vi.waitFor(() => expect(store.useOnstage.getState().loadedSetId).toBe(SET));
  await act(async () => store.useOnstage.setState({ gStep: 3 }));
  await settle();
  return store;
}

/** Change what's picked (or the set's frames) after the set has loaded. */
async function pick(store: Store, patch: Partial<ReturnType<Store["useOnstage"]["getState"]>>) {
  await act(async () => store.useOnstage.setState(patch));
  await settle();
}

/** The plan for whatever the store holds now. */
function planOf(store: Store) {
  const st = store.useOnstage.getState();
  return exportPlan({
    picks: st.exportPicks,
    langs: usableLocales(st.frames, st.exportLangs),
    frameCount: st.frames.length,
    root: EXPORT_ROOT,
  });
}

const text = () => host.textContent ?? "";
const buttonTexts = () => [...host.querySelectorAll("button")].map((b) => b.textContent?.trim() ?? "");

function button(label: string): HTMLButtonElement {
  const b = [...host.querySelectorAll("button")].find((el) => el.textContent?.trim() === label);
  if (!b) throw new Error(`no button labelled ${label}`);
  return b;
}

/** The "files · ~X MB" line under the big number. */
function sizeLine(): HTMLElement {
  const el = [...host.querySelectorAll<HTMLElement>("span")].find((x) => /^files? · /.test(x.textContent ?? ""));
  if (!el) throw new Error("no files line");
  return el;
}

/** The big number beside it. */
const bigCount = () => sizeLine().previousElementSibling?.textContent ?? "";

/** The summary card: the number, its size line and the rows under them. */
function card(): HTMLElement {
  const top = sizeLine().parentElement;
  const c = top?.parentElement;
  if (!c) throw new Error("no summary card");
  return c;
}

/** The card's rows as [label, meta]. */
function rows(): [string, string][] {
  const top = sizeLine().parentElement;
  const list = top?.nextElementSibling;
  if (!list) throw new Error("no rows under the count");
  return [...list.children].map((row) => {
    const cells = [...row.children];
    return [cells[1]?.textContent ?? "", cells[2]?.textContent ?? ""];
  });
}

/** The step's explanatory copy: the paragraph under its title. */
function body(title: string): string {
  const h1 = [...host.querySelectorAll("h1")].find((h) => h.textContent === title);
  if (!h1) throw new Error(`no step titled ${title}`);
  const p = h1.nextElementSibling;
  expect(p?.tagName).toBe("P");
  return p?.textContent ?? "";
}

/** Whether the tablet warning shows — its box, and its words in it. */
const noteShown = () => {
  const boxes = [...host.querySelectorAll('[role="note"]')];
  const worded = [...host.querySelectorAll("div")].some((d) => d.textContent === TABLET_NOTE);
  expect(boxes.length).toBe(worded ? 1 : 0);
  return worded;
};

/** Every readout on the step equals the plan for the store's picks. */
function expectMatchesPlan(store: Store) {
  const plan = planOf(store);
  expect(bigCount()).toBe(String(plan.files));
  const files = (n: number) => `${n} file${n === 1 ? "" : "s"}`;
  expect(sizeLine().textContent).toBe(`${plan.files === 1 ? "file" : "files"} · ~${formatMB(plan.estBytes)}`);
  expect(buttonTexts()).toContain(`Export ${files(plan.files)}`);
  expect(rows()).toEqual([
    ...plan.slots.map((p): [string, string] => [p.slot.label, files(p.files)]),
    [`Locales — ${plan.locales.join(", ")}`, `×${plan.locales.length}`],
  ]);
  return plan;
}

describe("GuidedScreen step 4 — the export it promises (S3.2)", () => {
  it("says the zip holds what was picked, not both stores in every language", async () => {
    await renderExportStep();
    expect(body("Check what you'll get")).toBe("Every size and language picked for export, in one zip.");
    expect(text()).not.toContain("Both stores, every required size");
  });

  it("with the picks the set loads with, shows exactly the plan for them", async () => {
    const store = await renderExportStep();
    expectMatchesPlan(store);
  });

  it("one size and one locale: the set's frames, once", async () => {
    const store = await renderExportStep();
    const frames = store.useOnstage.getState().frames.length;
    await pick(store, { exportPicks: [IPHONE_69], exportLangs: ["EN"] });

    const plan = expectMatchesPlan(store);
    expect(plan.files).toBe(frames);
    expect(bigCount()).toBe(String(frames));
    expect(button(`Export ${frames} files`)).toBeTruthy();
    expect(rows()).toEqual([
      [EXPORT_SLOTS[IPHONE_69].label, `${frames} files`],
      ["Locales — EN", "×1"],
    ]);
    expect(noteShown()).toBe(false);
  });

  it("one file is one file, not '1 files'", async () => {
    const store = await renderExportStep();
    await pick(store, { exportPicks: [FEATURE], exportLangs: ["EN"] });
    expectMatchesPlan(store);
    expect(bigCount()).toBe("1");
    expect(sizeLine().textContent).toMatch(/^file · ~/);
    expect(button("Export 1 file")).toBeTruthy();
    expect(rows()[0]).toEqual([EXPORT_SLOTS[FEATURE].label, "1 file"]);
    expect(text()).not.toContain("1 files");
  });

  it("follows the frames, sizes and locales as they change", async () => {
    const store = await renderExportStep();
    // The sample's captions, which have DE/JA translations (S3.3 offers only
    // locales a set has captions in).
    const seven = Array.from({ length: 7 }, (_, i) => frame({ caption: CAPTIONS[i % CAPTIONS.length] }));

    // (7 + 7 + 1) × 2
    await pick(store, { frames: seven, exportPicks: [IPHONE_69, PHONE, FEATURE], exportLangs: ["EN", "DE"] });
    expect(expectMatchesPlan(store).files).toBe(30);
    expect(rows()).toEqual([
      ["Apple — iPhone 6.9″", "14 files"],
      ["Google — Phone", "14 files"],
      ["Google — Feature graphic", "2 files"],
      ["Locales — EN, DE", "×2"],
    ]);
    expect(buttonTexts()).toContain("Export 30 files");

    // One more locale: every row triples instead of doubles.
    await pick(store, { exportLangs: ["EN", "DE", "JA"] });
    expect(expectMatchesPlan(store).files).toBe(45);
    expect(rows().at(-1)).toEqual(["Locales — EN, DE, JA", "×3"]);

    // Fewer frames: the sizes shrink, the feature graphic doesn't.
    await pick(store, { frames: seven.slice(0, 3) });
    expect(expectMatchesPlan(store).files).toBe(21);
    expect(buttonTexts()).toContain("Export 21 files");
  });

  it("with no locale picked, counts English once", async () => {
    const store = await renderExportStep();
    await pick(store, { exportPicks: [PHONE], exportLangs: [] });
    expectMatchesPlan(store);
    expect(rows().at(-1)).toEqual(["Locales — EN", "×1"]);
  });

  it("with no size picked, promises no files — just the locales row", async () => {
    const store = await renderExportStep();
    await pick(store, { exportPicks: [], exportLangs: ["EN", "DE"] });
    expect(bigCount()).toBe("0");
    expect(sizeLine().textContent).toBe("files · ~0.0 MB");
    expect(buttonTexts()).toContain("Export 0 files");
    expect(rows()).toEqual([["Locales — EN, DE", "×2"]]);
  });

  it("shows none of the old fixed numbers", async () => {
    const store = await renderExportStep();
    const three = Array.from({ length: 3 }, () => frame());
    await pick(store, { frames: three, exportPicks: [PHONE], exportLangs: ["JA"] });

    expectMatchesPlan(store);
    const panel = card().textContent ?? "";
    for (const fixed of ["40", "16.8 MB", "20 files", "10 files", "iPhone 6.9″ + 6.5″", "Tablet 7″"]) {
      expect(panel).not.toContain(fixed);
    }
    expect(text()).not.toMatch(/stretched/i);
    expect(buttonTexts()).not.toContain("Export 40 files");
    expect(buttonTexts()).toContain("Export 3 files");
  });

  it("warns about tablets exactly when a tablet size is picked", async () => {
    const store = await renderExportStep();

    await pick(store, { exportPicks: [IPHONE_69, IPHONE_65, PHONE, FEATURE] });
    expect(noteShown()).toBe(false);
    expect(text()).not.toContain("Tablet sizes");

    await pick(store, { exportPicks: [IPAD] });
    expect(noteShown()).toBe(true);
    expect(rows()[0][0]).toBe("Apple — iPad Pro 13″");

    await pick(store, { exportPicks: [TABLET_7] });
    expect(noteShown()).toBe(true);
    expect(rows()[0][0]).toBe("Google — Tablet 7″");
    // A tablet row is a row like any other: its file count, not a warning.
    expect(rows()[0][1]).toBe(`${store.useOnstage.getState().frames.length * planOf(store).locales.length} files`);

    await pick(store, { exportPicks: [PHONE, IPAD, TABLET_7] });
    expect(noteShown()).toBe(true);
    expect(text()).not.toMatch(/stretch/i);
    expect(text()).not.toMatch(/\bsoft\b/i);

    await pick(store, { exportPicks: [PHONE] });
    expect(noteShown()).toBe(false);
  });

  it("the Export button still hands the canvas an export intent, whatever the count", async () => {
    const store = await renderExportStep();
    await pick(store, { exportPicks: [IPHONE_69], exportLangs: ["EN"] });
    const label = `Export ${planOf(store).files} files`;
    nav.router.push.mockClear();

    await act(async () => button(label).click());
    await settle();

    expect(nav.router.push).toHaveBeenCalledTimes(1);
    const href = new URL(String(nav.router.push.mock.calls[0][0]), "http://x");
    expect(href.pathname).toBe("/editor");
    expect(Object.fromEntries(href.searchParams)).toEqual({ set: SET, apply: "panel:export" });
    // The picks go with the store, not the URL: nothing resets them.
    expect(store.useOnstage.getState().exportPicks).toEqual([IPHONE_69]);
  });
});
