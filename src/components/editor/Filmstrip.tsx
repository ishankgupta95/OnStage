"use client";

import { useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, horizontalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CopyIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { useEditorStore } from "@/store/editor";
import type { RailShot } from "./Editor";
import {
  saveScreenshotConfig,
  addScreenshot,
  duplicateScreenshotInline,
  deleteScreenshotInline,
  reorderScreenshots,
} from "@/app/actions";

function thumbWidth(shot: RailShot) {
  return shot.doc.orientation === "landscape" ? 116 : 34;
}

function Card({
  shot,
  index,
  active,
  canDelete,
  canEdit,
  onSwitch,
  onDuplicate,
  onDelete,
}: {
  shot: RailShot;
  index: number;
  active: boolean;
  canDelete: boolean;
  canEdit: boolean;
  onSwitch: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: shot.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    width: thumbWidth(shot),
    height: 64,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group relative shrink-0"
      {...(canEdit ? attributes : {})}
      {...(canEdit ? listeners : {})}
    >
      <button
        onClick={onSwitch}
        className={`block h-full w-full overflow-hidden rounded-lg bg-muted transition-all ${
          active
            ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
            : "ring-1 ring-border hover:ring-foreground/30"
        }`}
        aria-label={`Edit screenshot ${index + 1}`}
        aria-current={active}
      >
        {shot.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shot.thumbnailUrl} alt="" draggable={false} className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center px-0.5 text-center text-[8px] leading-tight text-muted-foreground">
            {shot.doc.layout}
          </span>
        )}
      </button>
      <span className="pointer-events-none absolute left-1 top-1 grid h-4 min-w-4 place-items-center rounded bg-background/85 px-1 font-mono text-[9px] font-semibold tabular-nums text-foreground shadow-sm backdrop-blur">
        {index + 1}
      </span>
      {canEdit && (
        <div className="absolute right-1 top-1 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate();
            }}
            title="Duplicate"
            aria-label="Duplicate screenshot"
            className="grid size-5 place-items-center rounded bg-background/85 text-muted-foreground shadow-sm backdrop-blur transition-colors hover:text-foreground"
          >
            <CopyIcon className="size-3" />
          </button>
          {canDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              title="Delete"
              aria-label="Delete screenshot"
              className="grid size-5 place-items-center rounded bg-background/85 text-muted-foreground shadow-sm backdrop-blur transition-colors hover:text-destructive"
            >
              <Trash2Icon className="size-3" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function Filmstrip({
  projectId,
  initial,
  canEdit = true,
}: {
  projectId: string;
  initial: RailShot[];
  canEdit?: boolean;
}) {
  const [items, setItems] = useState<RailShot[]>(initial);
  const currentId = useEditorStore((s) => s.screenshotId);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  // Activate a screenshot without navigating. The store now holds every doc, so
  // we switch by id (using the live in-store doc, not the filmstrip's stale copy)
  // and just update the URL. No temporal.clear() — undo now spans the whole set.
  function loadIntoStore(shot: RailShot) {
    useEditorStore.getState().setActive(shot.id);
    window.history.replaceState(null, "", `/project/${projectId}/screenshot/${shot.id}`);
  }

  function switchTo(target: RailShot) {
    const st = useEditorStore.getState();
    const curSid = st.screenshotId;
    if (target.id === curSid) return;
    if (curSid) {
      const curDoc = st.doc;
      // Cache the live doc locally (so switching back shows latest edits) and
      // flush to the server now, rather than waiting on the autosave debounce.
      setItems((prev) => prev.map((s) => (s.id === curSid ? { ...s, doc: curDoc } : s)));
      void saveScreenshotConfig(curSid, curDoc);
    }
    loadIntoStore(target);
  }

  async function add() {
    const created = await addScreenshot(projectId);
    if (!created) {
      toast.error("Couldn't add screenshot");
      return;
    }
    const shot: RailShot = { id: created.id, position: created.position, thumbnailUrl: null, doc: created.doc };
    useEditorStore.getState().upsertDoc(created.id, created.doc);
    setItems((prev) => [...prev, shot]);
    switchTo(shot);
  }

  async function duplicate(id: string) {
    const st = useEditorStore.getState();
    // Flush the active screenshot first so the copy includes unsaved edits
    // (the server duplicates the stored config).
    if (id === st.screenshotId) await saveScreenshotConfig(id, st.doc);
    const created = await duplicateScreenshotInline(id, projectId);
    if (!created) {
      toast.error("Couldn't duplicate screenshot");
      return;
    }
    const shot: RailShot = { id: created.id, position: created.position, thumbnailUrl: null, doc: created.doc };
    useEditorStore.getState().upsertDoc(created.id, created.doc);
    setItems((prev) => [...prev, shot]);
    switchTo(shot);
  }

  function remove(id: string) {
    if (items.length <= 1) return;
    const wasCurrent = id === useEditorStore.getState().screenshotId;
    const idx = items.findIndex((s) => s.id === id);
    const next = items.filter((s) => s.id !== id);
    setItems(next);
    useEditorStore.getState().removeDoc(id);
    void deleteScreenshotInline(id, projectId);
    // If we deleted the open screenshot, open a neighbor (no flush — it's gone).
    if (wasCurrent && next.length) {
      loadIntoStore(next[Math.min(idx, next.length - 1)]);
    }
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((s) => s.id === active.id);
    const newIndex = items.findIndex((s) => s.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const nextItems = arrayMove(items, oldIndex, newIndex);
    setItems(nextItems);
    // Keep the board (which renders by store order) in sync with the rail.
    useEditorStore.getState().setOrder(nextItems.map((s) => s.id));
    void reorderScreenshots(
      projectId,
      nextItems.map((s) => s.id),
    );
  }

  return (
    <div className="flex h-24 shrink-0 animate-in fade-in slide-in-from-bottom-3 items-center gap-2 overflow-x-auto border-t bg-background/70 px-3 py-2 backdrop-blur duration-500 fill-mode-both delay-150">
      <DndContext id="filmstrip" sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={items.map((s) => s.id)} strategy={horizontalListSortingStrategy}>
          <div className="flex items-center gap-2">
            {items.map((s, i) => (
              <Card
                key={s.id}
                shot={s}
                index={i}
                active={s.id === currentId}
                canDelete={items.length > 1}
                canEdit={canEdit}
                onSwitch={() => switchTo(s)}
                onDuplicate={() => duplicate(s.id)}
                onDelete={() => remove(s.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      {canEdit && (
        <button
          onClick={add}
          title="Add screenshot"
          aria-label="Add screenshot"
          className="flex h-16 w-12 shrink-0 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-primary/60 hover:bg-primary/[0.04] hover:text-primary"
        >
          <PlusIcon className="size-4" />
          <span className="font-mono text-[8px] uppercase tracking-wider">Add</span>
        </button>
      )}
    </div>
  );
}
