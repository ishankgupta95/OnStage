"use client";

import Link from "next/link";
import { Share2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useEditorStore } from "@/store/editor";
import { ThemeToggle } from "@/components/ThemeToggle";
import ExportDialog from "./ExportDialog";

function SaveBadge() {
  const saveState = useEditorStore((s) => s.saveState);
  if (saveState === "idle") return <span className="w-14" />;
  const saving = saveState === "saving";
  return (
    <span className="inline-flex w-14 items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
      <span className={`size-1.5 rounded-full ${saving ? "animate-pulse bg-primary" : "bg-emerald-500/70"}`} />
      {saving ? "Saving" : "Saved"}
    </span>
  );
}

export default function TopBar({ projectName, projectId }: { projectName: string; projectId: string }) {
  function copyLink() {
    navigator.clipboard
      .writeText(window.location.href)
      .then(() => toast.success("Link copied to clipboard"))
      .catch(() => toast.error("Couldn't copy link"));
  }

  return (
    <header className="flex h-14 animate-in fade-in slide-in-from-top-2 items-center justify-between border-b px-4 duration-500">
      <div className="flex min-w-0 items-center gap-2.5">
        <Link href="/dashboard" className="flex shrink-0 items-center gap-2">
          <span className="grid size-7 place-items-center rounded-[7px] bg-primary/12 text-primary ring-1 ring-primary/25">
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="7" y="2.5" width="10" height="19" rx="3" />
              <line x1="10.5" y1="5" x2="13.5" y2="5" strokeLinecap="round" />
            </svg>
          </span>
          <span className="font-extrabold tracking-tight">Onstage</span>
        </Link>
        <span className="text-muted-foreground/40">/</span>
        <Link
          href={`/project/${projectId}`}
          className="truncate text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          {projectName}
        </Link>
        <SaveBadge />
      </div>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <Button variant="outline" size="sm" className="gap-1.5" onClick={copyLink}>
          <Share2Icon className="size-3.5" />
          Share
        </Button>
        <ExportDialog projectId={projectId} />
      </div>
    </header>
  );
}
