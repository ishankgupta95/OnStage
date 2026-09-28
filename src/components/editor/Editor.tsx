"use client";

import { useEffect, useState } from "react";
import { EyeIcon } from "lucide-react";
import { toast } from "sonner";
import TopBar from "./TopBar";
import LeftSidebar from "./LeftSidebar";
import RightSidebar from "./RightSidebar";
import EditorCanvas from "./EditorCanvas";
import Filmstrip from "./Filmstrip";
import EditorMobileBlock from "./EditorMobileBlock";
import OnboardingTour from "./OnboardingTour";
import { useEditorStore } from "@/store/editor";
import type { EditorDoc } from "@/lib/editorDoc";
import { deviceClassOf } from "@/lib/deviceGeometry";
import { saveScreenshotConfig, writeScreenshotDocNow } from "@/lib/localData";

// One project screenshot, as shown in the filmstrip rail.
export type RailShot = { id: string; position: number; thumbnailUrl: string | null; doc: EditorDoc };

type EditorProps = {
  initialDoc: EditorDoc;
  screenshotId: string;
  projectId: string;
  projectName: string;
  screenshots: RailShot[];
  canEdit?: boolean;
};

function EditorWorkspace({
  initialDoc,
  screenshotId,
  projectId,
  projectName,
  screenshots,
  canEdit = true,
}: EditorProps) {
  // Hydrate the store with the loaded screenshot before children render (no flash),
  // and reset undo history so undo can't revert to a previous screenshot's state.
  // A useState initializer runs exactly once, synchronously, on first mount.
  useState(() => {
    // Hydrate EVERY screenshot's doc into the store (keyed by id), then mark the
    // opened one active. The board edits them all; undo spans the set.
    const docs = Object.fromEntries(screenshots.map((s) => [s.id, s.doc] as const));
    useEditorStore.setState({
      docs,
      // Board order comes from the ordered screenshots prop (already by position).
      order: screenshots.map((s) => s.id),
      doc: initialDoc,
      selectedLayerId: initialDoc.textLayers[0]?.id ?? null,
      saveState: "idle",
      screenshotId,
      projectId,
      exportProgress: { state: "idle" },
      exportRequest: null,
      // Match the opened screenshot's device family so the crop sidebar is in sync.
      previewClass: deviceClassOf(initialDoc.device),
    });
    useEditorStore.temporal.getState().clear();
    return null;
  });

  // Autosave (multi-doc). The board edits many screenshots in place and "apply to
  // all" rewrites every doc at once, so we diff the whole `docs` map by reference
  // (edits + apply-to-all always create new doc objects) and debounce-save each
  // dirty screenshot via saveScreenshotConfig(id, doc). Marking an id "seen" the
  // moment a change is detected stops the setSaveState write below from
  // re-triggering the subscription into a loop. Viewers (read-only) never
  // autosave — RLS would reject the write and we don't imply their edits persist.
  useEffect(() => {
    if (!canEdit) return;
    const seen = new Map<string, EditorDoc>(Object.entries(useEditorStore.getState().docs));
    const pending = new Set<string>();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const flush = async () => {
      clearTimeout(timer);
      timer = undefined;
      const ids = [...pending];
      pending.clear();
      if (!ids.length) return;
      const docs = useEditorStore.getState().docs;
      let ok = true;
      // A stable toast id dedupes across repeated failed autosaves so a failing
      // store updates one toast instead of stacking dozens.
      await Promise.all(
        ids.map(async (id) => {
          const d = docs[id];
          if (!d) return; // deleted before the debounce fired
          try {
            const res = await saveScreenshotConfig(id, d);
            if (!res.ok) ok = false;
          } catch {
            ok = false;
          }
        }),
      );
      // "Saved" only once nothing newer is waiting to be written.
      const waiting = pending.size > 0 || timer !== undefined;
      useEditorStore.getState().setSaveState(!ok ? "idle" : waiting ? "saving" : "saved");
      if (!ok) toast.error("Couldn't save your changes to this browser's storage", { id: "save-error" });
    };
    const unsub = useEditorStore.subscribe((state) => {
      let changed = false;
      for (const id in state.docs) {
        if (seen.get(id) !== state.docs[id]) {
          seen.set(id, state.docs[id]);
          pending.add(id);
          changed = true;
        }
      }
      if (!changed) return;
      useEditorStore.getState().setSaveState("saving");
      clearTimeout(timer);
      timer = setTimeout(flush, 1500);
    });
    // Write immediately when the tab is hidden or closed, so the last edit isn't
    // lost inside the debounce window. The synchronous writes are what survive a
    // close; the normal save then runs too (and bumps the project's updated time).
    const onHide = () => {
      if (!pending.size) return;
      const docs = useEditorStore.getState().docs;
      for (const id of pending) if (docs[id]) writeScreenshotDocNow(id, docs[id]);
      void flush();
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") onHide();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onHide);
      void flush(); // leaving the editor (e.g. back to the dashboard)
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
        <main className="relative flex min-w-0 flex-1 flex-col bg-muted/30">
          <div className="relative flex-1 animate-in fade-in overflow-hidden duration-700 fill-mode-both delay-100">
            <EditorCanvas />
          </div>
          <Filmstrip projectId={projectId} initial={screenshots} canEdit={canEdit} />
        </main>
        <RightSidebar readOnly={!canEdit} />
      </div>
      <OnboardingTour enabled={canEdit} />
    </div>
  );
}

// The editor is desktop-only — gate it behind a viewport check so Konva and the
// autosave loop never mount on a phone, where the 3-pane layout can't be used.
// Returns null while measuring (one frame post-hydration; matches the empty SSR
// render, so no hydration mismatch).
function useIsDesktop(minWidth = 1024): boolean | null {
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${minWidth}px)`);
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [minWidth]);
  return isDesktop;
}

export default function Editor(props: EditorProps) {
  const isDesktop = useIsDesktop();
  if (isDesktop === null) return null;
  if (!isDesktop) return <EditorMobileBlock projectId={props.projectId} projectName={props.projectName} />;
  return <EditorWorkspace {...props} />;
}
