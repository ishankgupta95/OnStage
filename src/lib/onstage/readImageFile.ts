import { getBackend } from "@/lib/data/backend";
import { toImageRef } from "@/lib/data/imageRefs";

/** The image types every browser can decode and the export can draw. */
const TYPES = ["image/png", "image/jpeg", "image/webp"];
/** The largest screenshot taken, in bytes. */
export const MAX_BYTES = 20 * 1024 * 1024;
/** The shortest side a screenshot may have: below it, even the smallest
 *  store size would draw it blown up. */
export const MIN_SIDE = 600;

/** A screenshot's pixel size, or a rejection if it can't be decoded. */
export type MeasureImage = (file: Blob) => Promise<{ w: number; h: number }>;

/** Decode the file (never re-encoded or stored this way) to read its size. */
export const measureImage: MeasureImage = async (file) => {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file);
    const size = { w: bitmap.width, h: bitmap.height };
    bitmap.close();
    return size;
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("undecodable"));
      img.src = url;
    });
    return { w: img.naturalWidth, h: img.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
};

/** Why a file isn't taken, or null when it is. */
async function problemWith(file: File, measure: MeasureImage): Promise<string | null> {
  if (!TYPES.includes(file.type)) return "isn't a PNG, JPEG or WebP";
  if (file.size > MAX_BYTES) return `is over ${MAX_BYTES / 1024 / 1024} MB`;
  let size: { w: number; h: number };
  try {
    size = await measure(file);
  } catch {
    return "couldn't be read as an image";
  }
  if (Math.min(size.w, size.h) < MIN_SIDE) {
    return `is ${size.w} × ${size.h} — screenshots need at least ${MIN_SIDE} px on the short side`;
  }
  return null;
}

export type ReadResult = {
  /** One per file taken, in order: its `img:` ref, or why storing it failed. */
  stored: { name: string; result: string | Error }[];
  /** Files turned away before anything was stored, and why. */
  rejected: { name: string; reason: string }[];
  /** Good files past `limit`, not stored. */
  overflow: number;
};

/**
 * Check dropped screenshots (type, size, that they decode, minimum size —
 * SCREENSB-9), then store the good ones as they are — the File is the Blob,
 * no re-encode and no downscaling — at most `limit` of them. A rejected file
 * is never stored, so it can leave nothing behind; a file whose store fails
 * comes back as an Error in its slot, so the others still land.
 */
export async function readImageFiles(
  files: FileList | File[],
  /** Store at most this many — a single-image target never stores extras. */
  limit = Infinity,
  measure: MeasureImage = measureImage,
): Promise<ReadResult> {
  const all = Array.from(files);
  const problems = await Promise.all(all.map((f) => problemWith(f, measure)));
  const good = all.filter((_, i) => problems[i] === null);
  const rejected = all.flatMap((f, i) => (problems[i] ? [{ name: f.name, reason: problems[i]! }] : []));
  // Store up to `limit` of them. A file whose store fails doesn't use up a
  // place: the next good file is tried in its stead.
  const stored: ReadResult["stored"] = [];
  let next = 0;
  let landed = 0;
  while (landed < limit && next < good.length) {
    const batch = good.slice(next, next + (limit - landed));
    next += batch.length;
    const results = await Promise.allSettled(batch.map((file) => getBackend().putImage(file)));
    results.forEach((r, i) => {
      const result =
        r.status === "fulfilled"
          ? toImageRef(r.value)
          : r.reason instanceof Error
            ? r.reason
            : new Error("Couldn't store the screenshot.");
      if (typeof result === "string") landed++;
      stored.push({ name: batch[i].name, result });
    });
  }
  return { stored, rejected, overflow: Math.max(0, good.length - next) };
}
