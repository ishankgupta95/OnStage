import { Suspense } from "react";
import { FEATURES } from "@/lib/features";
import { AuthCallback } from "@/components/onstage/screens/AuthCallback";
import { NotFoundScreen } from "@/components/onstage/screens/NotFoundScreen";

export const metadata = {
  title: FEATURES.accounts ? "Signing you in — Onstage" : "Not found — Onstage",
};

export default function AuthCallbackPage() {
  if (!FEATURES.accounts) return <NotFoundScreen />;
  return (
    <Suspense>
      <AuthCallback />
    </Suspense>
  );
}
