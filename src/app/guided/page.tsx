import type { Metadata } from "next";
import { GuidedScreen } from "@/components/onstage/screens/GuidedScreen";

export const metadata: Metadata = { title: "Guided — Onstage" };

export default function GuidedPage() {
  return <GuidedScreen />;
}
