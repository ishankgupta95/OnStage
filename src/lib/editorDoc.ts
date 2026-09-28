import type { DeviceFrame, LayoutPreset, Font } from "@/lib/schema";
import { deviceClassOf, type DeviceClass } from "@/lib/deviceGeometry";

export type BackgroundChoice =
  | { kind: "gradient"; id: string }
  | { kind: "palette"; id: string }
  | { kind: "solid"; color: string }
  | { kind: "mesh"; id: string }
  | { kind: "pattern"; id: string }
  // A two-colour gradient picked by the user (angle in degrees, like GRADIENTS).
  | { kind: "custom-gradient"; from: string; to: string; angle: number }
  // A picture filling the canvas (cover), stored as a data URL like screenshots.
  | { kind: "image"; src: string };

export const CUSTOM_GRADIENT_ANGLE = 160;

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
  // The caption in other store languages (locale code → text); `content` is the
  // default language. See src/lib/locales.ts.
  translations?: Record<string, string>;
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

// Bounds for the preset-layout device-size multiplier (frameScale). 1 = the
// device fitted exactly to the layout's computed frame box.
export const FRAME_SCALE_MIN = 0.4;
export const FRAME_SCALE_MAX = 2.0;

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

// ── Multi-device freeform ───────────────────────────────────────────────────
// A freeform canvas can hold N independent devices, each with its own model,
// orientation, screenshot, placement (master space, like the legacy single
// freeform) and crop. doc.freeformFrames holds them; when absent, the doc is a
// legacy single-device freeform and resolveFreeformFrames synthesizes one frame.
export type FreeformFrameSpec = {
  id: string;
  device: DeviceFrame;
  // Per-frame orientation (upright/sideways); absent = follow the canvas.
  deviceOrientation?: Orientation;
  // The frame's screenshot src (resolved to an HTMLImageElement via the shared
  // src→image map at render time), or null for an empty device.
  src: string | null;
  x: number;
  y: number;
  width: number;
  rotation: number;
  // Per-frame crop (each device frames its own image). Absent = cover, no pan.
  adjust?: FrameAdjust;
  // Per-frame 3D angle. undefined = inherit doc.perspective; null = force flat;
  // a value = override. (Freeform devices are independent, so each can differ.)
  perspective?: DevicePerspective | null;
};

export function makeFreeformFrameId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `ff_${Math.random().toString(36).slice(2)}`;
}

// Selection ids for freeform devices are namespaced "freeform:<id>" so the single
// selectedLayerId slot can address any device alongside text/image layers and the
// preset FRAME_SELECTION_ID sentinel.
export const FREEFORM_SEL_PREFIX = "freeform:";
export function freeformSelId(id: string): string {
  return FREEFORM_SEL_PREFIX + id;
}
export function parseFreeformSel(sel: string | null | undefined): string | null {
  return sel && sel.startsWith(FREEFORM_SEL_PREFIX) ? sel.slice(FREEFORM_SEL_PREFIX.length) : null;
}

// Resolve the crop for a class + slot, tolerating the legacy flat-array shape
// (older docs stored a single global array) and falling back to slot 0/default.
export function frameAdjustFor(doc: EditorDoc, cls: DeviceClass, index: number): FrameAdjust {
  const fa = doc.frameAdjust as FrameAdjustByClass | (FrameAdjust | null)[] | undefined;
  const arr = Array.isArray(fa) ? fa : fa?.[cls];
  return arr?.[index] ?? arr?.[0] ?? DEFAULT_FRAME_ADJUST;
}

// Resolve a frame slot's device-size multiplier: per-slot value, else the legacy
// shared `frameScale`, else 1 (exact fit to the layout's computed box).
export function frameScaleAt(doc: EditorDoc, index: number): number {
  return doc.frameScales?.[index] ?? doc.frameScale ?? 1;
}

// Resolve a frame slot's USER rotation (degrees), added on top of the layout's
// own built-in tilt (computeLayout's fp.rotation). Absent = 0 (no extra tilt).
export function frameRotationAt(doc: EditorDoc, index: number): number {
  return doc.frameRotations?.[index] ?? 0;
}

// Resolve a frame slot's device orientation (upright vs sideways), independent of
// the canvas. Per-slot override first, then the screenshot-wide `deviceOrientation`
// (back-compat: pre-per-slot docs render unchanged), then the canvas orientation.
export function frameDeviceOrientationAt(doc: EditorDoc, index: number): Orientation {
  return doc.frameDeviceOrientations?.[index] ?? doc.deviceOrientation ?? doc.orientation ?? "portrait";
}

// Normalize a rotation to (-180, 180] so per-slot rotations stay tidy and the
// "reset" (0) reads as upright relative to the layout tilt.
export function normalizeAngle(deg: number): number {
  const r = ((deg % 360) + 360) % 360;
  return r > 180 ? r - 360 : r;
}

// The authoritative freeform device list. If freeformFrames is set (even empty),
// use it verbatim. Otherwise SYNTHESIZE a single device from the legacy fields
// (frameTransform + frameImages[0] + device + orientation + slot-0 crop) so old
// freeform docs render byte-identically and migrate to the array on first edit.
export function resolveFreeformFrames(doc: EditorDoc): FreeformFrameSpec[] {
  if (doc.freeformFrames) return doc.freeformFrames;
  const ft = doc.frameTransform ?? DEFAULT_FRAME_TRANSFORM;
  return [
    {
      id: "freeform-0",
      device: doc.device,
      deviceOrientation: doc.deviceOrientation,
      src: doc.frameImages?.[0] ?? null,
      x: ft.x,
      y: ft.y,
      width: ft.width,
      rotation: ft.rotation,
      adjust: frameAdjustFor(doc, deviceClassOf(doc.device), 0),
    },
  ];
}

// ── 3D device perspective ────────────────────────────────────────────────────
// The angled-mockup view. yaw rotates about the vertical axis (NEGATIVE shows the
// right rail + side button, matching the hero reference); pitch about horizontal.
// Absent on the doc = the flat front-on frame (current behavior, back-compatible).
export type DevicePerspective = { yaw: number; pitch: number };

export const PERSPECTIVE_PRESETS: { id: string; label: string; value: DevicePerspective | null }[] = [
  { id: "flat", label: "Flat", value: null },
  { id: "right", label: "Angle right", value: { yaw: -26, pitch: -6 } },
  { id: "left", label: "Angle left", value: { yaw: 26, pitch: -6 } },
  { id: "subtle", label: "Subtle tilt", value: { yaw: -15, pitch: -4 } },
];

// Map a stored perspective back to a preset id for the UI; "flat" when absent.
export function perspectivePresetId(p: DevicePerspective | undefined): string {
  if (!p) return "flat";
  return (
    PERSPECTIVE_PRESETS.find((x) => x.value && x.value.yaw === p.yaw && x.value.pitch === p.pitch)?.id ??
    "custom"
  );
}

// Resolve a PRESET slot's effective angle: per-slot override first (null = force
// flat), then the screenshot-wide doc.perspective. Mirrors frameRotationAt.
export function framePerspectiveAt(doc: EditorDoc, index: number): DevicePerspective | undefined {
  const v = doc.framePerspectives?.[index];
  if (v !== undefined) return v ?? undefined;
  return doc.perspective;
}

// True if ANY device frame in the doc renders in 3D — used to lazy-load the
// Three.js chunk only when needed (editor) and to preload it before export.
export function docUses3D(doc: EditorDoc): boolean {
  if (doc.perspective) return true;
  if (doc.framePerspectives && Object.values(doc.framePerspectives).some((p) => p)) return true;
  if (doc.freeformFrames?.some((f) => f.perspective)) return true;
  return false;
}

// Pragmatic editor working state for Phase 2. Maps to the Zod ScreenshotConfig
// at save time (Phase 3).
export type EditorDoc = {
  device: DeviceFrame;
  layout: LayoutPreset;
  // Canvas orientation (= export dimensions); absent = portrait (back-compat).
  orientation?: Orientation;
  // Device rotation, INDEPENDENT of the canvas: "portrait" = upright phone,
  // "landscape" = laid on its side. Absent = follows the canvas orientation, so
  // pre-existing docs render unchanged. Lets you put an upright phone in a wide
  // canvas (and vice-versa).
  deviceOrientation?: Orientation;
  background: BackgroundChoice;
  // One screenshot per frame slot; slots fall back to index 0 when unset.
  frameImages: (string | null)[];
  // Per-class, per-slot framing; absent entries fall back to DEFAULT_FRAME_ADJUST.
  frameAdjust?: FrameAdjustByClass;
  // Freeform device placement (LEGACY single device); only used when
  // layout === "freeform" AND freeformFrames is absent. See resolveFreeformFrames.
  frameTransform?: FrameTransform;
  // Multi-device freeform canvas. Absent = legacy single-device freeform
  // (synthesized by resolveFreeformFrames from frameTransform + frameImages[0]).
  // Present (even empty) = the authoritative device list for freeform.
  freeformFrames?: FreeformFrameSpec[];
  // Device-size multiplier over the layout's computed frame box, for PRESET
  // layouts (freeform uses frameTransform.width). Absent = 1 (exact fit).
  // Legacy shared value; per-slot `frameScales` takes precedence (see frameScaleAt).
  frameScale?: number;
  // Per-frame-slot device-size multipliers (multi-frame layouts resize each
  // device independently). Falls back to `frameScale` then 1.
  frameScales?: number[];
  // Per-frame-slot USER rotation in degrees, composed ON TOP of the layout's own
  // tilt (computeLayout's fp.rotation). Absent/0 = just the layout tilt.
  frameRotations?: number[];
  // Per-frame-slot device orientation (upright vs sideways), independent of the
  // canvas. Falls back to the screenshot-wide `deviceOrientation` then `orientation`
  // (so pre-per-slot docs render unchanged). See frameDeviceOrientationAt.
  frameDeviceOrientations?: Orientation[];
  // Free-floating images (logos/badges/art), placeable in any layout.
  imageLayers?: ImageLayer[];
  // 3D-angled device view applied to every device frame in this screenshot.
  // Absent = flat front-on (back-compat). See DevicePerspective / PERSPECTIVE_PRESETS.
  perspective?: DevicePerspective;
  // Per-PRESET-slot angle override, keyed by slot index (a Record, not an array:
  // JSON turns array holes into null, which would corrupt "inherit"). Value null
  // = force flat, a value = override, absent key = inherit `perspective`. See
  // framePerspectiveAt. (Freeform devices carry their own `perspective` instead.)
  framePerspectives?: Record<string, DevicePerspective | null>;
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
  device: "iphone-17-pro",
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
