import type { Metadata } from "next";
import { OnboardingScreen } from "@/components/onstage/screens/OnboardingScreen";

export const metadata: Metadata = { title: "First set — Onstage" };

export default function OnboardingPage() {
  return <OnboardingScreen />;
}
