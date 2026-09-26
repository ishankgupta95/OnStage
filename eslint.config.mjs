import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".next-*/**", // isolated build dirs (ONSTAGE_BUILD_DIST_DIR)
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Design handoff bundle from claude.ai/design — read-only reference, not
    // app source. It ships its own prototype runtime (support.js).
    "app-screenshot-generator-ui-mockups/**",
  ]),
]);

export default eslintConfig;
