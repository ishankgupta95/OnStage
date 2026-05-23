import type { CSSProperties } from "react";

// Mesh gradient = a base color with several soft radial "blobs" layered over it.
// Blob coords/radius are fractions of the canvas so it scales to any size.
export type MeshBlob = { x: number; y: number; r: number; color: string };
export type MeshPreset = { id: string; label: string; base: string; blobs: MeshBlob[] };

export const MESH_GRADIENTS: MeshPreset[] = [
  {
    id: "aurora-mesh",
    label: "Aurora",
    base: "#0b1020",
    blobs: [
      { x: 0.18, y: 0.22, r: 0.75, color: "#22d3ee" },
      { x: 0.82, y: 0.28, r: 0.65, color: "#8b5cf6" },
      { x: 0.5, y: 0.9, r: 0.8, color: "#ec4899" },
    ],
  },
  {
    id: "sunset-mesh",
    label: "Sunset",
    base: "#1a0b14",
    blobs: [
      { x: 0.15, y: 0.85, r: 0.8, color: "#f59e0b" },
      { x: 0.85, y: 0.7, r: 0.7, color: "#ec4899" },
      { x: 0.6, y: 0.15, r: 0.7, color: "#a855f7" },
    ],
  },
  {
    id: "ocean-mesh",
    label: "Ocean",
    base: "#04121f",
    blobs: [
      { x: 0.2, y: 0.3, r: 0.8, color: "#0ea5e9" },
      { x: 0.85, y: 0.5, r: 0.7, color: "#2dd4bf" },
      { x: 0.5, y: 0.95, r: 0.7, color: "#1d4ed8" },
    ],
  },
  {
    id: "ember-mesh",
    label: "Ember",
    base: "#0a0604",
    blobs: [
      { x: 0.25, y: 0.25, r: 0.7, color: "#ef4444" },
      { x: 0.8, y: 0.35, r: 0.6, color: "#f97316" },
      { x: 0.55, y: 0.9, r: 0.8, color: "#b91c1c" },
    ],
  },
  {
    id: "lavender-mesh",
    label: "Lavender",
    base: "#f4f1fb",
    blobs: [
      { x: 0.2, y: 0.25, r: 0.7, color: "#c4b5fd" },
      { x: 0.85, y: 0.3, r: 0.6, color: "#93c5fd" },
      { x: 0.55, y: 0.9, r: 0.75, color: "#f9a8d4" },
    ],
  },
  {
    id: "mint-mesh",
    label: "Mint",
    base: "#f0fbf5",
    blobs: [
      { x: 0.2, y: 0.8, r: 0.75, color: "#6ee7b7" },
      { x: 0.85, y: 0.65, r: 0.6, color: "#5eead4" },
      { x: 0.6, y: 0.15, r: 0.65, color: "#a7f3d0" },
    ],
  },
];

export type PatternType = "dots" | "grid" | "noise";
export type PatternPreset = { id: string; label: string; type: PatternType; fg: string; bg: string };

export const PATTERNS: PatternPreset[] = [
  { id: "dots-dark", label: "Dots", type: "dots", fg: "rgba(255,255,255,0.22)", bg: "#0f172a" },
  { id: "dots-light", label: "Dots light", type: "dots", fg: "rgba(15,23,42,0.18)", bg: "#f8fafc" },
  { id: "grid-dark", label: "Grid", type: "grid", fg: "rgba(255,255,255,0.12)", bg: "#0b0c0e" },
  { id: "grid-blue", label: "Graph", type: "grid", fg: "rgba(37,99,235,0.18)", bg: "#f8fbff" },
  { id: "noise-slate", label: "Noise", type: "noise", fg: "rgba(255,255,255,0.5)", bg: "#1e293b" },
  { id: "noise-warm", label: "Noise warm", type: "noise", fg: "rgba(0,0,0,0.35)", bg: "#fef3e2" },
];

export function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// A small repeating tile used as a Konva fillPatternImage. Same-origin canvas,
// so it never taints the export canvas.
export const PATTERN_TILE = 48;
const NOISE_TILE = 140;

export function generatePatternTile(p: PatternPreset): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  const size = p.type === "noise" ? NOISE_TILE : PATTERN_TILE;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = p.bg;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = p.fg;
  if (p.type === "dots") {
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size * 0.075, 0, Math.PI * 2);
    ctx.fill();
  } else if (p.type === "grid") {
    ctx.fillRect(0, 0, size, 2);
    ctx.fillRect(0, 0, 2, size);
  } else {
    // noise: scatter faint pixels; a large tile hides the repeat
    const count = Math.floor(size * size * 0.4);
    for (let i = 0; i < count; i++) {
      ctx.globalAlpha = Math.random() * 0.6 + 0.1;
      ctx.fillRect(Math.random() * size, Math.random() * size, 1, 1);
    }
    ctx.globalAlpha = 1;
  }
  return c;
}

// CSS approximations for the sidebar swatches (Konva does the real render).
export function meshSwatchStyle(p: MeshPreset): CSSProperties {
  const layers = p.blobs
    .map((b) => `radial-gradient(circle at ${b.x * 100}% ${b.y * 100}%, ${b.color}, transparent ${Math.round(b.r * 60)}%)`)
    .join(", ");
  return { backgroundColor: p.base, backgroundImage: layers };
}

export function patternSwatchStyle(p: PatternPreset): CSSProperties {
  if (p.type === "dots") {
    return {
      backgroundColor: p.bg,
      backgroundImage: `radial-gradient(${p.fg} 1.4px, transparent 1.4px)`,
      backgroundSize: "9px 9px",
    };
  }
  if (p.type === "grid") {
    return {
      backgroundColor: p.bg,
      backgroundImage: `linear-gradient(${p.fg} 1px, transparent 1px), linear-gradient(90deg, ${p.fg} 1px, transparent 1px)`,
      backgroundSize: "10px 10px",
    };
  }
  // noise: a dense fine dot field as a stand-in
  return {
    backgroundColor: p.bg,
    backgroundImage: `radial-gradient(${p.fg} 0.5px, transparent 0.6px)`,
    backgroundSize: "3px 3px",
  };
}
