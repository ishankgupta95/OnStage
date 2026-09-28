import { freeformSelId, type EditorDoc } from "@/lib/editorDoc";

// Undo-history helpers for the editor store (src/store/editor.ts). Pure so they
// can be unit-tested without a store.

// Collapse a burst of tracked changes (a slider drag, typing a word, a drag on
// the tilt pad) into ONE undo step. The first change of a burst is recorded —
// so undo returns to the state from before the burst — and later changes are
// skipped until `windowMs` passes with no change. `force()` true records the
// change anyway (used right after an undo, so a new edit always clears redo).
export function coalesceBursts<A extends unknown[]>(
  record: (...args: A) => void,
  opts: { windowMs: number; force?: () => boolean; now?: () => number },
): (...args: A) => void {
  const now = opts.now ?? Date.now;
  let last = -Infinity;
  return (...args: A) => {
    const t = now();
    if (t - last > opts.windowMs || opts.force?.()) record(...args);
    last = t;
  };
}

// Undo/redo restore a `docs` snapshot, but adding/removing a screenshot is
// structural and kept out of history. A snapshot can therefore predate a
// screenshot that exists now, or still contain one since deleted. Keep the set
// of screenshots following `order`: each id takes its restored doc if the
// snapshot has one, else keeps its current doc; ids not in `order` are dropped.
export function reconcileDocs(
  restored: Record<string, EditorDoc>,
  current: Record<string, EditorDoc>,
  order: string[],
): Record<string, EditorDoc> {
  const out: Record<string, EditorDoc> = {};
  for (const id of order) {
    const d = restored[id] ?? current[id];
    if (d) out[id] = d;
  }
  return out;
}

// Every selectable layer id in a doc (text, image, and freeform devices in their
// "freeform:<id>" selection form).
export function selectableIds(doc: EditorDoc): Set<string> {
  return new Set([
    ...doc.textLayers.map((l) => l.id),
    ...(doc.imageLayers ?? []).map((l) => l.id),
    ...(doc.freeformFrames ?? []).map((f) => freeformSelId(f.id)),
  ]);
}
