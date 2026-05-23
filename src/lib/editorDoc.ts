import type { DeviceFrame, LayoutPreset, Font } from "@/lib/schema";
import type { DeviceClass } from "@/lib/deviceGeometry";

export type BackgroundChoice =
  | { kind: "gradient"; id: string }
  | { kind: "palette"; id: string }
  | { kind: "solid"; color: string };

// Canvas orientation. The master design space (where text/frame/image coords
// live) transposes between the two: portrait is 1290×2796, landscape 2796×1290.
export type Orientation = "portrait" | "landscape";

export const MASTER: Record<Orientation, { w: number; h: number }> = {
  portrait: { w: 1290, h: 2796 },
  landscape: { w: 2796, h: 1290 },
};

export function masterDimsFor(orientation: Orientation | undefined) {
  return MASTER[orientation ?? "portrait"];
}

export type CaptionWeight = "400" | "500" | "600" | "700" | "800";
export type CaptionAlign = "left" | "center" | "right";

// A free-form text element positioned in canvas (1290×2796) coordinates.
export type TextLayer = {
  id: string;
  content: string;
  x: number;
  y: number;
  width: number;
  size: number;
  font: Font;
  weight: CaptionWeight;
  align: CaptionAlign;
  color: string;
  letterSpacing: number;
  lineHeight: number;
};

// How a source screenshot sits inside a device's screen.
// - fit: "cover" fills the screen (crops); "contain" shows the whole image.
// - scale: zoom multiplier on top of the base fit (1 = base).
// - offsetX/offsetY: pan as a fraction (-1..1) of the available overflow, so the
//   same adjustment applies proportionally at every export size.
export type FrameFit = "cover" | "contain";
export type FrameAdjust = { fit: FrameFit; scale: number; offsetX: number; offsetY: number };

export const DEFAULT_FRAME_ADJUST: FrameAdjust = { fit: "cover", scale: 1, offsetX: 0, offsetY: 0 };

// Crop is stored per device class (iPhone / iPad / Android phone / tablet), each
// with one entry per frame slot, so a family's crop is independent of the others.
export type FrameAdjustByClass = Partial<Record<DeviceClass, (FrameAdjust | null)[]>>;

// Freeform placement of the device frame, authored in 1290×2796 master space
// (like text layers). x/y is the frame's top-left, width its rendered width
// (height derives from the device aspect), rotation in degrees. Other preview
// sizes scale this uniformly by W/1290 — same model as text.
export type FrameTransform = { x: number; y: number; width: number; rotation: number };

export const DEFAULT_FRAME_TRANSFORM: FrameTransform = { x: 265, y: 540, width: 760, rotation: 0 };

// The freeform placement seeded the first time freeform is chosen, sized for the
// orientation (the portrait default transposed into the landscape master).
export function defaultFrameTransformFor(orientation: Orientation | undefined): FrameTransform {
  if ((orientation ?? "portrait") === "portrait") return { ...DEFAULT_FRAME_TRANSFORM };
  const o = masterDimsFor("portrait");
  const n = masterDimsFor("landscape");
  return {
    x: Math.round(DEFAULT_FRAME_TRANSFORM.x * (n.w / o.w)),
    y: Math.round(DEFAULT_FRAME_TRANSFORM.y * (n.h / o.h)),
    width: Math.round(DEFAULT_FRAME_TRANSFORM.width * (n.w / o.w)),
    rotation: 0,
  };
}

// A free-floating image (logo, badge, decorative art) the user can place
// anywhere — independent of the device screenshot. Authored in master space and
// scaled by W/1290 like text/frame; width+height keep the image's own aspect.
export type ImageLayer = {
  id: string;
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
};

export function makeImageLayer(src: string, aspect: number): ImageLayer {
  const width = 460;
  const height = Math.round(width / (aspect > 0 ? aspect : 1));
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `i_${Math.random().toString(36).slice(2)}`,
    src,
    x: Math.round((1290 - width) / 2),
    y: Math.round((2796 - height) / 2),
    width,
    height,
    rotation: 0,
  };
}

// Resolve the crop for a class + slot, tolerating the legacy flat-array shape
// (older docs stored a single global array) and falling back to slot 0/default.
export function frameAdjustFor(doc: EditorDoc, cls: DeviceClass, index: number): FrameAdjust {
  const fa = doc.frameAdjust as FrameAdjustByClass | (FrameAdjust | null)[] | undefined;
  const arr = Array.isArray(fa) ? fa : fa?.[cls];
  return arr?.[index] ?? arr?.[0] ?? DEFAULT_FRAME_ADJUST;
}

// Pragmatic editor working state for Phase 2. Maps to the Zod ScreenshotConfig
// at save time (Phase 3).
export type EditorDoc = {
  device: DeviceFrame;
  layout: LayoutPreset;
  // Canvas orientation; absent = portrait (back-compat with pre-landscape docs).
  orientation?: Orientation;
  background: BackgroundChoice;
  // One screenshot per frame slot; slots fall back to index 0 when unset.
  frameImages: (string | null)[];
  // Per-class, per-slot framing; absent entries fall back to DEFAULT_FRAME_ADJUST.
  frameAdjust?: FrameAdjustByClass;
  // Freeform device placement; only used when layout === "freeform".
  frameTransform?: FrameTransform;
  // Free-floating images (logos/badges/art), placeable in any layout.
  imageLayers?: ImageLayer[];
  textLayers: TextLayer[];
};

export function makeTextLayer(partial: Partial<TextLayer> = {}): TextLayer {
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `t_${Math.random().toString(36).slice(2)}`,
    content: "New text",
    x: 1290 * 0.2,
    y: 2796 * 0.45,
    width: 1290 * 0.6,
    size: 72,
    font: "inter",
    weight: "700",
    align: "center",
    color: "#FFFFFF",
    letterSpacing: 0,
    lineHeight: 1.1,
    ...partial,
  };
}

export const DEFAULT_DOC: EditorDoc = {
  device: "iphone-16-pro",
  layout: "text-above",
  orientation: "portrait",
  background: { kind: "gradient", id: "emerald-fade" },
  frameImages: ["/sample-screen.svg"],
  textLayers: [
    makeTextLayer({
      content: "Your sound,\ncenter stage.",
      x: 110,
      y: 168,
      width: 1070,
      size: 120,
      lineHeight: 1.08,
    }),
  ],
};

export const FONT_FAMILY: Record<Font, string> = {
  inter: "Inter",
  geist: "Geist",
  "cabinet-grotesk": "Cabinet Grotesk",
  fraunces: "Fraunces",
  "jetbrains-mono": "JetBrains Mono",
  "plus-jakarta-sans": "Plus Jakarta Sans",
};

export const FONT_LABEL: Record<Font, string> = {
  inter: "Inter",
  geist: "Geist",
  "cabinet-grotesk": "Cabinet Grotesk",
  fraunces: "Fraunces",
  "jetbrains-mono": "JetBrains Mono",
  "plus-jakarta-sans": "Plus Jakarta Sans",
};

export const CAPTION_WEIGHTS: { value: CaptionWeight; label: string }[] = [
  { value: "400", label: "Regular" },
  { value: "600", label: "Medium" },
  { value: "700", label: "Bold" },
  { value: "800", label: "Black" },
];

export const CAPTION_COLORS = ["#FFFFFF", "#0A0A0A", "#0F5132", "#FACC15"];
