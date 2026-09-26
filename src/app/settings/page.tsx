import type { Metadata } from "next";
import { Suspense } from "react";
import { SettingsScreen } from "@/components/onstage/screens/SettingsScreen";

export const metadata: Metadata = { title: "Settings — Onstage" };

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsScreen />
    </Suspense>
  );
}
