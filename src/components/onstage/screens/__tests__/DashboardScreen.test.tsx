import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
  usePathname: () => "/dashboard",
  useSearchParams: () => nav.params,
}));

import { localBackend } from "@/lib/data/local";
import { useOnstage } from "@/store/onstage";
import { DashboardScreen } from "../DashboardScreen";
import { seedLibrary } from "@/lib/data/__tests__/library";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

async function mount() {
  await act(async () => root.render(<DashboardScreen />));
  for (let i = 0; i < 3; i++) await act(() => new Promise((r) => setTimeout(r, 5)));
}

/** The innermost element whose text is exactly `text`. */
function byText(text: string): HTMLElement {
  const el = [...host.querySelectorAll<HTMLElement>("*")].filter((e) => e.textContent === text).at(-1);
  if (!el) throw new Error(`nothing reads "${text}"`);
  return el;
}

async function click(el: HTMLElement) {
  await act(async () => el.click());
}

const pushed = () => nav.router.push.mock.calls.map((c) => c[0] as string);

describe("DashboardScreen — recent sets open by id", () => {
  it("clicking 'Lumen — first draft' pushes /editor?set=lumen-draft", async () => {
    await mount();
    await click(byText("Lumen — first draft"));
    expect(pushed()).toEqual(["/editor?set=lumen-draft"]);
  });

  it("each row opens its own set, not a shared default", async () => {
    await mount();
    await click(byText("Ferry — 6.9″ set"));
    await click(byText("Trailhead — Play phone"));
    expect(pushed()).toEqual(["/editor?set=ferry-69", "/editor?set=trailhead-play"]);
  });

  it("opens a set made in this browser by its id", async () => {
    const app = await localBackend.createApp({ name: "Kite" });
    const set = await localBackend.createSet({ appId: app.id, name: "Kite launch" });
    await mount();
    await click(byText("Kite launch"));
    expect(pushed()).toEqual([`/editor?set=${set.id}`]);
  });

  it("opens in the guided flow when the work mode is guided", async () => {
    await mount();
    act(() => useOnstage.setState({ workMode: "guided" }));
    await click(byText("Lumen — first draft"));
    expect(pushed()).toEqual(["/guided?set=lumen-draft"]);
  });

  it("does not open the set in the store or remember it — the editor does that", async () => {
    await mount();
    await click(byText("Lumen — first draft"));
    expect(useOnstage.getState().loadedSetId).toBeNull();
    expect(localStorage.getItem("onstage:last-set:v1")).toBeNull();
  });
});

describe("DashboardScreen — app cards", () => {
  it("each app card pushes its own board, /project?app=<id>", async () => {
    await mount();
    await click(byText("Trailhead"));
    await click(byText("Ferry"));
    await click(byText("Lumen"));
    expect(pushed()).toEqual(["/project?app=trailhead", "/project?app=ferry", "/project?app=lumen"]);
  });

  it("an app made in this browser pushes its own id", async () => {
    const app = await localBackend.createApp({ name: "Kite" });
    await mount();
    await click(byText("Kite"));
    expect(pushed()).toEqual([`/project?app=${encodeURIComponent(app.id)}`]);
  });
});
