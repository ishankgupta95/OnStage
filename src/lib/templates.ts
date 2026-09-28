import type { LayoutPreset, DeviceFrame, Font } from "@/lib/schema";
import {
  DEFAULT_DOC,
  PERSPECTIVE_PRESETS,
  makeTextLayer,
  masterDimsFor,
  type CaptionWeight,
  type DevicePerspective,
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
  ios: "iphone-17-pro",
  android: "pixel-10",
};

export const PLATFORM_LABEL: Record<Platform, string> = {
  ios: "iPhone 17 Pro",
  android: "Pixel 10",
};

export type TemplateScreen = {
  layout: LayoutPreset;
  caption?: string;
  // A smaller second text layer placed under the caption (subheading, bullets).
  subcaption?: string;
  // Caption size at design size; default scales with the caption slot.
  size?: number;
  // 3D device angle for this screen; default flat.
  perspective?: DevicePerspective;
};

export type ProjectTemplate = {
  id: string;
  label: string;
  description: string;
  screens: TemplateScreen[];
  // Caption type; defaults are Inter 700 with Inter subcaptions.
  font?: Font;
  weight?: CaptionWeight;
  subFont?: Font;
  // A background the template is built around, used instead of the chosen color.
  background?: BackgroundChoice;
};

const angle = (id: string) => PERSPECTIVE_PRESETS.find((p) => p.id === id)?.value ?? undefined;

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
    label: "Wide Frames",
    description: "Three screens with a near edge-to-edge device and the caption along the bottom.",
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
  {
    id: "editorial",
    label: "Editorial",
    description: "Four screens with serif headlines and a quiet subheading under each.",
    font: "fraunces",
    weight: "600",
    screens: [
      { layout: "text-above", caption: "Read deeper", subcaption: "A calmer home for long reads" },
      { layout: "quote-above", caption: "“The first app\nI open each day.”", subcaption: "— A happy reader" },
      { layout: "text-above", caption: "Save for later", subcaption: "Articles, threads and PDFs" },
      { layout: "text-below", caption: "Start reading", subcaption: "Your library, beautifully set" },
    ],
  },
  {
    id: "angled-hero",
    label: "Angled Hero",
    description: "Four bold screens with the device turned in 3D, alternating angles.",
    weight: "800",
    screens: [
      { layout: "text-above", caption: "Built to\nmove fast", perspective: angle("right") },
      { layout: "angled-frame", caption: "Everything\nat a glance", perspective: angle("left") },
      { layout: "headline-over", caption: "Made for\nyour day", perspective: angle("subtle") },
      { layout: "text-above", caption: "Get started\nin seconds", perspective: angle("right") },
    ],
  },
  {
    id: "stat-proof",
    label: "Stat & Proof",
    description: "A big-number stat, a testimonial, a feature list and a closing call to action.",
    weight: "800",
    screens: [
      { layout: "stat-callout", caption: "10×", size: 200, subcaption: "faster than\ndoing it by hand" },
      { layout: "quote-above", caption: "“Paid for itself\nin a week.”", subcaption: "— Early customer" },
      { layout: "feature-list", caption: "Everything\nincluded", size: 88, subcaption: "• Offline mode\n• Smart reminders\n• Widgets\n• Dark mode" },
      { layout: "text-below", caption: "Get started today" },
    ],
  },
  {
    id: "dev-tool",
    label: "Dev Tool",
    description: "Four monospace screens on a dark grid, for developer and technical apps.",
    font: "jetbrains-mono",
    weight: "700",
    subFont: "jetbrains-mono",
    background: { kind: "pattern", id: "grid-dark" },
    screens: [
      { layout: "text-above", caption: "$ ship --faster", subcaption: "Your tools, in your pocket" },
      { layout: "callout-left", caption: "Type less.\nShip more.", size: 76 },
      { layout: "side-by-side", caption: "Logs & metrics,\nside by side" },
      { layout: "callout-right", caption: "Alerts that\nmake sense.", size: 76 },
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
export function backgroundColors(bg: BackgroundChoice): string[] {
  if (bg.kind === "gradient") return (GRADIENTS.find((x) => x.id === bg.id) ?? GRADIENTS[0]).stops.map((s) => s.color);
  if (bg.kind === "palette") {
    const c = (PALETTES.find((x) => x.id === bg.id) ?? PALETTES[0]).colors;
    return [c[1] ?? c[0], c[2] ?? c[c.length - 1], c[3] ?? c[c.length - 1]];
  }
  if (bg.kind === "solid") return [bg.color];
  if (bg.kind === "custom-gradient") return [bg.from, bg.to];
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
  if (bg.kind === "custom-gradient") return `linear-gradient(${bg.angle}deg, ${bg.from}, ${bg.to})`;
  return "#111111";
}

const LEFT_ALIGNED: LayoutPreset[] = ["callout-left", "callout-right", "feature-list", "stat-callout"];

// Caption size for a side layout's column: as large as `max` while the longest
// word still fits the width (a bold glyph averages ~0.6 em).
export function fitCaptionSize(text: string, width: number, max: number): number {
  const longest = Math.max(1, ...text.split(/\s+/).map((w) => w.length));
  return Math.max(40, Math.min(max, Math.floor(width / (longest * 0.6))));
}

// Turn a template + platform + background into ready-to-save EditorDocs (one per
// screen). Captions are placed at each layout's caption slot; device frames are
// left empty for the user's own screenshots.
export function buildTemplateDocs(
  template: ProjectTemplate,
  platform: Platform,
  chosenBackground: BackgroundChoice,
): EditorDoc[] {
  const device = PLATFORM_DEVICE[platform];
  const m = masterDimsFor("portrait");
  const background = template.background ?? chosenBackground;
  const color = captionColorFor(background);
  const screens = template.screens.length
    ? template.screens
    : [{ layout: "text-above" as LayoutPreset, caption: "Your headline here" }];

  return screens.map((screen) => {
    const cap = computeLayout(screen.layout, m.w, m.h).caption;
    const align = LEFT_ALIGNED.includes(screen.layout) ? "left" : "center";
    // Side layouts size the caption to their column (the stat as a big number);
    // the rest scale with the caption slot.
    const size =
      screen.size ??
      (cap && LEFT_ALIGNED.includes(screen.layout)
        ? fitCaptionSize(screen.caption ?? "", cap.width, screen.layout === "stat-callout" ? 220 : 88)
        : Math.max(56, Math.min(140, Math.round(cap ? cap.width * 0.1 : 110))));
    const lineHeight = 1.1;
    const textLayers =
      cap && screen.caption !== undefined
        ? [
            makeTextLayer({
              content: screen.caption || "Your headline here",
              x: cap.x,
              y: cap.y,
              width: cap.width,
              size,
              align,
              font: template.font ?? "inter",
              weight: template.weight ?? "700",
              lineHeight,
              color,
            }),
          ]
        : [];
    if (cap && screen.subcaption) {
      // Under the caption: its explicit lines (template captions are written
      // short enough not to wrap) plus a gap.
      const subSize = Math.min(64, Math.max(44, Math.round(size * 0.55)));
      const lines = (screen.caption ?? "").split("\n").length;
      textLayers.push(
        makeTextLayer({
          content: screen.subcaption,
          x: cap.x,
          y: Math.round(cap.y + lines * size * lineHeight + subSize * 0.6),
          width: cap.width,
          size: subSize,
          align,
          font: template.subFont ?? "inter",
          weight: "500",
          lineHeight: 1.3,
          color,
        }),
      );
    }
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
      ...(screen.perspective ? { perspective: screen.perspective } : {}),
    };
  });
}
