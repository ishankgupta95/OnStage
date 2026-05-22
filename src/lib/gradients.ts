export type GradientPreset = {
  id: string;
  label: string;
  angle: number;
  stops: { color: string; position: number }[];
};

// Starter subset (4). Curated set of 12 lands in Phase 2 (see plan §6).
export const GRADIENTS: GradientPreset[] = [
  {
    id: "emerald-fade",
    label: "Emerald Fade",
    angle: 135,
    stops: [
      { color: "#10B981", position: 0 },
      { color: "#0F5132", position: 1 },
    ],
  },
  {
    id: "sunset",
    label: "Sunset",
    angle: 160,
    stops: [
      { color: "#FB923C", position: 0 },
      { color: "#DB2777", position: 1 },
    ],
  },
  {
    id: "ocean",
    label: "Ocean",
    angle: 120,
    stops: [
      { color: "#38BDF8", position: 0 },
      { color: "#1E3A8A", position: 1 },
    ],
  },
  {
    id: "dusk",
    label: "Dusk",
    angle: 145,
    stops: [
      { color: "#6366F1", position: 0 },
      { color: "#0F172A", position: 1 },
    ],
  },
];
