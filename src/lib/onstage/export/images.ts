// Client-only helpers for the export pipeline, kept framework-agnostic so the
// render engine in renderSet stays readable.

import { getBackend } from "@/lib/data/backend";
import { imageIdFromRef } from "@/lib/data/imageRefs";

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new window.Image();
    if (/^https?:/i.test(src)) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Load a frame's screenshot for off-screen rendering: an `img:<id>` ref is
 *  read from the backend, a legacy `data:` URL loads as-is. Null rather than
 *  throwing, so one broken file can't abort a whole batch. */
export async function loadExportImage(ref: string): Promise<HTMLImageElement | null> {
  const id = imageIdFromRef(ref);
  if (!id) return loadImage(ref);
  const blob = await getBackend()
    .getImage(id)
    .catch((e: unknown) => {
      console.warn(`[onstage] couldn't read screenshot ${id} for export`, e);
      return null;
    });
  if (!blob) return null;
  // Once decoded, the image no longer needs its URL; revoking it keeps a big
  // export from pinning every screenshot's bytes twice.
  const url = URL.createObjectURL(blob);
  try {
    return await loadImage(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = "image/png"): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("canvas.toBlob returned null"))), type);
  });
}

/** Decode a produced PNG and read its true pixel dimensions — the gate that
 *  makes "exact dimensions" a checked fact rather than an assumption. */
export function blobDimensions(blob: Blob): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new window.Image();
    img.onload = () => {
      resolve({ w: img.naturalWidth, h: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("failed to decode exported PNG"));
    };
    img.src = url;
  });
}
