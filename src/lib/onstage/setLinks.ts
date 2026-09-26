import { useOnstage } from "@/store/onstage";

/**
 * Links into a set. Only the editor and guided screens open a set, always by
 * the id in their URL (plan D10), so every link that means "this set" says
 * which one.
 */

/** Where a set lives in the given mode — switching modes keeps the set. */
export const setHref = (mode: "guided" | "canvas", setId: string) =>
  `${mode === "guided" ? "/guided" : "/editor"}?set=${encodeURIComponent(setId)}`;

/**
 * The canvas for the set that is open (the default one if none is), carrying
 * an intent — `template:<slug>`, `brand:<kitId>` — that the editor applies
 * once that set has loaded. Screens outside the editor use this instead of
 * changing the document themselves.
 */
export function editorHref(apply: string): string {
  const q = new URLSearchParams();
  const open = useOnstage.getState().loadedSetId;
  if (open) q.set("set", open);
  q.set("apply", apply);
  return `/editor?${q.toString()}`;
}
