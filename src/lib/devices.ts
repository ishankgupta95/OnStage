import type { DeviceFrame } from "@/lib/schema";

export type DeviceSpec = {
  id: DeviceFrame;
  label: string;
  platform: "ios" | "android";
  kind: "phone" | "tablet";
  // Screen cutout pixel size (source image fits here). Placeholder values — refine in Phase 2.
  screenWidth: number;
  screenHeight: number;
};

// Starter subset (4). Full 20+ library lands in Phase 2 via hand-built SVGs + a licensed frame pack.
export const DEVICES: DeviceSpec[] = [
  {
    id: "iphone-16-pro",
    label: "iPhone 16 Pro",
    platform: "ios",
    kind: "phone",
    screenWidth: 1206,
    screenHeight: 2622,
  },
  {
    id: "ipad-pro-13",
    label: 'iPad Pro 13" M4',
    platform: "ios",
    kind: "tablet",
    screenWidth: 2064,
    screenHeight: 2752,
  },
  {
    id: "pixel-9-pro",
    label: "Pixel 9 Pro",
    platform: "android",
    kind: "phone",
    screenWidth: 1280,
    screenHeight: 2856,
  },
  {
    id: "galaxy-s24-ultra",
    label: "Galaxy S24 Ultra",
    platform: "android",
    kind: "phone",
    screenWidth: 1440,
    screenHeight: 3120,
  },
];

export const DEVICE_BY_ID = Object.fromEntries(
  DEVICES.map((d) => [d.id, d]),
) as Record<DeviceFrame, DeviceSpec | undefined>;
