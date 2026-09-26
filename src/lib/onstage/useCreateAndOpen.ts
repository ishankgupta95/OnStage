"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ScreenshotSet } from "@/lib/data/types";
import { setHref } from "./setLinks";

/**
 * Make a new set, then open it by id (plan D10): the template gallery, a
 * template's page and first run all use this rather than changing the open
 * set. `busy` names the action in flight (one at a time); a refusal — full
 * storage, say — lands in `error` for that action and nothing opens.
 */
export function useCreateAndOpen() {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<{ key: string; message: string } | null>(null);

  const run = async (key: string, make: () => Promise<ScreenshotSet>, mode: "canvas" | "guided" = "canvas") => {
    if (busy) return;
    setBusy(key);
    setError(null);
    try {
      const set = await make();
      // Stays busy: the page is on its way to the new set.
      router.push(setHref(mode, set.id));
    } catch (e) {
      setError({ key, message: `Couldn't create the set — ${e instanceof Error ? e.message : "something went wrong."}` });
      setBusy(null);
    }
  };

  return { busy, error, run };
}
