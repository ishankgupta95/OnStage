"use client";

import { useQuery } from "@/lib/data/useQuery";
import { getBackend } from "@/lib/data/backend";
import type { SetFrame } from "@/lib/data/types";
import { DEFAULT_SET_ID, useOnstage } from "@/store/onstage";

/**
 * The set a read-only screen previews (store listing, a template shown with
 * "my screens"). While the editor has a set loaded, that set as it is now —
 * it can be newer than storage. Otherwise the saved copy, read without
 * opening it: only the editor and guided screens open a set (plan D10).
 * S2.1 replaces DEFAULT_SET_ID with the set the person last opened.
 */
export function useSetPreview(): { frames: SetFrame[]; store: "apple" | "play"; loading: boolean } {
  const loadedSetId = useOnstage((st) => st.loadedSetId);
  const liveFrames = useOnstage((st) => st.frames);
  const liveStore = useOnstage((st) => st.store);
  const saved = useQuery(loadedSetId ? "set-preview:open" : `set-preview:${DEFAULT_SET_ID}`, () =>
    loadedSetId ? Promise.resolve(null) : getBackend().loadSetDoc(DEFAULT_SET_ID),
  );

  if (loadedSetId) return { frames: liveFrames, store: liveStore, loading: false };
  if (saved.loading) return { frames: [], store: "apple", loading: true };
  const doc = saved.data;
  // No saved copy (or an unreadable one): the set would open as the default.
  if (!doc || !Array.isArray(doc.frames) || !doc.frames.length) {
    return { frames: liveFrames, store: liveStore, loading: false };
  }
  return { frames: doc.frames, store: doc.store ?? "apple", loading: false };
}
