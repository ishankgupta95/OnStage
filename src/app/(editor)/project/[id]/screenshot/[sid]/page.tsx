import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getTeamRole, canEdit } from "@/lib/workspace";
import Editor, { type RailShot } from "@/components/editor/Editor";
import { DEFAULT_DOC, type EditorDoc } from "@/lib/editorDoc";

function toDoc(config: unknown): EditorDoc {
  const c = config as Partial<EditorDoc> | null;
  return c && Array.isArray(c.textLayers) ? (c as EditorDoc) : DEFAULT_DOC;
}

export default async function ScreenshotEditorPage({
  params,
}: {
  params: Promise<{ id: string; sid: string }>;
}) {
  const { id, sid } = await params;
  const user = await requireUser();
  const supabase = await createClient();

  // Load every screenshot in the project so the filmstrip can switch in place
  // without a round-trip; the current one supplies the initial editor doc.
  const { data: rows } = await supabase
    .from("screenshots")
    .select("id,position,thumbnail_url,config")
    .eq("project_id", id)
    .order("position");

  const screenshots: RailShot[] = (rows ?? []).map((row) => ({
    id: row.id as string,
    position: row.position as number,
    thumbnailUrl: (row.thumbnail_url as string | null) ?? null,
    doc: toDoc(row.config),
  }));

  const current = screenshots.find((s) => s.id === sid);
  if (!current) notFound();

  const { data: project } = await supabase.from("projects").select("name, team_id").eq("id", id).single();
  const role = project ? await getTeamRole(supabase, project.team_id as string, user.id) : null;

  return (
    <Editor
      initialDoc={current.doc}
      screenshotId={sid}
      projectId={id}
      projectName={project?.name ?? "Project"}
      screenshots={screenshots}
      canEdit={canEdit(role)}
    />
  );
}
