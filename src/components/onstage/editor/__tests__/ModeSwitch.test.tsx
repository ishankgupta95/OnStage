import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { seedLibrary, storageSnapshot } from "@/lib/data/__tests__/library";

/**
 * Plan S3.2: the Guided ⇄ Canvas switch in the editor's and guided flow's top
 * bars is the work-mode preference too (Settings says so), and guided's
 * "Skip the steps — open the canvas" chooses the canvas. Each goes to the set
 * in the page's URL whether or not it has loaded, and a preference the
 * browser refuses to store never stops the switch.
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
  usePathname: () => "/editor",
  useSearchParams: () => nav.params,
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const PREFS_KEY = "onstage:prefs:v1";
const SET = "trailhead-69";

type Store = typeof import("@/store/onstage");

let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  // Every test gets a fresh module graph, so a fresh store and backend.
  vi.resetModules();
  nav.params = new URLSearchParams();
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

const storedPrefs = (): unknown => JSON.parse(localStorage.getItem(PREFS_KEY) ?? "null");
const pushed = () => nav.router.push.mock.calls.map((c) => String(c[0]));

function button(label: string): HTMLButtonElement {
  const b = [...host.querySelectorAll("button")].find((el) => el.textContent?.trim() === label);
  if (!b) throw new Error(`no button labelled ${label}`);
  return b;
}

async function click(el: HTMLElement) {
  await act(async () => el.click());
  await settle();
}

const quotaFull = () =>
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new DOMException("x", "QuotaExceededError");
  });

/** The switch on its own, with the store its module graph shares. */
async function renderSwitch(mode: "guided" | "canvas", setId: string): Promise<Store> {
  const { ModeSwitch } = await import("../EditorScreen");
  const store = await import("@/store/onstage");
  await act(async () => root.render(<ModeSwitch mode={mode} setId={setId} />));
  return store;
}

describe("ModeSwitch", () => {
  it("offers Guided and Canvas", async () => {
    await renderSwitch("canvas", "S");
    expect([...host.querySelectorAll("button")].map((b) => b.textContent)).toEqual(["Guided", "Canvas"]);
  });

  it("Guided goes to the guided flow for the set and stores the preference — the set needn't be loaded", async () => {
    const { useOnstage } = await renderSwitch("canvas", "S");
    expect(useOnstage.getState().loadedSetId).toBeNull();

    await click(button("Guided"));

    expect(pushed()).toEqual(["/guided?set=S"]);
    expect(storedPrefs()).toEqual({ workMode: "guided", defaultStore: "apple" });
    expect(useOnstage.getState().workMode).toBe("guided");
    // Nothing about the set was loaded or written.
    expect(useOnstage.getState().loadedSetId).toBeNull();
    expect(localStorage.getItem("onstage:set-docs:v1")).toBeNull();
  });

  it("Canvas goes to the canvas for the set and stores that preference", async () => {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ workMode: "guided", defaultStore: "play" }));
    const { useOnstage } = await renderSwitch("guided", "S");
    useOnstage.setState({ workMode: "guided" });

    await click(button("Canvas"));

    expect(pushed()).toEqual(["/editor?set=S"]);
    // The other preference is kept.
    expect(storedPrefs()).toEqual({ workMode: "canvas", defaultStore: "play" });
    expect(useOnstage.getState().workMode).toBe("canvas");
  });

  it("with no set id yet, it goes to the bare route (which finds the set) and still stores the choice", async () => {
    await renderSwitch("canvas", "");
    await click(button("Guided"));
    expect(pushed()).toEqual(["/guided"]);
    expect(storedPrefs()).toEqual({ workMode: "guided", defaultStore: "apple" });
  });

  it("after the switch, 'open this set' links follow the new mode", async () => {
    await renderSwitch("canvas", "S");
    const { openSetHref } = await import("@/lib/onstage/setLinks");
    expect(openSetHref("other")).toBe("/editor?set=other");
    await click(button("Guided"));
    expect(openSetHref("other")).toBe("/guided?set=other");
  });

  it("a preference the browser refuses to store still switches, and says why in the console", async () => {
    const { useOnstage } = await renderSwitch("canvas", "S");
    const before = storageSnapshot();
    quotaFull();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await click(button("Guided"));

    expect(pushed()).toEqual(["/guided?set=S"]);
    expect(useOnstage.getState().workMode).toBe("guided");
    expect(storageSnapshot()).toEqual(before);
    expect(warn).toHaveBeenCalledWith(
      "[onstage] couldn't store the work mode",
      expect.objectContaining({ message: "This browser's storage is full." }),
    );
  });
});

describe("GuidedScreen — the work-mode controls", () => {
  /** A page load of /guided?set=trailhead-69, waited on until the set has
   *  loaded. */
  async function renderGuided(): Promise<Store> {
    seedLibrary();
    nav.params = new URLSearchParams(`set=${SET}`);
    const { GuidedScreen } = await import("@/components/onstage/screens/GuidedScreen");
    const store = await import("@/store/onstage");
    await act(async () => root.render(<GuidedScreen />));
    await settle();
    await vi.waitFor(() => expect(store.useOnstage.getState().loadedSetId).toBe(SET));
    await settle();
    return store;
  }

  function skipLink(): HTMLElement {
    const el = [...host.querySelectorAll<HTMLElement>("span")].find(
      (x) => x.textContent === "Skip the steps — open the canvas",
    );
    if (!el) throw new Error("no skip link");
    return el;
  }

  it("'Skip the steps — open the canvas' chooses the canvas and opens this set in it", async () => {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ workMode: "guided", defaultStore: "apple" }));
    const { useOnstage } = await renderGuided();
    useOnstage.setState({ workMode: "guided" });
    nav.router.push.mockClear();

    await click(skipLink());

    expect(pushed()).toEqual([`/editor?set=${SET}`]);
    expect(storedPrefs()).toEqual({ workMode: "canvas", defaultStore: "apple" });
    expect(useOnstage.getState().workMode).toBe("canvas");
  });

  it("the skip link still opens the canvas when the preference can't be stored", async () => {
    const { useOnstage } = await renderGuided();
    useOnstage.setState({ workMode: "guided" });
    nav.router.push.mockClear();
    const prefsBefore = localStorage.getItem(PREFS_KEY);
    quotaFull();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await click(skipLink());

    expect(pushed()).toEqual([`/editor?set=${SET}`]);
    expect(localStorage.getItem(PREFS_KEY)).toBe(prefsBefore);
    expect(useOnstage.getState().workMode).toBe("canvas");
    expect(warn).toHaveBeenCalledWith("[onstage] couldn't store the work mode", expect.any(Error));
  });

  it("the top bar's Canvas switch opens this set on the canvas and stores the choice", async () => {
    const { useOnstage } = await renderGuided();
    useOnstage.setState({ workMode: "guided" });
    nav.router.push.mockClear();

    await click(button("Canvas"));

    expect(pushed()).toEqual([`/editor?set=${SET}`]);
    expect(storedPrefs()).toEqual({ workMode: "canvas", defaultStore: "apple" });
  });

  it("neither control writes the work mode into the set's document", async () => {
    const { useOnstage } = await renderGuided();
    // An edit, so the document is saved.
    await act(async () => useOnstage.getState().patchFrame({ caption: "Mine" }));
    await click(skipLink());
    await settle(1000);
    const docs = JSON.parse(localStorage.getItem("onstage:set-docs:v1") ?? "{}") as Record<string, object>;
    expect(docs[SET]).toBeDefined();
    expect(docs[SET]).not.toHaveProperty("workMode");
  });
});
