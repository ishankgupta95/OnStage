import type { NextConfig } from "next";

// Allow opting into an isolated build directory via env, so a production build
// can run without overwriting the founder's running `next dev` cache.
// Set ONSTAGE_BUILD_DIST_DIR=.next-isolated before `next build` to use it.
const distDir = process.env.ONSTAGE_BUILD_DIST_DIR;

const nextConfig: NextConfig = {
  ...(distDir ? { distDir } : {}),
};

export default nextConfig;
