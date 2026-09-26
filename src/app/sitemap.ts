import type { MetadataRoute } from "next";
import { TEMPLATES } from "@/lib/onstage/data";
import { FEATURES } from "@/lib/features";

// Required for `output: export` — emit a static sitemap.xml at build time.
export const dynamic = "force-static";

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL || "https://ishankgupta95.github.io/OnStage";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const now = new Date();
  const page = (path: string, priority: number): MetadataRoute.Sitemap[number] => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority,
  });

  return [
    page("/", 1),
    // Gated routes still emit HTML (static export can't redirect) but render
    // the 404 body, so they stay out of the sitemap. See src/lib/features.ts.
    ...(FEATURES.billing ? [page("/pricing", 0.9)] : []),
    page("/templates", 0.8),
    ...TEMPLATES.map((t) => page(`/templates/${t.slug}`, 0.5)),
    page("/editor", 0.8),
    page("/guided", 0.6),
    page("/dashboard", 0.6),
    page("/project", 0.5),
    page("/brand", 0.5),
    page("/store-preview", 0.5),
    ...(FEATURES.teams ? [page("/review", 0.4)] : []),
    ...(FEATURES.abTest ? [page("/ab-test", 0.4)] : []),
    ...(FEATURES.jobQueue ? [page("/queue", 0.4)] : []),
    page("/settings", 0.4),
    ...(FEATURES.designBoards ? [page("/states", 0.3), page("/mobile", 0.3)] : []),
    ...(FEATURES.accounts ? [page("/signin", 0.5)] : []),
    page("/onboarding", 0.5),
    { url: `${base}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];
}
