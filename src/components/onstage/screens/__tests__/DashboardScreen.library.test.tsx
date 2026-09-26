import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// One router per test, stable across renders the way Next's is.
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
import type { App } from "@/lib/data/types";
import { useOnstage } from "@/store/onstage";
import { DashboardScreen } from "../DashboardScreen";
import { seedLibrary, storageSnapshot } from "@/lib/data/__tests__/library";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const APPS_KEY = "onstage:apps:v1";

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
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
});

async function settle() {
  for (let i = 0; i < 3; i++) await act(() => new Promise((r) => setTimeout(r, 5)));
}

async function mount() {
  await act(async () => root.render(<DashboardScreen />));
  await settle();
}

/** Wait (inside act) until `check` holds, or fail naming `what`. */
async function until(check: () => boolean, what: string, ms = 2000) {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > ms) throw new Error(`timed out waiting for ${what}`);
    await act(() => new Promise((r) => setTimeout(r, 5)));
  }
}

const text = () => host.textContent ?? "";

function button(label: string): HTMLButtonElement {
  const b = [...host.querySelectorAll("button")].find((x) => x.textContent?.trim() === label);
  if (!b) throw new Error(`no "${label}" button`);
  return b;
}

const nameField = () => host.querySelector<HTMLInputElement>('input[aria-label="New app name"]');
const createButton = () => host.querySelector<HTMLButtonElement>('button[aria-label="Create app"]');
const alerts = () => [...host.querySelectorAll<HTMLElement>('[role="alert"]')];
const pushed = () => nav.router.push.mock.calls.map((c) => c[0] as string);
const storedApps = () => JSON.parse(localStorage.getItem(APPS_KEY) ?? "[]") as App[];

async function click(el: HTMLElement) {
  await act(async () => el.click());
}

/** Set the field's value the way typing does, so React's onChange sees it. */
async function type(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  await act(async () => {
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function press(input: HTMLElement, key: string) {
  await act(async () => {
    input.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
  });
}

/** Open the "New app" tile and return its name field. */
async function openTile(): Promise<HTMLInputElement> {
  expect(nameField()).toBeNull();
  await click(button("New app"));
  const input = nameField();
  expect(input).not.toBeNull();
  return input!;
}

describe("DashboardScreen — the New app tile", () => {
  let seeded: App[];
  beforeEach(() => {
    seeded = seedLibrary().apps;
  });

  it("opens into a name field whose + button is disabled while the name is blank", async () => {
    await mount();
    const input = await openTile();
    expect(input.value).toBe("");
    expect(createButton()!.disabled).toBe(true);
    await type(input, "   ");
    expect(createButton()!.disabled).toBe(true);
    await type(input, "Ferry Two");
    expect(createButton()!.disabled).toBe(false);
  });

  it("Enter creates the app in storage and pushes its board", async () => {
    await mount();
    const input = await openTile();
    await type(input, "Ferry Two");
    await press(input, "Enter");
    await until(() => nav.router.push.mock.calls.length > 0, "the push to the new app's board");

    const apps = storedApps();
    expect(apps).toHaveLength(seeded.length + 1);
    // The existing apps are untouched, the new one is appended.
    expect(apps.slice(0, seeded.length)).toEqual(seeded);
    const created = apps.at(-1)!;
    expect(created.name).toBe("Ferry Two");
    expect(created.initial).toBe("F");
    expect(seeded.some((a) => a.id === created.id)).toBe(false);
    expect(pushed()).toEqual([`/project?app=${encodeURIComponent(created.id)}`]);
    expect(alerts()).toEqual([]);
  });

  it("trims the name before creating the app", async () => {
    await mount();
    const input = await openTile();
    await type(input, "  Ferry Two  ");
    await press(input, "Enter");
    await until(() => nav.router.push.mock.calls.length > 0, "the push to the new app's board");
    expect(storedApps().at(-1)!.name).toBe("Ferry Two");
  });

  it("the + button (Create app) creates the app and pushes its board", async () => {
    await mount();
    const input = await openTile();
    await type(input, "Ferry Two");
    await click(createButton()!);
    await until(() => nav.router.push.mock.calls.length > 0, "the push to the new app's board");

    const apps = storedApps();
    expect(apps).toHaveLength(seeded.length + 1);
    const created = apps.at(-1)!;
    expect(created.name).toBe("Ferry Two");
    expect(pushed()).toEqual([`/project?app=${encodeURIComponent(created.id)}`]);
  });

  it("Escape closes the field without creating anything, and reopens empty", async () => {
    await mount();
    const before = storageSnapshot();
    const input = await openTile();
    await type(input, "Ferry Two");
    await press(input, "Escape");
    await settle();

    expect(nameField()).toBeNull();
    expect(() => button("New app")).not.toThrow();
    expect(storageSnapshot()).toEqual(before);
    expect(nav.router.push).not.toHaveBeenCalled();

    const again = await openTile();
    expect(again.value).toBe("");
  });

  it("a full browser store keeps the field open, says why, and stores and pushes nothing", async () => {
    await mount();
    const before = storageSnapshot();
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
    });
    const input = await openTile();
    await type(input, "Ferry Two");
    await press(input, "Enter");
    await until(() => alerts().length > 0, "the refusal line");

    expect(alerts().map((a) => a.textContent)).toEqual([
      "Couldn't create the app — This browser's storage is full.",
    ]);
    // The field stays, with the name, ready to try again.
    expect(nameField()).toBe(input);
    expect(input.value).toBe("Ferry Two");
    expect(createButton()!.disabled).toBe(false);
    expect(nav.router.push).not.toHaveBeenCalled();
    expect(setItem).toHaveBeenCalled();

    setItem.mockRestore();
    expect(storageSnapshot()).toEqual(before);
    expect(storedApps().some((a) => a.name === "Ferry Two")).toBe(false);
  });

  it("after a refusal, the next attempt succeeds once storage accepts it", async () => {
    await mount();
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
    });
    const input = await openTile();
    await type(input, "Ferry Two");
    await press(input, "Enter");
    await until(() => alerts().length > 0, "the refusal line");
    setItem.mockRestore();

    await click(createButton()!);
    await until(() => nav.router.push.mock.calls.length > 0, "the push to the new app's board");
    const created = storedApps().at(-1)!;
    expect(created.name).toBe("Ferry Two");
    expect(pushed()).toEqual([`/project?app=${encodeURIComponent(created.id)}`]);
    expect(alerts()).toEqual([]);
  });
});

describe("DashboardScreen — an empty library", () => {
  it("the recent-sets list says 'No sets yet', and the New app tile is still there", async () => {
    // No seedLibrary(): nothing stored, and the library reads come back empty.
    vi.spyOn(localBackend, "listSets").mockResolvedValue([]);
    vi.spyOn(localBackend, "listApps").mockResolvedValue([]);
    await mount();
    expect(text()).toContain("No sets yet");
    expect(text()).toContain("A set is one app, one store size, and the frames inside it.");
    expect(text()).not.toContain("No sets match that");
    expect(() => button("New app")).not.toThrow();
    // No sample rows leaked in from fixtures.
    expect(text()).not.toContain("Trailhead — 6.9″ set");
    expect(text()).not.toContain("Lumen — first draft");
  });

  it("with a real, unseeded browser the sample set is listed instead (seeded on first read)", async () => {
    await mount();
    expect(text()).toContain("Trailhead — 6.9″ set");
    expect(text()).not.toContain("No sets yet");
    expect(localStorage.getItem("onstage:seeded:v1")).not.toBeNull();
  });
});
