import { StrictMode, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { seedLibrary } from "@/lib/data/__tests__/library";

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
  usePathname: () => "/editor",
  useSearchParams: () => nav.params,
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Flags = Partial<typeof import("@/lib/features").FEATURES>;
type Store = typeof import("@/store/onstage");
type Editor = typeof import("../EditorScreen").EditorScreen;

let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  // A returning user's library: the sample apps and sets as stored records.
  seedLibrary();
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  // Every test gets a fresh module graph, so a fresh store and backend.
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

/**
 * The editor and its store from one fresh module graph — with `flags` on
 * when given — so the store the test drives is the one the editor reads.
 */
async function load(flags?: Flags): Promise<{ EditorScreen: Editor; store: Store }> {
  if (flags) {
    vi.doMock("@/lib/features", async (importOriginal) => {
      const real = await importOriginal<typeof import("@/lib/features")>();
      return { FEATURES: { ...real.FEATURES, ...flags } };
    });
  }
  try {
    const { EditorScreen } = await import("../EditorScreen");
    const store = await import("@/store/onstage");
    return { EditorScreen, store };
  } finally {
    if (flags) vi.doUnmock("@/lib/features");
  }
}

/** A page load of /editor?<query>, waited on until the set has loaded. */
async function renderEditor(query: string, flags?: Flags) {
  nav.params = new URLSearchParams(query);
  const { EditorScreen, store } = await load(flags);
  await act(async () => root.render(<EditorScreen />));
  await settle();
  expect(store.useOnstage.getState().loadedSetId).toBe("trailhead-69");
  return { EditorScreen, ...store };
}

const allButtons = () => [...host.querySelectorAll("button")];
const byLabel = (label: string) => host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
const byText = (text: string) => allButtons().find((b) => b.textContent?.trim() === text) ?? null;

/** The tool rail's buttons, in order, by their accessible names. */
function railLabels(): (string | null)[] {
  const first = byLabel("Templates");
  expect(first).not.toBeNull();
  return [...first!.parentElement!.querySelectorAll("button")].map((b) => b.getAttribute("aria-label"));
}

async function click(el: Element | null) {
  expect(el).not.toBeNull();
  await act(async () => (el as HTMLElement).click());
  await settle();
}

const DRAWER_TITLE = "Captions & languages";
/** The export dialog's title field: the app name its zip is named after. */
const appNameField = () => host.querySelector<HTMLInputElement>('input[aria-label="App name"]');

describe("EditorScreen — AI assist off (the default)", () => {
  it("the tool rail has Templates, Screens, Text, Background and Brand kit, and no AI captions", async () => {
    await renderEditor("set=trailhead-69");

    expect(railLabels()).toEqual(["Templates", "Screens", "Text", "Background", "Brand kit"]);
    expect(byLabel("AI captions")).toBeNull();
  });

  it("a selected caption's context bar keeps its font and align controls but has no Rewrite with AI", async () => {
    const { useOnstage } = await renderEditor("set=trailhead-69");

    await click(byLabel("Text"));
    expect(useOnstage.getState().sel).toBe("caption");

    // The font picker (named by the current font) and the three alignments.
    expect(byText(useOnstage.getState().captionFont)).not.toBeNull();
    for (const a of ["left", "center", "right"]) expect(byLabel(`Align ${a}`)).not.toBeNull();
    expect(byText("Rewrite with AI")).toBeNull();
    expect(host.textContent).not.toContain("Rewrite with AI");
  });

  it("a caption selected through the store shows no Rewrite with AI either", async () => {
    const { useOnstage } = await renderEditor("set=trailhead-69");

    await act(async () => useOnstage.getState().select(0, "caption"));
    await settle();

    expect(byLabel("Align center")).not.toBeNull();
    expect(host.textContent).not.toContain("Rewrite with AI");
  });

  it("the filmstrip shows the language chips but no Add a language button", async () => {
    await renderEditor("set=trailhead-69");

    expect(host.textContent).toContain("LANGUAGE");
    for (const l of ["EN", "DE", "JA", "ES"]) expect(byText(l)).not.toBeNull();
    expect(byLabel("Add a language")).toBeNull();
  });

  it("forcing the AI overlay open renders no drawer", async () => {
    const { useOnstage } = await renderEditor("set=trailhead-69");

    await act(async () => useOnstage.setState({ overlay: "ai" }));
    await settle();

    expect(host.textContent).not.toContain(DRAWER_TITLE);
    expect(host.textContent).not.toContain("SUGGESTIONS");
    expect(host.textContent).not.toContain("Portuguese (BR)");
  });

  it("?apply=panel:localize opens nothing, and the URL drops the intent", async () => {
    const { useOnstage } = await renderEditor("set=trailhead-69&apply=panel:localize");

    expect(useOnstage.getState().overlay).toBeNull();
    expect(host.textContent).not.toContain(DRAWER_TITLE);
    expect(nav.router.replace).toHaveBeenCalledWith("/editor?set=trailhead-69");
  });

  it("?apply=panel:export still opens the export dialog, offering the zip", async () => {
    const { useOnstage } = await renderEditor("set=trailhead-69&apply=panel:export");

    expect(useOnstage.getState().overlay).toBe("export");
    expect(appNameField()?.value).toBe("Trailhead");
    expect(host.textContent).toContain("DESTINATION");
    expect(host.textContent).toContain("YOU'LL GET");
    expect(host.textContent).toContain("Download a zip");
    expect(nav.router.replace).toHaveBeenCalledWith("/editor?set=trailhead-69");
  });
});

describe("EditorScreen — leaving closes a finished dialog (GAP-16)", () => {
  it("under StrictMode (next dev) a run that finished while the person was away still shows on return, like the static build", async () => {
    const { EditorScreen, useOnstage } = await renderEditor("set=trailhead-69");
    await act(async () =>
      useOnstage.setState({ overlay: "export", exportState: "rendering", exportDone: 3, exportTotal: 10 }),
    );
    // The person leaves while it renders; the run finishes in the background.
    await act(async () => root.render(null));
    await settle();
    await act(async () => useOnstage.setState({ exportState: "done", exportDeliveredTo: "zip" }));

    // Back, with React's development double mount.
    await act(async () =>
      root.render(
        <StrictMode>
          <EditorScreen />
        </StrictMode>,
      ),
    );
    await settle();
    expect(useOnstage.getState().overlay).toBe("export");
    expect(host.textContent).toContain("Zip saved to Downloads");

    // Leaving again closes it.
    await act(async () => root.render(null));
    await settle();
    expect(useOnstage.getState()).toMatchObject({ overlay: null, exportState: null });
  });

  it("unmounting after a finished export closes the dialog, and coming back to the set doesn't reopen it", async () => {
    const { EditorScreen, useOnstage } = await renderEditor("set=trailhead-69");

    await act(async () => useOnstage.setState({ overlay: "export", exportState: "done", exportDeliveredTo: "zip" }));
    await settle();
    expect(appNameField()?.value).toBe("Trailhead");
    expect(host.textContent).toContain("Zip saved to Downloads");

    // The person goes to another page.
    await act(async () => root.render(null));
    await settle();
    const left = useOnstage.getState();
    expect(left.overlay).toBeNull();
    expect(left.exportState).toBeNull();
    expect(left.exportDeliveredTo).toBeNull();

    // And comes back to the same set, which is still loaded (no reload).
    await act(async () => root.render(<EditorScreen />));
    await settle();
    expect(useOnstage.getState().loadedSetId).toBe("trailhead-69");
    expect(useOnstage.getState().overlay).toBeNull();
    expect(appNameField()).toBeNull();
    expect(host.textContent).not.toContain("DESTINATION");
    expect(byText("Export")).not.toBeNull();
  });

  it("unmounting while an export is rendering keeps the dialog and its progress", async () => {
    const { EditorScreen, useOnstage } = await renderEditor("set=trailhead-69");

    await act(async () =>
      useOnstage.setState({ overlay: "export", exportState: "rendering", exportDone: 3, exportTotal: 10 }),
    );
    await settle();
    expect(host.textContent).toContain("Rendering 3 of 10…");

    await act(async () => root.render(null));
    await settle();
    expect(useOnstage.getState().overlay).toBe("export");
    expect(useOnstage.getState().exportState).toBe("rendering");

    // On the way back the run's progress is still there.
    await act(async () => root.render(<EditorScreen />));
    await settle();
    expect(appNameField()?.value).toBe("Trailhead");
    expect(host.textContent).toContain("Rendering 3 of 10…");
  });
});

// A fresh module graph with the flag on, proving the selectors above would
// have found these controls had they mounted.
describe("EditorScreen — AI assist on", () => {
  const ON: Flags = { aiAssist: true };

  it("the tool rail has AI captions, and it opens the drawer", async () => {
    const { useOnstage } = await renderEditor("set=trailhead-69", ON);

    expect(railLabels()).toEqual(["Templates", "Screens", "Text", "Background", "AI captions", "Brand kit"]);
    expect(host.textContent).not.toContain(DRAWER_TITLE);

    await click(byLabel("AI captions"));
    expect(useOnstage.getState().overlay).toBe("ai");
    expect(host.textContent).toContain(DRAWER_TITLE);
  });

  it("Rewrite with AI opens the drawer on the Captions tab, even after Localize was last open", async () => {
    const { useOnstage } = await renderEditor("set=trailhead-69", ON);
    await act(async () => useOnstage.setState({ aiTab: "Localize" }));

    await click(byLabel("Text"));
    const rewrite = byText("Rewrite with AI");
    expect(rewrite).not.toBeNull();

    await click(rewrite);
    expect(useOnstage.getState().overlay).toBe("ai");
    expect(useOnstage.getState().aiTab).toBe("Captions");
    expect(host.textContent).toContain(DRAWER_TITLE);
    expect(host.textContent).toContain("FRAME 01 HEADLINE");
    expect(host.textContent).toContain("SUGGESTIONS");
    expect(host.textContent).not.toContain("Portuguese (BR)");
  });

  it("the filmstrip's Add a language opens the drawer on Localize", async () => {
    const { useOnstage } = await renderEditor("set=trailhead-69", ON);
    expect(useOnstage.getState().aiTab).toBe("Captions");

    await click(byLabel("Add a language"));
    expect(useOnstage.getState().overlay).toBe("ai");
    expect(useOnstage.getState().aiTab).toBe("Localize");
    expect(host.textContent).toContain(DRAWER_TITLE);
    expect(host.textContent).toContain("Portuguese (BR)");
  });

  it("?apply=panel:localize opens the drawer on Localize, and the URL drops the intent", async () => {
    const { useOnstage } = await renderEditor("set=trailhead-69&apply=panel:localize", ON);

    expect(useOnstage.getState().overlay).toBe("ai");
    expect(useOnstage.getState().aiTab).toBe("Localize");
    expect(host.textContent).toContain(DRAWER_TITLE);
    expect(host.textContent).toContain("Portuguese (BR)");
    expect(nav.router.replace).toHaveBeenCalledWith("/editor?set=trailhead-69");
  });
});

// S3.3: the top bar's App Store / Play Store toggle aims the set at a store —
// the export dialog's sizes and the store preview follow it (GAP-5/GAP-7) —
// and only locales the set has captions in are offered (EDITOR-6 interim).
describe("EditorScreen — the set's store and its captions drive the export (S3.3)", () => {
  const SET_DOCS_KEY = "onstage:set-docs:v1";
  const SIZE_ROWS = [
    "Apple — iPhone 6.9″",
    "Apple — iPhone 6.5″",
    "Apple — iPad Pro 13″",
    "Google — Phone",
    "Google — Tablet 7″",
    "Google — Feature graphic",
  ];
  const SAMPLE_LOCALES = ["EN", "DE", "JA", "ES"];

  /** An export-dialog size row, found by its label. */
  function sizeRow(label: string): HTMLElement {
    const name = [...host.querySelectorAll("div")].find(
      (d) => d.childElementCount === 0 && d.textContent === label,
    );
    expect(name, `size row "${label}"`).toBeDefined();
    // label → its text column → the row
    return name!.parentElement!.parentElement!;
  }

  /** The row's file-count cell: "N files" when picked, "—" when not. */
  const filesCell = (label: string) => sizeRow(label).lastElementChild!.textContent;

  /** The labels of the rows whose file-count cell says they're picked. */
  const pickedRows = () => SIZE_ROWS.filter((l) => filesCell(l) !== "—");

  /** The chip buttons under a small caps heading (LOCALES, LANGUAGE). */
  function chipsUnder(heading: string): string[] {
    const label = [...host.querySelectorAll("div, span")].find(
      (el) => el.childElementCount === 0 && el.textContent === heading,
    );
    expect(label, `heading ${heading}`).toBeDefined();
    const chips = label!.nextElementSibling;
    expect(chips).not.toBeNull();
    return [...chips!.querySelectorAll("button")].map((b) => b.textContent?.trim() ?? "");
  }

  const exportLocaleChips = () => chipsUnder("LOCALES");
  const filmstripLanguageChips = () => chipsUnder("LANGUAGE");

  async function openExport() {
    await click(byText("Export"));
    expect(appNameField()?.value).toBe("Trailhead");
  }

  async function closeOverlay() {
    const close = host.querySelector<HTMLButtonElement>('button[aria-label="Close"]');
    await click(close);
  }

  /** Type into the inspector's HEADLINE box, as a person would. */
  async function typeHeadline(text: string) {
    const box = host.querySelector("textarea");
    expect(box).not.toBeNull();
    const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
    await act(async () => {
      setValue.call(box, text);
      box!.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await settle();
  }

  it("a new visit's export dialog picks the App Store's two iPhone sizes, in English", async () => {
    const { useOnstage } = await renderEditor("set=trailhead-69&apply=panel:export");

    expect(useOnstage.getState().store).toBe("apple");
    expect(pickedRows()).toEqual(["Apple — iPhone 6.9″", "Apple — iPhone 6.5″"]);
    expect(filesCell("Apple — iPhone 6.9″")).toBe("5 files");
    expect(filesCell("Apple — iPhone 6.5″")).toBe("5 files");
    expect(host.textContent).toContain("5 FRAMES · 1 LOCALE");
    expect(byText("Render 10 files")).not.toBeNull();
  });

  it("clicking Play Store picks Google — Phone and Feature graphic, and none of the iPhone rows", async () => {
    const { useOnstage } = await renderEditor("set=trailhead-69");

    await click(byText("Play Store"));
    expect(useOnstage.getState().store).toBe("play");

    await openExport();
    expect(pickedRows()).toEqual(["Google — Phone", "Google — Feature graphic"]);
    expect(filesCell("Google — Phone")).toBe("5 files");
    expect(filesCell("Google — Feature graphic")).toBe("1 file");
    for (const l of ["Apple — iPhone 6.9″", "Apple — iPhone 6.5″", "Apple — iPad Pro 13″", "Google — Tablet 7″"]) {
      expect(filesCell(l)).toBe("—");
    }
    expect(byText("Render 6 files")).not.toBeNull();
    expect(host.textContent).toContain("feature-graphic-1024x500.png");
    expect(host.textContent).not.toContain("APP_IPHONE_69/");
  });

  it("the store preview follows the toggle: Google Play for Play, the App Store again on the way back", async () => {
    const { useOnstage } = await renderEditor("set=trailhead-69");

    await click(byText("Store preview"));
    expect(host.textContent).toContain("As the App Store shows it");
    expect(host.textContent).toContain("IPHONE · SEARCH RESULT");
    await closeOverlay();

    await click(byText("Play Store"));
    await click(byText("Store preview"));
    expect(useOnstage.getState().overlay).toBe("store");
    expect(host.textContent).toContain("As Google Play shows it");
    expect(host.textContent).toContain("PHONE · SEARCH RESULT");
    expect(host.textContent).not.toContain("As the App Store shows it");
    expect(host.textContent).not.toContain("IPHONE · SEARCH RESULT");
    await closeOverlay();

    await click(byText("App Store"));
    expect(useOnstage.getState().store).toBe("apple");
    await click(byText("Store preview"));
    expect(host.textContent).toContain("As the App Store shows it");
    expect(host.textContent).toContain("IPHONE · SEARCH RESULT");
    expect(host.textContent).not.toContain("As Google Play shows it");
  });

  it("back to App Store restores the iPhone picks, replacing a Tablet 7″ picked for Play", async () => {
    const { useOnstage } = await renderEditor("set=trailhead-69");

    await click(byText("Play Store"));
    await openExport();
    await click(sizeRow("Google — Tablet 7″"));
    expect(pickedRows()).toEqual(["Google — Phone", "Google — Tablet 7″", "Google — Feature graphic"]);
    await closeOverlay();

    await click(byText("App Store"));
    expect(useOnstage.getState()).toMatchObject({ store: "apple", exportPicks: [0, 1] });
    await openExport();
    expect(pickedRows()).toEqual(["Apple — iPhone 6.9″", "Apple — iPhone 6.5″"]);
  });

  it("the toggle is not an undo step, and it is saved with the set", async () => {
    const { useOnstage } = await renderEditor("set=trailhead-69");
    expect(useOnstage.temporal.getState().pastStates.length).toBe(0);

    await click(byText("Play Store"));
    expect(useOnstage.temporal.getState().pastStates.length).toBe(0);

    await settle(400);
    const docs = JSON.parse(localStorage.getItem(SET_DOCS_KEY) ?? "{}");
    expect(docs["trailhead-69"]?.store).toBe("play");
  });

  it("a set saved as a Play set opens its export dialog on Play's sizes", async () => {
    const { defaultDoc } = await import("@/lib/onstage/docOps");
    localStorage.setItem(SET_DOCS_KEY, JSON.stringify({ "trailhead-69": { ...defaultDoc(), store: "play" } }));
    const { useOnstage } = await renderEditor("set=trailhead-69&apply=panel:export");

    expect(useOnstage.getState().store).toBe("play");
    expect(pickedRows()).toEqual(["Google — Phone", "Google — Feature graphic"]);
  });

  it("the dialog's LOCALES are EN, DE, JA, ES for the untouched sample, and EN alone once a caption is edited", async () => {
    const { useOnstage } = await renderEditor("set=trailhead-69&apply=panel:export");
    expect(exportLocaleChips()).toEqual(SAMPLE_LOCALES);

    await act(async () => {
      useOnstage.getState().select(1, "caption");
      useOnstage.getState().typeCaption("Pace, sorted");
    });
    await settle();

    expect(useOnstage.getState().frames[1].caption).toBe("Pace, sorted");
    expect(exportLocaleChips()).toEqual(["EN"]);
    expect(host.textContent).toContain("5 FRAMES · 1 LOCALE");
  });

  it("DE picked on the sample counts, then drops out of the dialog's count once a caption is edited", async () => {
    const { useOnstage } = await renderEditor("set=trailhead-69&apply=panel:export");

    const de = [...host.querySelectorAll("button")].filter((b) => b.textContent?.trim() === "DE");
    // The filmstrip's chip comes first in the page; the dialog's is last.
    await click(de[de.length - 1]);
    expect(useOnstage.getState().exportLangs).toEqual(["EN", "DE"]);
    expect(host.textContent).toContain("5 FRAMES · 2 LOCALES");
    expect(byText("Render 20 files")).not.toBeNull();
    expect(filesCell("Apple — iPhone 6.9″")).toBe("10 files");

    await act(async () => {
      useOnstage.getState().select(0, "caption");
      useOnstage.getState().typeCaption("Every run, charted");
    });
    await settle();

    expect(exportLocaleChips()).toEqual(["EN"]);
    expect(host.textContent).toContain("5 FRAMES · 1 LOCALE");
    expect(byText("Render 10 files")).not.toBeNull();
    expect(filesCell("Apple — iPhone 6.9″")).toBe("5 files");
    expect(host.textContent).not.toContain("de-DE/");
  });

  it("the filmstrip's LANGUAGE chips follow the same rule, typed through the inspector", async () => {
    const { useOnstage } = await renderEditor("set=trailhead-69");
    expect(filmstripLanguageChips()).toEqual(SAMPLE_LOCALES);

    await click(byLabel("Text"));
    expect(useOnstage.getState().sel).toBe("caption");
    await typeHeadline("Every run, on the map");

    expect(useOnstage.getState().frames[0].caption).toBe("Every run, on the map");
    expect(filmstripLanguageChips()).toEqual(["EN"]);

    // Undo brings the sample's own caption back, and its languages with it.
    await act(async () => useOnstage.getState().undo());
    await settle();
    expect(useOnstage.getState().frames[0].caption).toBe("Every run, mapped");
    expect(filmstripLanguageChips()).toEqual(SAMPLE_LOCALES);
  });
});
