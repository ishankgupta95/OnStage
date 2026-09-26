/** Curated data from the design file — the single source for every screen. */

type TiltPreset = { id: string; label: string; x: number; y: number; d: number };

export const TILT_PRESETS: TiltPreset[] = [
  { id: "flat", label: "Flat", x: 0, y: 0, d: 0 },
  { id: "right", label: "Right", x: 0, y: -17, d: 40 },
  { id: "left", label: "Left", x: 0, y: 17, d: 40 },
  { id: "hero", label: "Hero", x: 9, y: -22, d: 68 },
];

/**
 * Where a point on a tilt pad turns the phone. `nx`/`ny` run from -1 to 1
 * across the pad, centre 0. Dragging right turns the phone to the right
 * (negative yaw, like the Right preset); dragging down tips its top back.
 * `range` is the angle at the pad's edge — the editor's pad reaches ±34°
 * yaw and ±22° pitch; the landing demo uses a gentler range, same signs.
 */
export function tiltFromPad(
  nx: number,
  ny: number,
  range: { yaw: number; pitch: number } = { yaw: 34, pitch: 22 },
): { tiltX: number; tiltY: number } {
  return { tiltY: Math.round(nx * -range.yaw), tiltX: Math.round(ny * -range.pitch) };
}

type Bg = { id: string; label: string; css: string };

export const BGS: Bg[] = [
  { id: "ember", label: "Ember", css: "linear-gradient(150deg,#ff6b53,#c9315f 60%,#6d1a4a)" },
  { id: "dusk", label: "Dusk", css: "linear-gradient(160deg,#1f2b4d,#0e1424)" },
  { id: "moss", label: "Moss", css: "linear-gradient(155deg,#1b6f6a,#0f3a3d)" },
  { id: "bone", label: "Bone", css: "linear-gradient(160deg,#f4f1ea,#ded8cb)" },
  { id: "ink", label: "Ink", css: "linear-gradient(160deg,#1a1917,#0b0b0a)" },
  { id: "sun", label: "Sun", css: "linear-gradient(150deg,#f5b544,#e8672f)" },
  { id: "iris", label: "Iris", css: "linear-gradient(155deg,#6f5bd6,#2a2159)" },
  { id: "sea", label: "Sea", css: "linear-gradient(150deg,#3aa8c9,#124e73)" },
  { id: "clay", label: "Clay", css: "linear-gradient(155deg,#c98b6b,#6d3f33)" },
];

/**
 * The sample device screen is artwork, not chrome, so its ink is fixed rather
 * than following the app theme — the canvas and the exported PNG must match.
 */
export const SCREEN_INK = "233,233,237";

/** Light-ground backgrounds need ink captions rather than white ones. */
const LIGHT_BGS = ["bone", "sun"];

export const capInk = (bg: string) => (LIGHT_BGS.indexOf(bg) >= 0 ? "#1a1614" : "#fff");

export const bgCss = (id: string) => (BGS.find((b) => b.id === id) || BGS[0]).css;

export const DEVICES = [
  { id: "ip16pm", label: "iPhone 16 Pro Max", px: "1320×2868" },
  { id: "ip15", label: "iPhone 15", px: "1179×2556" },
  { id: "ipad", label: 'iPad Pro 13"', px: "2064×2752" },
  { id: "pixel", label: "Pixel 9 Pro", px: "1344×2992" },
  { id: "none", label: "No frame", px: "raw screen" },
];

export const FRAME_COLORS = [
  { id: "graphite", label: "Graphite", css: "linear-gradient(150deg,#3a3833,#141312)" },
  { id: "silver", label: "Silver", css: "linear-gradient(150deg,#e8e6e1,#a7a49d)" },
  { id: "gold", label: "Desert", css: "linear-gradient(150deg,#e3c9a6,#a8865c)" },
  { id: "black", label: "Black", css: "linear-gradient(150deg,#2a2927,#050505)" },
];

export const CAPTIONS = [
  "Every run, mapped",
  "Know your pace",
  "Trails near you",
  "Share the route",
  "Built for the long haul",
];

/**
 * The 12 template sets used by the gallery, landing strip and detail page.
 *
 * `preview` is the gradient the card paints; `bg` is the background the set
 * actually gets when the template is applied, and `ty` its device angle — so
 * "the whole set restyles" is a real operation, not a navigation.
 */
export type Template = {
  slug: string;
  name: string;
  tagline: string;
  frames: number;
  preview: string;
  bg: string;
  panoramic: boolean;
  ty: number;
  badge: string;
  tags: string[];
};

export const TEMPLATES: Template[] = [
  { slug: "ember", name: "Ember", tagline: "Warm gradient, big type", frames: 5, preview: "linear-gradient(150deg,#ff6b53,#c9315f 62%,#6d1a4a)", bg: "ember", panoramic: true, ty: -14, badge: "POPULAR", tags: ["Dark", "Bold type", "Panoramic"] },
  { slug: "cold-open", name: "Cold Open", tagline: "Editorial, navy", frames: 6, preview: "linear-gradient(160deg,#1f2b4d,#0e1424)", bg: "dusk", panoramic: false, ty: 0, badge: "", tags: ["Dark", "Minimal"] },
  { slug: "field-notes", name: "Field Notes", tagline: "Paper, serif captions", frames: 4, preview: "linear-gradient(160deg,#f4f1ea,#ded8cb)", bg: "bone", panoramic: false, ty: 12, badge: "", tags: ["Light", "Minimal"] },
  { slug: "moss", name: "Moss", tagline: "Deep green, panoramic", frames: 5, preview: "linear-gradient(155deg,#1b6f6a,#0f3a3d)", bg: "moss", panoramic: true, ty: -8, badge: "PANORAMIC", tags: ["Dark", "Panoramic"] },
  { slug: "nocturne", name: "Nocturne", tagline: "Near-black, quiet", frames: 7, preview: "linear-gradient(160deg,#1a1917,#0b0b0a)", bg: "ink", panoramic: false, ty: 16, badge: "", tags: ["Dark", "Minimal"] },
  { slug: "sunbelt", name: "Sunbelt", tagline: "Amber, high energy", frames: 5, preview: "linear-gradient(150deg,#f5b544,#e8672f)", bg: "sun", panoramic: false, ty: -20, badge: "", tags: ["Light", "Bold type"] },
  { slug: "iris", name: "Iris", tagline: "Violet, product-led", frames: 6, preview: "linear-gradient(155deg,#6f5bd6,#2a2159)", bg: "iris", panoramic: false, ty: 8, badge: "NEW", tags: ["Dark", "Bold type"] },
  { slug: "harbour", name: "Harbour", tagline: "Cool blue, calm", frames: 5, preview: "linear-gradient(150deg,#3aa8c9,#124e73)", bg: "sea", panoramic: false, ty: -10, badge: "", tags: ["Dark", "Tablet-first"] },
  { slug: "clay", name: "Clay", tagline: "Earthy, tactile", frames: 4, preview: "linear-gradient(155deg,#c98b6b,#6d3f33)", bg: "clay", panoramic: false, ty: 14, badge: "", tags: ["Minimal"] },
  { slug: "blueprint", name: "Blueprint", tagline: "Grid lines, technical", frames: 5, preview: "linear-gradient(160deg,#12232e,#0a1218)", bg: "dusk", panoramic: false, ty: 0, badge: "", tags: ["Dark", "Minimal", "Tablet-first"] },
  { slug: "bone", name: "Bone", tagline: "Off-white, editorial", frames: 6, preview: "linear-gradient(160deg,#f7f6f3,#e7e3da)", bg: "bone", panoramic: false, ty: -16, badge: "", tags: ["Light", "Minimal"] },
  { slug: "signal", name: "Signal", tagline: "Split colour blocks", frames: 5, preview: "linear-gradient(120deg,#ff6b53 50%,#1f2b4d 50%)", bg: "ember", panoramic: false, ty: 10, badge: "", tags: ["Bold type", "Feature graphic"] },
];

/** How many template sets there are — every screen that counts them reads
 *  this (SCREENSA-1; S5.1 points it at the gallery's own list). */
export const TEMPLATE_COUNT = TEMPLATES.length;

/** The filter chips above the gallery. */
export const TEMPLATE_FILTERS = [
  "All",
  "Dark",
  "Light",
  "Bold type",
  "Panoramic",
  "Minimal",
  "Tablet-first",
  "Feature graphic",
];

/** Templates whose ground is light, so their caption bar has to be ink. */
export const LIGHT_TEMPLATES = ["Field Notes", "Bone"];
