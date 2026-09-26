import type { Metadata } from "next";
import { Suspense } from "react";
import { StorePageScreen } from "@/components/onstage/screens/StorePageScreen";

export const metadata: Metadata = { title: "Store listing preview — Onstage" };

// StorePageScreen reads ?set= with useSearchParams, which a statically
// exported page must render under a Suspense boundary.
export default function StorePreviewPage() {
  return (
    <Suspense>
      <StorePageScreen />
    </Suspense>
  );
}
