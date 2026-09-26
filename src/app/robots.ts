import type { MetadataRoute } from "next";
import { FEATURES } from "@/lib/features";

// Required for `output: export` — emit a static robots.txt at build time.
export const dynamic = "force-static";

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL || "https://ishankgupta95.github.io/OnStage";

export default function robots(): MetadataRoute.Robots {
  // Public demo — everything is crawlable except the routes turned off in
  // src/lib/features.ts. Those still serve HTML (static export has no
  // redirects) but render the 404 body, so keep crawlers off them.
  const disallow = [
    ...(FEATURES.accounts ? [] : ["/signin", "/auth/callback"]),
    ...(FEATURES.billing ? [] : ["/pricing"]),
    ...(FEATURES.teams ? [] : ["/review"]),
    ...(FEATURES.abTest ? [] : ["/ab-test"]),
    ...(FEATURES.jobQueue ? [] : ["/queue"]),
    ...(FEATURES.designBoards ? [] : ["/states", "/mobile"]),
  ];

  return {
    rules: { userAgent: "*", allow: "/", ...(disallow.length ? { disallow } : {}) },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
