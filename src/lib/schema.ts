import { z } from "zod";

export const DEVICE_FRAMES = [
  "iphone-16-pro",
  "iphone-16-pro-max",
  "iphone-16",
  "iphone-16-plus",
  "iphone-15-pro",
  "iphone-15",
  "iphone-14",
  "iphone-se-3",
  "ipad-pro-13",
  "ipad-pro-11",
  "ipad-air-11",
  "ipad-mini",
  "pixel-9-pro-xl",
  "pixel-9-pro",
  "pixel-9",
  "pixel-9-fold",
  "pixel-8",
  "galaxy-s24-ultra",
  "galaxy-s24-plus",
  "galaxy-s24",
  "galaxy-s23",
  "galaxy-z-fold-6",
  "galaxy-a55",
  "galaxy-tab-s9",
] as const;

export const LAYOUT_PRESETS = [
  "text-above",
  "text-below",
  "text-overlay-top",
  "headline-over",
  "callout-left",
  "callout-right",
  "side-by-side",
  "feature-list",
  "quote-above",
  "panoramic",
  "full-bleed",
  "frame-bleed",
  "angled-frame",
  "staggered",
  "overlap",
  "stat-callout",
  "logo-tagline",
  "triptych",
  "photo-inset",
  "freeform",
] as const;

export const FONTS = [
  "inter",
  "geist",
  "cabinet-grotesk",
  "fraunces",
  "jetbrains-mono",
  "plus-jakarta-sans",
] as const;

export const ColorSchema = z.object({
  hex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  alpha: z.number().min(0).max(1).default(1),
});

export const TextLayerSchema = z.object({
  id: z.string().uuid(),
  type: z.literal("text"),
  content: z.string(),
  // Locale-ready hook: per-locale translations keyed by ISO code (e.g. "es", "ja").
  // Empty in v1 (English-only) but present so v1.1 AI translation isn't a schema rewrite.
  localizedContent: z.record(z.string(), z.string()).optional(),
  font: z.enum(FONTS),
  weight: z.enum(["400", "500", "600", "700", "800"]),
  size: z.number().min(8).max(200),
  color: ColorSchema,
  lineHeight: z.number().min(0.8).max(2.5).default(1.2),
  letterSpacing: z.number().min(-5).max(20).default(0),
  align: z.enum(["left", "center", "right"]),
  x: z.number().default(0),
  y: z.number().default(0),
  width: z.number().optional(),
});

export const FrameLayerSchema = z.object({
  id: z.string().uuid(),
  type: z.literal("frame"),
  device: z.enum(DEVICE_FRAMES),
  sourceImageAssetId: z.string().uuid().nullable(),
  rotation: z.number().min(-180).max(180).default(0),
  scale: z.number().min(0.1).max(3).default(1),
  x: z.number().default(0),
  y: z.number().default(0),
});

export const LayerSchema = z.discriminatedUnion("type", [
  TextLayerSchema,
  FrameLayerSchema,
]);

export const BackgroundSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("solid"), color: ColorSchema }),
  z.object({
    type: z.literal("gradient"),
    stops: z
      .array(
        z.object({ color: ColorSchema, position: z.number().min(0).max(1) }),
      )
      .min(2),
    angle: z.number(),
  }),
  z.object({
    type: z.literal("image"),
    assetId: z.string().uuid(),
    fit: z.enum(["cover", "contain"]),
  }),
  z.object({ type: z.literal("transparent") }),
]);

export const ScreenshotConfigSchema = z.object({
  layoutPreset: z.enum(LAYOUT_PRESETS),
  background: BackgroundSchema,
  layers: z.array(LayerSchema),
  canvasWidth: z.number(),
  canvasHeight: z.number(),
  // Which locale this screenshot set renders. v1 is always "en".
  locale: z.string().default("en"),
});

export type Color = z.infer<typeof ColorSchema>;
export type TextLayer = z.infer<typeof TextLayerSchema>;
export type FrameLayer = z.infer<typeof FrameLayerSchema>;
export type Layer = z.infer<typeof LayerSchema>;
export type Background = z.infer<typeof BackgroundSchema>;
export type ScreenshotConfig = z.infer<typeof ScreenshotConfigSchema>;
export type DeviceFrame = (typeof DEVICE_FRAMES)[number];
export type LayoutPreset = (typeof LAYOUT_PRESETS)[number];
export type Font = (typeof FONTS)[number];
