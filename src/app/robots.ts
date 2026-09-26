import type { MetadataRoute } from "next";
import { FEATURES } from "@/lib/features";
import { SITE_URL, sitePath } from "@/lib/site";

// Required for `output: export` — emit a static robots.txt at build time.
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  // Public demo — everything is crawlable except the routes turned off in
  // src/lib/features.ts. Those still serve HTML (static export has no
  // redirects) but render the 404 body, so keep crawlers off them. Paths
  // carry the site's base path, as crawlers request them. On a GitHub
  // project page this file is never read (crawlers only fetch robots.txt at
  // the host's root), so those pages also carry a noindex tag (S3.5).
  const disallow = [
    ...(FEATURES.accounts ? [] : ["/signin", "/auth/callback"]),
    ...(FEATURES.billing ? [] : ["/pricing"]),
    ...(FEATURES.teams ? [] : ["/review"]),
    ...(FEATURES.abTest ? [] : ["/ab-test"]),
    ...(FEATURES.jobQueue ? [] : ["/queue"]),
    ...(FEATURES.designBoards ? [] : ["/states", "/mobile"]),
  ].map(sitePath);

  return {
    rules: { userAgent: "*", allow: sitePath("/"), ...(disallow.length ? { disallow } : {}) },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
