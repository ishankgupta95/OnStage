import { act, type ComponentType } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { seedLibrary } from "@/lib/data/__tests__/library";
import { TEMPLATES, TEMPLATE_COUNT } from "@/lib/onstage/data";

/**
 * Plan S3.2 (SCREENSA-1): every screen that counts the templates says how
 * many there are — TEMPLATE_COUNT, the gallery's own list — and none still
 * advertises the design file's invented "240".
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
  usePathname: () => "/",
  useSearchParams: () => nav.params,
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Flags = Partial<typeof import("@/lib/features").FEATURES>;

let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  seedLibrary();
  for (const fn of Object.values(nav.router)) fn.mockReset();
  nav.params = new URLSearchParams();
  vi.resetModules();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
});

/** A screen's module from a fresh graph with `flags` on (the rest as shipped). */
async function withFlags<T>(flags: Flags, load: () => Promise<T>): Promise<T> {
  vi.resetModules();
  vi.doMock("@/lib/features", async (importOriginal) => {
    const real = await importOriginal<typeof import("@/lib/features")>();
    return { FEATURES: { ...real.FEATURES, ...flags } };
  });
  try {
    return await load();
  } finally {
    vi.doUnmock("@/lib/features");
  }
}

async function render(Screen: ComponentType) {
  await act(async () => root.render(<Screen />));
}

/** The innermost element showing exactly `text`. */
function leaf(text: string): HTMLElement {
  const el = [...host.querySelectorAll<HTMLElement>("*")].find(
    (e) => e.children.length === 0 && e.textContent === text,
  );
  if (!el) throw new Error(`nothing shows "${text}"`);
  return el;
}

function button(label: string): HTMLButtonElement {
  const b = [...host.querySelectorAll("button")].find((el) => el.textContent?.trim() === label);
  if (!b) throw new Error(`no "${label}" button`);
  return b;
}

async function click(el: HTMLElement) {
  await act(async () => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
}

/** "240" as a number of its own (not part of, say, a pixel size). */
const NO_240 = /(?<!\d)240(?!\d)/;

function expectNo240() {
  expect(host.textContent ?? "").not.toMatch(NO_240);
}

it("TEMPLATE_COUNT is the gallery's own list: 12", () => {
  expect(TEMPLATE_COUNT).toBe(TEMPLATES.length);
  expect(TEMPLATE_COUNT).toBe(12);
});

describe("the template count on every screen that shows it", () => {
  it("Templates: the header says 12 SETS", async () => {
    const { TemplatesScreen } = await import("../TemplatesScreen");
    await render(TemplatesScreen);
    expect(leaf(`${TEMPLATE_COUNT} SETS`).textContent).toBe("12 SETS");
    expect(host.textContent).not.toContain("240 SETS");
    expectNo240();
  });

  it("Landing: 12 sets built by app designers", async () => {
    const { LandingScreen } = await import("../LandingScreen");
    await render(LandingScreen);
    expect(host.textContent).toContain("12 sets built by app designers");
    expect(host.textContent).not.toContain("240 sets");
    expectNo240();
  });

  it("Landing with billing on still counts 12 (its plan table included)", async () => {
    const { LandingScreen } = await withFlags({ billing: true }, () => import("../LandingScreen"));
    await render(LandingScreen);
    expect(host.textContent).toContain("12 sets built by app designers");
    expectNo240();
  });

  it("Onboarding: the template route's meta is 12 SETS, and pick-a-look offers See all 12", async () => {
    const { OnboardingScreen } = await import("../OnboardingScreen");
    await render(OnboardingScreen);
    const card = leaf("Start from a template").parentElement!;
    expect(card.textContent).toContain("12 SETS");
    expect(leaf("12 SETS")).toBeTruthy();
    expectNo240();

    // Reach the look step the way a first run does.
    await click(leaf("Upload your screens"));
    expect(host.textContent).toContain("STEP 2 — PICK A LOOK");
    expect(button("See all 12")).toBeTruthy();
    expect(() => button("See all 240")).toThrow();
    expectNo240();
  });

  it("Onboarding with store import on: still 12 SETS on the template route", async () => {
    const { OnboardingScreen } = await withFlags({ storeImport: true }, () => import("../OnboardingScreen"));
    await render(OnboardingScreen);
    expect(leaf("Start from a template").parentElement!.textContent).toContain("12 SETS");
    expectNo240();
  });

  it("Mobile board (designBoards): the nav drawer's Templates row reads 12", async () => {
    const { MobileScreen } = await withFlags({ designBoards: true }, () => import("../MobileScreen"));
    await render(MobileScreen);
    const row = leaf("Templates").parentElement!;
    expect(leaf("Templates").nextElementSibling!.textContent).toBe("12");
    expect(row.textContent).toBe("Templates12");
    expectNo240();
  });

  it("Mobile board with billing on: still 12, pricing table and all", async () => {
    const { MobileScreen } = await withFlags({ designBoards: true, billing: true }, () => import("../MobileScreen"));
    await render(MobileScreen);
    expect(host.textContent).toContain("Pay when you ship");
    expect(leaf("Templates").nextElementSibling!.textContent).toBe("12");
    expectNo240();
  });

  it("Pricing (billing): the free plan includes All 12 templates", async () => {
    const { PricingScreen } = await withFlags({ billing: true }, () => import("../PricingScreen"));
    await render(PricingScreen);
    expect(leaf("All 12 templates")).toBeTruthy();
    expect(host.textContent).not.toContain("All 240 templates");
    expectNo240();
  });
});
