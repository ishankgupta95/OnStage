"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Client-side auth state for the (static) marketing page, so the nav/CTAs can
// reflect a signed-in session without making the page dynamic. Returns null while
// the session is still being read — render auth-specific UI only once it's known,
// so SSR and the first client render match (no hydration mismatch, no flash).
export function useSignedIn(): boolean | null {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setSignedIn(!!data.session?.user);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setSignedIn(!!session?.user);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return signedIn;
}
