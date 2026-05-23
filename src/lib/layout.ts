import type { LayoutPreset } from "@/lib/schema";

export type Box = { x: number; y: number; width: number; height: number };
export type FramePlacement = { box: Box; rotation?: number };
export type LayoutResult = {
  caption: Box | null;
  frames: FramePlacement[];
  captionScaleMul: number;
  captionOnTop: boolean; // draw caption above the frames (overlays)
};

// Given the canvas size, decide where the caption and 1–3 device frames go.
// Each device is fit (preserving aspect) inside its frame box by the renderer.
export function computeLayout(
  layout: LayoutPreset,
  W: number,
  H: number,
): LayoutResult {
  const m = W * 0.085;
  const cw = W - m * 2;
  const box = (x: number, y: number, w: number, h: number): Box => ({ x, y, width: w, height: h });
  const r = (
    caption: Box | null,
    frames: FramePlacement[],
    opts: { captionScaleMul?: number; captionOnTop?: boolean } = {},
  ): LayoutResult => ({
    caption,
    frames,
    captionScaleMul: opts.captionScaleMul ?? 1,
    captionOnTop: opts.captionOnTop ?? false,
  });

  // Landscape (wide) canvas. The device is wide-and-short, so compositions
  // differ from portrait: caption bands span the width, callouts split L/R,
  // and a single device can fill nearly the full height.
  if (W > H) {
    switch (layout) {
      case "text-below":
        return r(box(m, H * 0.84, cw, H * 0.12), [{ box: box(W * 0.08, H * 0.04, W * 0.84, H * 0.74) }]);
      case "text-overlay-top":
        return r(box(m, H * 0.05, cw, H * 0.18), [{ box: box(W * 0.06, H * 0.08, W * 0.88, H * 0.9) }], { captionOnTop: true });
      case "headline-over":
        return r(box(W * 0.06, H * 0.08, W * 0.5, H * 0.34), [{ box: box(W * 0.22, H * 0.16, W * 0.76, H * 0.8) }], { captionOnTop: true, captionScaleMul: 1.1 });
      case "callout-left":
        return r(box(W * 0.05, H * 0.27, W * 0.36, H * 0.46), [{ box: box(W * 0.42, H * 0.08, W * 0.56, H * 0.84) }]);
      case "callout-right":
        return r(box(W * 0.59, H * 0.27, W * 0.36, H * 0.46), [{ box: box(W * 0.02, H * 0.08, W * 0.56, H * 0.84) }]);
      case "feature-list":
        return r(box(W * 0.05, H * 0.15, W * 0.36, H * 0.7), [{ box: box(W * 0.42, H * 0.08, W * 0.56, H * 0.84) }]);
      case "quote-above":
        return r(box(m, H * 0.06, cw, H * 0.2), [{ box: box(W * 0.1, H * 0.32, W * 0.8, H * 0.64) }]);
      case "side-by-side":
        return r(box(m, H * 0.04, cw, H * 0.1), [
          { box: box(W * 0.02, H * 0.15, W * 0.48, H * 0.82) },
          { box: box(W * 0.5, H * 0.15, W * 0.48, H * 0.82) },
        ]);
      case "staggered":
        return r(box(m, H * 0.04, cw, H * 0.1), [
          { box: box(W * 0.0, H * 0.08, W * 0.56, H * 0.6) },
          { box: box(W * 0.44, H * 0.34, W * 0.56, H * 0.6) },
        ]);
      case "overlap":
        return r(box(m, H * 0.04, cw, H * 0.1), [
          { box: box(W * 0.03, H * 0.1, W * 0.52, H * 0.58) },
          { box: box(W * 0.4, H * 0.28, W * 0.57, H * 0.64) },
        ]);
      case "triptych":
        return r(box(m, H * 0.04, cw, H * 0.09), [
          { box: box(W * 0.0, H * 0.34, W * 0.33, H * 0.44) },
          { box: box(W * 0.335, H * 0.22, W * 0.33, H * 0.56) },
          { box: box(W * 0.67, H * 0.34, W * 0.33, H * 0.44) },
        ]);
      case "angled-frame":
        return r(box(m, H * 0.05, cw, H * 0.13), [{ box: box(W * 0.12, H * 0.16, W * 0.76, H * 0.78), rotation: -7 }]);
      case "stat-callout":
        return r(box(W * 0.05, H * 0.22, W * 0.4, H * 0.5), [{ box: box(W * 0.46, H * 0.12, W * 0.52, H * 0.78) }], { captionScaleMul: 1.4 });
      case "logo-tagline":
        return r(box(m, H * 0.06, cw, H * 0.15), [{ box: box(W * 0.1, H * 0.26, W * 0.8, H * 0.7) }]);
      case "panoramic":
        return r(box(m, H * 0.85, cw, H * 0.12), [{ box: box(W * 0.02, H * 0.06, W * 0.96, H * 0.74) }], { captionOnTop: true });
      case "photo-inset":
        return r(box(m, H * 0.82, cw, H * 0.14), [{ box: box(W * 0.24, H * 0.1, W * 0.52, H * 0.66) }], { captionOnTop: true });
      case "full-bleed":
        return r(null, [{ box: box(W * 0.0, H * 0.0, W * 1.0, H * 1.0) }]);
      case "frame-bleed":
        return r(box(m, H * 0.05, cw, H * 0.14), [{ box: box(W * 0.1, H * 0.34, W * 0.8, H * 0.95) }]);
      case "freeform":
        return r(null, [{ box: box(W * 0.2, H * 0.2, W * 0.6, H * 0.6) }]);
      case "text-above":
      default:
        return r(box(m, H * 0.04, cw, H * 0.13), [{ box: box(W * 0.08, H * 0.2, W * 0.84, H * 0.76) }]);
    }
  }

  switch (layout) {
    // Frame dominates the lower ~84%; small caption pinned to the top edge.
    case "text-below":
      return r(box(m, H * 0.87, cw, H * 0.11), [{ box: box(W * 0.04, H * 0.02, W * 0.92, H * 0.83) }]);
    case "text-overlay-top":
      return r(box(m, H * 0.05, cw, H * 0.16), [{ box: box(W * 0.06, H * 0.1, W * 0.88, H * 0.88) }], { captionOnTop: true });
    // Big headline floating over the upper third of a large frame.
    case "headline-over":
      return r(box(W * 0.07, H * 0.06, W * 0.86, H * 0.24), [{ box: box(W * 0.08, H * 0.22, W * 0.84, H * 0.76) }], { captionOnTop: true, captionScaleMul: 1.1 });
    case "callout-left":
      return r(box(W * 0.05, H * 0.3, W * 0.42, H * 0.44), [{ box: box(W * 0.4, H * 0.09, W * 0.6, H * 0.85) }]);
    case "callout-right":
      return r(box(W * 0.53, H * 0.3, W * 0.42, H * 0.44), [{ box: box(W * 0.0, H * 0.09, W * 0.6, H * 0.85) }]);
    case "feature-list":
      return r(box(W * 0.05, H * 0.16, W * 0.42, H * 0.66), [{ box: box(W * 0.44, H * 0.1, W * 0.56, H * 0.84) }]);
    case "quote-above":
      return r(box(m, H * 0.06, cw, H * 0.17), [{ box: box(W * 0.06, H * 0.26, W * 0.88, H * 0.7) }]);
    case "side-by-side":
      return r(box(m, H * 0.045, cw, H * 0.1), [
        { box: box(W * 0.01, H * 0.17, W * 0.49, H * 0.78) },
        { box: box(W * 0.5, H * 0.17, W * 0.49, H * 0.78) },
      ]);
    // Two screens offset diagonally for depth; shadows read as layering.
    case "staggered":
      return r(box(m, H * 0.05, cw, H * 0.1), [
        { box: box(W * -0.04, H * 0.14, W * 0.58, H * 0.66) },
        { box: box(W * 0.46, H * 0.3, W * 0.58, H * 0.66) },
      ]);
    // Heavy two-up overlap: smaller screen behind, larger one forward.
    case "overlap":
      return r(box(m, H * 0.05, cw, H * 0.1), [
        { box: box(W * 0.02, H * 0.12, W * 0.56, H * 0.6) },
        { box: box(W * 0.38, H * 0.26, W * 0.62, H * 0.68) },
      ]);
    case "triptych":
      return r(box(m, H * 0.05, cw, H * 0.09), [
        { box: box(W * 0.0, H * 0.3, W * 0.34, H * 0.5) },
        { box: box(W * 0.32, H * 0.2, W * 0.36, H * 0.6) },
        { box: box(W * 0.66, H * 0.3, W * 0.34, H * 0.5) },
      ]);
    // Slight tilt + the frame's own drop shadow read as a 3D, lifted device.
    case "angled-frame":
      return r(box(m, H * 0.055, cw, H * 0.13), [{ box: box(W * 0.12, H * 0.2, W * 0.76, H * 0.78), rotation: -9 }]);
    case "stat-callout":
      return r(box(W * 0.06, H * 0.1, W * 0.52, H * 0.42), [{ box: box(W * 0.46, H * 0.16, W * 0.56, H * 0.8) }], { captionScaleMul: 1.4 });
    case "logo-tagline":
      return r(box(m, H * 0.07, cw, H * 0.13), [{ box: box(W * 0.08, H * 0.22, W * 0.84, H * 0.76) }]);
    case "panoramic":
      return r(box(m, H * 0.85, cw, H * 0.12), [{ box: box(W * 0.02, H * 0.06, W * 0.96, H * 0.76) }], { captionOnTop: true });
    case "photo-inset":
      return r(box(m, H * 0.82, cw, H * 0.14), [{ box: box(W * 0.2, H * 0.12, W * 0.6, H * 0.66) }], { captionOnTop: true });
    // Hero: device fills the canvas edge-to-edge, no caption.
    case "full-bleed":
      return r(null, [{ box: box(W * 0.0, H * 0.0, W * 1.0, H * 0.98) }]);
    // Device runs off the bottom edge (box centre sits low, so fitFrame pushes
    // the frame down and the canvas crops the bottom). Caption above.
    case "frame-bleed":
      return r(box(m, H * 0.05, cw, H * 0.14), [{ box: box(W * 0.08, H * 0.3, W * 0.84, H * 0.95) }]);
    // Freeform: rendered from doc.frameTransform, not this box. The single box
    // here only drives the "1 screenshot slot" count in the sidebar.
    case "freeform":
      return r(null, [{ box: box(W * 0.2, H * 0.19, W * 0.6, H * 0.62) }]);
    case "text-above":
    default:
      return r(box(m, H * 0.045, cw, H * 0.12), [{ box: box(W * 0.04, H * 0.15, W * 0.92, H * 0.83) }]);
  }
}

// Fit a frame of the given aspect (w/h) into box, preserving aspect, centered.
export function fitFrame(b: Box, aspect: number): Box {
  let fw = b.width;
  let fh = fw / aspect;
  if (fh > b.height) {
    fh = b.height;
    fw = fh * aspect;
  }
  return { x: b.x + (b.width - fw) / 2, y: b.y + (b.height - fh) / 2, width: fw, height: fh };
}
