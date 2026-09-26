import type { Metadata } from "next";
import { Suspense } from "react";
import { FEATURES } from "@/lib/features";
import { NOT_INDEXED } from "@/lib/site";
import { AuthCallback } from "@/components/onstage/screens/AuthCallback";
import { NotFoundScreen } from "@/components/onstage/screens/NotFoundScreen";

export const metadata: Metadata = {
  title: FEATURES.accounts ? "Signing you in — Onstage" : "Not found — Onstage",
  // A redirect target, never a page to find — flag on or off.
  robots: NOT_INDEXED,
};

export default function AuthCallbackPage() {
  if (!FEATURES.accounts) return <NotFoundScreen />;
  return (
    <Suspense>
      <AuthCallback />
    </Suspense>
  );
}
