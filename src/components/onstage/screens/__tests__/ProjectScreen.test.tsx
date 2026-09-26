import { act, Suspense, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// One router and one set of search params per test, stable across renders the
// way Next's are; each test points `nav.params` at the URL it is testing.
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
import { useOnstage } from "@/store/onstage";
import { ProjectScreen } from "../ProjectScreen";
import { seedLibrary } from "@/lib/data/__tests__/library";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const LAST_SET_KEY = "onstage:last-set:v1";

let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  // A returning user's library: the sample apps and sets as stored records.
  seedLibrary();
  nav.params = new URLSearchParams();
  for (const fn of Object.values(nav.router)) fn.mockReset();
  useOnstage.setState({ workMode: "canvas" });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
});

/** Let the backend reads resolve and the screen re-render. */
async function settle() {
  for (let i = 0; i < 3; i++) await act(() => new Promise((r) => setTimeout(r, 5)));
}

async function mount(query: string, Screen: () => ReactNode = ProjectScreen) {
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

/** Elements whose own text is exactly `text`. */
const byText = (text: string) =>
  [...host.querySelectorAll<HTMLElement>("*")].filter((el) => el.textContent === text);

const text = () => host.textContent ?? "";

/** The clickable line of the set row named `name` (it holds the row's buttons). */
function setRow(name: string): HTMLElement {
  const label = byText(name).at(-1);
  if (!label) throw new Error(`no set row named ${name}`);
  let el: HTMLElement | null = label;
  while (el && !el.querySelector("button")) el = el.parentElement;
  if (!el) throw new Error(`set row ${name} has no buttons`);
  return el;
}

function button(within: ParentNode, label: string): HTMLButtonElement {
  const b = [...within.querySelectorAll("button")].find((x) => x.textContent?.trim() === label);
  if (!b) throw new Error(`no "${label}" button`);
  return b;
}

async function click(el: HTMLElement) {
  await act(async () => el.click());
}

const pushed = () => nav.router.push.mock.calls.map((c) => c[0] as string);

describe("ProjectScreen — the board for ?app=", () => {
  it("?app=ferry shows Ferry's board and only Ferry's sets", async () => {
    await mount("app=ferry");
    expect(byText("Ferry").length).toBeGreaterThan(0);
    expect(byText("Trailhead")).toEqual([]);
    expect(byText("1 SET").length).toBeGreaterThan(0);
    expect(text()).toContain("Ferry — 6.9″ set");
    expect(text()).not.toContain("Trailhead — 6.9″ set");
    expect(text()).not.toContain("Trailhead — Play phone");
    expect(text()).not.toContain("Lumen — first draft");
    expect(nav.router.replace).not.toHaveBeenCalled();
  });

  it("a set row's Open pushes the editor for that set, by id", async () => {
    await mount("app=ferry");
    await click(button(setRow("Ferry — 6.9″ set"), "Open"));
    expect(pushed()).toEqual(["/editor?set=ferry-69"]);
  });

  it("Open goes to the guided flow when the work mode is guided", async () => {
    await mount("app=ferry");
    act(() => useOnstage.setState({ workMode: "guided" }));
    await click(button(setRow("Ferry — 6.9″ set"), "Open"));
    expect(pushed()).toEqual(["/guided?set=ferry-69"]);
  });

  it("opening a set from the board does not open it in the store or remember it", async () => {
    await mount("app=ferry");
    await click(button(setRow("Ferry — 6.9″ set"), "Open"));
    expect(useOnstage.getState().loadedSetId).toBeNull();
    expect(localStorage.getItem(LAST_SET_KEY)).toBeNull();
  });

  it("shows an app made in this browser, with its own sets", async () => {
    const app = await localBackend.createApp({ name: "Kite" });
    const one = await localBackend.createSet({ appId: app.id, name: "Kite launch" });
    await localBackend.createSet({ appId: app.id, name: "Kite tablet" });
    await mount(`app=${app.id}`);
    expect(byText("Kite").length).toBeGreaterThan(0);
    expect(byText("2 SETS").length).toBeGreaterThan(0);
    expect(text()).toContain("Kite launch");
    expect(text()).toContain("Kite tablet");
    expect(text()).not.toContain("Ferry — 6.9″ set");
    expect(text()).not.toContain("Trailhead — 6.9″ set");
    await click(button(setRow("Kite launch"), "Open"));
    expect(pushed()).toEqual([`/editor?set=${one.id}`]);
  });

  it("an app with no sets says so, and Export has nothing to target", async () => {
    const app = await localBackend.createApp({ name: "Empty" });
    await mount(`app=${app.id}`);
    expect(text()).toContain("No sets in this app yet");
    const exportButton = button(host, "Export");
    expect(exportButton.disabled).toBe(true);
    await click(exportButton);
    expect(nav.router.push).not.toHaveBeenCalled();
  });
});

describe("ProjectScreen — an app this browser doesn't have", () => {
  it("?app=nope renders the in-page 'not here' state with a way back to /dashboard", async () => {
    await mount("app=nope");
    expect(byText("This app isn't in this browser").length).toBeGreaterThan(0);
    const back = host.querySelector<HTMLAnchorElement>('a[href="/dashboard"]');
    expect(back).not.toBeNull();
    // No board, and no redirect to someone else's board.
    expect(() => button(host, "Export")).toThrow();
    expect(text()).not.toContain("Trailhead");
    expect(nav.router.replace).not.toHaveBeenCalled();
    expect(nav.router.push).not.toHaveBeenCalled();
  });
});

describe("ProjectScreen — bare /project", () => {
  it("replaces the URL with the app of the last opened set", async () => {
    localStorage.setItem(LAST_SET_KEY, JSON.stringify("lumen-draft"));
    expect(localStorage.getItem(LAST_SET_KEY)).toBe('"lumen-draft"');
    await mount("");
    expect(nav.router.replace).toHaveBeenCalledTimes(1);
    expect(nav.router.replace).toHaveBeenCalledWith("/project?app=lumen");
    expect(nav.router.push).not.toHaveBeenCalled();
  });

  it("with no last set, replaces the URL with the first app's board", async () => {
    await mount("");
    expect(nav.router.replace).toHaveBeenCalledTimes(1);
    expect(nav.router.replace).toHaveBeenCalledWith("/project?app=trailhead");
  });

  it("ignores a remembered set the library no longer lists", async () => {
    localStorage.setItem(LAST_SET_KEY, JSON.stringify("gone-set"));
    await mount("");
    expect(nav.router.replace).toHaveBeenCalledWith("/project?app=trailhead");
  });

  it("follows the last set into an app made in this browser", async () => {
    const app = await localBackend.createApp({ name: "Kite" });
    const set = await localBackend.createSet({ appId: app.id, name: "Kite launch" });
    await localBackend.rememberLastSet(set.id);
    await mount("");
    expect(nav.router.replace).toHaveBeenCalledWith(`/project?app=${encodeURIComponent(app.id)}`);
  });

  it("with no apps at all, goes to the dashboard", async () => {
    vi.spyOn(localBackend, "listApps").mockResolvedValue([]);
    vi.spyOn(localBackend, "listSets").mockResolvedValue([]);
    await mount("");
    expect(nav.router.replace).toHaveBeenCalledWith("/dashboard");
  });
});

describe("ProjectScreen — fixture-only surfaces (flags off)", () => {
  it("has no A/B variants, no Activity card and no Uploads tab", async () => {
    const variants = vi.spyOn(localBackend, "listVariants");
    const activity = vi.spyOn(localBackend, "listActivity");
    await mount("app=trailhead");
    // The board itself rendered.
    expect(byText("Sets").length).toBeGreaterThan(0);
    expect(() => button(host, "Locales")).not.toThrow();
    // …without the gated pieces.
    expect(byText("A/B variants")).toEqual([]);
    expect(byText("ACTIVITY")).toEqual([]);
    expect(() => button(host, "Uploads")).toThrow();
    expect(variants).not.toHaveBeenCalled();
    expect(activity).not.toHaveBeenCalled();
  });

  it("has no Store connections card, no A/B results row and no upload wording (S3.1)", async () => {
    const connections = vi.spyOn(localBackend, "listConnections");
    await mount("app=trailhead");
    expect(byText("THIS SET").length).toBeGreaterThan(0);
    expect(byText("STORE CONNECTIONS")).toEqual([]);
    expect(text()).not.toContain("A/B test results");
    expect(host.querySelector('a[href="/ab-test"]')).toBeNull();
    expect(host.querySelector('a[href^="/settings"]')).toBeNull();
    expect(connections).not.toHaveBeenCalled();
    // The header button exports; there is nowhere to upload to.
    expect(() => button(host, "Export")).not.toThrow();
    expect(text()).not.toContain("upload");
  });

  it("offers no AI translation: no Translate set with AI, Translate, Review or Add a language (S3.1)", async () => {
    await mount("app=trailhead");
    expect(byText("LOCALES").length).toBeGreaterThan(0);
    expect(() => button(host, "Translate set with AI")).toThrow();
    await click(button(host, "Locales"));
    expect(byText("Languages").length).toBeGreaterThan(0);
    expect(text()).toContain("English (US)");
    for (const label of ["Translate with AI", "Translate", "Review", "Add a language"]) {
      expect(() => button(host, label)).toThrow();
    }
    expect(nav.router.push).not.toHaveBeenCalled();
  });
});

describe("ProjectScreen — Export", () => {
  const exportTarget = () => {
    const calls = pushed();
    expect(calls).toHaveLength(1);
    const url = new URL(calls[0], "http://x");
    return { path: url.pathname, set: url.searchParams.get("set"), apply: url.searchParams.get("apply") };
  };

  it("opens the editor on the selected set with the export panel", async () => {
    await mount("app=ferry");
    await click(button(host, "Export"));
    expect(exportTarget()).toEqual({ path: "/editor", set: "ferry-69", apply: "panel:export" });
  });

  it("targets the set picked in the list; picking a row only selects it", async () => {
    await mount("app=trailhead");
    await click(setRow("Trailhead — Play phone"));
    expect(nav.router.push).not.toHaveBeenCalled();
    await click(button(host, "Export"));
    expect(exportTarget()).toEqual({ path: "/editor", set: "trailhead-play", apply: "panel:export" });
  });

  it("defaults to the first listed set when none is picked", async () => {
    await mount("app=trailhead");
    await click(button(host, "Export"));
    expect(exportTarget()).toEqual({ path: "/editor", set: "trailhead-69", apply: "panel:export" });
  });
});

const parse = (href: string) => {
  const u = new URL(href, "http://x");
  return { path: u.pathname, set: u.searchParams.get("set"), apply: u.searchParams.get("apply") };
};

describe("ProjectScreen — every set control carries the selected set's id", () => {

  it("THIS SET → Store listing preview previews the selected set", async () => {
    await mount("app=trailhead");
    await click(setRow("Trailhead — Play phone"));
    const link = [...host.querySelectorAll("a")].find((a) => a.textContent?.includes("Store listing preview"));
    expect(link).toBeTruthy();
    const u = new URL(link!.getAttribute("href")!, "http://x");
    expect(u.pathname).toBe("/store-preview");
    expect(u.searchParams.get("set")).toBe("trailhead-play");
  });
});

// Last: it swaps in a fresh module graph with the flags on, proving the
// selectors above would have found these surfaces had they mounted.
describe("ProjectScreen — fixture-only surfaces (flags on)", () => {
  /** The board from a fresh module graph with `flags` on. */
  async function flagged(flags: Partial<typeof import("@/lib/features").FEATURES>) {
    vi.resetModules();
    vi.doMock("@/lib/features", async (importOriginal) => {
      const real = await importOriginal<typeof import("@/lib/features")>();
      return { FEATURES: { ...real.FEATURES, ...flags } };
    });
    try {
      return (await import("../ProjectScreen")).ProjectScreen;
    } finally {
      vi.doUnmock("@/lib/features");
    }
  }

  it("mounts A/B variants, Activity and the Uploads tab under abTest + jobQueue", async () => {
    const Flagged = await flagged({ abTest: true, jobQueue: true });
    await mount("app=trailhead", Flagged);
    expect(byText("A/B variants").length).toBeGreaterThan(0);
    expect(byText("ACTIVITY").length).toBeGreaterThan(0);
    expect(() => button(host, "Uploads")).not.toThrow();
    // abTest also brings back THIS SET's results row.
    expect(host.querySelector('a[href="/ab-test"]')?.textContent).toContain("A/B test results");
  });

  it("mounts the Store connections card and the upload label under storeUpload", async () => {
    const Flagged = await flagged({ storeUpload: true });
    await mount("app=trailhead", Flagged);
    expect(byText("STORE CONNECTIONS").length).toBeGreaterThan(0);
    // The rows (and their Settings links) appear once the connections load.
    await vi.waitFor(() => expect(host.querySelector('a[href="/settings?tab=Store+connections"]')).not.toBeNull());
    expect(() => button(host, "Export & upload")).not.toThrow();
  });

  it("under aiAssist, the Locales tab's Translate opens the selected set with the localise drawer, not a bare /editor", async () => {
    const Flagged = await flagged({ aiAssist: true });
    await mount("app=ferry", Flagged);
    expect(() => button(host, "Translate set with AI")).not.toThrow();
    await click(button(host, "Locales"));
    expect(() => button(host, "Add a language")).not.toThrow();
    expect(() => button(host, "Review")).not.toThrow();
    await click(button(host, "Translate with AI"));
    expect(pushed().map(parse)).toEqual([{ path: "/editor", set: "ferry-69", apply: "panel:localize" }]);
  });
});
