/**
 * Device metrics for the export renderer. Ratios are relative to the rendered
 * frame width so a device looks correct at any pixel size.
 * (Restored from the pre-redesign export pipeline; re-keyed to the design's
 * own device list.)
 */
type Cutout = "island" | "punch" | "none";

export type DeviceGeometry = {
  aspect: number; // frameWidth / frameHeight
  cornerRatio: number;
  insetRatio: number;
  railRatio: number;
  screenCornerRatio: number;
  cutout: Cutout;
  buttons: boolean;
  thickness: number; // body depth ÷ short edge
  frameless?: boolean; // "No frame" — screen only
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

const FRAMELESS: DeviceGeometry = {
  aspect: 0.476,
  cornerRatio: 0.06,
  insetRatio: 0.001,
  railRatio: 0.001,
  screenCornerRatio: 0.06,
  cutout: "none",
  buttons: false,
  thickness: 0.012,
  frameless: true,
};

/** Coarse device family. Export slots are grouped the same way. */
export type DeviceClass = "iphone" | "ipad" | "android-phone" | "android-tablet";

const BY_CLASS: Record<DeviceClass, DeviceGeometry> = {
  iphone: IPHONE,
  ipad: IPAD,
  "android-phone": PIXEL,
  "android-tablet": ANDROID_TABLET,
};

/**
 * Geometry for a slot. Every device the editor offers is one of these four
 * families, so the slot's own family is what picks the frame — an iPhone
 * design exported to an iPad slot gets an iPad. "No frame" is device-level and
 * outranks the slot.
 */
export function geometryFor(deviceId: string, slotClass: DeviceClass): DeviceGeometry {
  return deviceId === "none" ? FRAMELESS : BY_CLASS[slotClass];
}

/** Finish → the metal the 3D renderer shades the body with. */
export const FRAME_FINISH: Record<string, { color: number; roughness: number }> = {
  graphite: { color: 0x2c2c30, roughness: 0.34 },
  silver: { color: 0xc9c7c2, roughness: 0.28 },
  gold: { color: 0xbfa07a, roughness: 0.3 },
  black: { color: 0x121213, roughness: 0.38 },
};
