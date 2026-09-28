import type { DeviceFrame } from "@/lib/schema";
import { DEFAULT_FRAME_ADJUST, type EditorDoc, type FrameAdjustByClass, type Orientation } from "@/lib/editorDoc";
import { DEFAULT_DEVICE_FOR_CLASS, deviceClassOf, type DeviceClass } from "@/lib/deviceGeometry";

// Which store an export size belongs to — drives the top-level export folder.
export type StoreOS = "iOS" | "Android";

export type ExportSize = {
  id: string;
  label: string;
  w: number;
  h: number;
  deviceClass: DeviceClass;
  os: StoreOS;
};

// App Store / Play accept landscape screenshots at the transposed dimensions.
// Orientation is a doc-level property, so we transpose a size on demand.
export function orientSize(size: ExportSize, orientation: Orientation | undefined): ExportSize {
  return orientation === "landscape" ? { ...size, w: size.h, h: size.w } : size;
}

// App Store / Play accepted pixel dimensions — one canonical size per device
// slot each store offers (verified against Apple's "Screenshot specifications"
// and Google Play's preview-asset requirements). deviceClass picks which frame
// family renders this slot; os drives the top-level export folder. Apple accepts
// several pixel pairs per slot but you only need one, and it auto-scales the
// largest down — so we ship the canonical/current dimension for each slot.
export const EXPORT_SIZES: ExportSize[] = [
  // iPhone — Apple App Store
  { id: "iphone-6-9", label: '6.9" iPhone', w: 1320, h: 2868, deviceClass: "iphone", os: "iOS" },
  { id: "iphone-6-5", label: '6.5" iPhone', w: 1284, h: 2778, deviceClass: "iphone", os: "iOS" },
  { id: "iphone-6-3", label: '6.3" iPhone', w: 1179, h: 2556, deviceClass: "iphone", os: "iOS" },
  { id: "iphone-6-1", label: '6.1" iPhone', w: 1170, h: 2532, deviceClass: "iphone", os: "iOS" },
  { id: "iphone-5-5", label: '5.5" iPhone', w: 1242, h: 2208, deviceClass: "iphone", os: "iOS" },
  { id: "iphone-4-7", label: '4.7" iPhone', w: 750, h: 1334, deviceClass: "iphone", os: "iOS" },
  // iPad — Apple App Store
  { id: "ipad-13", label: '13" iPad', w: 2064, h: 2752, deviceClass: "ipad", os: "iOS" },
  { id: "ipad-12-9", label: '12.9" iPad', w: 2048, h: 2732, deviceClass: "ipad", os: "iOS" },
  { id: "ipad-11", label: '11" iPad', w: 1668, h: 2420, deviceClass: "ipad", os: "iOS" },
  { id: "ipad-10-5", label: '10.5" iPad', w: 1668, h: 2224, deviceClass: "ipad", os: "iOS" },
  { id: "ipad-9-7", label: '9.7" iPad', w: 1536, h: 2048, deviceClass: "ipad", os: "iOS" },
  // Google Play
  { id: "play-phone", label: "Play phone", w: 1080, h: 1920, deviceClass: "android-phone", os: "Android" },
  { id: "play-tablet", label: "Play tablet", w: 1200, h: 1920, deviceClass: "android-tablet", os: "Android" },
];

// Designs are authored against the largest iPhone canvas.
export const PRIMARY_SIZE = EXPORT_SIZES[0];

export function sizeById(id: string): ExportSize | undefined {
  return EXPORT_SIZES.find((s) => s.id === id);
}

// Frame to render for a size: keep the editor's device when it's the right
// family, otherwise substitute the family's representative frame.
export function deviceForSize(size: ExportSize, chosen: DeviceFrame): DeviceFrame {
  return deviceClassOf(chosen) === size.deviceClass ? chosen : DEFAULT_DEVICE_FOR_CLASS[size.deviceClass];
}

// The doc to render at an export size. Preset layouts swap in the size's frame
// family (an iPad slot gets an iPad). When a phone design lands in a tablet
// frame and that family has no crop of its own, the phone screenshot is
// letterboxed ("contain") rather than cover-cropped, which would cut off its
// top and bottom (status bar included). Freeform devices keep their own models.
export function exportDocForSize(doc: EditorDoc, size: ExportSize): EditorDoc {
  if (doc.layout === "freeform") return doc;
  const out: EditorDoc = { ...doc, device: deviceForSize(size, doc.device) };
  const fromPhone = ["iphone", "android-phone"].includes(deviceClassOf(doc.device));
  const toTablet = size.deviceClass === "ipad" || size.deviceClass === "android-tablet";
  const fa = doc.frameAdjust as FrameAdjustByClass | unknown[] | undefined;
  // A legacy flat crop array applies to every family, so it counts as set.
  const hasCrop = Array.isArray(fa) ? fa.some(Boolean) : Boolean(fa?.[size.deviceClass]?.some(Boolean));
  if (fromPhone && toTablet && !hasCrop) {
    const byClass = Array.isArray(fa) ? {} : fa;
    out.frameAdjust = { ...byClass, [size.deviceClass]: [{ ...DEFAULT_FRAME_ADJUST, fit: "contain" }] };
  }
  return out;
}

// Most screenshots each store takes per device size.
export const STORE_SCREENSHOT_LIMIT: Record<StoreOS, number> = { iOS: 10, Android: 8 };
// A set holds at most as many screenshots as the App Store takes.
export const MAX_SET_SCREENSHOTS = STORE_SCREENSHOT_LIMIT.iOS;

export const SET_FULL_MESSAGE = `A set holds at most ${MAX_SET_SCREENSHOTS} screenshots, the App Store's limit.`;

// PNGs an export writes: every size gets each screenshot up to its store's limit.
export function exportFileCount(sizeIds: string[], shotCount: number): number {
  return sizeIds.reduce((n, id) => {
    const size = sizeById(id);
    return size ? n + Math.min(shotCount, STORE_SCREENSHOT_LIMIT[size.os]) : n;
  }, 0);
}

// The size used to preview a device class in the editor (the largest slot in
// each family). Crop set here applies to every export size in that class.
const REP_SIZE_ID: Record<DeviceClass, string> = {
  iphone: "iphone-6-9",
  ipad: "ipad-13",
  "android-phone": "play-phone",
  "android-tablet": "play-tablet",
};

export function representativeSizeForClass(cls: DeviceClass): ExportSize {
  return sizeById(REP_SIZE_ID[cls]) ?? PRIMARY_SIZE;
}

export const PREVIEW_CLASSES: { id: DeviceClass; label: string }[] = [
  { id: "iphone", label: "iPhone" },
  { id: "ipad", label: "iPad" },
  { id: "android-phone", label: "Android" },
  { id: "android-tablet", label: "Tablet" },
];

// Store submission bundles. "App Store (all)" covers every iPhone + iPad slot
// App Store Connect offers; "required" is the minimal set Apple now mandates
// (it auto-scales these down to every smaller slot you skip).
export type ExportPreset = { id: string; label: string; hint: string; sizeIds: string[] };

const APPLE_SIZE_IDS = EXPORT_SIZES.filter((s) => s.os === "iOS").map((s) => s.id);
const PLAY_SIZE_IDS = EXPORT_SIZES.filter((s) => s.os === "Android").map((s) => s.id);

export const EXPORT_PRESETS: ExportPreset[] = [
  {
    id: "apple-all",
    label: "App Store (all)",
    hint: "Every iPhone + iPad size",
    sizeIds: APPLE_SIZE_IDS,
  },
  {
    id: "apple-required",
    label: "App Store (required)",
    hint: "6.9″ iPhone + 13″ iPad",
    sizeIds: ["iphone-6-9", "ipad-13"],
  },
  {
    id: "google-play",
    label: "Google Play",
    hint: "Phone + tablet",
    sizeIds: PLAY_SIZE_IDS,
  },
  {
    id: "all",
    label: "Everything",
    hint: `All ${EXPORT_SIZES.length} sizes`,
    sizeIds: EXPORT_SIZES.map((s) => s.id),
  },
];
