import type { MetadataRoute } from "next";
import { TEMPLATES } from "@/lib/onstage/data";
import { FEATURES } from "@/lib/features";
import { pageUrl } from "@/lib/site";

// Required for `output: export` — emit a static sitemap.xml at build time.
export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  // Each URL as the site serves it — with the export's trailing slash, so a
  // crawler never lands on a redirect (RUN-1) — matching the canonical links.
  const page = (
    path: string,
    priority: number,
    changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] = "weekly",
  ): MetadataRoute.Sitemap[number] => ({
    url: pageUrl(path),
    lastModified: now,
    changeFrequency,
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
    page("/privacy", 0.3, "yearly"),
    page("/terms", 0.3, "yearly"),
  ];
}
