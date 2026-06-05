"use client";

import Link from "next/link";
import { ArrowLeftIcon, MonitorIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Shown instead of the editor on small viewports. The editor is desktop-only
// (3-pane layout + precise pointer work), so we send mobile users back rather
// than render a cramped, broken canvas.
export default function EditorMobileBlock({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName: string;
}) {
  return (
    <div className="grid min-h-screen place-items-center bg-background px-6">
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-border bg-card/40 px-6 py-12 text-center">
        <div className="bp-grid pointer-events-none absolute inset-0 opacity-60 [mask-image:radial-gradient(70%_60%_at_50%_25%,black,transparent)]" />
        <div className="relative">
          <span className="mx-auto mb-6 grid size-14 place-items-center rounded-2xl bg-primary/12 text-primary ring-1 ring-primary/25">
            <MonitorIcon className="size-7" />
          </span>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Desktop only</p>
          <h1 className="mt-2 text-xl font-bold tracking-tight">The editor needs a bigger screen</h1>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
            Onstage&apos;s screenshot editor is built for a mouse and room to work — pixel-precise framing, layers, and
            live export. Open <span className="font-medium text-foreground">{projectName}</span> on a Mac or PC to edit.
          </p>
          <div className="mt-7 flex items-center justify-center gap-2">
            <Link
              href={`/project/${projectId}`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
            >
              <ArrowLeftIcon className="size-4" />
              Back to project
            </Link>
            <Link href="/dashboard" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
              Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
