import type { Metadata } from "next";
import { FEATURES } from "@/lib/features";
import { ReviewScreen } from "@/components/onstage/screens/ReviewScreen";
import { NotFoundScreen } from "@/components/onstage/screens/NotFoundScreen";

export const metadata: Metadata = {
  title: FEATURES.teams ? "Review — Onstage" : "Not found — Onstage",
};

// Comments would work single-player, but the seeded threads are from named
// collaborators, so the whole route rides on `teams` for now.
export default function ReviewPage() {
  return FEATURES.teams ? <ReviewScreen /> : <NotFoundScreen />;
}
