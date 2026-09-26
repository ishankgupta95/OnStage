import type { Metadata } from "next";
import { EmptyScreen } from "@/components/onstage/screens/EmptyScreen";
import { NOT_INDEXED } from "@/lib/site";

// The empty dashboard as the design board shows it; nothing links here (the
// real dashboard shows its own empty state), so it stays out of search.
export const metadata: Metadata = { title: "No sets yet — Onstage", robots: NOT_INDEXED };

export default function EmptyPage() {
  return <EmptyScreen />;
}
