import type { Metadata } from "next";
import { StorePageScreen } from "@/components/onstage/screens/StorePageScreen";

export const metadata: Metadata = { title: "Store listing preview — Onstage" };

export default function StorePreviewPage() {
  return <StorePageScreen />;
}
