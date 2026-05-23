"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useEditorStore } from "@/store/editor";
import { ThemeToggle } from "@/components/ThemeToggle";
import ExportDialog from "./ExportDialog";

export default function TopBar({ projectName, projectId }: { projectName: string; projectId: string }) {
  const saveState = useEditorStore((s) => s.saveState);

  return (
    <header className="flex h-14 items-center justify-between border-b px-4">
      <div className="flex items-center gap-2">
        <Link href="/dashboard" className="font-semibold tracking-tight">
          Onstage
        </Link>
        <span className="text-muted-foreground">/</span>
        <Link href={`/project/${projectId}`} className="text-sm hover:underline">
          {projectName}
        </Link>
        <span className="ml-2 inline-flex w-16 items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {saveState !== "idle" && (
            <span className={`size-1.5 rounded-full ${saveState === "saving" ? "bg-primary animate-pulse" : "bg-muted-foreground/50"}`} />
          )}
          {saveState === "saving" ? "Saving" : saveState === "saved" ? "Saved" : ""}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <Button variant="outline" size="sm">
          Share
        </Button>
        <ExportDialog projectId={projectId} />
      </div>
    </header>
  );
}
