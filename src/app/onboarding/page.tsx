import type { Metadata } from "next";
import { OnboardingScreen } from "@/components/onstage/screens/OnboardingScreen";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  path: "/onboarding",
  title: "First set — Onstage",
  description:
    "Start a screenshot set: upload your app's screens and pick a look.",
});

export default function OnboardingPage() {
  return <OnboardingScreen />;
}
