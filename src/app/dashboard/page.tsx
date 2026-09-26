import type { Metadata } from "next";
import { DashboardScreen } from "@/components/onstage/screens/DashboardScreen";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  path: "/dashboard",
  title: "Your apps — Onstage",
  description:
    "Your apps and their screenshot sets, saved in this browser.",
});

export default function DashboardPage() {
  return <DashboardScreen />;
}
