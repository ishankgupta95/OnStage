import type { Metadata } from "next";
import { BGS, TEMPLATES } from "@/lib/onstage/data";
import { angleLabel } from "@/lib/onstage/templateFacts";
import { pageMetadata } from "@/lib/site";
import { TemplateDetailScreen } from "@/components/onstage/screens/TemplateDetailScreen";

export function generateStaticParams() {
  return TEMPLATES.map((t) => ({ slug: t.slug }));
}

// Only the templates above exist: any other slug is a 404, never a copy of
// the first template's page (the static export already works this way).
export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const tpl = TEMPLATES.find((t) => t.slug === slug);
  if (!tpl) return { title: "Template — Onstage" };
  // What applying it really sets (the page's own facts), not its tagline —
  // the taglines promise effects the templates don't have yet (SCREENSA-3).
  const bg = BGS.find((b) => b.id === tpl.bg)?.label ?? tpl.bg;
  const angle = angleLabel(tpl.ty).toLowerCase();
  return pageMetadata({
    path: `/templates/${tpl.slug}`,
    title: `${tpl.name} — Onstage`,
    description: `${tpl.name}, a look for App Store and Google Play screenshots: the ${bg} background${
      tpl.panoramic ? " running across every frame" : ""
    }, the phone ${angle === "flat" ? "flat" : `turned ${angle}`}. Start a set from it in Onstage.`,
  });
}

export default async function TemplateDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <TemplateDetailScreen slug={slug} />;
}
