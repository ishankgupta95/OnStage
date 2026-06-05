import type { MetadataRoute } from "next";

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Auth-gated routes have no useful content for crawlers and may briefly
      // 200 with a login redirect — keep them out of the index.
      disallow: ["/dashboard", "/settings", "/project", "/invite", "/api"],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
