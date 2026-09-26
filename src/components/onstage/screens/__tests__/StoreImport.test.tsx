import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Plan S3.1 / D3: reading a listing from its App Store / Play URL needs a
 * server, so `FEATURES.storeImport` (off) takes the "Paste your store URL"
 * route out of first run and the empty dashboard. The route, the field and
 * `importFromStoreUrl` are kept — flipping the flag brings back today's
 * fixture flow unchanged.
 */

const nav = vi.hoisted(() => ({
  params: new URLSearchParams(),
  router: { push: vi.fn(), replace: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => nav.router,
  usePathname: () => "/onboarding",
  useSearchParams: () => nav.params,
}));

import { FEATURES } from "@/lib/features";
import { getBackend } from "@/lib/data/backend";
import { localBackend } from "@/lib/data/local";
import { EmptyScreen } from "../EmptyScreen";
import { OnboardingScreen, START_ROUTES } from "../OnboardingScreen";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const URL_ROUTE = "Paste your store URL";
const UPLOAD_ROUTE = "Upload your screens";
const TEMPLATE_ROUTE = "Start from a template";
const FIELD = 'input[aria-label="Store listing URL"]';
const STEP_TWO = "STEP 2 — PICK A LOOK";

let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  nav.params = new URLSearchParams();
  nav.router.push.mockReset();
  nav.router.replace.mockReset();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
});

/** A fresh page load built with `storeImport` on: the screens, the flags and
 *  the backend all from that one module graph. */
async function withStoreImport() {
  vi.resetModules();
  vi.doMock("@/lib/features", async (importOriginal) => {
    const real = await importOriginal<typeof import("@/lib/features")>();
    return { FEATURES: { ...real.FEATURES, storeImport: true } };
  });
  try {
    const onboarding = await import("../OnboardingScreen");
    const empty = await import("../EmptyScreen");
    const features = await import("@/lib/features");
    const backend = await import("@/lib/data/backend");
    const local = await import("@/lib/data/local");
    return {
      OnboardingScreen: onboarding.OnboardingScreen,
      START_ROUTES: onboarding.START_ROUTES,
      EmptyScreen: empty.EmptyScreen,
      FEATURES: features.FEATURES,
      getBackend: backend.getBackend,
      localBackend: local.localBackend,
    };
  } finally {
    vi.doUnmock("@/lib/features");
  }
}

async function render(el: React.ReactElement) {
  await act(async () => root.render(el));
}

/** The innermost element showing exactly `text`, or null. */
function findText(text: string): HTMLElement | null {
  return (
    [...host.querySelectorAll<HTMLElement>("*")].find(
      (e) => e.textContent === text && e.children.length === 0,
    ) ?? null
  );
}

function byText(text: string): HTMLElement {
  const el = findText(text);
  if (!el) throw new Error(`nothing shows "${text}"`);
  return el;
}

/** The route card whose title is `title`. */
const card = (title: string): HTMLElement => byText(title).parentElement!;

/** The grid the route cards sit in (found from a card that is always offered). */
const routeGrid = (): HTMLElement => card(UPLOAD_ROUTE).parentElement!;

/** Each card's title, in order. */
const routeTitles = (): string[] =>
  [...routeGrid().children].map((c) => c.children[1]?.textContent ?? "");

/** The column template the s() parser produced, whitespace-insensitive. */
const columns = (el: HTMLElement): string => el.style.gridTemplateColumns.replace(/\s+/g, "");

const field = (): HTMLInputElement | null => host.querySelector<HTMLInputElement>(FIELD);

const pushed = (): string[] => nav.router.push.mock.calls.map((c) => c[0] as string);

async function click(el: HTMLElement) {
  await act(async () => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
}

/** Set the field's value the way typing does, so React's onChange sees it. */
async function type(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  await act(async () => {
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function button(label: string): HTMLButtonElement {
  const b = [...host.querySelectorAll("button")].find((x) => x.textContent === label);
  if (!b) throw new Error(`no "${label}" button`);
  return b;
}

async function until(done: () => boolean, ms = 3000) {
  const end = Date.now() + ms;
  while (!done()) {
    if (Date.now() > end) throw new Error("timed out waiting for the screen");
    await act(() => new Promise((r) => setTimeout(r, 5)));
  }
}

describe("store import — flag off (the shipped build)", () => {
  it("is off by default, and the shared route list drops only the store URL route", () => {
    expect(FEATURES.storeImport).toBe(false);
    expect(START_ROUTES.map((r) => r.id)).toEqual(["upload", "template"]);
  });

  it("first run offers two routes, two across, with no store URL field and no Found line", async () => {
    await render(<OnboardingScreen />);

    expect(routeTitles()).toEqual([UPLOAD_ROUTE, TEMPLATE_ROUTE]);
    expect(columns(routeGrid())).toBe("repeat(2,1fr)");
    expect(host.textContent).not.toContain(URL_ROUTE);
    expect(host.textContent).not.toContain("FASTEST · 20 SECONDS");
    expect(field()).toBeNull();
    expect(host.textContent).not.toContain("Found");
    expect(host.textContent).not.toContain("An apps.apple.com or play.google.com link to your listing.");
  });

  it("no way through first run reaches the store-listing import", async () => {
    const importer = vi.spyOn(localBackend, "importFromStoreUrl");
    expect(getBackend()).toBe(localBackend);
    await render(<OnboardingScreen />);

    // Every route card, then back to the start each time. (No zip link:
    // there is no zip import yet — S3.3.)
    await click(card(UPLOAD_ROUTE));
    expect(host.textContent).toContain(STEP_TWO);
    await click(button("Back"));
    expect(field()).toBeNull();

    await click(card(TEMPLATE_ROUTE));
    expect(pushed()).toEqual(["/templates"]);
    expect(field()).toBeNull();
    expect(host.textContent).not.toContain("Import a zip");

    expect(routeTitles()).toEqual([UPLOAD_ROUTE, TEMPLATE_ROUTE]);
    expect(field()).toBeNull();
    expect(host.textContent).not.toContain("Found");
    expect(importer).not.toHaveBeenCalled();
  });

  it("the empty dashboard offers two routes, two across, without mentioning a live listing", async () => {
    const importer = vi.spyOn(localBackend, "importFromStoreUrl");
    await render(<EmptyScreen />);

    expect(routeTitles()).toEqual([UPLOAD_ROUTE, TEMPLATE_ROUTE]);
    expect(columns(routeGrid())).toBe("repeat(2,1fr)");
    expect(host.textContent).toContain("Start from your own screens or a template.");
    expect(host.textContent).not.toContain("live listing");
    expect(host.textContent).not.toContain(URL_ROUTE);
    expect(field()).toBeNull();

    await click(card(UPLOAD_ROUTE));
    await click(card(TEMPLATE_ROUTE));
    expect(pushed()).toEqual(["/onboarding", "/templates"]);
    expect(importer).not.toHaveBeenCalled();
  });

  it("keeps importFromStoreUrl on the backend (gated at the call site, not removed)", async () => {
    expect(typeof getBackend().importFromStoreUrl).toBe("function");
    await expect(localBackend.importFromStoreUrl("https://apps.apple.com/app/x")).resolves.toEqual({
      appName: "Trailhead",
      subtitle: "Run & Trail Log",
      tint: "#1b6f6a",
      screenshots: [],
    });
    await expect(
      localBackend.importFromStoreUrl("  https://play.google.com/store/apps/details?id=x  "),
    ).resolves.toMatchObject({ appName: "Trailhead" });
    await expect(localBackend.importFromStoreUrl("https://example.com/app")).resolves.toEqual({
      error: "Paste an apps.apple.com or play.google.com link.",
    });
  });
});

describe("store import — storeImport on", () => {
  it("first run offers three routes, three across, and the store URL card opens the field", async () => {
    const g = await withStoreImport();
    expect(g.FEATURES.storeImport).toBe(true);
    expect(g.START_ROUTES.map((r) => r.id)).toEqual(["url", "upload", "template"]);
    await render(<g.OnboardingScreen />);

    expect(routeTitles()).toEqual([URL_ROUTE, UPLOAD_ROUTE, TEMPLATE_ROUTE]);
    expect(columns(routeGrid())).toBe("repeat(3,1fr)");
    expect(field()).toBeNull();

    await click(card(URL_ROUTE));

    expect(field()).not.toBeNull();
    expect(host.textContent).toContain("An apps.apple.com or play.google.com link to your listing.");
    // Opening the field is all the card does: still on step one, nothing pushed.
    expect(host.textContent).toContain("STEP 1 OF 2");
    expect(pushed()).toEqual([]);
  });

  it("a store link reads the listing through the backend, moves on, and the start page then says what it found", async () => {
    const g = await withStoreImport();
    expect(g.getBackend()).toBe(g.localBackend);
    const importer = vi.spyOn(g.localBackend, "importFromStoreUrl");
    await render(<g.OnboardingScreen />);
    await click(card(URL_ROUTE));

    expect(button("Pull it in").disabled).toBe(true);
    await type(field()!, "https://apps.apple.com/app/x");
    expect(button("Pull it in").disabled).toBe(false);
    await click(button("Pull it in"));
    await until(() => host.textContent!.includes(STEP_TWO));

    expect(importer).toHaveBeenCalledTimes(1);
    expect(importer).toHaveBeenCalledWith("https://apps.apple.com/app/x");
    expect(host.textContent).toContain("STEP 2 OF 2");

    // The Found line lives on the start page: back there, it names the app.
    await click(button("Back"));
    expect(byText("Found Trailhead.")).toBeTruthy();
    expect(field()).not.toBeNull();
    expect(pushed()).toEqual([]);
  });

  it("a link that isn't a store listing says so and stays on the start page", async () => {
    const g = await withStoreImport();
    const importer = vi.spyOn(g.localBackend, "importFromStoreUrl");
    await render(<g.OnboardingScreen />);
    await click(card(URL_ROUTE));

    await type(field()!, "https://example.com/app");
    await click(button("Pull it in"));
    // The message sits beside an alert icon, so it isn't a leaf element.
    await until(() => host.textContent!.includes("Paste an apps.apple.com or play.google.com link."));

    expect(importer).toHaveBeenCalledWith("https://example.com/app");
    expect(host.textContent).toContain("STEP 1 OF 2");
    expect(host.textContent).not.toContain(STEP_TWO);
    expect(host.textContent).not.toContain("Found");
  });

  it("the empty dashboard offers three routes and mentions the live listing", async () => {
    const g = await withStoreImport();
    await render(<g.EmptyScreen />);

    expect(routeTitles()).toEqual([URL_ROUTE, UPLOAD_ROUTE, TEMPLATE_ROUTE]);
    expect(columns(routeGrid())).toBe("repeat(3,1fr)");
    expect(host.textContent).toContain("Start from your live listing, your own screens, or a template.");
    expect(host.textContent).not.toContain("Start from your own screens or a template.");

    // The URL route hands over to first run, where the field lives.
    await click(card(URL_ROUTE));
    expect(pushed()).toEqual(["/onboarding"]);
  });
});
