import type { Metadata } from "next";
import { EmptyScreen } from "@/components/onstage/screens/EmptyScreen";

export const metadata: Metadata = { title: "No sets yet — Onstage" };

export default function EmptyPage() {
  return <EmptyScreen />;
}
