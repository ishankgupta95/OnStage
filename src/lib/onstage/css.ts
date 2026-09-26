import type { CSSProperties } from "react";

/**
 * The declarations of a CSS string: split on the `;`s that end one — never
 * one inside parentheses (`url(data:image/png;base64,…)`) or quotes
 * (`content:";"`). A string ends at its closing quote or, as in CSS, at a
 * newline; a quote left open (a stray apostrophe in an interpolated value)
 * is no string at all, so it can't swallow the declarations after it.
 */
function declarations(css: string, quotes = true): string[] {
  const out: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let start = 0;
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (quote) {
      if (c === "\\") i++; // an escaped character, the quote included
      else if (c === quote || c === "\n") quote = null;
    } else if (quotes && (c === '"' || c === "'")) quote = c;
    else if (c === "(") depth++;
    else if (c === ")") depth = Math.max(0, depth - 1);
    else if (c === ";" && depth === 0) {
      out.push(css.slice(start, i));
      start = i + 1;
    }
  }
  if (quote) return declarations(css, false);
  out.push(css.slice(start));
  return out;
}

/** A CSS property as React names it: camelCase, `-webkit-x` → `WebkitX`,
 *  `-ms-x` → `msX` (React's one lower-case vendor prefix), custom properties
 *  as written. */
function reactName(prop: string): string {
  if (prop.startsWith("--")) return prop;
  const bare = prop.startsWith("-ms-") ? prop.slice(1) : prop;
  return bare.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

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
  for (const decl of declarations(css)) {
    const i = decl.indexOf(":");
    if (i < 0) continue;
    const prop = decl.slice(0, i).trim();
    const value = decl.slice(i + 1).trim();
    if (!prop || !value) continue;
    out[reactName(prop)] = value;
  }
  return out as CSSProperties;
}
