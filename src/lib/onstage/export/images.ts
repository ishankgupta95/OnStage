// Client-only helpers for the export pipeline, kept framework-agnostic so the
// render engine in renderSet stays readable.

/** Load a source image for off-screen rendering; null rather than throwing, so
 *  one broken file can't abort a whole batch. */
export function loadExportImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new window.Image();
    if (/^https?:/i.test(src)) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
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
