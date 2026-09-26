import type { Metadata } from "next";
import { BrandScreen } from "@/components/onstage/screens/BrandScreen";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  path: "/brand",
  title: "Brand kits — Onstage",
  description:
    "Brand kits for your screenshot sets: apply a kit's device frame, caption alignment and angle to a set in one step.",
});

export default function BrandPage() {
  return <BrandScreen />;
}
