import type { DeviceFrame } from "@/lib/schema";

export type Cutout = "island" | "punch" | "none";

// All ratios are relative to the rendered frame width, so a device looks correct
// at any size. aspect = frameWidth / frameHeight.
export type DeviceGeometry = {
  aspect: number;
  cornerRatio: number; // body corner radius
  insetRatio: number; // frame edge → screen
  railRatio: number; // titanium/metal rail thickness (rest of inset is black bezel)
  screenCornerRatio: number;
  cutout: Cutout;
  buttons: boolean;
  // Body depth ÷ short edge — drives the 3D-angled mockup's thickness. Real
  // devices are thin (phones ~0.10, tablets ~0.026). Ignored by the flat frame.
  thickness: number;
};

const IPHONE: DeviceGeometry = {
  aspect: 0.476,
  cornerRatio: 0.165,
  insetRatio: 0.042,
  railRatio: 0.02,
  screenCornerRatio: 0.135,
  cutout: "island",
  buttons: true,
  thickness: 0.098,
};

const IPAD: DeviceGeometry = {
  aspect: 0.75,
  cornerRatio: 0.05,
  insetRatio: 0.05,
  railRatio: 0.012,
  screenCornerRatio: 0.03,
  cutout: "none",
  buttons: false,
  thickness: 0.026,
};

const PIXEL: DeviceGeometry = {
  aspect: 0.47,
  cornerRatio: 0.12,
  insetRatio: 0.034,
  railRatio: 0.014,
  screenCornerRatio: 0.1,
  cutout: "punch",
  buttons: true,
  thickness: 0.1,
};

const GALAXY: DeviceGeometry = {
  aspect: 0.487,
  cornerRatio: 0.055,
  insetRatio: 0.028,
  railRatio: 0.012,
  screenCornerRatio: 0.045,
  cutout: "punch",
  buttons: true,
  thickness: 0.1,
};

// Android tablet (Galaxy Tab) — 16:10 portrait, uniform bezels, no notch.
const ANDROID_TABLET: DeviceGeometry = {
  aspect: 0.625,
  cornerRatio: 0.05,
  insetRatio: 0.032,
  railRatio: 0.012,
  screenCornerRatio: 0.03,
  cutout: "none",
  buttons: true,
  thickness: 0.036,
};

// Unfolded inner display — near-square.
const FOLD: DeviceGeometry = {
  aspect: 0.86,
  cornerRatio: 0.04,
  insetRatio: 0.026,
  railRatio: 0.01,
  screenCornerRatio: 0.03,
  cutout: "punch",
  buttons: true,
  thickness: 0.055,
};

const SE: DeviceGeometry = { ...IPHONE, aspect: 0.49, cornerRatio: 0.08, cutout: "none", screenCornerRatio: 0.02 };

const BY_DEVICE: Partial<Record<DeviceFrame, DeviceGeometry>> = {
  "iphone-16-pro": IPHONE,
  "iphone-16-pro-max": IPHONE,
  "iphone-16": IPHONE,
  "iphone-16-plus": IPHONE,
  "iphone-15-pro": IPHONE,
  "iphone-15": IPHONE,
  "iphone-14": IPHONE,
  "iphone-se-3": SE,
  "ipad-pro-13": IPAD,
  "ipad-pro-11": IPAD,
  "ipad-air-11": IPAD,
  "ipad-mini": { ...IPAD, aspect: 0.7 },
  "pixel-9-pro-xl": PIXEL,
  "pixel-9-pro": PIXEL,
  "pixel-9": PIXEL,
  "pixel-9-fold": FOLD,
  "pixel-8": PIXEL,
  "galaxy-s24-ultra": GALAXY,
  "galaxy-s24-plus": GALAXY,
  "galaxy-s24": GALAXY,
  "galaxy-s23": GALAXY,
  "galaxy-z-fold-6": FOLD,
  "galaxy-a55": { ...GALAXY, cornerRatio: 0.08 },
  "galaxy-tab-s9": ANDROID_TABLET,
};

// Landscape inverts the aspect (a phone laid on its side); DeviceFrame handles
// the matching cutout/button placement. (Inline orientation literal avoids an
// import cycle with editorDoc, which imports this module.)
export function geometryFor(
  device: DeviceFrame,
  orientation: "portrait" | "landscape" = "portrait",
): DeviceGeometry {
  const g = BY_DEVICE[device] ?? IPHONE;
  return orientation === "landscape" ? { ...g, aspect: 1 / g.aspect } : g;
}

// Coarse device family. Export sizes are grouped the same way so a size can be
// rendered with a frame from the right family (an iPad slot gets an iPad, etc.).
export type DeviceClass = "iphone" | "ipad" | "android-phone" | "android-tablet";

export function deviceClassOf(device: DeviceFrame): DeviceClass {
  if (device.startsWith("ipad")) return "ipad";
  if (device.startsWith("iphone")) return "iphone";
  if (device.includes("tab")) return "android-tablet"; // galaxy-tab-*
  return "android-phone"; // pixel-*, galaxy-*
}

// Representative frame used when the editor's chosen device doesn't match the
// export size's family (e.g. an iPhone design exported to an iPad slot).
export const DEFAULT_DEVICE_FOR_CLASS: Record<DeviceClass, DeviceFrame> = {
  iphone: "iphone-16-pro",
  ipad: "ipad-pro-13",
  "android-phone": "pixel-9",
  "android-tablet": "galaxy-tab-s9",
};
