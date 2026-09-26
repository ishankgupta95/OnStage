import type { Metadata } from "next";
import { TemplatesScreen } from "@/components/onstage/screens/TemplatesScreen";

export const metadata: Metadata = { title: "Templates — Onstage" };

export default function TemplatesPage() {
  return <TemplatesScreen />;
}
