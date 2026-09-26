import type { Metadata } from "next";

/**
 * Where the site lives (plan S3.5): the one base every absolute URL is built
 * from — metadataBase (so canonical links and og:image), sitemap.xml and
 * robots.txt. Origin plus base path, no trailing slash. Unset (or blank) it
 * is the production Pages URL, never localhost.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://ishankgupta95.github.io/OnStage"
).replace(/\/+$/, "");

/** What Onstage is, in one line: the home page's description and the OG
 *  image's subtitle. */
export const SITE_DESCRIPTION =
  "Drop your screens onto a phone, tilt them, pick a background, and export every App Store and Google Play size at once. Free, and your screenshots stay in your browser.";

/** The static export serves every page as a folder (`trailingSlash: true` in
 *  next.config.ts), so its URLs end in "/"; a server build's don't. */
const TRAILING_SLASH = process.env.NEXT_PUBLIC_STATIC_EXPORT === "true";

/** A page's absolute URL, in the form the site serves it without a redirect. */
export function pageUrl(path: string): string {
  const clean = path === "/" ? "" : path.replace(/\/+$/, "");
  return `${SITE_URL}${clean}${TRAILING_SLASH ? "/" : ""}`;
}

/** A page path under the site's base path ("/OnStage/signin"), as a crawler
 *  requests it. */
export function sitePath(path: string): string {
  return `${new URL(SITE_URL).pathname.replace(/\/+$/, "")}${path}`;
}

/**
 * A public page's metadata: its own title and description, and a canonical
 * link to its bare path — query strings (`?set=`, `?app=`) name a person's
 * local data, not another page. Next resolves the path against metadataBase
 * and adds the export's trailing slash itself.
 */
export function pageMetadata({
  path,
  title,
  description,
}: {
  path: string;
  /** Omitted: the root layout's title. */
  title?: string;
  description: string;
}): Metadata {
  return {
    ...(title ? { title } : {}),
    description,
    alternates: { canonical: path },
  };
}

/** A route no one should find in search: flagged off (it renders the 404
 *  body) or a design-board state nothing links to. robots.txt can't do this
 *  on a GitHub project page — crawlers only read it at the host's root. */
export const NOT_INDEXED: Metadata["robots"] = { index: false, follow: false };
