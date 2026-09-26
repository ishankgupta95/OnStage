import type { Metadata } from "next";
import { TemplatesScreen } from "@/components/onstage/screens/TemplatesScreen";
import { TEMPLATE_COUNT } from "@/lib/onstage/data";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  path: "/templates",
  title: "Templates — Onstage",
  description: `Start a set from one of ${TEMPLATE_COUNT} looks for App Store and Google Play screenshots: a background, an angle and a caption layout.`,
});

export default function TemplatesPage() {
  return <TemplatesScreen />;
}
