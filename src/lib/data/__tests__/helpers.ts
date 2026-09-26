import { closeImageStore } from "../imageStore";
import type { SetDoc, SetFrame } from "../types";

/** Close the cached connection and delete the `onstage` database. */
export async function resetImageDb(): Promise<void> {
  await closeImageStore();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase("onstage");
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("deleteDatabase blocked"));
  });
}

/** A small, valid-looking PNG payload as a base64 data URL (bytes vary by seed). */
export function pngDataUrl(seed: number, length = 64): string {
  const bytes = new Uint8Array(length);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  for (let i = 8; i < length; i++) bytes[i] = (seed * 31 + i * 7) & 0xff;
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return `data:image/png;base64,${btoa(bin)}`;
}

export const frame = (over: Partial<SetFrame> = {}): SetFrame => ({
  caption: "Caption",
  bg: "ember",
  tiltX: 0,
  tiltY: 0,
  depth: 0,
  scale: 1,
  screenshot: null,
  ...over,
});

export const doc = (frames: SetFrame[], over: Partial<SetDoc> = {}): SetDoc => ({
  frames,
  device: "ip16pm",
  frameColor: "graphite",
  captionFont: "Inter",
  align: "center",
  captionSize: 44,
  panorama: false,
  shadow: true,
  lang: "EN",
  store: "apple",
  ...over,
});

export async function blobBytes(blob: Blob): Promise<number[]> {
  return Array.from(new Uint8Array(await blob.arrayBuffer()));
}
