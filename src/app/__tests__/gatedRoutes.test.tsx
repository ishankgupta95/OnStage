import { afterEach, describe, expect, it, vi } from "vitest";
import type { Metadata } from "next";

/**
 * Gated routes keep their page.tsx and render the 404 body while their flag
 * is off (static export can't redirect) — and their own screen once it's on.
 * The pages are plain functions, so the element they return says which.
 */
const ROUTES = [
  { path: "ab-test", flag: "NEXT_PUBLIC_FEATURE_AB_TEST", screen: "AbTestScreen", title: "A/B test — Onstage" },
  { path: "queue", flag: "NEXT_PUBLIC_FEATURE_JOB_QUEUE", screen: "QueueScreen", title: "Renders & uploads — Onstage" },
  { path: "states", flag: "NEXT_PUBLIC_FEATURE_DESIGN_BOARDS", screen: "StatesScreen", title: "Error & edge states — Onstage" },
  { path: "mobile", flag: "NEXT_PUBLIC_FEATURE_DESIGN_BOARDS", screen: "MobileScreen", title: "Marketing at 390px — Onstage" },
  { path: "review", flag: "NEXT_PUBLIC_FEATURE_TEAMS", screen: "ReviewScreen", title: "Review — Onstage" },
  { path: "pricing", flag: "NEXT_PUBLIC_FEATURE_BILLING", screen: "PricingScreen", title: "Pricing — Onstage" },
  { path: "signin", flag: "NEXT_PUBLIC_FEATURE_ACCOUNTS", screen: "AuthScreen", title: "Sign in — Onstage" },
] as const;

type Page = { default: () => { type: unknown }; metadata: Metadata };

const pages: Record<(typeof ROUTES)[number]["path"], () => Promise<Page>> = {
  "ab-test": () => import("@/app/ab-test/page"),
  queue: () => import("@/app/queue/page"),
  states: () => import("@/app/states/page"),
  mobile: () => import("@/app/mobile/page"),
  review: () => import("@/app/review/page"),
  pricing: () => import("@/app/pricing/page"),
  signin: () => import("@/app/signin/page"),
};

/** The route's page module, built with its flag on or off. */
async function load(route: (typeof ROUTES)[number], on: boolean) {
  vi.resetModules();
  vi.stubEnv(route.flag, on ? "true" : "");
  const page = await pages[route.path]();
  const NotFound = (await import("@/components/onstage/screens/NotFoundScreen")).NotFoundScreen;
  return { element: page.default(), title: page.metadata.title, robots: page.metadata.robots, NotFound };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("gated routes", () => {
  it.each(ROUTES)("/$path renders the 404 body and a Not found title with its flag off", async (route) => {
    const { element, title, NotFound } = await load(route, false);
    expect(element.type).toBe(NotFound);
    expect(title).toBe("Not found — Onstage");
  });

  // robots.txt under /OnStage/ is never read on a GitHub project page, so
  // the page itself says so (S3.5).
  it.each(ROUTES)("/$path asks not to be indexed with its flag off, and doesn't once it's on", async (route) => {
    expect((await load(route, false)).robots).toEqual({ index: false, follow: false });
    expect((await load(route, true)).robots).toBeUndefined();
  });

  it.each(ROUTES)("/$path renders $screen with its flag on", async (route) => {
    const { element, title, NotFound } = await load(route, true);
    expect(element.type).not.toBe(NotFound);
    expect((element.type as { name?: string }).name).toBe(route.screen);
    expect(title).toBe(route.title);
  });
});
