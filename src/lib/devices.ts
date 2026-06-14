import type { DeviceFrame } from "@/lib/schema";

export type DeviceSpec = {
  id: DeviceFrame;
  label: string;
  platform: "ios" | "android";
  kind: "phone" | "tablet";
  // Screen cutout pixel size (source image fits here). Approximate — frame
  // proportions come from deviceGeometry; refined per device later.
  screenWidth: number;
  screenHeight: number;
};

export const DEVICES: DeviceSpec[] = [
  { id: "iphone-16-pro", label: "iPhone 16 Pro", platform: "ios", kind: "phone", screenWidth: 1206, screenHeight: 2622 },
  { id: "iphone-16-pro-max", label: "iPhone 16 Pro Max", platform: "ios", kind: "phone", screenWidth: 1320, screenHeight: 2868 },
  { id: "iphone-16", label: "iPhone 16", platform: "ios", kind: "phone", screenWidth: 1179, screenHeight: 2556 },
  { id: "iphone-16-plus", label: "iPhone 16 Plus", platform: "ios", kind: "phone", screenWidth: 1290, screenHeight: 2796 },
  { id: "iphone-15-pro", label: "iPhone 15 Pro", platform: "ios", kind: "phone", screenWidth: 1179, screenHeight: 2556 },
  { id: "iphone-15", label: "iPhone 15", platform: "ios", kind: "phone", screenWidth: 1179, screenHeight: 2556 },
  { id: "iphone-14", label: "iPhone 14", platform: "ios", kind: "phone", screenWidth: 1170, screenHeight: 2532 },
  { id: "iphone-se-3", label: "iPhone SE", platform: "ios", kind: "phone", screenWidth: 750, screenHeight: 1334 },
  { id: "ipad-pro-13", label: 'iPad Pro 13"', platform: "ios", kind: "tablet", screenWidth: 2064, screenHeight: 2752 },
  { id: "ipad-pro-11", label: 'iPad Pro 11"', platform: "ios", kind: "tablet", screenWidth: 1668, screenHeight: 2420 },
  { id: "ipad-air-11", label: 'iPad Air 11"', platform: "ios", kind: "tablet", screenWidth: 1640, screenHeight: 2360 },
  { id: "ipad-mini", label: "iPad mini", platform: "ios", kind: "tablet", screenWidth: 1488, screenHeight: 2266 },
  { id: "pixel-9-pro-xl", label: "Pixel 9 Pro XL", platform: "android", kind: "phone", screenWidth: 1344, screenHeight: 2992 },
  { id: "pixel-9-pro", label: "Pixel 9 Pro", platform: "android", kind: "phone", screenWidth: 1280, screenHeight: 2856 },
  { id: "pixel-9", label: "Pixel 9", platform: "android", kind: "phone", screenWidth: 1080, screenHeight: 2424 },
  { id: "pixel-9-fold", label: "Pixel 9 Pro Fold", platform: "android", kind: "phone", screenWidth: 2076, screenHeight: 2152 },
  { id: "pixel-8", label: "Pixel 8", platform: "android", kind: "phone", screenWidth: 1080, screenHeight: 2400 },
  { id: "galaxy-s24-ultra", label: "Galaxy S24 Ultra", platform: "android", kind: "phone", screenWidth: 1440, screenHeight: 3120 },
  { id: "galaxy-s24-plus", label: "Galaxy S24+", platform: "android", kind: "phone", screenWidth: 1440, screenHeight: 3120 },
  { id: "galaxy-s24", label: "Galaxy S24", platform: "android", kind: "phone", screenWidth: 1080, screenHeight: 2340 },
  { id: "galaxy-s23", label: "Galaxy S23", platform: "android", kind: "phone", screenWidth: 1080, screenHeight: 2340 },
  { id: "galaxy-z-fold-6", label: "Galaxy Z Fold 6", platform: "android", kind: "phone", screenWidth: 1856, screenHeight: 2160 },
  { id: "galaxy-a55", label: "Galaxy A55", platform: "android", kind: "phone", screenWidth: 1080, screenHeight: 2340 },
  { id: "galaxy-tab-s9", label: "Galaxy Tab S9", platform: "android", kind: "tablet", screenWidth: 1600, screenHeight: 2560 },
];

export const DEVICE_BY_ID = Object.fromEntries(
  DEVICES.map((d) => [d.id, d]),
) as Record<DeviceFrame, DeviceSpec | undefined>;

// The models shown in the device picker. Every device above maps to one of a
// handful of shared frame geometries (deviceGeometry.ts), so most "different"
// models render an identical frame. We keep DEVICES (and DEVICE_BY_ID) full so
// any saved/legacy doc still resolves a label and renders correctly, and only
// curate which models are *offered* — one representative per distinct frame.
const PICKER_IDS: DeviceFrame[] = [
  "iphone-16-pro", // covers 16/15/14 Pro & non-Pro (identical IPHONE frame)
  "iphone-se-3",
  "ipad-pro-13", // covers iPad Pro 11 / Air (identical IPAD frame)
  "ipad-mini", // distinct: narrower 0.7 aspect
  "pixel-9", // covers Pixel 9 Pro / XL / 8 (identical PIXEL frame)
  "galaxy-s24-ultra", // covers S24/S23 family + A55 (GALAXY frame)
  "galaxy-z-fold-6", // covers Pixel 9 Pro Fold (identical FOLD frame)
  "galaxy-tab-s9",
];

export const DEVICE_PICKER: DeviceSpec[] = PICKER_IDS.map((id) => DEVICE_BY_ID[id]).filter(
  (d): d is DeviceSpec => Boolean(d),
);
