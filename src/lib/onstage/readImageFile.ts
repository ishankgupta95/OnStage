import { getBackend } from "@/lib/data/backend";
import { toImageRef } from "@/lib/data/imageRefs";

/**
 * Store dropped screenshots as they are — the File is the Blob, no re-encode
 * and no downscaling — and return one `img:<id>` ref per image, in order.
 * A file that couldn't be stored comes back as an Error in its slot, so the
 * others still land on the frames they were aimed at.
 */
export async function readImageFiles(
  files: FileList | File[],
  /** Store at most this many — a single-image target never stores extras. */
  limit = Infinity,
): Promise<(string | Error)[]> {
  const images = Array.from(files)
    .filter((f) => f.type.startsWith("image/"))
    .slice(0, limit);
  const stored = await Promise.allSettled(images.map((file) => getBackend().putImage(file)));
  return stored.map((r) =>
    r.status === "fulfilled"
      ? toImageRef(r.value)
      : r.reason instanceof Error
        ? r.reason
        : new Error("Couldn't store the screenshot."),
  );
}
