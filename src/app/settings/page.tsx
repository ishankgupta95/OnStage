import type { Metadata } from "next";
import { Suspense } from "react";
import { SettingsScreen } from "@/components/onstage/screens/SettingsScreen";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  path: "/settings",
  title: "Settings — Onstage",
  description:
    "Onstage's settings for this browser: how you like to work and the store new sets start on.",
});

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsScreen />
    </Suspense>
  );
}
