import type { LayoutPreset, DeviceFrame } from "@/lib/schema";
import {
  DEFAULT_DOC,
  makeTextLayer,
  masterDimsFor,
  type EditorDoc,
  type BackgroundChoice,
} from "@/lib/editorDoc";
import { computeLayout } from "@/lib/layout";
import { GRADIENTS } from "@/lib/gradients";
import { PALETTES } from "@/lib/palettes";

// Starting templates: a project can be created pre-populated with a curated SET
// of screens (each a layout + a placeholder caption). The user's chosen platform
// supplies the device and the chosen color supplies the background — applied to
// every screen so the set looks cohesive out of the box. Everything stays fully
// editable afterward (per-screenshot independence is preserved).

export type Platform = "ios" | "android";

// Platform → the device every seeded screen uses (changeable per-frame later).
export const PLATFORM_DEVICE: Record<Platform, DeviceFrame> = {
  ios: "iphone-16-pro",
  android: "pixel-9",
};

export const PLATFORM_LABEL: Record<Platform, string> = {
  ios: "iPhone 16 Pro",
  android: "Pixel 9",
};

export type TemplateScreen = { layout: LayoutPreset; caption?: string };

export type ProjectTemplate = {
  id: string;
  label: string;
  description: string;
  screens: TemplateScreen[];
};

// Curated lineup. Counts and layouts vary deliberately so the gallery shows range.
export const TEMPLATES: ProjectTemplate[] = [
  {
    id: "blank",
    label: "Blank",
    description: "One empty screen — build it from scratch.",
    screens: [{ layout: "text-above", caption: "Your headline here" }],
  },
  {
    id: "minimal",
    label: "Minimal",
    description: "Three clean screens, one headline each.",
    screens: [
      { layout: "text-above", caption: "Everything in one place" },
      { layout: "headline-over", caption: "Designed for focus" },
      { layout: "text-below", caption: "Get started in seconds" },
    ],
  },
  {
    id: "feature-showcase",
    label: "Feature Showcase",
    description: "Five screens that walk through your key features.",
    screens: [
      { layout: "headline-over", caption: "Meet your new workflow" },
      { layout: "callout-left", caption: "Organize everything effortlessly" },
      { layout: "callout-right", caption: "Stay in sync across devices" },
      { layout: "feature-list", caption: "Powerful by default" },
      { layout: "text-below", caption: "Start free today" },
    ],
  },
  {
    id: "bold",
    label: "Bold Captions",
    description: "Four big-type screens with a quote and a stat.",
    screens: [
      { layout: "text-above", caption: "Built for speed" },
      { layout: "quote-above", caption: "“This completely changed how I work.”" },
      { layout: "stat-callout", caption: "10× faster" },
      { layout: "text-below", caption: "Try it now" },
    ],
  },
  {
    id: "panoramic",
    label: "Panoramic Story",
    description: "Three wide, immersive screens that tell one story.",
    screens: [
      { layout: "panoramic", caption: "See the bigger picture" },
      { layout: "panoramic", caption: "One seamless flow" },
      { layout: "text-below", caption: "Available now" },
    ],
  },
  {
    id: "showcase",
    label: "Showcase",
    description: "Six screens mixing logo, triptych and layered devices.",
    screens: [
      { layout: "logo-tagline", caption: "Your brand" },
      { layout: "triptych", caption: "Three ways to win" },
      { layout: "staggered", caption: "Layered for depth" },
      { layout: "overlap", caption: "Everything connected" },
      { layout: "text-above", caption: "Front and center" },
      { layout: "full-bleed" },
    ],
  },
];

export function templateById(id: string | null | undefined): ProjectTemplate {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];
}

function hexLuminance(hex: string): number {
  const h = hex.replace("#", "");
  const n = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = parseInt(n.slice(0, 2), 16) / 255;
  const g = parseInt(n.slice(2, 4), 16) / 255;
  const b = parseInt(n.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// The colors a background actually renders with (mirrors ScreenshotContent):
// gradients use their stops; palettes use indices 1..3 (the lightest is skipped).
function backgroundColors(bg: BackgroundChoice): string[] {
  if (bg.kind === "gradient") return (GRADIENTS.find((x) => x.id === bg.id) ?? GRADIENTS[0]).stops.map((s) => s.color);
  if (bg.kind === "palette") {
    const c = (PALETTES.find((x) => x.id === bg.id) ?? PALETTES[0]).colors;
    return [c[1] ?? c[0], c[2] ?? c[c.length - 1], c[3] ?? c[c.length - 1]];
  }
  if (bg.kind === "solid") return [bg.color];
  return ["#111111"];
}

// Black or white caption, whichever reads better on the chosen background.
export function captionColorFor(bg: BackgroundChoice): string {
  const cols = backgroundColors(bg);
  const avg = cols.reduce((s, c) => s + hexLuminance(c), 0) / Math.max(1, cols.length);
  return avg > 0.6 ? "#0A0A0A" : "#FFFFFF";
}

// CSS background string for the gallery previews — close to the Konva rendering.
export function backgroundCssFor(bg: BackgroundChoice): string {
  if (bg.kind === "gradient") {
    const g = GRADIENTS.find((x) => x.id === bg.id) ?? GRADIENTS[0];
    return `linear-gradient(${g.angle}deg, ${g.stops.map((s) => `${s.color} ${s.position * 100}%`).join(", ")})`;
  }
  if (bg.kind === "palette") {
    const c = (PALETTES.find((x) => x.id === bg.id) ?? PALETTES[0]).colors;
    return `linear-gradient(135deg, ${c[1] ?? c[0]} 0%, ${c[2] ?? c[c.length - 1]} 50%, ${c[3] ?? c[c.length - 1]} 100%)`;
  }
  if (bg.kind === "solid") return bg.color;
  return "#111111";
}

const LEFT_ALIGNED: LayoutPreset[] = ["callout-left", "callout-right", "feature-list", "stat-callout"];

// Turn a template + platform + background into ready-to-save EditorDocs (one per
// screen). Captions are placed at each layout's caption slot; device frames are
// left empty for the user's own screenshots.
export function buildTemplateDocs(
  template: ProjectTemplate,
  platform: Platform,
  background: BackgroundChoice,
): EditorDoc[] {
  const device = PLATFORM_DEVICE[platform];
  const m = masterDimsFor("portrait");
  const color = captionColorFor(background);
  const screens = template.screens.length
    ? template.screens
    : [{ layout: "text-above" as LayoutPreset, caption: "Your headline here" }];

  return screens.map((screen) => {
    const cap = computeLayout(screen.layout, m.w, m.h).caption;
    const textLayers =
      cap && screen.caption !== undefined
        ? [
            makeTextLayer({
              content: screen.caption || "Your headline here",
              x: cap.x,
              y: cap.y,
              width: cap.width,
              size: Math.max(56, Math.min(140, Math.round(cap.width * 0.1))),
              align: LEFT_ALIGNED.includes(screen.layout) ? "left" : "center",
              weight: "700",
              lineHeight: 1.1,
              color,
            }),
          ]
        : [];
    return {
      ...DEFAULT_DOC,
      device,
      layout: screen.layout,
      orientation: "portrait",
      background,
      frameImages: [],
      frameAdjust: undefined,
      frameTransform: undefined,
      imageLayers: [],
      textLayers,
    };
  });
}
