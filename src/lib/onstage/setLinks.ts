import { useOnstage } from "@/store/onstage";

/**
 * Links into a set. Only the editor and guided screens open a set, always by
 * the id in their URL (plan D10), so every link that means "this set" says
 * which one.
 */

/**
 * Where a set lives in the given mode — switching modes keeps the set. An
 * `apply` intent rides along for the editor to carry out once the set has
 * loaded. With no id, the bare route, which opens the last set.
 */
export function setHref(mode: "guided" | "canvas", setId: string, apply?: string | null): string {
  const path = mode === "guided" ? "/guided" : "/editor";
  const q = new URLSearchParams();
  if (setId) q.set("set", setId);
  if (apply) q.set("apply", apply);
  const query = q.toString();
  return query ? `${path}?${query}` : path;
}

/**
 * Where an "open this set" control goes: the canvas, or the guided flow when
 * that is the person's work-mode preference (loaded into the store at boot,
 * changed in Settings or by the top bar's switch).
 */
export const openSetHref = (setId: string) => setHref(useOnstage.getState().workMode, setId);

/**
 * The canvas for the set that is open (or, when none is, the one a bare
 * `/editor` opens — the last one), carrying an intent — `brand:<kitId>`,
 * `panel:export` — that the editor applies once that set has loaded. Screens
 * outside the editor use this instead of changing the document themselves.
 */
export function editorHref(apply: string): string {
  return setHref("canvas", useOnstage.getState().loadedSetId ?? "", apply);
}
