import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createScreenshot, renameProject } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ScreenshotGrid from "@/components/editor/ScreenshotGrid";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireUser();
  const supabase = await createClient();

  const { data: project } = await supabase.from("projects").select("id,name").eq("id", id).single();
  if (!project) notFound();

  const { data: screenshots } = await supabase
    .from("screenshots")
    .select("id,position,device_frame,layout_preset,thumbnail_url")
    .eq("project_id", id)
    .order("position");

  const shots = screenshots ?? [];

  return (
    <main className="mx-auto max-w-4xl p-8">
      <div className="mb-6">
        <Link href="/dashboard" className="text-xs text-muted-foreground hover:underline">
          ← Projects
        </Link>
        <div className="mt-1 flex items-center justify-between gap-4">
          <form action={renameProject} className="flex items-center gap-2">
            <input type="hidden" name="id" value={id} />
            <Input name="name" defaultValue={project.name} className="h-9 w-72 text-lg font-semibold" aria-label="Project name" />
            <Button variant="outline" size="sm" type="submit">
              Rename
            </Button>
          </form>
          <form action={createScreenshot}>
            <input type="hidden" name="projectId" value={id} />
            <Button type="submit">New screenshot</Button>
          </form>
        </div>
      </div>

      {shots.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <p className="text-sm font-medium">No screenshots yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add your first screenshot to start designing your store gallery.
          </p>
          <form action={createScreenshot} className="mt-4 inline-block">
            <input type="hidden" name="projectId" value={id} />
            <Button type="submit">New screenshot</Button>
          </form>
        </div>
      ) : (
        <ScreenshotGrid projectId={id} screenshots={shots} />
      )}
    </main>
  );
}
