"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser, getUser } from "@/lib/auth";
import { ensureWorkspace } from "@/lib/workspace";
import { DEFAULT_DOC, type EditorDoc } from "@/lib/editorDoc";

export async function createProject(formData: FormData) {
  const user = await requireUser();
  const supabase = await createClient();
  const teamId = await ensureWorkspace(supabase, user.id);
  const name = ((formData.get("name") as string) || "").trim() || "Untitled app";
  const { data, error } = await supabase
    .from("projects")
    .insert({ team_id: teamId, name, created_by: user.id })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to create project");
  revalidatePath("/dashboard");
  redirect(`/project/${data.id}`);
}

export async function deleteProject(formData: FormData) {
  await requireUser();
  const supabase = await createClient();
  await supabase.from("projects").delete().eq("id", formData.get("id") as string);
  revalidatePath("/dashboard");
}

export async function renameProject(formData: FormData) {
  const id = formData.get("id") as string;
  const name = ((formData.get("name") as string) || "").trim();
  await requireUser();
  const supabase = await createClient();
  if (name) await supabase.from("projects").update({ name }).eq("id", id);
  revalidatePath(`/project/${id}`);
  revalidatePath("/dashboard");
}

export async function reorderScreenshots(projectId: string, ids: string[]) {
  await requireUser();
  const supabase = await createClient();
  await Promise.all(ids.map((id, i) => supabase.from("screenshots").update({ position: i }).eq("id", id)));
  revalidatePath(`/project/${projectId}`);
}

export async function moveScreenshot(formData: FormData) {
  const id = formData.get("id") as string;
  const projectId = formData.get("projectId") as string;
  const dir = formData.get("dir") as string;
  await requireUser();
  const supabase = await createClient();
  const { data: shots } = await supabase
    .from("screenshots")
    .select("id,position")
    .eq("project_id", projectId)
    .order("position");
  if (!shots) return;
  const idx = shots.findIndex((s) => s.id === id);
  const swapIdx = dir === "up" ? idx - 1 : idx + 1;
  if (idx < 0 || swapIdx < 0 || swapIdx >= shots.length) return;
  const a = shots[idx];
  const b = shots[swapIdx];
  await supabase.from("screenshots").update({ position: b.position }).eq("id", a.id);
  await supabase.from("screenshots").update({ position: a.position }).eq("id", b.id);
  revalidatePath(`/project/${projectId}`);
}

async function nextPosition(supabase: Awaited<ReturnType<typeof createClient>>, projectId: string) {
  const { data } = await supabase
    .from("screenshots")
    .select("position")
    .eq("project_id", projectId)
    .order("position", { ascending: false })
    .limit(1);
  return data && data.length ? (data[0].position as number) + 1 : 0;
}

export async function createScreenshot(formData: FormData) {
  const projectId = formData.get("projectId") as string;
  await requireUser();
  const supabase = await createClient();
  const position = await nextPosition(supabase, projectId);
  const { data, error } = await supabase
    .from("screenshots")
    .insert({
      project_id: projectId,
      position,
      device_frame: DEFAULT_DOC.device,
      layout_preset: DEFAULT_DOC.layout,
      config: DEFAULT_DOC,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to create screenshot");
  redirect(`/project/${projectId}/screenshot/${data.id}`);
}

export async function duplicateScreenshot(formData: FormData) {
  const id = formData.get("id") as string;
  const projectId = formData.get("projectId") as string;
  await requireUser();
  const supabase = await createClient();
  const { data: src } = await supabase.from("screenshots").select("*").eq("id", id).single();
  if (src) {
    const position = await nextPosition(supabase, projectId);
    await supabase.from("screenshots").insert({
      project_id: projectId,
      position,
      device_frame: src.device_frame,
      layout_preset: src.layout_preset,
      config: src.config,
      source_image_url: src.source_image_url,
    });
  }
  revalidatePath(`/project/${projectId}`);
}

export async function deleteScreenshot(formData: FormData) {
  const projectId = formData.get("projectId") as string;
  await requireUser();
  const supabase = await createClient();
  await supabase.from("screenshots").delete().eq("id", formData.get("id") as string);
  revalidatePath(`/project/${projectId}`);
}

// Every screenshot's doc for a project, ordered by position. Used by the
// "export all screenshots" path. RLS scopes this to the caller's team.
export async function getProjectScreenshotConfigs(projectId: string) {
  await requireUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("screenshots")
    .select("id,position,config")
    .eq("project_id", projectId)
    .order("position");
  return (data ?? []).map((row) => {
    const config = row.config as Partial<EditorDoc> | null;
    const doc: EditorDoc = config && Array.isArray(config.textLayers) ? (config as EditorDoc) : DEFAULT_DOC;
    return { id: row.id as string, position: row.position as number, doc };
  });
}

// Best-effort export usage record (free-tier limit enforcement, Phase 6).
// Never throws on the export path — failures are swallowed by the caller.
export async function recordExport(projectId: string, count: number) {
  const user = await getUser();
  if (!user) return { ok: false };
  const supabase = await createClient();
  const { data: project } = await supabase.from("projects").select("team_id").eq("id", projectId).single();
  if (!project) return { ok: false };
  await supabase.from("export_history").insert({
    team_id: project.team_id,
    project_id: projectId,
    user_id: user.id,
    export_count: count,
  });
  return { ok: true };
}

// Saves a small preview image (data URL) for the project page. Best-effort.
// Revalidates the project page so its cards reflect the latest screenshot.
export async function saveThumbnail(id: string, dataUrl: string, projectId?: string) {
  const user = await getUser();
  if (!user) return { ok: false };
  const supabase = await createClient();
  await supabase.from("screenshots").update({ thumbnail_url: dataUrl }).eq("id", id);
  if (projectId) revalidatePath(`/project/${projectId}`);
  return { ok: true };
}

// Autosave. Updates config and snapshots a version at most once/minute (pruned to 30).
export async function saveScreenshotConfig(id: string, doc: EditorDoc) {
  const user = await requireUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("screenshots")
    .update({ config: doc, device_frame: doc.device, layout_preset: doc.layout })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  const { data: last } = await supabase
    .from("screenshot_versions")
    .select("created_at")
    .eq("screenshot_id", id)
    .order("created_at", { ascending: false })
    .limit(1);
  const lastMs = last && last.length ? new Date(last[0].created_at as string).getTime() : 0;
  if (Date.now() - lastMs > 60_000) {
    await supabase.from("screenshot_versions").insert({ screenshot_id: id, config: doc, created_by: user.id });
    const { data: stale } = await supabase
      .from("screenshot_versions")
      .select("id")
      .eq("screenshot_id", id)
      .order("created_at", { ascending: false })
      .range(30, 1000);
    if (stale && stale.length) {
      await supabase
        .from("screenshot_versions")
        .delete()
        .in(
          "id",
          stale.map((s) => s.id),
        );
    }
  }

  return { ok: true };
}
