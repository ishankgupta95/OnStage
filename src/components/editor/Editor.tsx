"use client";

import { useEffect, useState } from "react";
import TopBar from "./TopBar";
import LeftSidebar from "./LeftSidebar";
import RightSidebar from "./RightSidebar";
import EditorCanvas from "./EditorCanvas";
import { useEditorStore } from "@/store/editor";
import type { EditorDoc } from "@/lib/editorDoc";
import { saveScreenshotConfig } from "@/app/actions";

export default function Editor({
  initialDoc,
  screenshotId,
  projectId,
  projectName,
}: {
  initialDoc: EditorDoc;
  screenshotId: string;
  projectId: string;
  projectName: string;
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

  // Autosave: persist the doc ~1.5s after edits stop.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Track the last DOC we reacted to. Update it BEFORE setSaveState — that call
    // mutates the store and synchronously re-fires this subscriber, so the guard
    // must already see "no doc change" to avoid infinite recursion.
    let lastSeen = JSON.stringify(useEditorStore.getState().doc);
    const unsub = useEditorStore.subscribe((state) => {
      const current = JSON.stringify(state.doc);
      if (current === lastSeen) return;
      lastSeen = current;
      useEditorStore.getState().setSaveState("saving");
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const res = await saveScreenshotConfig(screenshotId, JSON.parse(current));
        useEditorStore.getState().setSaveState(res.ok ? "saved" : "idle");
      }, 1500);
    });
    return () => {
      clearTimeout(timer);
      unsub();
    };
  }, [screenshotId]);

  return (
    <div className="flex h-screen flex-col">
      <TopBar projectName={projectName} projectId={projectId} />
      <div className="flex flex-1 overflow-hidden">
        <LeftSidebar />
        <main className="relative flex-1 bg-muted/30">
          <EditorCanvas />
        </main>
        <RightSidebar />
      </div>
    </div>
  );
}
