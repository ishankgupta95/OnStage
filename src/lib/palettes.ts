export type Palette = {
  id: string;
  label: string;
  colors: string[]; // hex values, ordered light → dark or by emphasis
};

// Starter subset (4). Curated set of 10 lands in Phase 2 (see plan §6).
export const PALETTES: Palette[] = [
  {
    id: "mono-emerald",
    label: "Mono Emerald",
    colors: ["#ECFDF5", "#6EE7B7", "#10B981", "#0F5132"],
  },
  {
    id: "warm-light",
    label: "Warm Light",
    colors: ["#FFF7ED", "#FED7AA", "#FB923C", "#7C2D12"],
  },
  {
    id: "cool-dark",
    label: "Cool Dark",
    colors: ["#0F172A", "#1E293B", "#38BDF8", "#E0F2FE"],
  },
  {
    id: "monochrome-bw",
    label: "Monochrome",
    colors: ["#FFFFFF", "#A3A3A3", "#404040", "#0A0A0A"],
  },
];
