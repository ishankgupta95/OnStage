"use client";

import { useEffect, useState } from "react";
import { EyeIcon } from "lucide-react";
import TopBar from "./TopBar";
import LeftSidebar from "./LeftSidebar";
import RightSidebar from "./RightSidebar";
import EditorCanvas from "./EditorCanvas";
import Filmstrip from "./Filmstrip";
import { useEditorStore } from "@/store/editor";
import type { EditorDoc } from "@/lib/editorDoc";
import { saveScreenshotConfig } from "@/app/actions";

// One project screenshot, as shown in the filmstrip rail.
export type RailShot = { id: string; position: number; thumbnailUrl: string | null; doc: EditorDoc };

export default function Editor({
  initialDoc,
  screenshotId,
  projectId,
  projectName,
  screenshots,
  canEdit = true,
}: {
  initialDoc: EditorDoc;
  screenshotId: string;
  projectId: string;
  projectName: string;
  screenshots: RailShot[];
  canEdit?: boolean;
}) {
  // Hydrate the store with the loaded screenshot before children render (no flash),
  // and reset undo history so undo can't revert to a previous screenshot's state.
  // A useState initializer runs exactly once, synchronously, on first mount.
  useState(() => {
    useEditorStore.setState({
      doc: initialDoc,
      selectedLayerId: initialDoc.textLayers[0]?.id ?? null,
      saveState: "idle",
      screenshotId,
      projectId,
      exportProgress: { state: "idle" },
      exportRequest: null,
      previewClass: "iphone",
    });
    useEditorStore.temporal.getState().clear();
    return null;
  });

  // Autosave: persist the doc ~1.5s after edits stop. The target screenshot id
  // is read from the store (captured when the edit is seen), not a prop — so the
  // filmstrip can switch screenshots in place and edits still save to the right one.
  // Viewers (read-only) never autosave — RLS would reject the write anyway, and
  // we don't want to imply their local edits persist.
  useEffect(() => {
    if (!canEdit) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let lastSeen = JSON.stringify(useEditorStore.getState().doc);
    const unsub = useEditorStore.subscribe((state) => {
      const current = JSON.stringify(state.doc);
      if (current === lastSeen) return;
      lastSeen = current;
      const sid = useEditorStore.getState().screenshotId;
      useEditorStore.getState().setSaveState("saving");
      clearTimeout(timer);
      timer = setTimeout(async () => {
        if (!sid) return;
        const res = await saveScreenshotConfig(sid, JSON.parse(current));
        useEditorStore.getState().setSaveState(res.ok ? "saved" : "idle");
      }, 1500);
    });
    return () => {
      clearTimeout(timer);
      unsub();
    };
  }, [canEdit]);

  return (
    <div className="flex h-screen flex-col">
      <TopBar projectName={projectName} projectId={projectId} canEdit={canEdit} />
      {!canEdit && (
        <div className="flex items-center justify-center gap-2 border-b border-border bg-muted/50 px-4 py-1.5 text-center font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          <EyeIcon className="size-3.5" />
          Read-only — you have viewer access in this workspace. Changes won&apos;t be saved.
        </div>
      )}
      <div className="flex flex-1 overflow-hidden">
        <LeftSidebar readOnly={!canEdit} />
        <main className="relative flex flex-1 flex-col bg-muted/30">
          <div className="relative flex-1 animate-in fade-in overflow-hidden duration-700 fill-mode-both delay-100">
            <EditorCanvas />
          </div>
          <Filmstrip projectId={projectId} initial={screenshots} canEdit={canEdit} />
        </main>
        <RightSidebar readOnly={!canEdit} />
      </div>
    </div>
  );
}
