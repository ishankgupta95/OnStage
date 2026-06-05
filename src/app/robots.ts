import type { MetadataRoute } from "next";

// Required for `output: export` — emit a static robots.txt at build time.
export const dynamic = "force-static";

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL || "https://ishankgupta95.github.io/OnStage";

export default function robots(): MetadataRoute.Robots {
  // Public demo — everything is crawlable.
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
