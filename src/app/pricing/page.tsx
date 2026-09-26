import type { Metadata } from "next";
import { FEATURES } from "@/lib/features";
import { PricingScreen } from "@/components/onstage/screens/PricingScreen";
import { NotFoundScreen } from "@/components/onstage/screens/NotFoundScreen";

export const metadata: Metadata = {
  title: FEATURES.billing ? "Pricing — Onstage" : "Not found — Onstage",
};

// See the note in /signin: gated routes render the 404 body rather than
// redirect, because `output: export` cannot redirect.
export default function PricingPage() {
  return FEATURES.billing ? <PricingScreen /> : <NotFoundScreen />;
}
