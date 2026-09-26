import type { Metadata } from "next";
import { FEATURES } from "@/lib/features";
import { NOT_INDEXED } from "@/lib/site";
import { QueueScreen } from "@/components/onstage/screens/QueueScreen";
import { NotFoundScreen } from "@/components/onstage/screens/NotFoundScreen";

export const metadata: Metadata = {
  title: FEATURES.jobQueue ? "Renders & uploads — Onstage" : "Not found — Onstage",
  // Flagged off it renders the 404 body: keep it out of search.
  ...(FEATURES.jobQueue ? {} : { robots: NOT_INDEXED }),
};

// Every export renders in this tab, so there is no queue to show: the jobs
// are fixture data and their Retry / Download buttons can't act (plan D3).
export default function QueuePage() {
  return FEATURES.jobQueue ? <QueueScreen /> : <NotFoundScreen />;
}
