import type { Metadata } from "next";
import { Suspense } from "react";
import { GuidedScreen } from "@/components/onstage/screens/GuidedScreen";

export const metadata: Metadata = { title: "Guided — Onstage" };

// GuidedScreen reads ?set= with useSearchParams, which a statically exported
// page must render under a Suspense boundary.
export default function GuidedPage() {
  return (
    <Suspense>
      <GuidedScreen />
    </Suspense>
  );
}
