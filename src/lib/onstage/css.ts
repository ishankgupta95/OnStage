import type { CSSProperties } from "react";

/**
 * Parse a CSS declaration string into a React style object.
 *
 * The mockups express every rule as a `style="…"` string, and the exact pixel
 * values are the spec. Keeping them as strings — rather than hand-translating
 * hundreds of them to camelCase — is what keeps this implementation honest
 * against the design file.
 */
export function s(css: string): CSSProperties {
  const out: Record<string, string> = {};
  for (const decl of css.split(";")) {
    const i = decl.indexOf(":");
    if (i < 0) continue;
    const prop = decl.slice(0, i).trim();
    const value = decl.slice(i + 1).trim();
    if (!prop || !value) continue;
    out[prop.startsWith("--") ? prop : prop.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())] =
      value;
  }
  return out as CSSProperties;
}
