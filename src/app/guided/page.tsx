import type { Metadata } from "next";
import { Suspense } from "react";
import { GuidedScreen } from "@/components/onstage/screens/GuidedScreen";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  path: "/guided",
  title: "Guided — Onstage",
  description:
    "Make a set of store screenshots step by step: add your screens, write the headlines, choose a look and export.",
});

// GuidedScreen reads ?set= with useSearchParams, which a statically exported
// page must render under a Suspense boundary.
export default function GuidedPage() {
  return (
    <Suspense>
      <GuidedScreen />
    </Suspense>
  );
}
