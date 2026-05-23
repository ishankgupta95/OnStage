export type Palette = {
  id: string;
  label: string;
  colors: string[]; // hex values
};

// 10 curated palettes (plan §6).
export const PALETTES: Palette[] = [
  { id: "mono-emerald", label: "Mono Emerald", colors: ["#ECFDF5", "#6EE7B7", "#10B981", "#0F5132"] },
  { id: "warm-light", label: "Warm Light", colors: ["#FFF7ED", "#FED7AA", "#FB923C", "#7C2D12"] },
  { id: "warm-dark", label: "Warm Dark", colors: ["#1C1917", "#7C2D12", "#EA580C", "#FDBA74"] },
  { id: "cool-light", label: "Cool Light", colors: ["#F0F9FF", "#BAE6FD", "#0EA5E9", "#0C4A6E"] },
  { id: "cool-dark", label: "Cool Dark", colors: ["#0F172A", "#1E293B", "#38BDF8", "#E0F2FE"] },
  { id: "monochrome-bw", label: "Monochrome", colors: ["#FFFFFF", "#A3A3A3", "#404040", "#0A0A0A"] },
  { id: "sunset", label: "Sunset", colors: ["#FEF3C7", "#FB923C", "#DB2777", "#831843"] },
  { id: "ocean", label: "Ocean", colors: ["#CFFAFE", "#22D3EE", "#0891B2", "#164E63"] },
  { id: "forest", label: "Forest", colors: ["#ECFCCB", "#4ADE80", "#16A34A", "#14532D"] },
  { id: "mono-violet", label: "Mono Violet", colors: ["#F5F3FF", "#C4B5FD", "#8B5CF6", "#4C1D95"] },
];

// Curated solid background colors offered alongside gradients.
export const SOLID_BACKGROUNDS: string[] = [
  "#0F5132",
  "#0A0A0A",
  "#1E293B",
  "#0C4A6E",
  "#831843",
  "#7C2D12",
  "#4C1D95",
  "#F5F5F4",
];
