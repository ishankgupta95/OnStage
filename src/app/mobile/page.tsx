import type { Metadata } from "next";
import { MobileScreen } from "@/components/onstage/screens/MobileScreen";

export const metadata: Metadata = { title: "Marketing at 390px — Onstage" };

export default function MobilePage() {
  return <MobileScreen />;
}
