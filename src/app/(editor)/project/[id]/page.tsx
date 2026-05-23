import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, DownloadIcon, PlusIcon } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createScreenshot, renameProject } from "@/app/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import ScreenshotGrid, { type Shot } from "@/components/editor/ScreenshotGrid";

function formatDate(value: string | null | undefined) {
  if (!value) return null;
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireUser();
  const supabase = await createClient();

  const { data: project } = await supabase.from("projects").select("id,name,updated_at").eq("id", id).single();
  if (!project) notFound();

  const { data: screenshots } = await supabase
    .from("screenshots")
    .select("id,position,device_frame,layout_preset,thumbnail_url,config")
    .eq("project_id", id)
    .order("position");

  const shots: Shot[] = (screenshots ?? []).map((s) => ({
    id: s.id as string,
    device_frame: s.device_frame as string,
    layout_preset: s.layout_preset as string,
    thumbnail_url: s.thumbnail_url as string | null,
    orientation: (s.config as { orientation?: "portrait" | "landscape" } | null)?.orientation,
  }));

  const edited = formatDate(project.updated_at as string | undefined);

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10 sm:px-8">
      {/* breadcrumb */}
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeftIcon className="size-3.5" />
        Dashboard
      </Link>

      {/* header */}
      <header className="mt-4 flex flex-col gap-5 border-b border-border pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <span className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Project</span>
          <form action={renameProject} className="group/name relative mt-1.5 flex items-center gap-2">
            <input type="hidden" name="id" value={id} />
            <input
              name="name"
              defaultValue={project.name}
              aria-label="Project name"
              className="-ml-2 w-full max-w-md rounded-lg border border-transparent bg-transparent px-2 py-1 text-3xl font-extrabold tracking-tight outline-none transition-colors hover:bg-muted/60 focus:border-border focus:bg-card sm:text-4xl"
            />
            <button
              type="submit"
              className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-focus-within/name:opacity-100"
            >
              Save
            </button>
          </form>
          <p className="mt-2 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
            <span className="tabular-nums">
              {shots.length} screenshot{shots.length === 1 ? "" : "s"}
            </span>
            {edited && (
              <>
                <span className="text-border">·</span>
                <span>Edited {edited}</span>
              </>
            )}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {shots.length > 0 && (
            <Link
              href={`/project/${id}/screenshot/${shots[0].id}`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-9 gap-1.5 px-3.5")}
            >
              <DownloadIcon className="size-4" />
              Export
            </Link>
          )}
          <form action={createScreenshot}>
            <input type="hidden" name="projectId" value={id} />
            <Button type="submit" size="sm" className="h-9 gap-1.5 px-3.5">
              <PlusIcon className="size-4" />
              New screenshot
            </Button>
          </form>
        </div>
      </header>

      {shots.length === 0 ? (
        <div className="relative mt-8 overflow-hidden rounded-3xl border border-border bg-card/40 px-6 py-16 text-center sm:py-20">
          <div className="bp-grid pointer-events-none absolute inset-0 opacity-60 [mask-image:radial-gradient(70%_60%_at_50%_25%,black,transparent)]" />
          <div className="relative">
            {/* ghost frames illustration */}
            <div className="mx-auto mb-8 flex items-end justify-center gap-3" aria-hidden>
              <div className="h-20 w-11 rounded-xl border-2 border-dashed border-border" />
              <div className="grid h-28 w-14 place-items-center rounded-xl border-2 border-dashed border-primary/40 bg-primary/[0.06] text-primary">
                <PlusIcon className="size-6" />
              </div>
              <div className="h-20 w-11 rounded-xl border-2 border-dashed border-border" />
            </div>
            <h2 className="text-xl font-bold tracking-tight">Your store gallery starts here</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
              Add a screenshot, drop in a capture, then pick a layout and background. Every screenshot for this app lives together in one project.
            </p>
            <form action={createScreenshot} className="mt-6 inline-block">
              <input type="hidden" name="projectId" value={id} />
              <Button type="submit" className="h-10 gap-1.5 px-5">
                <PlusIcon className="size-4" />
                New screenshot
              </Button>
            </form>
          </div>
        </div>
      ) : (
        <div className="mt-8">
          <ScreenshotGrid projectId={id} screenshots={shots} />
        </div>
      )}
    </main>
  );
}
