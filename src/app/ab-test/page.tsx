import type { Metadata } from "next";
import { AbTestScreen } from "@/components/onstage/screens/AbTestScreen";

export const metadata: Metadata = { title: "A/B test — Onstage" };

export default function AbTestPage() {
  return <AbTestScreen />;
}
