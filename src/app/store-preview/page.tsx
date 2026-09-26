import type { Metadata } from "next";
import { Suspense } from "react";
import { StorePageScreen } from "@/components/onstage/screens/StorePageScreen";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  path: "/store-preview",
  title: "Store listing preview — Onstage",
  description:
    "See a screenshot set the way the App Store or Google Play lays it out on a listing.",
});

// StorePageScreen reads ?set= with useSearchParams, which a statically
// exported page must render under a Suspense boundary.
export default function StorePreviewPage() {
  return (
    <Suspense>
      <StorePageScreen />
    </Suspense>
  );
}
