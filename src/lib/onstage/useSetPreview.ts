"use client";

import { useQuery } from "@/lib/data/useQuery";
import type { ScreenshotSet, SetFrame } from "@/lib/data/types";
import { useOnstage } from "@/store/onstage";
import { setPreviewSource } from "./sets";

/**
 * The set a read-only screen previews (store listing, a template shown with
 * "my screens"): `setId` when the screen names one (the store preview's
 * `?set=`), else the set a bare `/editor` would open — the one last opened,
 * else the most recently edited. While the editor has that set loaded, it as
 * it is now (it can be newer than storage). Read without opening it: only
 * the editor and guided screens open a set (plan D10).
 */
export function useSetPreview(setId?: string | null): {
  frames: SetFrame[];
  store: "apple" | "play";
  loading: boolean;
  /** The set's library record; null for the default (no sets yet). */
  set: ScreenshotSet | null;
  /** `setId` names a set this browser's library doesn't list. */
  missing: boolean;
} {
  const loadedSetId = useOnstage((st) => st.loadedSetId);
  const liveFrames = useOnstage((st) => st.frames);
  const liveStore = useOnstage((st) => st.store);
  // Keyed on the open set too, so a set opened (or switched) in this tab is
  // re-read — its record is part of the answer.
  const source = useQuery(`set-preview:${setId ?? ""}:${loadedSetId ?? ""}`, () =>
    setPreviewSource(undefined, setId),
  );

  const set = source.data?.set ?? null;
  const live = loadedSetId !== null && (setId ? setId === loadedSetId : true);
  if (live && (source.loading || set?.id === loadedSetId)) {
    return {
      frames: liveFrames,
      store: liveStore,
      loading: false,
      set: set?.id === loadedSetId ? set : null,
      missing: false,
    };
  }
  if (source.loading) return { frames: [], store: "apple", loading: true, set: null, missing: false };
  // Unreadable library: show what the editor shows before a set loads.
  if (!source.data) return { frames: liveFrames, store: liveStore, loading: false, set: null, missing: false };
  const { doc, missing } = source.data;
  return { frames: doc.frames, store: doc.store ?? "apple", loading: false, set, missing };
}
