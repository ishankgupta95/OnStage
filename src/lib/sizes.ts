import type { DeviceFrame } from "@/lib/schema";
import type { Orientation } from "@/lib/editorDoc";
import { DEFAULT_DEVICE_FOR_CLASS, deviceClassOf, type DeviceClass } from "@/lib/deviceGeometry";

export type ExportSize = { id: string; label: string; w: number; h: number; deviceClass: DeviceClass };

// App Store / Play accept landscape screenshots at the transposed dimensions.
// Orientation is a doc-level property, so we transpose a size on demand.
export function orientSize(size: ExportSize, orientation: Orientation | undefined): ExportSize {
  return orientation === "landscape" ? { ...size, w: size.h, h: size.w } : size;
}

// App Store / Play required pixel dimensions (plan §3 Export). deviceClass picks
// which frame family renders this slot.
export const EXPORT_SIZES: ExportSize[] = [
  { id: "iphone-6-9", label: '6.9" iPhone', w: 1290, h: 2796, deviceClass: "iphone" },
  { id: "iphone-6-7", label: '6.7" iPhone', w: 1284, h: 2778, deviceClass: "iphone" },
  { id: "iphone-6-5", label: '6.5" iPhone', w: 1242, h: 2688, deviceClass: "iphone" },
  { id: "iphone-5-5", label: '5.5" iPhone', w: 1242, h: 2208, deviceClass: "iphone" },
  { id: "ipad-13", label: '13" iPad', w: 2064, h: 2752, deviceClass: "ipad" },
  { id: "ipad-12-9", label: '12.9" iPad', w: 2048, h: 2732, deviceClass: "ipad" },
  { id: "play-phone", label: "Play phone", w: 1080, h: 1920, deviceClass: "android-phone" },
  { id: "play-tablet", label: "Play tablet", w: 1200, h: 1920, deviceClass: "android-tablet" },
];

// Phase 1 spike designs against the 6.9" iPhone canvas.
export const PRIMARY_SIZE = EXPORT_SIZES[0];

export function sizeById(id: string): ExportSize | undefined {
  return EXPORT_SIZES.find((s) => s.id === id);
}

// Frame to render for a size: keep the editor's device when it's the right
// family, otherwise substitute the family's representative frame.
export function deviceForSize(size: ExportSize, chosen: DeviceFrame): DeviceFrame {
  return deviceClassOf(chosen) === size.deviceClass ? chosen : DEFAULT_DEVICE_FOR_CLASS[size.deviceClass];
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

// Store submission bundles. Apple still accepts 5.5" for older listings; we
// include it so a single export covers every slot App Store Connect offers.
export type ExportPreset = { id: string; label: string; hint: string; sizeIds: string[] };

export const EXPORT_PRESETS: ExportPreset[] = [
  {
    id: "apple",
    label: "Apple App Store",
    hint: "iPhone 6.9″–5.5″ + iPad 13″/12.9″",
    sizeIds: ["iphone-6-9", "iphone-6-7", "iphone-6-5", "iphone-5-5", "ipad-13", "ipad-12-9"],
  },
  {
    id: "google-play",
    label: "Google Play",
    hint: "Phone + tablet",
    sizeIds: ["play-phone", "play-tablet"],
  },
  {
    id: "all",
    label: "Everything",
    hint: "All 8 sizes",
    sizeIds: EXPORT_SIZES.map((s) => s.id),
  },
];
