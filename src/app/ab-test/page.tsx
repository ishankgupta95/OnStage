import type { Metadata } from "next";
import { FEATURES } from "@/lib/features";
import { NOT_INDEXED } from "@/lib/site";
import { AbTestScreen } from "@/components/onstage/screens/AbTestScreen";
import { NotFoundScreen } from "@/components/onstage/screens/NotFoundScreen";

export const metadata: Metadata = {
  title: FEATURES.abTest ? "A/B test — Onstage" : "Not found — Onstage",
  // Flagged off it renders the 404 body: keep it out of search.
  ...(FEATURES.abTest ? {} : { robots: NOT_INDEXED }),
};

// The results are fixture data and "Promote variant B" has nowhere to send
// the winner without a store backend (plan D3). See the note in /signin:
// gated routes render the 404 body because `output: export` can't redirect.
export default function AbTestPage() {
  return FEATURES.abTest ? <AbTestScreen /> : <NotFoundScreen />;
}
