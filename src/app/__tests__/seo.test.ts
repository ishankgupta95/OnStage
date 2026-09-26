import { afterEach, describe, expect, it, vi } from "vitest";
import type { MetadataRoute } from "next";

/** Routes that exist only behind a flag: they still emit HTML (static export
 *  can't redirect) but render the 404 body, so crawlers must stay off them. */
const GATED = {
  NEXT_PUBLIC_FEATURE_ACCOUNTS: ["/signin", "/auth/callback"],
  NEXT_PUBLIC_FEATURE_BILLING: ["/pricing"],
  NEXT_PUBLIC_FEATURE_TEAMS: ["/review"],
  NEXT_PUBLIC_FEATURE_AB_TEST: ["/ab-test"],
  NEXT_PUBLIC_FEATURE_JOB_QUEUE: ["/queue"],
  NEXT_PUBLIC_FEATURE_DESIGN_BOARDS: ["/states", "/mobile"],
} as const;

const ALL_GATED = Object.values(GATED).flat();

async function load(on: boolean) {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://example.test/OnStage");
  for (const name of Object.keys(GATED)) vi.stubEnv(name, on ? "true" : "");
  const sitemap = (await import("@/app/sitemap")).default;
  const robots = (await import("@/app/robots")).default;
  const paths = sitemap().map((e) => new URL(e.url).pathname.replace(/^\/OnStage/, "") || "/");
  const rules = robots().rules as Extract<MetadataRoute.Robots["rules"], { userAgent?: unknown }>;
  const disallow = rules.disallow === undefined ? [] : ([] as string[]).concat(rules.disallow);
  return { paths, disallow };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("sitemap and robots", () => {
  it("leave out and disallow every flagged-off route", async () => {
    const { paths, disallow } = await load(false);
    for (const route of ALL_GATED) {
      expect(paths).not.toContain(route);
      expect(disallow).toContain(route);
    }
  });

  it("list the routes again once their flags are on", async () => {
    const { paths, disallow } = await load(true);
    // /auth/callback is a redirect target, never a page worth indexing.
    for (const route of ALL_GATED.filter((r) => r !== "/auth/callback")) expect(paths).toContain(route);
    expect(disallow).toEqual([]);
  });

  it("always list the public pages", async () => {
    const { paths } = await load(false);
    for (const route of ["/", "/templates", "/editor", "/dashboard", "/privacy", "/terms"]) {
      expect(paths).toContain(route);
    }
  });
});
