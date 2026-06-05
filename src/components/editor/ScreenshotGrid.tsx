"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CopyIcon, GripVerticalIcon, ImageIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DEVICE_BY_ID } from "@/lib/devices";
import { duplicateScreenshot, deleteScreenshot, reorderScreenshots, createScreenshot } from "@/lib/localData";
import { editorHref } from "@/lib/routes";
import type { EditorDoc } from "@/lib/editorDoc";

export type Shot = {
  id: string;
  device_frame: string;
  layout_preset: string;
  thumbnail_url: string | null;
  orientation?: "portrait" | "landscape";
};

// Build a board Shot from a freshly created/duplicated screenshot doc.
function shotFromDoc(id: string, doc: EditorDoc): Shot {
  return {
    id,
    device_frame: doc.device,
    layout_preset: doc.layout,
    thumbnail_url: null,
    orientation: doc.orientation,
  };
}

function prettyLayout(preset: string) {
  return preset.replace(/-/g, " ");
}

function Card({
  shot,
  index,
  projectId,
  canEdit,
  onDuplicate,
  onDelete,
}: {
  shot: Shot;
  index: number;
  projectId: string;
  canEdit: boolean;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: shot.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 30 : undefined,
  };
  const landscape = shot.orientation === "landscape";
  const deviceLabel = DEVICE_BY_ID[shot.device_frame as keyof typeof DEVICE_BY_ID]?.label ?? shot.device_frame;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative rounded-2xl border border-border bg-card transition-all duration-200 hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-lg hover:shadow-black/5 ${isDragging ? "opacity-80 shadow-xl ring-1 ring-primary/40" : ""}`}
    >
      <Link href={editorHref(projectId, shot.id)} className="block p-2.5">
        <div
          className="relative overflow-hidden rounded-xl bg-muted ring-1 ring-border"
          style={{ aspectRatio: landscape ? "2796 / 1290" : "1290 / 2796" }}
        >
          {shot.thumbnail_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shot.thumbnail_url} alt={`Screenshot ${index + 1}`} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
              <ImageIcon className="size-5 opacity-50" />
              <span className="px-2 text-center text-[10px] leading-tight">Not rendered yet</span>
            </div>
          )}
          <span className="absolute left-2 top-2 grid h-5 min-w-5 place-items-center rounded-md bg-background/85 px-1 font-mono text-[10px] font-semibold tabular-nums text-foreground shadow-sm backdrop-blur">
            {index + 1}
          </span>
        </div>
      </Link>

      {/* drag handle */}
      {canEdit && (
        <button
          {...attributes}
          {...listeners}
          className="absolute right-3.5 top-3.5 grid size-7 cursor-grab place-items-center rounded-md bg-background/85 text-muted-foreground opacity-0 shadow-sm backdrop-blur transition-all hover:text-foreground focus-visible:opacity-100 active:cursor-grabbing group-hover:opacity-100"
          aria-label={`Reorder screenshot ${index + 1}`}
        >
          <GripVerticalIcon className="size-4" />
        </button>
      )}

      <div className="flex items-center justify-between gap-1 px-3 pb-2.5 pt-0.5">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium">{deviceLabel}</p>
          <p className="truncate font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{prettyLayout(shot.layout_preset)}</p>
        </div>
        {canEdit && (
          <div className="flex shrink-0 items-center opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
            <Button
              variant="ghost"
              size="icon-sm"
              type="button"
              aria-label="Duplicate screenshot"
              onClick={() => onDuplicate(shot.id)}
            >
              <CopyIcon />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              type="button"
              aria-label="Delete screenshot"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => onDelete(shot.id)}
            >
              <Trash2Icon />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function AddTile({ onAdd }: { onAdd: () => void }) {
  return (
    <button
      type="button"
      onClick={onAdd}
      className="group flex aspect-[1290/2796] w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/[0.04] hover:text-primary"
    >
      <span className="grid size-10 place-items-center rounded-full bg-muted transition-colors group-hover:bg-primary/15">
        <PlusIcon className="size-5" />
      </span>
      <span className="text-xs font-medium">New screenshot</span>
    </button>
  );
}

export default function ScreenshotGrid({
  projectId,
  screenshots,
  canEdit = true,
}: {
  projectId: string;
  screenshots: Shot[];
  canEdit?: boolean;
}) {
  const router = useRouter();
  const [items, setItems] = useState(screenshots);
  // Resync only when membership changes (add/delete), not on reorder-only updates.
  const [knownIds, setKnownIds] = useState(() => screenshots.map((s) => s.id).slice().sort().join(","));
  const incomingIds = screenshots.map((s) => s.id).slice().sort().join(",");
  if (incomingIds !== knownIds) {
    setKnownIds(incomingIds);
    setItems(screenshots);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function handleAdd() {
    const created = await createScreenshot(projectId);
    if (!created) {
      toast.error("Couldn't add screenshot");
      return;
    }
    router.push(editorHref(projectId, created.id));
  }

  async function handleDuplicate(id: string) {
    const created = await duplicateScreenshot(id, projectId);
    if (!created) {
      toast.error("Couldn't duplicate screenshot");
      return;
    }
    setItems((prev) => [...prev, shotFromDoc(created.id, created.doc)]);
  }

  async function handleDelete(id: string) {
    if (items.length <= 1) return;
    const prev = items;
    setItems((p) => p.filter((s) => s.id !== id));
    const res = await deleteScreenshot(id, projectId);
    if (!res.ok) {
      setItems(prev);
      toast.error("Couldn't delete screenshot");
    }
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((s) => s.id === active.id);
    const newIndex = items.findIndex((s) => s.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const prev = items;
    const next = arrayMove(items, oldIndex, newIndex);
    setItems(next);
    reorderScreenshots(
      projectId,
      next.map((s) => s.id),
    ).catch(() => {
      setItems(prev); // revert the optimistic reorder
      toast.error("Couldn't save the new order");
    });
  }

  return (
    <DndContext id="screenshot-grid" sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items.map((s) => s.id)} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((s, i) => (
            <Card
              key={s.id}
              shot={s}
              index={i}
              projectId={projectId}
              canEdit={canEdit}
              onDuplicate={handleDuplicate}
              onDelete={handleDelete}
            />
          ))}
          {canEdit && <AddTile onAdd={handleAdd} />}
        </div>
      </SortableContext>
    </DndContext>
  );
}
