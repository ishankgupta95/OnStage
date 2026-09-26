"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getBackend } from "@/lib/data/backend";
import type { App } from "@/lib/data/types";
import { findSetToOpen } from "./sets";

export type AppRoute = {
  /** `resolving`: no `?app=` yet, finding one; `checking`: confirming the
   *  library lists it; `missing`: it doesn't; `ready`: it does. */
  status: "resolving" | "checking" | "missing" | "error" | "ready";
  appId: string | null;
  app: App | null;
  error: string | null;
  retry: () => void;
};

const message = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong.");

/**
 * The app the project board shows, from `?app=` (plan S2.1). With no id, the
 * app of the set a bare `/editor` would open, else the first app — then the
 * URL is replaced to name it; with no apps at all, the dashboard. An id the
 * library doesn't list is `missing`.
 */
export function useAppRoute(): AppRoute {
  const router = useRouter();
  const requested = useSearchParams().get("app") || null;
  const [nonce, setNonce] = useState(0);
  const key = `${requested ?? ""}#${nonce}`;
  const [result, setResult] = useState<{
    key: string;
    status: "missing" | "error" | "ready";
    app: App | null;
    error: string | null;
  } | null>(null);

  useEffect(() => {
    let alive = true;
    const fail = (e: unknown) => {
      if (alive) setResult({ key, status: "error", app: null, error: message(e) });
    };
    if (!requested) {
      Promise.all([findSetToOpen(), getBackend().listApps()])
        .then(([set, apps]) => {
          if (!alive) return;
          const id = apps.find((a) => a.id === set?.appId)?.id ?? apps[0]?.id;
          router.replace(id ? `/project?app=${encodeURIComponent(id)}` : "/dashboard");
        })
        .catch(fail);
    } else {
      getBackend()
        .listApps()
        .then((apps) => {
          if (!alive) return;
          const app = apps.find((a) => a.id === requested) ?? null;
          setResult({ key, status: app ? "ready" : "missing", app, error: null });
        })
        .catch(fail);
    }
    return () => {
      alive = false;
    };
  }, [key, requested, router]);

  const fresh = result?.key === key ? result : null;
  return {
    status: fresh ? fresh.status : requested ? "checking" : "resolving",
    appId: requested,
    app: fresh?.app ?? null,
    error: fresh?.error ?? null,
    retry: () => setNonce((n) => n + 1),
  };
}
