import type { NextConfig } from "next";

// Allow opting into an isolated build directory via env, so a production build
// can run without overwriting the founder's running `next dev` cache.
// Set ONSTAGE_BUILD_DIST_DIR=.next-isolated before `next build` to use it.
const distDir = process.env.ONSTAGE_BUILD_DIST_DIR;

// Static portfolio export (GitHub Pages). Opt-in via env so local `next dev`
// and ordinary builds behave normally — only the Pages CI build turns it on
// (NEXT_PUBLIC_STATIC_EXPORT=true NEXT_PUBLIC_BASE_PATH=/OnStage). Under export
// there is no server: no server actions/route handlers/middleware (the app
// runs entirely client-side; see src/lib/localData.ts).
const isExport = process.env.NEXT_PUBLIC_STATIC_EXPORT === "true";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "/OnStage";

const nextConfig: NextConfig = {
  ...(distDir ? { distDir } : {}),
  // next/image's default optimizer needs a server; static export can't use it.
  images: { unoptimized: true },
  ...(isExport
    ? {
        output: "export",
        // Served from a GitHub project page (/<repo>), so assets + links must be
        // prefixed. <Link>/router prepend this automatically; raw window.* nav
        // uses withBase() from src/lib/routes.ts.
        basePath,
        assetPrefix: basePath,
        // Emit /editor/index.html (served at /editor/) so GitHub Pages resolves
        // folder routes without per-file rewrites.
        trailingSlash: true,
      }
    : {}),
};

export default nextConfig;
