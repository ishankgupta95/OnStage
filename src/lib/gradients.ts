export type GradientPreset = {
  id: string;
  label: string;
  angle: number;
  stops: { color: string; position: number }[];
};

const g = (
  id: string,
  label: string,
  angle: number,
  a: string,
  b: string,
  c?: string,
): GradientPreset => ({
  id,
  label,
  angle,
  stops: c
    ? [
        { color: a, position: 0 },
        { color: b, position: 0.5 },
        { color: c, position: 1 },
      ]
    : [
        { color: a, position: 0 },
        { color: b, position: 1 },
      ],
});

// 12 curated gradients (plan §3 / §6).
export const GRADIENTS: GradientPreset[] = [
  g("emerald-fade", "Emerald", 135, "#10B981", "#0F5132"),
  g("sunset", "Sunset", 160, "#FB923C", "#DB2777"),
  g("ocean", "Ocean", 120, "#38BDF8", "#1E3A8A"),
  g("dusk", "Dusk", 145, "#6366F1", "#0F172A"),
  g("aurora", "Aurora", 135, "#34D399", "#3B82F6", "#8B5CF6"),
  g("rose", "Rose", 150, "#FB7185", "#9D174D"),
  g("peach", "Peach", 120, "#FDE68A", "#FB7185"),
  g("violet", "Violet", 140, "#A78BFA", "#4C1D95"),
  g("midnight", "Midnight", 160, "#1E293B", "#020617"),
  g("forest", "Forest", 135, "#4ADE80", "#14532D"),
  g("gold", "Gold", 130, "#FCD34D", "#B45309"),
  g("sky", "Sky", 120, "#E0F2FE", "#0EA5E9", "#1E40AF"),
];
