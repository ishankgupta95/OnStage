import { afterEach, describe, expect, it, vi } from "vitest";
import type { Metadata } from "next";

/**
 * Plan S3.5 (PLATFORM-1, PLATFORM-3): every public page has its own
 * description and a canonical link to its bare path; pages nobody should find
 * say noindex; and URLs resolve against the production site, never localhost.
 */

type PageModule = { metadata?: Metadata; generateMetadata?: (p: { params: Promise<{ slug: string }> }) => Promise<Metadata> };

const PUBLIC: { path: string; load: () => Promise<PageModule> }[] = [
  { path: "/", load: () => import("@/app/page") },
  { path: "/templates", load: () => import("@/app/templates/page") },
  { path: "/editor", load: () => import("@/app/editor/page") },
  { path: "/guided", load: () => import("@/app/guided/page") },
  { path: "/dashboard", load: () => import("@/app/dashboard/page") },
  { path: "/project", load: () => import("@/app/project/page") },
  { path: "/brand", load: () => import("@/app/brand/page") },
  { path: "/store-preview", load: () => import("@/app/store-preview/page") },
  { path: "/settings", load: () => import("@/app/settings/page") },
  { path: "/onboarding", load: () => import("@/app/onboarding/page") },
  { path: "/privacy", load: () => import("@/app/privacy/page") },
  { path: "/terms", load: () => import("@/app/terms/page") },
];

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("public pages", () => {
  it.each(PUBLIC)("$path has its own description and a canonical link to itself", async ({ path, load }) => {
    const { metadata } = await load();
    expect(metadata?.alternates?.canonical).toBe(path);
    expect(typeof metadata?.description).toBe("string");
    expect((metadata?.description as string).length).toBeGreaterThan(20);
    expect(metadata?.robots).toBeUndefined();
  });

  it("no two public pages share a description or a title", async () => {
    const all = await Promise.all(PUBLIC.map(async (p) => (await p.load()).metadata!));
    const descriptions = all.map((m) => m.description);
    expect(new Set(descriptions).size).toBe(descriptions.length);
    // The home page keeps the root layout's title.
    const titles = all.map((m) => m.title).filter(Boolean);
    expect(new Set(titles).size).toBe(titles.length);
    expect(titles).toHaveLength(PUBLIC.length - 1);
  });

  it("no description promises what's turned off: AI, uploading to the stores, accounts or teams", async () => {
    const all = await Promise.all(PUBLIC.map(async (p) => (await p.load()).metadata!));
    for (const m of all) {
      expect(m.description).not.toMatch(/\bAI\b|upload(s|ed)? to|push live|sign in|account|team|colours? and (caption )?font/i);
      expect(m.description).not.toMatch(/Drop a screen onto the phone/);
    }
  });

  it("the template count in /templates' description is the real one", async () => {
    const { TEMPLATE_COUNT } = await import("@/lib/onstage/data");
    const { metadata } = await import("@/app/templates/page");
    expect(metadata.description).toContain(`one of ${TEMPLATE_COUNT} looks`);
  });
});

describe("template pages", () => {
  it("each has its own title, a description of what applying it sets, and a canonical link", async () => {
    const { BGS, TEMPLATES } = await import("@/lib/onstage/data");
    const { generateMetadata } = await import("@/app/templates/[slug]/page");
    const descriptions = new Set<string>();
    for (const tpl of TEMPLATES) {
      const m = await generateMetadata({ params: Promise.resolve({ slug: tpl.slug }) });
      expect(m.title).toBe(`${tpl.name} — Onstage`);
      const d = m.description as string;
      descriptions.add(d);
      expect(d).toContain(`the ${BGS.find((b) => b.id === tpl.bg)!.label} background`);
      expect(d.includes("running across every frame")).toBe(tpl.panoramic);
      expect(d).toContain(tpl.ty === 0 ? "the phone flat" : `turned ${Math.abs(tpl.ty)}°`);
      // Not the tagline: it promises effects the templates don't have yet (SCREENSA-3).
      expect(d).not.toContain(tpl.tagline);
      expect(m.alternates?.canonical).toBe(`/templates/${tpl.slug}`);
    }
    expect(descriptions.size).toBe(TEMPLATES.length);
  });

  it("only the listed templates exist: any other slug is a 404 in a server build too", async () => {
    const page = await import("@/app/templates/[slug]/page");
    expect(page.dynamicParams).toBe(false);
  });

  it("an unknown slug gets a plain title and no canonical link", async () => {
    const { generateMetadata } = await import("@/app/templates/[slug]/page");
    const m = await generateMetadata({ params: Promise.resolve({ slug: "no-such-look" }) });
    expect(m).toEqual({ title: "Template — Onstage" });
  });
});

describe("pages kept out of search", () => {
  it("/dashboard/empty (a design-board state nothing links to) and /auth/callback say noindex", async () => {
    const empty = (await import("@/app/dashboard/empty/page")).metadata;
    const callback = (await import("@/app/auth/callback/page")).metadata;
    expect(empty.robots).toEqual({ index: false, follow: false });
    expect(callback.robots).toEqual({ index: false, follow: false });
    expect(empty.alternates).toBeUndefined();
  });

  it("/auth/callback stays noindex with accounts on", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_FEATURE_ACCOUNTS", "true");
    const { metadata } = await import("@/app/auth/callback/page");
    expect(metadata.title).toBe("Signing you in — Onstage");
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});

describe("the root layout", () => {
  async function layout(env: Record<string, string>) {
    vi.resetModules();
    for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
    return (await import("@/app/layout")).metadata;
  }

  it("resolves against the production Pages URL when no site URL is set — never localhost (PLATFORM-1)", async () => {
    const m = await layout({ NEXT_PUBLIC_SITE_URL: "" });
    expect(String(m.metadataBase)).toBe("https://ishankgupta95.github.io/OnStage/");
  });

  it("uses NEXT_PUBLIC_SITE_URL when set, with or without a trailing slash", async () => {
    expect(String((await layout({ NEXT_PUBLIC_SITE_URL: "https://example.test/OnStage" })).metadataBase)).toBe(
      "https://example.test/OnStage/",
    );
    expect(String((await layout({ NEXT_PUBLIC_SITE_URL: "https://example.test/OnStage/" })).metadataBase)).toBe(
      "https://example.test/OnStage/",
    );
  });

  it("names no canonical link itself, so no page inherits the home page's", async () => {
    const m = await layout({});
    expect(m.alternates).toBeUndefined();
    expect(m.description).toMatch(/App Store and Google Play/);
    expect(m.description).not.toMatch(/Drop a screen onto the phone/);
  });
});
