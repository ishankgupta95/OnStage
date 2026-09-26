import type { Metadata } from "next";
import { TEMPLATES } from "@/lib/onstage/data";
import { TemplateDetailScreen } from "@/components/onstage/screens/TemplateDetailScreen";

export function generateStaticParams() {
  return TEMPLATES.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const tpl = TEMPLATES.find((t) => t.slug === slug);
  return { title: `${tpl?.name ?? "Template"} — Onstage` };
}

export default async function TemplateDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <TemplateDetailScreen slug={slug} />;
}
