"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getBackend } from "@/lib/data/backend";
import type { ScreenshotSet } from "@/lib/data/types";
import { applyIntent, isSetDeleted, openSet, useOnstage } from "@/store/onstage";
import { setHref } from "./setLinks";
import { resolveSetToOpen } from "./sets";

export type SetRouteStatus =
  /** No `?set=` yet: finding the set to open (and replacing the URL). */
  | "resolving"
  /** Confirming the library has the set in the URL. */
  | "checking"
  /** The library doesn't list it — nothing is opened or saved. */
  | "missing"
  /** The library couldn't be read, or no set could be made. */
  | "error"
  /** Listed: opened (or opening) by id. */
  | "ready";

export type SetRoute = {
  status: SetRouteStatus;
  /** The set in the URL, once there is one. */
  setId: string | null;
  /** Its library record, once confirmed. */
  set: ScreenshotSet | null;
  error: string | null;
  retry: () => void;
};

const message = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong.");

/**
 * The set the editor or guided screen is on, from `?set=` (plan S2.1, D10).
 * - No id: the set a bare route opens — the last one opened, else the newest,
 *   else a new one — then the URL is replaced to name it.
 * - An id the library doesn't list: `missing`, and `openSet` is never called,
 *   so nothing is autosaved under it.
 * - Otherwise the set is opened; an `?apply=` intent lands on it once loaded,
 *   as one undo step, then leaves the URL so a reload doesn't repeat it.
 */
export function useSetRoute(mode: "canvas" | "guided"): SetRoute {
  const router = useRouter();
  const params = useSearchParams();
  const requested = params.get("set") || null;
  const apply = params.get("apply");
  const [nonce, setNonce] = useState(0);
  const key = `${requested ?? ""}#${nonce}`;
  const [result, setResult] = useState<{
    key: string;
    status: "missing" | "error" | "ready";
    set: ScreenshotSet | null;
    error: string | null;
  } | null>(null);

  useEffect(() => {
    let alive = true;
    const fail = (e: unknown) => {
      if (alive) setResult({ key, status: "error", set: null, error: message(e) });
    };
    if (!requested) {
      resolveSetToOpen().then((id) => {
        if (alive) router.replace(setHref(mode, id, apply));
      }, fail);
    } else {
      getBackend()
        .listSets()
        .then((sets) => {
          if (!alive) return;
          // A set this tab is deleting is gone, even while its record waits
          // to be removed.
          const set = isSetDeleted(requested) ? null : (sets.find((s) => s.id === requested) ?? null);
          setResult({ key, status: set ? "ready" : "missing", set, error: null });
          if (!set) return;
          return openSet(requested).then(() => {
            if (!alive || !apply || useOnstage.getState().loadedSetId !== requested) return;
            applyIntent(apply);
            router.replace(setHref(mode, requested));
          });
        })
        .catch(fail);
    }
    return () => {
      alive = false;
    };
  }, [key, requested, apply, mode, router]);

  const fresh = result?.key === key ? result : null;
  return {
    status: fresh ? fresh.status : requested ? "checking" : "resolving",
    setId: requested,
    set: fresh?.set ?? null,
    error: fresh?.error ?? null,
    retry: () => setNonce((n) => n + 1),
  };
}
