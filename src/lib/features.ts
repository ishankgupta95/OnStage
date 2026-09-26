/**
 * Onstage runs as a free, local, no-account tool. The account-shaped features
 * are built and gated here rather than deleted — flipping one of these back on
 * (plus its env var in CI) restores the full surface.
 *
 * Isomorphic and build-time constant on purpose: `sitemap.ts`, `robots.ts` and
 * `opengraph-image.tsx` are `dynamic = "force-static"` server modules that
 * import it, and the GitHub Pages build runs `output: "export"`. So no
 * `"use client"`, no `window`, no `localStorage` at import time — a runtime
 * read would hydration-mismatch against HTML baked at build time and trip
 * `react-hooks/purity` during render.
 *
 * `NEXT_PUBLIC_*` is inlined at build time; see `.env.local.example` and
 * `.github/workflows/deploy.yml`. Each reference must stay a literal
 * `process.env.NEXT_PUBLIC_…` member access, or the inlining misses it.
 */
export const FEATURES = {
  accounts: process.env.NEXT_PUBLIC_FEATURE_ACCOUNTS === "true",
  teams: process.env.NEXT_PUBLIC_FEATURE_TEAMS === "true",
  billing: process.env.NEXT_PUBLIC_FEATURE_BILLING === "true",
  exportQuota: process.env.NEXT_PUBLIC_FEATURE_EXPORT_QUOTA === "true",
  /* Surfaces that only ever show fixture data, or can never succeed without a
     server (plan D3). Built and kept; off until a backend exists. */
  /** Store destinations in the export dialog (without it every export is a
   *  zip), Settings → Store connections, the project board's Store
   *  connections card and "Export & upload" label, Reconnect, "Push live". */
  storeUpload: process.env.NEXT_PUBLIC_FEATURE_STORE_UPLOAD === "true",
  /** The AI caption / localise drawer and everything that opens it (tool
   *  rail, "Rewrite with AI", the filmstrip's +, the Locales tab's Translate /
   *  Review / Add a language, `?apply=panel:localize`), plus guided's tone
   *  chips and caption suggestions. */
  aiAssist: process.env.NEXT_PUBLIC_FEATURE_AI_ASSIST === "true",
  /** `/ab-test`, the project board's variant cards and its "A/B test
   *  results" row. */
  abTest: process.env.NEXT_PUBLIC_FEATURE_AB_TEST === "true",
  /** `/queue`, the project board's Uploads tab and Activity feed. */
  jobQueue: process.env.NEXT_PUBLIC_FEATURE_JOB_QUEUE === "true",
  /** Importing a listing from an App Store / Play URL (onboarding, the empty
   *  dashboard, guided). */
  storeImport: process.env.NEXT_PUBLIC_FEATURE_STORE_IMPORT === "true",
  /** The design-review boards `/states` and `/mobile`. */
  designBoards: process.env.NEXT_PUBLIC_FEATURE_DESIGN_BOARDS === "true",
} as const;
