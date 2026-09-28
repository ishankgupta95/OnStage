"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeftIcon, DownloadIcon, PlusIcon } from "lucide-react";
import { toast } from "sonner";
import { getProject, renameProject, createScreenshot } from "@/lib/localData";
import { editorHref } from "@/lib/routes";
import { MAX_SET_SCREENSHOTS, SET_FULL_MESSAGE } from "@/lib/sizes";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import ScreenshotGrid, { type Shot } from "@/components/editor/ScreenshotGrid";

// Flat, static board route (replaces the dynamic /project/[id]). The project id
// comes from ?p= and the data is loaded from IndexedDB on the client.

function fmtDate(value: number | null | undefined) {
  if (!value) return null;
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function toShot(s: { id: string; thumbnailUrl: string | null; doc: { device: string; layout: string; orientation?: "portrait" | "landscape" } }): Shot {
  return {
    id: s.id,
    device_frame: s.doc.device,
    layout_preset: s.doc.layout,
    thumbnail_url: s.thumbnailUrl,
    orientation: s.doc.orientation,
  };
}

type LoadState =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "ready"; id: string; name: string; updatedAt: number; shots: Shot[] };

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-[60vh] items-center justify-center p-8 text-sm text-muted-foreground">{children}</div>;
}

function ProjectBoard() {
  const router = useRouter();
  const params = useSearchParams();
  const projectId = params.get("p");
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [name, setName] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      if (!projectId) {
        if (active) setState({ status: "missing" });
        return;
      }
      try {
        const proj = await getProject(projectId);
        if (!active) return;
        if (!proj) {
          setState({ status: "missing" });
          return;
        }
        setName(proj.name);
        setState({ status: "ready", id: proj.id, name: proj.name, updatedAt: proj.updatedAt, shots: proj.shots.map(toShot) });
      } catch {
        if (active) setState({ status: "missing" });
      }
    })();
    return () => {
      active = false;
    };
  }, [projectId]);

  if (state.status === "loading") return <Centered>Loading project…</Centered>;
  if (state.status === "missing") {
    return (
      <main className="mx-auto w-full max-w-5xl px-6 py-16 text-center sm:px-8">
        <h1 className="text-xl font-bold tracking-tight">Project not found</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
          Projects live only in the browser that created them. Open one of yours from the dashboard.
        </p>
        <Link href="/dashboard" className={cn(buttonVariants({ size: "sm" }), "mt-5 gap-1.5")}>
          <ArrowLeftIcon className="size-4" />
          Back to dashboard
        </Link>
      </main>
    );
  }

  const { id, shots, updatedAt, name: savedName } = state;
  const edited = fmtDate(updatedAt);

  async function saveName() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === savedName) return;
    await renameProject(id, trimmed);
    setState((s) => (s.status === "ready" ? { ...s, name: trimmed } : s));
  }

  async function addScreen() {
    if (shots.length >= MAX_SET_SCREENSHOTS) {
      toast.error(SET_FULL_MESSAGE);
      return;
    }
    const created = await createScreenshot(id);
    if (!created) {
      toast.error("Couldn't add screenshot");
      return;
    }
    router.push(editorHref(id, created.id));
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10 sm:px-8">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeftIcon className="size-3.5" />
        Dashboard
      </Link>

      <header className="mt-4 flex flex-col gap-5 border-b border-border pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <span className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Project</span>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void saveName();
            }}
            className="group/name relative mt-1.5 flex items-center gap-2"
          >
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => void saveName()}
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
              href={editorHref(id, shots[0].id)}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-9 gap-1.5 px-3.5")}
            >
              <DownloadIcon className="size-4" />
              Export
            </Link>
          )}
          <Button type="button" size="sm" className="h-9 gap-1.5 px-3.5" onClick={addScreen}>
            <PlusIcon className="size-4" />
            New screenshot
          </Button>
        </div>
      </header>

      {shots.length === 0 ? (
        <div className="relative mt-8 overflow-hidden rounded-3xl border border-border bg-card/40 px-6 py-16 text-center sm:py-20">
          <div className="bp-grid pointer-events-none absolute inset-0 opacity-60 [mask-image:radial-gradient(70%_60%_at_50%_25%,black,transparent)]" />
          <div className="relative">
            <div className="mx-auto mb-8 flex items-end justify-center gap-3" aria-hidden>
              <div className="h-20 w-11 rounded-xl border-2 border-dashed border-border" />
              <div className="grid h-28 w-14 place-items-center rounded-xl border-2 border-dashed border-primary/40 bg-primary/[0.06] text-primary">
                <PlusIcon className="size-6" />
              </div>
              <div className="h-20 w-11 rounded-xl border-2 border-dashed border-border" />
            </div>
            <h2 className="text-xl font-bold tracking-tight">Your store gallery starts here</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
              Add a screenshot, drop in a capture, then pick a layout and background. Every screenshot for this app lives
              together in one project.
            </p>
            <Button onClick={addScreen} className="mt-6 h-10 gap-1.5 px-5">
              <PlusIcon className="size-4" />
              New screenshot
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-8">
          <ScreenshotGrid projectId={id} screenshots={shots} canEdit />
        </div>
      )}
    </main>
  );
}

export default function ProjectPage() {
  return (
    <Suspense fallback={<Centered>Loading project…</Centered>}>
      <ProjectBoard />
    </Suspense>
  );
}
