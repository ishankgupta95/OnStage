/**
 * CSS background size and position that show frame `i` of `n` as its slice of
 * one background spread across the set — how the canvas (and every preview
 * that imitates it) draws a panoramic set. The export slices the same way in
 * Konva (renderSet: span = n, offset = i).
 */
export function panoramaSlice(i: number, n: number): { size: string; position: string } {
  return { size: `${n * 100}% 100%`, position: `${(i / Math.max(1, n - 1)) * 100}% 50%` };
}
