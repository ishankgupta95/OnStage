import type { MetadataRoute } from "next";

// Required for `output: export` — emit a static sitemap.xml at build time.
export const dynamic = "force-static";

// Default to the GitHub Pages URL for the demo; override with NEXT_PUBLIC_SITE_URL.
const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL || "https://ishankgupta95.github.io/OnStage";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const now = new Date();
  return [
    { url: `${base}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/dashboard`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];
}
