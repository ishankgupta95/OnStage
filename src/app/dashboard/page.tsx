import type { Metadata } from "next";
import { DashboardScreen } from "@/components/onstage/screens/DashboardScreen";

export const metadata: Metadata = { title: "Your apps — Onstage" };

export default function DashboardPage() {
  return <DashboardScreen />;
}
