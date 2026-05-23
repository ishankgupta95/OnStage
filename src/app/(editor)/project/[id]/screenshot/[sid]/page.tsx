import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import Editor from "@/components/editor/Editor";
import { DEFAULT_DOC, type EditorDoc } from "@/lib/editorDoc";

export default async function ScreenshotEditorPage({
  params,
}: {
  params: Promise<{ id: string; sid: string }>;
}) {
  const { id, sid } = await params;
  await requireUser();
  const supabase = await createClient();

  const { data: shot } = await supabase.from("screenshots").select("id,config").eq("id", sid).single();
  if (!shot) notFound();

  const { data: project } = await supabase.from("projects").select("name").eq("id", id).single();

  const config = shot.config as Partial<EditorDoc> | null;
  const initialDoc: EditorDoc =
    config && Array.isArray(config.textLayers) ? (config as EditorDoc) : DEFAULT_DOC;

  return (
    <Editor
      initialDoc={initialDoc}
      screenshotId={sid}
      projectId={id}
      projectName={project?.name ?? "Project"}
    />
  );
}
