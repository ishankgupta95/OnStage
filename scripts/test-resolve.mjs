// Test-only module resolution for `node --test` (see the "test" script): maps
// the tsconfig "@/…" alias to src/ and resolves extensionless imports to .ts,
// so the app's TypeScript modules run under Node's built-in type stripping.
// Anything else (node_modules, CommonJS requires) resolves normally.
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SRC = new URL("../src/", import.meta.url);

registerHooks({
  resolve(specifier, context, nextResolve) {
    const aliased = specifier.startsWith("@/");
    if ((aliased || specifier.startsWith(".")) && context.parentURL?.startsWith(SRC.href)) {
      const url = aliased ? new URL(specifier.slice(2), SRC) : new URL(specifier, context.parentURL);
      if (!/\.[cm]?[jt]sx?$/.test(url.pathname)) {
        for (const ext of [".ts", "/index.ts"]) {
          const candidate = new URL(url.href + ext);
          if (existsSync(fileURLToPath(candidate))) return nextResolve(candidate.href, context);
        }
      }
      if (aliased) return nextResolve(url.href, context);
    }
    return nextResolve(specifier, context);
  },
});
