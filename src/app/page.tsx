import type { Metadata } from "next";
import { LandingScreen } from "@/components/onstage/screens/LandingScreen";
import { SITE_DESCRIPTION, pageMetadata } from "@/lib/site";

// The root layout's title; the canonical link is the page's own.
export const metadata: Metadata = pageMetadata({ path: "/", description: SITE_DESCRIPTION });

export default function Home() {
  return <LandingScreen />;
}
