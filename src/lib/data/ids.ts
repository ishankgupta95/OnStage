/**
 * A v4 UUID for a new record. `crypto.randomUUID` needs a secure context;
 * fall back to `getRandomValues`, which doesn't, so a LAN-served build still
 * works. Never time-based: two records made in the same millisecond must not
 * share an id (and overwrite each other).
 */
export function randomId(): string {
  const c = globalThis.crypto;
  if (typeof c?.randomUUID === "function") return c.randomUUID();
  const b = c.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
