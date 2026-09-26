import type { SetDoc, SetFrame } from "./types";

/**
 * How a set document points at its screenshots. The bytes live in the image
 * store (IndexedDB locally); a frame holds only a short `img:<id>` ref, so the
 * document itself stays a few KB. Older documents may still carry `data:`
 * URLs until the boot migration converts them — both forms render.
 */

export const IMAGE_REF_PREFIX = "img:";

export const toImageRef = (id: string): string => `${IMAGE_REF_PREFIX}${id}`;

/** The image-store id behind a ref, or null for anything that isn't `img:`
 *  (including a value of the wrong type in a damaged document). */
export function imageIdFromRef(ref: unknown): string | null {
  if (typeof ref !== "string" || !ref.startsWith(IMAGE_REF_PREFIX)) return null;
  const id = ref.slice(IMAGE_REF_PREFIX.length);
  return id || null;
}

/**
 * Every frame field that holds an image ref. The migration converts these and
 * the reference scan in `deleteSet` reads them; a new ref field (tablet
 * screenshot, second screenshot) is added here in the same change.
 */
export const FRAME_IMAGE_FIELDS = ["screenshot"] as const satisfies readonly (keyof SetFrame)[];

/** Every image-store id a document references through its ref fields.
 *  A damaged document (frames not a list) references nothing this can see. */
export function docImageIds(doc: Pick<SetDoc, "frames"> | null | undefined): Set<string> {
  const ids = new Set<string>();
  const frames: unknown = doc?.frames;
  if (!Array.isArray(frames)) return ids;
  for (const frame of frames as (Partial<SetFrame> | null)[]) {
    for (const field of FRAME_IMAGE_FIELDS) {
      const id = imageIdFromRef(frame?.[field]);
      if (id) ids.add(id);
    }
  }
  return ids;
}

/**
 * Every image id mentioned anywhere in stored JSON — any field, any shape,
 * damaged or not. `deleteSet` keeps whatever this finds in the documents it
 * isn't deleting: over-keeping only leaves a Blob behind, while missing a
 * reference (a field added later, a document it can't parse) would break a
 * set. Ids are random UUIDs, so a match is a reference.
 */
export function imageIdsInJson(json: string): Set<string> {
  const ids = new Set<string>();
  for (const m of json.matchAll(/"img:([^"\\]+)"/g)) ids.add(m[1]);
  return ids;
}
