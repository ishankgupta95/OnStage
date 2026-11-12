import type { DeviceFrame } from "@/lib/schema";

// Every device frame is a photoreal render of one of a handful of device
// models (built and path-traced in Blender by scripts/blender/build_devices.py;
// see src/lib/deviceRenders.ts). Devices that share a model share a frame.
export type DeviceModelId =
  | "iphone"
  | "iphone-se"
  | "ipad"
  | "ipad-mini"
  | "pixel"
  | "galaxy"
  | "galaxy-a"
  | "fold"
  | "galaxy-tab";

export function modelFor(device: DeviceFrame): DeviceModelId {
  if (device === "iphone-se-3") return "iphone-se";
  if (device === "ipad-mini") return "ipad-mini";
  if (device.startsWith("ipad")) return "ipad";
  if (device.startsWith("iphone")) return "iphone";
  if (device === "pixel-9-fold" || device === "galaxy-z-fold-6") return "fold";
  if (device.startsWith("pixel")) return "pixel";
  if (device === "galaxy-a55") return "galaxy-a";
  if (device.startsWith("galaxy-tab")) return "galaxy-tab";
  if (device.startsWith("galaxy")) return "galaxy";
  return "iphone";
}

// Portrait frame-box aspect (width ÷ height) per model. The renders are made
// at exactly this aspect — keep in sync with SPECS[*].aspect in the Blender
// script.
const MODEL_ASPECT: Record<DeviceModelId, number> = {
  iphone: 0.476,
  "iphone-se": 0.49,
  ipad: 0.75,
  "ipad-mini": 0.7,
  pixel: 0.47,
  galaxy: 0.487,
  "galaxy-a": 0.487,
  fold: 0.86,
  "galaxy-tab": 0.625,
};

export type DeviceGeometry = {
  aspect: number; // frame box width ÷ height
};

// One object per model + orientation, so devices sharing a frame get the very
// same geometry. (Inline orientation literal avoids an import cycle with
// editorDoc, which imports this module.)
const _geo = new Map<string, DeviceGeometry>();

export function geometryFor(
  device: DeviceFrame,
  orientation: "portrait" | "landscape" = "portrait",
): DeviceGeometry {
  const model = modelFor(device);
  const key = `${model}/${orientation}`;
  let g = _geo.get(key);
  if (!g) {
    const a = MODEL_ASPECT[model];
    // Landscape = the device laid on its side.
    g = { aspect: orientation === "landscape" ? 1 / a : a };
    _geo.set(key, g);
  }
  return g;
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
  iphone: "iphone-17-pro",
  ipad: "ipad-pro-13",
  "android-phone": "pixel-10",
  "android-tablet": "galaxy-tab-s9",
};
