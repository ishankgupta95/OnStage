"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import Editor, { type RailShot } from "@/components/editor/Editor";
import { getProject } from "@/lib/localData";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Flat, static editor route. The runtime dynamic segments (/project/[id]/
// screenshot/[sid]) can't be statically exported, so the project + screenshot
// ids come from the query string and the doc set is loaded from IndexedDB on the
// client. Falls back gracefully if the project isn't in this browser.

type LoadState =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "ready"; projectId: string; projectName: string; screenshots: RailShot[]; current: RailShot };

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex h-screen items-center justify-center p-8 text-sm text-muted-foreground">{children}</div>;
}

function MissingProject() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-xl font-bold tracking-tight">This project isn’t saved in this browser</h1>
      <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
        Projects in the demo live only in the browser that created them — nothing is stored on a server. Head back to the
        dashboard to open one of yours or start a new project.
      </p>
      <Link href="/dashboard" className={cn(buttonVariants({ size: "sm" }), "mt-1 gap-1.5")}>
        <ArrowLeftIcon className="size-4" />
        Back to dashboard
      </Link>
    </div>
  );
}

function EditorLoader() {
  const params = useSearchParams();
  const projectId = params.get("p");
  const screenshotId = params.get("s");
  const [state, setState] = useState<LoadState>({ status: "loading" });

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
        if (!proj || proj.shots.length === 0) {
          setState({ status: "missing" });
          return;
        }
        const screenshots: RailShot[] = proj.shots.map((s) => ({
          id: s.id,
          position: s.position,
          thumbnailUrl: s.thumbnailUrl,
          doc: s.doc,
        }));
        const current = screenshots.find((s) => s.id === screenshotId) ?? screenshots[0];
        setState({ status: "ready", projectId: proj.id, projectName: proj.name, screenshots, current });
      } catch {
        if (active) setState({ status: "missing" });
      }
    })();
    return () => {
      active = false;
    };
    // Only (re)load when the URL ids change via real navigation. The Filmstrip
    // switches screenshots in-store + replaceState (no router event), so this
    // effect doesn't re-run and the Editor isn't remounted on every switch.
  }, [projectId, screenshotId]);

  if (state.status === "loading") return <Centered>Loading editor…</Centered>;
  if (state.status === "missing") return <MissingProject />;
  return (
    <Editor
      initialDoc={state.current.doc}
      screenshotId={state.current.id}
      projectId={state.projectId}
      projectName={state.projectName}
      screenshots={state.screenshots}
      canEdit
    />
  );
}

export default function EditorPage() {
  return (
    <Suspense fallback={<Centered>Loading editor…</Centered>}>
      <EditorLoader />
    </Suspense>
  );
}
