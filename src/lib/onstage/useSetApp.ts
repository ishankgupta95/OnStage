"use client";

import { getBackend } from "@/lib/data/backend";
import type { App } from "@/lib/data/types";
import { useQuery } from "@/lib/data/useQuery";

/** The app a set belongs to (its record: name, initial, tint), or null
 *  while it loads, for no set, or when the library can't be read. */
export function useSetApp(setId: string | null | undefined): App | null {
  const q = useQuery(`set-app:${setId ?? ""}`, async () => {
    if (!setId) return null;
    const [sets, apps] = await Promise.all([getBackend().listSets(), getBackend().listApps()]);
    const set = sets.find((s) => s.id === setId);
    return (set && apps.find((a) => a.id === set.appId)) ?? null;
  });
  return q.data ?? null;
}
