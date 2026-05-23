// Client-only helpers for the export pipeline. Kept framework-agnostic so the
// render/harvest engine in ExportController stays readable.

// Load a source image for off-screen rendering. Remote (Storage) images need
// CORS so the export canvas stays untainted; resolves null on failure so one
// broken image can't abort the whole batch (the frame falls back to its
// "Drop a screenshot" placeholder).
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

// Decode the produced PNG and read its true pixel dimensions. This is the
// exact-dimensions gate: Apple rejects off-by-one, so we verify the encoded
// output rather than trusting the source canvas size.
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
