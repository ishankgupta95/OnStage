import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { doc, frame } from "@/lib/data/__tests__/helpers";
import { seedLibrary } from "@/lib/data/__tests__/library";
import * as sample from "@/lib/data/sample";
import type { SetDoc } from "@/lib/data/types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Plan S3.4: the export dialog's title is the name the zip, its folder and
 * the feature graphic carry — the set's own name for its app, else its app's
 * record name, else "Onstage export" — and it never borrows the sample's.
 */

const DOCS_KEY = "onstage:set-docs:v1";

type Store = typeof import("@/store/onstage");
type Local = typeof import("@/lib/data/local");

let root: Root;
let host: HTMLDivElement;
/** The module graph the current test opened, so its queued saves can be
 *  written before the next test's storage is cleared. */
let graph: Store | null = null;

beforeEach(() => {
  // Every test gets a fresh store and backend, as on a page load.
  vi.resetModules();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(async () => {
  act(() => root.unmount());
  host.remove();
  // A committed name queues a debounced autosave; write it now so it can't
  // land in the next test's library.
  if (graph) await graph.flushSaves();
  graph = null;
  vi.restoreAllMocks();
});

/** Let the backend reads resolve and the dialog re-render. */
async function settle() {
  for (let i = 0; i < 4; i++) await act(() => new Promise((r) => setTimeout(r, 5)));
}

/**
 * The editor on `setId` with its export dialog open: the documents in `docs`
 * stored, the set opened the way the editor opens it (openSet), then the
 * dialog mounted from the same module graph. `before` runs once the backend
 * is loaded and before anything reads it.
 */
async function openDialog(
  setId: string,
  { docs = {}, before }: { docs?: Record<string, SetDoc>; before?: (local: Local) => void } = {},
) {
  localStorage.setItem(DOCS_KEY, JSON.stringify(docs));
  const store = await import("@/store/onstage");
  const local = await import("@/lib/data/local");
  const { ExportOverlay } = await import("../ExportOverlay");
  graph = store;
  before?.(local);
  await store.openSet(setId);
  act(() =>
    store.useOnstage.setState({
      overlay: "export",
      // iPhone 6.9″ + Google phone + the feature graphic, English only.
      exportPicks: [0, 3, 5],
      exportLangs: ["EN"],
      exportDest: "zip",
    }),
  );
  await act(async () => root.render(<ExportOverlay />));
  await settle();
  return store;
}

const text = () => host.textContent ?? "";

/** Elements whose whole text is exactly `t`. */
const byText = (t: string) =>
  [...host.querySelectorAll<HTMLElement>("*")].filter((el) => el.textContent === t);

function nameInput(): HTMLInputElement {
  const el = host.querySelector<HTMLInputElement>('input[aria-label="App name"]');
  if (!el) throw new Error('no "App name" input');
  return el;
}

/** The folder tree under YOU'LL GET (heading → count row → tree box). */
function treeLines(): string[] {
  const heading = byText("YOU'LL GET")[0];
  const box = heading?.nextElementSibling?.nextElementSibling;
  if (!box) throw new Error("no export tree");
  return [...box.children].map((l) => l.textContent ?? "");
}

/** Focus the name and type `value` over it, as a person would. */
async function type(value: string) {
  const input = nameInput();
  await act(async () => {
    input.focus();
    // React tracks the value it last rendered; the native setter bypasses
    // that so the input event is seen as a change.
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function press(key: string) {
  await act(async () => {
    nameInput().dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
  });
}

async function blur() {
  await act(async () => nameInput().blur());
}

const storedDocs = (): Record<string, SetDoc> => JSON.parse(localStorage.getItem(DOCS_KEY) ?? "{}");

const ferrySet = sample.SETS.find((s) => s.id === "ferry-69")!;

describe("ExportOverlay — the app name in the title (S3.4)", () => {
  it("the sample set is titled Trailhead once its app record loads, and the zip folder follows", async () => {
    seedLibrary();
    const { useOnstage } = await openDialog("trailhead-69");
    await vi.waitFor(() => expect(nameInput().value).toBe("Trailhead"));
    expect(text()).toContain("Export");
    expect(treeLines()[0]).toBe("trailhead-store-assets/");
    // The app's name is shown, not stored as the set's own.
    expect(useOnstage.getState().appName).toBeUndefined();
  });

  it("a set in the app Ferry is titled Ferry, with ferry-store-assets/", async () => {
    seedLibrary();
    const { useOnstage } = await openDialog("ferry-69");
    await vi.waitFor(() => expect(nameInput().value).toBe("Ferry"));
    expect(treeLines()[0]).toBe("ferry-store-assets/");
    expect(useOnstage.getState().appName).toBeUndefined();
  });

  it("a set whose document names its app is titled with that name, over its app's", async () => {
    seedLibrary();
    const { useOnstage } = await openDialog("ferry-69", {
      docs: { "ferry-69": doc([frame(), frame()], { appName: "Ferry Pro" }) },
    });
    // Wait for the app record itself (the placeholder a cleared name falls
    // back to), so the set's own name is seen winning after it loads.
    await vi.waitFor(() => expect(nameInput().placeholder).toBe("Ferry"));
    expect(nameInput().value).toBe("Ferry Pro");
    expect(treeLines()[0]).toBe("ferry-pro-store-assets/");
    expect(useOnstage.getState().appName).toBe("Ferry Pro");
  });

  it("a set whose app was deleted is titled Onstage export, with onstage-export-store-assets/", async () => {
    seedLibrary({
      apps: sample.APPS.filter((a) => a.id !== "ferry").map((a) => ({ ...a })),
    });
    await openDialog("ferry-69");
    await settle();
    expect(nameInput().value).toBe("Onstage export");
    expect(treeLines()[0]).toBe("onstage-export-store-assets/");
    expect(text()).not.toContain("Trailhead");
    expect(nameInput().value).not.toContain("Trailhead");
  });

  it("a set with no library record is titled Onstage export, with onstage-export-store-assets/", async () => {
    seedLibrary();
    await openDialog("not-in-the-library", { docs: { "not-in-the-library": doc([frame()]) } });
    await settle();
    expect(nameInput().value).toBe("Onstage export");
    expect(treeLines()[0]).toBe("onstage-export-store-assets/");
    expect(nameInput().value).not.toContain("Trailhead");
  });

  it("a library that can't be read titles the dialog Onstage export, not an error", async () => {
    seedLibrary();
    await openDialog("ferry-69", {
      before: (local) => vi.spyOn(local.localBackend, "listApps").mockRejectedValue(new Error("storage refused")),
    });
    await settle();
    expect(nameInput().value).toBe("Onstage export");
    expect(treeLines()[0]).toBe("onstage-export-store-assets/");
    expect(text()).not.toContain("storage refused");
  });

  it("nothing in the dialog names Trailhead for a Ferry set", async () => {
    seedLibrary();
    const { useOnstage } = await openDialog("ferry-69");
    await vi.waitFor(() => expect(nameInput().value).toBe("Ferry"));
    const clean = () => {
      expect(text()).not.toMatch(/trailhead/i);
      expect(nameInput().value).not.toMatch(/trailhead/i);
      expect(nameInput().placeholder).not.toMatch(/trailhead/i);
    };
    clean();
    // Every size (the feature graphic included) and every locale on offer.
    act(() => useOnstage.setState({ exportPicks: [0, 1, 2, 3, 4, 5], exportLangs: ["EN", "DE", "JA", "ES"] }));
    clean();
    expect(treeLines()[0]).toBe("ferry-store-assets/");
  });

  it("switching from the sample set to a Ferry set drops Trailhead from the open dialog", async () => {
    seedLibrary();
    const store = await openDialog("trailhead-69");
    await vi.waitFor(() => expect(nameInput().value).toBe("Trailhead"));

    await act(() => store.openSet("ferry-69"));
    await vi.waitFor(() => expect(nameInput().value).toBe("Ferry"));
    expect(treeLines()[0]).toBe("ferry-store-assets/");
    expect(text()).not.toMatch(/trailhead/i);
    expect(nameInput().placeholder).not.toMatch(/trailhead/i);
  });

  it("switching from a set with its own name to one without drops that name", async () => {
    seedLibrary();
    const store = await openDialog("trailhead-69", {
      docs: { "trailhead-69": doc([frame()], { appName: "Summit Maps" }) },
    });
    expect(nameInput().value).toBe("Summit Maps");

    await act(() => store.openSet("ferry-69"));
    await vi.waitFor(() => expect(nameInput().value).toBe("Ferry"));
    expect(store.useOnstage.getState().appName).toBeUndefined();
    expect(text()).not.toContain("summit-maps");
  });

  it("typing a new name and pressing Enter commits it, and the zip folder follows", async () => {
    seedLibrary();
    const { useOnstage, flushSaves } = await openDialog("trailhead-69");
    await vi.waitFor(() => expect(nameInput().value).toBe("Trailhead"));

    await type("  Summit Maps  ");
    // A draft is only a draft: nothing is stored and the folder is unchanged.
    expect(nameInput().value).toBe("  Summit Maps  ");
    expect(useOnstage.getState().appName).toBeUndefined();
    expect(treeLines()[0]).toBe("trailhead-store-assets/");

    await press("Enter");
    expect(useOnstage.getState().appName).toBe("Summit Maps");
    expect(nameInput().value).toBe("Summit Maps");
    expect(treeLines()[0]).toBe("summit-maps-store-assets/");
    expect(document.activeElement).not.toBe(nameInput());

    // It is the set's document's now, saved with it.
    await flushSaves();
    expect(storedDocs()["trailhead-69"]?.appName).toBe("Summit Maps");
  });

  it("leaving the field commits the name too", async () => {
    seedLibrary();
    const { useOnstage } = await openDialog("ferry-69");
    await vi.waitFor(() => expect(nameInput().value).toBe("Ferry"));

    await type("Ferry Deluxe");
    await blur();
    expect(useOnstage.getState().appName).toBe("Ferry Deluxe");
    expect(nameInput().value).toBe("Ferry Deluxe");
    expect(treeLines()[0]).toBe("ferry-deluxe-store-assets/");
  });

  it("Escape drops the draft: the store is unchanged and the old name is back", async () => {
    seedLibrary();
    const { useOnstage } = await openDialog("trailhead-69");
    await vi.waitFor(() => expect(nameInput().value).toBe("Trailhead"));

    await type("Not this one");
    await press("Escape");
    expect(nameInput().value).toBe("Trailhead");
    expect(useOnstage.getState().appName).toBeUndefined();
    expect(treeLines()[0]).toBe("trailhead-store-assets/");

    // …and the blur that follows has nothing to commit.
    await blur();
    expect(useOnstage.getState().appName).toBeUndefined();
    expect(nameInput().value).toBe("Trailhead");
  });

  it("Escape keeps a set's own name when a new one was being typed over it", async () => {
    seedLibrary();
    const { useOnstage } = await openDialog("ferry-69", {
      docs: { "ferry-69": doc([frame()], { appName: "Ferry Pro" }) },
    });
    await type("Something else");
    await press("Escape");
    await blur();
    expect(nameInput().value).toBe("Ferry Pro");
    expect(useOnstage.getState().appName).toBe("Ferry Pro");
    expect(treeLines()[0]).toBe("ferry-pro-store-assets/");
  });

  it("clearing a set's own name returns it to its app's name", async () => {
    seedLibrary();
    const { useOnstage } = await openDialog("ferry-69", {
      docs: { "ferry-69": doc([frame()], { appName: "Ferry Pro" }) },
    });
    await vi.waitFor(() => expect(nameInput().placeholder).toBe("Ferry"));
    expect(nameInput().value).toBe("Ferry Pro");

    await type("");
    // While empty, the field hints at what an empty name means.
    expect(nameInput().value).toBe("");
    expect(nameInput().placeholder).toBe("Ferry");

    await press("Enter");
    expect(useOnstage.getState().appName).toBeUndefined();
    expect(nameInput().value).toBe("Ferry");
    expect(treeLines()[0]).toBe("ferry-store-assets/");
  });

  it("a name of only spaces is no name: the set goes back to its app's", async () => {
    seedLibrary();
    const { useOnstage } = await openDialog("ferry-69", {
      docs: { "ferry-69": doc([frame()], { appName: "Ferry Pro" }) },
    });
    await vi.waitFor(() => expect(nameInput().placeholder).toBe("Ferry"));

    await type("   ");
    await blur();
    expect(useOnstage.getState().appName).toBeUndefined();
    expect(nameInput().value).toBe("Ferry");
    expect(treeLines()[0]).toBe("ferry-store-assets/");
  });

  it("retyping the app's own name leaves the set without a name of its own", async () => {
    seedLibrary();
    const { useOnstage, flushSaves } = await openDialog("ferry-69");
    await vi.waitFor(() => expect(nameInput().value).toBe("Ferry"));

    // Exactly the app's name, and the same name with spaces round it.
    for (const typed of ["Ferry", "  Ferry "]) {
      await type(typed);
      await press("Enter");
      expect(useOnstage.getState().appName).toBeUndefined();
      expect(nameInput().value).toBe("Ferry");
      expect(treeLines()[0]).toBe("ferry-store-assets/");
    }

    // Not an edit, so the set's document was never written with a name —
    // renaming the app later still renames this set's exports.
    await flushSaves();
    expect(storedDocs()["ferry-69"]?.appName).toBeUndefined();
  });

  it("a set with no app record keeps the name typed for it", async () => {
    seedLibrary();
    const { useOnstage } = await openDialog("not-in-the-library", {
      docs: { "not-in-the-library": doc([frame()]) },
    });
    await settle();
    expect(nameInput().value).toBe("Onstage export");

    await type("Harbor");
    await press("Enter");
    expect(useOnstage.getState().appName).toBe("Harbor");
    expect(nameInput().value).toBe("Harbor");
    expect(treeLines()[0]).toBe("harbor-store-assets/");
  });

  it("retyping 'Onstage export' on a set nothing names leaves it unnamed", async () => {
    seedLibrary();
    const { useOnstage } = await openDialog("not-in-the-library", {
      docs: { "not-in-the-library": doc([frame()]) },
    });
    await settle();
    expect(nameInput().value).toBe("Onstage export");

    await type("Onstage expor");
    await type("Onstage export ");
    await press("Enter");
    // Not a name anyone chose: the feature graphic still prints none.
    expect(useOnstage.getState().appName).toBeUndefined();
    expect(nameInput().value).toBe("Onstage export");
  });

  it("the Ferry set's record is the one these tests read", () => {
    // Guards the fixtures above: ferry-69 belongs to the app named Ferry.
    expect(ferrySet.appId).toBe("ferry");
    expect(sample.APPS.find((a) => a.id === ferrySet.appId)?.name).toBe("Ferry");
  });
});
