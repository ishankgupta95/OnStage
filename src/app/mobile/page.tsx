import type { Metadata } from "next";
import { FEATURES } from "@/lib/features";
import { NOT_INDEXED } from "@/lib/site";
import { MobileScreen } from "@/components/onstage/screens/MobileScreen";
import { NotFoundScreen } from "@/components/onstage/screens/NotFoundScreen";

export const metadata: Metadata = {
  title: FEATURES.designBoards ? "Marketing at 390px — Onstage" : "Not found — Onstage",
  // Flagged off it renders the 404 body: keep it out of search.
  ...(FEATURES.designBoards ? {} : { robots: NOT_INDEXED }),
};

// A design-review board: mock phones whose buttons do nothing (plan D3).
export default function MobilePage() {
  return FEATURES.designBoards ? <MobileScreen /> : <NotFoundScreen />;
}
