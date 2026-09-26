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

async function load(on: boolean, { exported = true, siteUrl = "https://example.test/OnStage" } = {}) {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", siteUrl);
  vi.stubEnv("NEXT_PUBLIC_STATIC_EXPORT", exported ? "true" : "");
  for (const name of Object.keys(GATED)) vi.stubEnv(name, on ? "true" : "");
  const sitemap = (await import("@/app/sitemap")).default;
  const robots = (await import("@/app/robots")).default;
  const urls = sitemap().map((e) => e.url);
  // "/OnStage/templates/" → "/templates"
  const paths = urls.map((u) => new URL(u).pathname.replace(/^\/OnStage/, "").replace(/\/$/, "") || "/");
  const out = robots();
  const rules = out.rules as Extract<MetadataRoute.Robots["rules"], { userAgent?: unknown }>;
  // Robots paths carry the base path: "/OnStage/signin" → "/signin".
  const disallow = (rules.disallow === undefined ? [] : ([] as string[]).concat(rules.disallow)).map((p) =>
    p.replace(/^\/OnStage/, ""),
  );
  return { urls, paths, disallow, rules, sitemapUrl: out.sitemap };
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

  it("list every page with the trailing slash the static export serves, so none is a redirect (RUN-1)", async () => {
    const { urls } = await load(false);
    expect(urls).toContain("https://example.test/OnStage/");
    expect(urls).toContain("https://example.test/OnStage/templates/");
    expect(urls).toContain("https://example.test/OnStage/templates/ember/");
    expect(urls).toContain("https://example.test/OnStage/privacy/");
    for (const url of urls) expect(url).toMatch(/\/$/);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("without the static export (no trailingSlash), list the bare paths", async () => {
    const { urls } = await load(false, { exported: false });
    expect(urls).toContain("https://example.test/OnStage");
    expect(urls).toContain("https://example.test/OnStage/templates");
    for (const url of urls.filter((u) => u !== "https://example.test/OnStage")) expect(url).not.toMatch(/\/$/);
  });

  it("robots paths carry the site's base path, as a crawler requests them", async () => {
    const { rules, sitemapUrl } = await load(false);
    expect(rules.allow).toBe("/OnStage/");
    expect(([] as string[]).concat(rules.disallow ?? [])).toContain("/OnStage/signin");
    expect(sitemapUrl).toBe("https://example.test/OnStage/sitemap.xml");
  });

  it("on a site at a host's root, robots paths have no prefix", async () => {
    const { rules, urls } = await load(false, { siteUrl: "https://onstage.example/" });
    expect(rules.allow).toBe("/");
    expect(([] as string[]).concat(rules.disallow ?? [])).toContain("/signin");
    expect(urls).toContain("https://onstage.example/");
    expect(urls).toContain("https://onstage.example/templates/");
  });

  it("with no site URL set, use the production Pages URL — never localhost (PLATFORM-1)", async () => {
    const { urls, sitemapUrl } = await load(false, { siteUrl: "" });
    expect(urls).toContain("https://ishankgupta95.github.io/OnStage/");
    expect(sitemapUrl).toBe("https://ishankgupta95.github.io/OnStage/sitemap.xml");
    for (const url of urls) expect(url).not.toContain("localhost");
  });
});
