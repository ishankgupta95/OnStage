import type { Metadata } from "next";
import { BrandScreen } from "@/components/onstage/screens/BrandScreen";

export const metadata: Metadata = { title: "Brand kits — Onstage" };

export default function BrandPage() {
  return <BrandScreen />;
}
