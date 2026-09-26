import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { seedLibrary, storageSnapshot } from "@/lib/data/__tests__/library";

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

let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  // A returning user's library: the sample apps and sets as stored records.
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

/** A fresh store and editor, as on a page load of /editor?<query>. */
async function renderEditor(query: string) {
  nav.params = new URLSearchParams(query);
  const { EditorScreen } = await import("../EditorScreen");
  const store = await import("@/store/onstage");
  await act(async () => root.render(<EditorScreen />));
  await settle();
  return store;
}

const buttons = () => [...host.querySelectorAll("button")].map((b) => b.getAttribute("aria-label") ?? b.textContent);

describe("EditorScreen — routed by ?set=", () => {
  it("an id this browser doesn't have shows the in-page not-found state and saves nothing", async () => {
    const before = storageSnapshot();
    const { useOnstage } = await renderEditor("set=does-not-exist");

    expect(host.querySelector("h1")?.textContent).toBe("This set isn't in this browser");
    const hrefs = [...host.querySelectorAll("a")].map((a) => a.getAttribute("href") ?? "");
    expect(hrefs.some((h) => h.endsWith("/dashboard"))).toBe(true);

    // No canvas, no top-bar controls, no tool rail.
    for (const label of ["Export", "Store preview", "Zoom in", "Zoom out", "Templates", "Brand kit", "App Store", "Guided", "Canvas"]) {
      expect(buttons()).not.toContain(label);
    }
    expect(useOnstage.getState().loadedSetId).toBeNull();

    // Well past the autosave debounce, nothing has been written anywhere:
    // storage is exactly as it was before the editor mounted.
    await settle(1000);
    expect(storageSnapshot()).toEqual(before);
    expect(nav.router.replace).not.toHaveBeenCalled();
  });

  it("a listed set's top bar shows its name from the library record", async () => {
    const { useOnstage } = await renderEditor("set=trailhead-69");

    expect(useOnstage.getState().loadedSetId).toBe("trailhead-69");
    expect(host.textContent).toContain("Trailhead — 6.9″ set");
    expect(host.textContent).not.toContain("This set isn't in this browser");
    expect(buttons()).toContain("Export");
  });
});
