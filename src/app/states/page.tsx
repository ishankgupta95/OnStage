import type { Metadata } from "next";
import { FEATURES } from "@/lib/features";
import { NOT_INDEXED } from "@/lib/site";
import { StatesScreen } from "@/components/onstage/screens/StatesScreen";
import { NotFoundScreen } from "@/components/onstage/screens/NotFoundScreen";

export const metadata: Metadata = {
  title: FEATURES.designBoards ? "Error & edge states — Onstage" : "Not found — Onstage",
  // Flagged off it renders the 404 body: keep it out of search.
  ...(FEATURES.designBoards ? {} : { robots: NOT_INDEXED }),
};

// A design-review board of fixture error cards, not a product page (plan D3).
export default function StatesPage() {
  return FEATURES.designBoards ? <StatesScreen /> : <NotFoundScreen />;
}
