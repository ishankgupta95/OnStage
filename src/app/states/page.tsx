import type { Metadata } from "next";
import { StatesScreen } from "@/components/onstage/screens/StatesScreen";

export const metadata: Metadata = { title: "Error & edge states — Onstage" };

export default function StatesPage() {
  return <StatesScreen />;
}
