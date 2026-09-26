import type { Metadata } from "next";
import { QueueScreen } from "@/components/onstage/screens/QueueScreen";

export const metadata: Metadata = { title: "Renders & uploads — Onstage" };

export default function QueuePage() {
  return <QueueScreen />;
}
