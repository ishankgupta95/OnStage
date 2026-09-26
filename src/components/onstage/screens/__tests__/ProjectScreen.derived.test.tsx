import { act, Suspense, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// One router and one set of search params per test, stable across renders the
// way Next's are.
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
  usePathname: () => "/project",
  useSearchParams: () => nav.params,
}));

import { localBackend } from "@/lib/data/local";
import { SET_DOCS_KEY } from "@/lib/data/migrateImages";
import type { App, ScreenshotSet, SetDoc } from "@/lib/data/types";
import { defaultDoc } from "@/lib/onstage/docOps";
import { requiredSizes } from "@/lib/onstage/readiness";
import { flushSaves, useOnstage } from "@/store/onstage";
import { ProjectScreen } from "../ProjectScreen";
import { seedLibrary, storageSnapshot } from "@/lib/data/__tests__/library";
import { doc, frame } from "@/lib/data/__tests__/helpers";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/* ── the library: one app, two sets, both with stored documents ──────────── */

const SETS_KEY = "onstage:sets:v1";

const APP: App = {
  id: "aurora",
  name: "Aurora",
  initial: "A",
  meta: "2 SETS",
  tint: "#6f5bd6",
  thumbs: [],
  tags: [],
};

const A_ID = "aurora-appstore";
const P_ID = "aurora-play";
const A_NAME = "Aurora — App Store";
const P_NAME = "Aurora — Play";

// No `store` on the records: the sizes must come from each set's document.
// A is the newer, so it is the board's default selection.
const recA = (): ScreenshotSet => ({
  id: A_ID,
  appId: APP.id,
  name: A_NAME,
  sub: "iPhone 16 Pro Max · 2 frames",
  frameCount: 2,
  status: "Draft",
  updatedAt: "2026-09-25T09:00:00.000Z",
  swatch: "#6f5bd6",
});
const recP = (): ScreenshotSet => ({
  id: P_ID,
  appId: APP.id,
  name: P_NAME,
  sub: "Pixel 9 Pro · 3 frames",
  frameCount: 3,
  status: "Ready",
  updatedAt: "2026-09-20T09:00:00.000Z",
  swatch: "#1b6f6a",
});

const SHOT = "img:0f1e2d3c-aaaa-4bbb-8ccc-000000000001";

/** Apple, two frames, no screenshots; one caption is blank; German source. */
const docA = (): SetDoc =>
  doc([frame({ caption: "Plan your night", bg: "iris" }), frame({ caption: "   ", bg: "sea" })], {
    store: "apple",
    lang: "de",
  });

/** Play, three frames, the second with a screenshot and a blank caption;
 *  Japanese source. */
const docP = (): SetDoc =>
  doc(
    [
      frame({ caption: "Stargaze tonight", bg: "dusk" }),
      frame({ caption: "", bg: "moss", screenshot: SHOT }),
      frame({ caption: "Share the sky", bg: "sun" }),
    ],
    { store: "play", lang: "ja", device: "pixel" },
  );

function seed(docs: Record<string, SetDoc> = { [A_ID]: docA(), [P_ID]: docP() }) {
  seedLibrary({ apps: [APP], sets: [recA(), recP()] });
  localStorage.setItem(SET_DOCS_KEY, JSON.stringify(docs));
}

/* ── mounting ────────────────────────────────────────────────────────────── */

let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  nav.params = new URLSearchParams();
  for (const fn of Object.values(nav.router)) fn.mockReset();
  useOnstage.setState({ workMode: "canvas" });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(async () => {
  act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  vi.useRealTimers();
  // Nothing a test opened or edited in the store outlives it: queued edits
  // are written now (into this test's storage, cleared before the next).
  await flushSaves();
  useOnstage.setState({ loadedSetId: null, setId: "" });
});

/** Let the backend reads resolve and the screen re-render. */
async function settle() {
  for (let i = 0; i < 3; i++) await act(() => new Promise((r) => setTimeout(r, 5)));
}

async function mount(query = `app=${APP.id}`, Screen: () => ReactNode = ProjectScreen) {
  nav.params = new URLSearchParams(query);
  await act(async () =>
    root.render(
      <Suspense>
        <Screen />
      </Suspense>,
    ),
  );
  await settle();
}

/** Wait (inside act) until `check` holds, or fail naming `what`. Uses
 *  performance.now so a faked Date can't stall it. */
async function until(check: () => boolean, what: string, ms = 3000) {
  const start = performance.now();
  while (!check()) {
    if (performance.now() - start > ms) throw new Error(`timed out waiting for ${what}`);
    await act(() => new Promise((r) => setTimeout(r, 5)));
  }
}

/* ── reading the page ───────────────────────────────────────────────────── */

/** Elements whose own text is exactly `t`. */
const byText = (t: string) =>
  [...host.querySelectorAll<HTMLElement>("*")].filter((el) => el.textContent === t);

function button(within: ParentNode, label: string): HTMLButtonElement {
  const b = [...within.querySelectorAll("button")].find((x) => x.textContent?.trim() === label);
  if (!b) throw new Error(`no "${label}" button`);
  return b;
}

const buttonsLabelled = (within: ParentNode, label: string) =>
  [...within.querySelectorAll("button")].filter((x) => x.textContent?.trim() === label);

/** The clickable line of the set row named `name` (it holds the row's buttons). */
function setRow(name: string): HTMLElement {
  const label = byText(name).at(-1);
  if (!label) throw new Error(`no set row named ${name}`);
  let el: HTMLElement | null = label;
  while (el && !el.querySelector("button")) el = el.parentElement;
  if (!el) throw new Error(`set row ${name} has no buttons`);
  return el;
}

async function click(el: HTMLElement) {
  await act(async () => el.click());
}

const pushed = () => nav.router.push.mock.calls.map((c) => c[0] as string);
const alerts = () => [...host.querySelectorAll<HTMLElement>('[role="alert"]')];
const storedSets = () => JSON.parse(localStorage.getItem(SETS_KEY) ?? "[]") as ScreenshotSet[];
const storedDocs = () => JSON.parse(localStorage.getItem(SET_DOCS_KEY) ?? "{}") as Record<string, SetDoc>;

function requiredHeading(): HTMLElement {
  const h = [...host.querySelectorAll("h2")].find((x) => x.textContent === "Required sizes");
  if (!h) throw new Error("no Required sizes heading");
  return h as HTMLElement;
}

/** The count line beside "Required sizes": "<SET> · APPLE n OF m". */
const sizesHeader = () => requiredHeading().nextElementSibling?.textContent ?? "";

type Card = { store: string; label: string; px: string; status: string; thumbs: number; open: HTMLButtonElement };

/** Every size card under "Required sizes", as the page shows it. */
function sizeCards(): Card[] {
  const list = requiredHeading().parentElement!.nextElementSibling!;
  return [...list.children].flatMap((card) => {
    const row = card.children[0];
    const open = row?.querySelector("button");
    if (!row || !open) return []; // a loading placeholder
    const [store, name, status] = [...row.children] as HTMLElement[];
    return [
      {
        store: store.textContent ?? "",
        label: name.children[0]?.textContent ?? "",
        px: name.children[1]?.textContent ?? "",
        status: status.textContent ?? "",
        thumbs: card.children[1]?.children.length ?? 0,
        open,
      },
    ];
  });
}

/** The cards without their buttons, for toEqual. */
const cardRows = () =>
  sizeCards().map(({ store, label, px, status, thumbs }) => ({ store, label, px, status, thumbs }));

/** Wait for the Required sizes header to read `header`. */
const sizesRead = (header: string) =>
  until(() => sizesHeader() === header && sizeCards().length > 0, `the Required sizes header "${header}"`);

type LocaleRow = { code: string; name: string; frames: string; state: string; action: string };

/** The Locales tab's language rows. */
function localeRows(): LocaleRow[] {
  const counts = [...host.querySelectorAll<HTMLElement>("div")].filter(
    (el) => el.children.length === 0 && /^\d+ OF \d+ FRAMES$/.test(el.textContent ?? ""),
  );
  return counts.map((count) => {
    const row = count.parentElement!.parentElement!;
    const [code, info, state, action] = [...row.children] as HTMLElement[];
    return {
      code: code.textContent ?? "",
      name: info.children[0]?.textContent ?? "",
      frames: count.textContent ?? "",
      state: state.textContent ?? "",
      action: action.textContent ?? "",
    };
  });
}

/** The right column's LOCALES chips: code and the name in its title. */
function localeChips(): { code: string; title: string | null }[] {
  const label = byText("LOCALES")[0];
  if (!label) throw new Error("no LOCALES card");
  return [...label.nextElementSibling!.children]
    .filter((el) => el.tagName === "SPAN")
    .map((el) => ({ code: el.textContent ?? "", title: el.getAttribute("title") }));
}

/** The set "Export & upload" opens. */
async function exportTarget(): Promise<string | null> {
  nav.router.push.mockReset();
  await click(button(host, "Export & upload"));
  const calls = pushed();
  expect(calls).toHaveLength(1);
  return new URL(calls[0], "http://x").searchParams.get("set");
}

/** What each size card's Open pushes. */
async function sizeOpens(): Promise<string[]> {
  nav.router.push.mockReset();
  for (const c of sizeCards()) await click(c.open);
  return pushed();
}

const APPLE_MISSING: Omit<Card, "open">[] = [
  { store: "Apple", label: "iPhone 6.9″", px: "1320 × 2868", status: "Missing", thumbs: 0 },
  { store: "Apple", label: "iPhone 6.5″", px: "1242 × 2688", status: "Missing", thumbs: 0 },
  { store: "Apple", label: "iPad Pro 13″", px: "2064 × 2752", status: "Missing", thumbs: 0 },
];

const GOOGLE_READY: Omit<Card, "open">[] = [
  { store: "Google", label: "Phone", px: "1080 × 1920", status: "Ready", thumbs: 1 },
  { store: "Google", label: "Tablet 7″", px: "1200 × 1920", status: "Ready", thumbs: 1 },
  { store: "Google", label: "Feature graphic", px: "1024 × 500", status: "Ready", thumbs: 1 },
];

/* ── Required sizes ─────────────────────────────────────────────────────── */

describe("ProjectScreen — Required sizes follow the selected set's document", () => {
  it("the default (newest) set A: its name, APPLE 0 OF 3, and the three Apple sizes Missing", async () => {
    seed();
    await mount();
    await sizesRead("AURORA — APP STORE · APPLE 0 OF 3");
    expect(cardRows()).toEqual(APPLE_MISSING);
    // Every size's Open opens the selected set, by id.
    expect(await sizeOpens()).toEqual([
      `/editor?set=${A_ID}`,
      `/editor?set=${A_ID}`,
      `/editor?set=${A_ID}`,
    ]);
    expect(await exportTarget()).toBe(A_ID);
  });

  it("selecting P switches to its name, GOOGLE 3 OF 3 and the Play sizes (one screenshot readies all three)", async () => {
    seed();
    await mount();
    await sizesRead("AURORA — APP STORE · APPLE 0 OF 3");

    await click(setRow(P_NAME));
    expect(nav.router.push).not.toHaveBeenCalled();
    await sizesRead("AURORA — PLAY · GOOGLE 3 OF 3");
    expect(cardRows()).toEqual(GOOGLE_READY);
    expect(await sizeOpens()).toEqual([`/editor?set=${P_ID}`, `/editor?set=${P_ID}`, `/editor?set=${P_ID}`]);
    expect(await exportTarget()).toBe(P_ID);

    // …and back again.
    await click(setRow(A_NAME));
    await sizesRead("AURORA — APP STORE · APPLE 0 OF 3");
    expect(cardRows()).toEqual(APPLE_MISSING);
    expect(await sizeOpens()).toEqual([`/editor?set=${A_ID}`, `/editor?set=${A_ID}`, `/editor?set=${A_ID}`]);
  });

  it("a Play set with frames but no screenshot: only the feature graphic is Ready (GOOGLE 1 OF 3)", async () => {
    const bare = docP();
    bare.frames = bare.frames.map((f) => ({ ...f, screenshot: null }));
    seed({ [A_ID]: docA(), [P_ID]: bare });
    await mount();
    await click(setRow(P_NAME));
    await sizesRead("AURORA — PLAY · GOOGLE 1 OF 3");
    expect(cardRows()).toEqual([
      { store: "Google", label: "Phone", px: "1080 × 1920", status: "Missing", thumbs: 0 },
      { store: "Google", label: "Tablet 7″", px: "1200 × 1920", status: "Missing", thumbs: 0 },
      // Made from the first frame.
      { store: "Google", label: "Feature graphic", px: "1024 × 500", status: "Ready", thumbs: 1 },
    ]);
  });

  it("a set with no stored document shows the default document's sizes, as the editor would open it", async () => {
    seed({ [P_ID]: docP() });
    await mount();
    const expected = requiredSizes(defaultDoc());
    expect(expected.store).toBe("apple");
    await sizesRead(`AURORA — APP STORE · APPLE ${expected.ready} OF ${expected.rows.length}`);
    expect(cardRows().map(({ label, px, status }) => ({ label, px, status }))).toEqual(
      expected.rows.map(({ label, px, status }) => ({ label, px, status })),
    );
    // Reading it for the board wrote nothing.
    expect(storedDocs()).toEqual({ [P_ID]: docP() });
  });

  it("never reads the fixture size rows or locales (listSizeRows / listLocales)", async () => {
    const sizes = vi.spyOn(localBackend, "listSizeRows");
    const locales = vi.spyOn(localBackend, "listLocales");
    seed();
    await mount();
    await sizesRead("AURORA — APP STORE · APPLE 0 OF 3");
    await click(setRow(P_NAME));
    await sizesRead("AURORA — PLAY · GOOGLE 3 OF 3");
    await click(button(host, "Locales"));
    await until(() => localeRows().length > 0, "the Locales tab");
    await click(button(host, "Sets"));
    await settle();
    expect(sizes).not.toHaveBeenCalled();
    expect(locales).not.toHaveBeenCalled();
  });
});

/* ── Locales ────────────────────────────────────────────────────────────── */

describe("ProjectScreen — the Locales tab and LOCALES chips follow the selected set", () => {
  it("shows just the selected set's source language, counting its written captions; switching sets changes it", async () => {
    seed();
    await mount();
    await until(() => localeChips().length > 0, "the LOCALES chips");
    // The captions' language — English until S9.1 — not the set's `lang`
    // (the filmstrip's view chip: DE for A, JA for P here).
    expect(localeChips()).toEqual([{ code: "EN", title: "English (US)" }]);

    await click(button(host, "Locales"));
    await until(() => localeRows().length > 0, "the Locales rows");
    // A: two frames, one caption blank (whitespace only).
    expect(localeRows()).toEqual([
      { code: "EN", name: "English (US)", frames: "1 OF 2 FRAMES", state: "SOURCE", action: "Review" },
    ]);
    // None of the fixture languages.
    for (const name of ["German", "Japanese", "Spanish", "French", "Portuguese (BR)"]) {
      expect(byText(name)).toEqual([]);
    }

    // Select P on the Sets tab, then come back.
    await click(button(host, "Sets"));
    await click(setRow(P_NAME));
    await click(button(host, "Locales"));
    await until(() => localeRows()[0]?.frames === "2 OF 3 FRAMES", "P's Locales row");
    // P: three frames, the second caption empty.
    expect(localeRows()).toEqual([
      { code: "EN", name: "English (US)", frames: "2 OF 3 FRAMES", state: "SOURCE", action: "Review" },
    ]);
    expect(localeChips()).toEqual([{ code: "EN", title: "English (US)" }]);
    expect(byText("Japanese")).toEqual([]);
  });

  it("a set with no stored document lists the default's language, English (US), every frame written", async () => {
    seed({ [P_ID]: docP() });
    await mount();
    await until(() => localeChips().length > 0, "the LOCALES chips");
    expect(localeChips()).toEqual([{ code: "EN", title: "English (US)" }]);
    await click(button(host, "Locales"));
    await until(() => localeRows().length > 0, "the Locales rows");
    const n = defaultDoc().frames.length;
    expect(localeRows()).toEqual([
      { code: "EN", name: "English (US)", frames: `${n} OF ${n} FRAMES`, state: "SOURCE", action: "Review" },
    ]);
  });
});

/* ── Duplicate ──────────────────────────────────────────────────────────── */

describe("ProjectScreen — Duplicate", () => {
  it("with the row's delete card open, copying closes the card and shows its own progress, not 'Deleting…'", async () => {
    seed();
    let release!: () => void;
    const real = localBackend.duplicateSet.bind(localBackend);
    vi.spyOn(localBackend, "duplicateSet").mockImplementation(async (id) => {
      await new Promise<void>((r) => (release = r));
      return real(id);
    });
    await mount();
    await click(button(setRow(P_NAME), "Delete"));
    expect(host.querySelector(`[aria-label="Delete ${P_NAME}?"]`)).not.toBeNull();

    await click(button(setRow(P_NAME), "Duplicate"));
    await until(() => typeof release === "function", "the copy to start");
    expect(host.querySelector(`[aria-label="Delete ${P_NAME}?"]`)).toBeNull();
    expect(host.textContent).not.toContain("Deleting…");
    expect(buttonsLabelled(host, "Copying…")).toHaveLength(1);

    release();
    await until(() => byText(`${P_NAME} copy`).length > 0, "the copy's row");
    expect(storedSets().map((x) => x.id)).toContain(P_ID);
  });

  it("adds '<name> copy' sharing the original's document and screenshots, and selects it", async () => {
    seed();
    // The copy is stamped older than both sets, so newest-first would never
    // put it first: only an explicit selection makes it the board's set.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    await mount();
    await sizesRead("AURORA — APP STORE · APPLE 0 OF 3");
    const before = { sets: storedSets(), docs: storedDocs() };

    await click(button(setRow(P_NAME), "Duplicate"));
    await until(() => byText(`${P_NAME} copy`).length > 0, "the copy's row");
    await sizesRead("AURORA — PLAY COPY · GOOGLE 3 OF 3");

    const sets = storedSets();
    expect(sets).toHaveLength(3);
    // The originals are untouched; the copy is appended.
    expect(sets.slice(0, 2)).toEqual(before.sets);
    const copy = sets[2];
    expect(copy).toEqual({
      ...recP(),
      id: expect.stringMatching(/^set_[0-9a-f-]{36}$/),
      name: `${P_NAME} copy`,
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    // Its document is the original's as stored — the same img: ref, no new image.
    const docs = storedDocs();
    expect(Object.keys(docs).sort()).toEqual([A_ID, P_ID, copy.id].sort());
    expect(docs[copy.id]).toEqual(docP());
    expect(docs[copy.id].frames[1].screenshot).toBe(SHOT);
    expect(docs[P_ID]).toEqual(docP());
    expect(docs[A_ID]).toEqual(docA());

    // The list shows it (oldest, so last) and the board is about it.
    expect(byText("3 SETS").length).toBeGreaterThan(0);
    expect(cardRows()).toEqual(GOOGLE_READY);
    expect(await sizeOpens()).toEqual([
      `/editor?set=${copy.id}`,
      `/editor?set=${copy.id}`,
      `/editor?set=${copy.id}`,
    ]);
    expect(await exportTarget()).toBe(copy.id);
    expect(button(setRow(P_NAME), "Duplicate").disabled).toBe(false);
    expect(alerts()).toEqual([]);
  });

  it("a set with no stored document duplicates to a record with no document either", async () => {
    seed({ [P_ID]: docP() });
    await mount();
    await click(button(setRow(A_NAME), "Duplicate"));
    await until(() => byText(`${A_NAME} copy`).length > 0, "the copy's row");
    const copy = storedSets().find((x) => x.name === `${A_NAME} copy`)!;
    expect(copy).toBeTruthy();
    expect(copy.appId).toBe(APP.id);
    expect(storedDocs()).toEqual({ [P_ID]: docP() });
    await until(() => sizesHeader().startsWith("AURORA — APP STORE COPY · "), "the copy selected");
    expect(await exportTarget()).toBe(copy.id);
  });

  it("stores the open set's unsaved edit first, so the copy has it", async () => {
    seed();
    const { openSet } = await import("@/store/onstage");
    await openSet(P_ID);
    await mount();
    act(() => useOnstage.getState().patchFrame({ caption: "Edited in the editor" }));
    // Still waiting for the autosave.
    expect(storedDocs()[P_ID].frames[0].caption).toBe("Stargaze tonight");

    await click(button(setRow(P_NAME), "Duplicate"));
    await until(() => byText(`${P_NAME} copy`).length > 0, "the copy's row");
    const copy = storedSets().find((x) => x.name === `${P_NAME} copy`)!;
    const docs = storedDocs();
    expect(docs[copy.id].frames.map((f) => f.caption)).toEqual(["Edited in the editor", "", "Share the sky"]);
    expect(docs[copy.id]).toEqual(docs[P_ID]);
    expect(docs[copy.id].frames[1].screenshot).toBe(SHOT);
  });

  it("a refused write says why under the row and changes nothing", async () => {
    seed();
    await mount();
    await sizesRead("AURORA — APP STORE · APPLE 0 OF 3");
    const before = storageSnapshot();
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
    });

    await click(button(setRow(P_NAME), "Duplicate"));
    await until(() => alerts().length > 0, "the refusal line");
    expect(alerts().map((a) => a.textContent)).toEqual([
      "Couldn't duplicate the set — This browser's storage is full.",
    ]);
    // Under P's row.
    let rowBlock: HTMLElement | null = setRow(P_NAME);
    while (rowBlock && !rowBlock.querySelector('[role="alert"]')) rowBlock = rowBlock.parentElement;
    expect(rowBlock?.textContent).toContain(P_NAME);
    expect(rowBlock?.textContent).not.toContain(A_NAME);

    setItem.mockRestore();
    expect(storageSnapshot()).toEqual(before);
    expect(byText(`${P_NAME} copy`)).toEqual([]);
    expect(byText("2 SETS").length).toBeGreaterThan(0);
    // The selection didn't move, and the button is ready to try again.
    expect(sizesHeader()).toBe("AURORA — APP STORE · APPLE 0 OF 3");
    expect(button(setRow(P_NAME), "Duplicate").disabled).toBe(false);
  });

  it("a refused record write puts the documents back exactly", async () => {
    seed();
    await mount();
    const before = storageSnapshot();
    const real = Storage.prototype.setItem;
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
      this: Storage,
      key: string,
      value: string,
    ) {
      if (key === SETS_KEY) throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
      return real.call(this, key, value);
    });

    await click(button(setRow(P_NAME), "Duplicate"));
    await until(() => alerts().length > 0, "the refusal line");
    expect(alerts().map((a) => a.textContent)).toEqual([
      "Couldn't duplicate the set — This browser's storage is full.",
    ]);
    // The documents were written, then restored byte-for-byte.
    expect(setItem.mock.calls.some(([k]) => k === SET_DOCS_KEY)).toBe(true);
    setItem.mockRestore();
    expect(storageSnapshot()).toEqual(before);
  });
});

/* ── the open set, live ─────────────────────────────────────────────────── */

describe("ProjectScreen — the selected set open in the editor, with an unsaved edit", () => {
  it("Required sizes and Locales read the live document, not the stored copy", async () => {
    seed();
    // Saves "succeed" without storing, so storage keeps the old document.
    const save = vi.spyOn(localBackend, "saveSetDoc").mockResolvedValue(undefined);
    const { openSet } = await import("@/store/onstage");
    await openSet(A_ID);
    act(() => {
      const st = useOnstage.getState();
      st.setScreenshots(0, [SHOT]);
      st.select(1);
      st.patchFrame({ caption: "Now written" });
    });

    await mount();
    await sizesRead("AURORA — APP STORE · APPLE 3 OF 3");
    expect(cardRows()).toEqual([
      { store: "Apple", label: "iPhone 6.9″", px: "1320 × 2868", status: "Ready", thumbs: 1 },
      { store: "Apple", label: "iPhone 6.5″", px: "1242 × 2688", status: "Ready", thumbs: 1 },
      { store: "Apple", label: "iPad Pro 13″", px: "2064 × 2752", status: "Ready", thumbs: 1 },
    ]);
    await click(button(host, "Locales"));
    await until(() => localeRows().length > 0, "the Locales rows");
    expect(localeRows()).toEqual([
      { code: "EN", name: "English (US)", frames: "2 OF 2 FRAMES", state: "SOURCE", action: "Review" },
    ]);

    // The stored copy is still the old one: the board read the open set.
    expect(storedDocs()[A_ID]).toEqual(docA());
    expect(save.mock.calls.every(([id]) => id === A_ID)).toBe(true);
  });

  it("another selected set still reads its stored document", async () => {
    seed();
    vi.spyOn(localBackend, "saveSetDoc").mockResolvedValue(undefined);
    const { openSet } = await import("@/store/onstage");
    await openSet(A_ID);
    act(() => useOnstage.getState().setScreenshots(0, [SHOT]));
    await mount();
    await sizesRead("AURORA — APP STORE · APPLE 3 OF 3");
    await click(setRow(P_NAME));
    await sizesRead("AURORA — PLAY · GOOGLE 3 OF 3");
    expect(cardRows()).toEqual(GOOGLE_READY);
  });
});

describe("ProjectScreen — an edit the editor left waiting for its autosave", () => {
  it("is stored before the list is read, so order, status and the default selection are the set as saved", async () => {
    seed();
    const { openSet } = await import("@/store/onstage");
    // P is the older set; an edit gives every frame a screenshot — but the
    // autosave hasn't run yet (its 400 ms debounce is pending).
    await openSet(P_ID);
    act(() => useOnstage.getState().setScreenshots(0, [SHOT, SHOT, SHOT]));
    // Storage still holds the older copy: A is the newest record.
    expect(storedDocs()[P_ID]).toEqual(docP());

    await mount();
    // Saved now, P is the newest set: listed first and selected.
    await sizesRead("AURORA — PLAY · GOOGLE 3 OF 3");
    const rows = [...host.querySelectorAll("*")].filter((el) => el.textContent === P_NAME || el.textContent === A_NAME);
    expect(rows[0].textContent).toBe(P_NAME);
    expect(storedDocs()[P_ID].frames.every((f) => f.screenshot === SHOT)).toBe(true);
  });
});

/* ── flags (last: swaps in a fresh module graph) ─────────────────────────── */

describe("ProjectScreen — A/B variant cards and Push live", () => {
  async function mountFlagged(flags: { abTest: boolean; storeUpload: boolean }) {
    vi.resetModules();
    vi.doMock("@/lib/features", async (importOriginal) => {
      const real = await importOriginal<typeof import("@/lib/features")>();
      return { FEATURES: { ...real.FEATURES, ...flags } };
    });
    try {
      const { ProjectScreen: Flagged } = await import("../ProjectScreen");
      await mount(`app=${APP.id}`, Flagged);
      await until(() => byText("Variant B — screenshot first").length > 0, "the variant cards");
    } finally {
      vi.doUnmock("@/lib/features");
    }
  }

  /** A variant card's buttons, by the variant's name. */
  function variantButtons(name: string): string[] {
    let card: HTMLElement | null = byText(name)[0] ?? null;
    if (!card) throw new Error(`no variant ${name}`);
    // Up to the card: the element that also holds the note line.
    while (card && card.children.length < 3) card = card.parentElement;
    return [...card!.querySelectorAll("button")].map((b) => b.textContent ?? "");
  }

  it("with abTest on and storeUpload off, the cards render but no Push live", async () => {
    seed();
    await mountFlagged({ abTest: true, storeUpload: false });
    expect(byText("A/B variants").length).toBeGreaterThan(0);
    expect(byText("Variant A — headline first").length).toBeGreaterThan(0);
    expect(byText("Not yet published").length).toBeGreaterThan(0);
    expect(variantButtons("Variant A — headline first")).toEqual(["Duplicate"]);
    expect(variantButtons("Variant B — screenshot first")).toEqual([]);
    expect(buttonsLabelled(host, "Push live")).toEqual([]);
  });

  it("with abTest and storeUpload on, Push live renders on the ready variant", async () => {
    seed();
    await mountFlagged({ abTest: true, storeUpload: true });
    expect(variantButtons("Variant A — headline first")).toEqual(["Duplicate"]);
    expect(variantButtons("Variant B — screenshot first")).toEqual(["Push live"]);
    expect(buttonsLabelled(host, "Push live")).toHaveLength(1);
  });
});
