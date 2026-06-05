"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRightIcon, FolderPlusIcon, ImageIcon, Loader2, PlusIcon, Trash2Icon } from "lucide-react";
import { listProjects, deleteProject, seedDemoIfEmpty, type ProjectSummary } from "@/lib/localData";
import { projectHref } from "@/lib/routes";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ThemeToggle";

function fmtDate(v: number | null) {
  if (!v) return "—";
  return new Date(v).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function Mark() {
  return (
    <span className="grid size-9 place-items-center rounded-[9px] bg-primary/12 text-primary ring-1 ring-primary/25">
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="7" y="2.5" width="10" height="19" rx="3" />
        <line x1="10.5" y1="5" x2="13.5" y2="5" strokeLinecap="round" />
      </svg>
    </span>
  );
}

export default function DashboardPage() {
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);

  const refresh = useCallback(async () => {
    setProjects(await listProjects());
  }, []);

  useEffect(() => {
    let active = true;
    // Seed a couple of demo projects on first visit so the showcase isn't empty.
    seedDemoIfEmpty()
      .then(() => listProjects())
      .then((p) => active && setProjects(p))
      .catch(() => active && setProjects([]));
    return () => {
      active = false;
    };
  }, []);

  async function onDelete(id: string) {
    await deleteProject(id);
    await refresh();
  }

  const totalShots = (projects ?? []).reduce((n, p) => n + p.count, 0);

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10 sm:px-8 lg:py-14">
      <header className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2">
          <Link href="/" aria-label="Onstage home" className="shrink-0">
            <Mark />
          </Link>
          <span className="font-extrabold tracking-tight">Onstage</span>
          <span className="hidden rounded-full border border-border bg-muted/50 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground sm:inline">
            Demo
          </span>
        </div>
        <ThemeToggle />
      </header>

      <section className="mt-10 flex flex-col gap-5 border-b border-border pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Your apps</h2>
          <p className="mt-2 flex flex-wrap items-center gap-x-2 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            <span className="tabular-nums text-foreground/80">{projects?.length ?? 0}</span> project
            {(projects?.length ?? 0) === 1 ? "" : "s"}
            <span className="text-border">·</span>
            <span className="tabular-nums text-foreground/80">{totalShots}</span> screenshot{totalShots === 1 ? "" : "s"}
          </p>
        </div>
        <Link href="/project/new" className={cn(buttonVariants({ size: "sm" }), "h-9 shrink-0 gap-1.5 self-start px-3.5 sm:self-auto")}>
          <PlusIcon className="size-4" />
          New project
        </Link>
      </section>

      {projects === null ? (
        <div className="mt-8 flex items-center justify-center gap-2 py-24 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading your projects…
        </div>
      ) : projects.length === 0 ? (
        <div className="relative mt-8 overflow-hidden rounded-3xl border border-border bg-card/40 px-6 py-20 text-center">
          <div className="bp-grid pointer-events-none absolute inset-0 opacity-60 [mask-image:radial-gradient(70%_60%_at_50%_25%,black,transparent)]" />
          <div className="relative">
            <span className="mx-auto mb-6 grid size-14 place-items-center rounded-2xl bg-primary/12 text-primary ring-1 ring-primary/25">
              <FolderPlusIcon className="size-7" />
            </span>
            <h2 className="text-xl font-bold tracking-tight">No projects yet</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
              A project is one app — it holds all of its store screenshots. Click New project to pick a starting template
              and create your first.
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p, i) => (
            <div
              key={p.id}
              style={{ ["--tw-animation-delay" as string]: `${i * 55}ms` }}
              className="group relative animate-in fade-in slide-in-from-bottom-2 overflow-hidden rounded-2xl border border-border bg-card duration-500 fill-mode-both transition-all hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-lg hover:shadow-black/5"
            >
              <Link href={projectHref(p.id)} className="block">
                <div className="relative aspect-[4/3] overflow-hidden border-b border-border bg-muted/40">
                  <div className="bp-grid absolute inset-0 opacity-50" />
                  {p.cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.cover} alt="" className="relative h-full w-full object-contain p-5 drop-shadow-xl transition-transform duration-300 group-hover:scale-[1.03]" />
                  ) : (
                    <div className="relative flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
                      <ImageIcon className="size-6 opacity-50" />
                      <span className="text-[11px]">No screenshots yet</span>
                    </div>
                  )}
                  <span className="absolute left-2.5 top-2.5 rounded-md bg-background/85 px-2 py-0.5 font-mono text-[10px] font-semibold tabular-nums text-foreground shadow-sm backdrop-blur">
                    {p.count} {p.count === 1 ? "shot" : "shots"}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-2 p-4">
                  <div className="min-w-0">
                    <p className="truncate font-semibold tracking-tight">{p.name}</p>
                    <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Edited {fmtDate(p.updatedAt)}</p>
                  </div>
                  <ArrowUpRightIcon className="size-4 shrink-0 -translate-x-1 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                </div>
              </Link>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void onDelete(p.id);
                }}
                className="absolute right-2.5 top-2.5 z-10 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100"
              >
                <Button variant="ghost" size="icon-sm" type="submit" aria-label={`Delete ${p.name}`} className="bg-background/85 backdrop-blur hover:text-destructive">
                  <Trash2Icon />
                </Button>
              </form>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
