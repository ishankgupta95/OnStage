import type { Metadata } from "next";
import { FEATURES } from "@/lib/features";
import { NOT_INDEXED } from "@/lib/site";
import { PricingScreen } from "@/components/onstage/screens/PricingScreen";
import { NotFoundScreen } from "@/components/onstage/screens/NotFoundScreen";

export const metadata: Metadata = {
  title: FEATURES.billing ? "Pricing — Onstage" : "Not found — Onstage",
  // Flagged off it renders the 404 body: keep it out of search.
  ...(FEATURES.billing ? {} : { robots: NOT_INDEXED }),
};

// See the note in /signin: gated routes render the 404 body rather than
// redirect, because `output: export` cannot redirect.
export default function PricingPage() {
  return FEATURES.billing ? <PricingScreen /> : <NotFoundScreen />;
}
