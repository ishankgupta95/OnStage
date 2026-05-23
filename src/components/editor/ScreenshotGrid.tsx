"use client";

import { useState } from "react";
import Link from "next/link";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { duplicateScreenshot, deleteScreenshot, reorderScreenshots } from "@/app/actions";

type Shot = {
  id: string;
  device_frame: string;
  layout_preset: string;
  thumbnail_url: string | null;
};

function Card({ shot, index, projectId }: { shot: Shot; index: number; projectId: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: shot.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} className="rounded-lg border bg-background p-3">
      <div className="mb-1 flex items-center justify-between">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing"
          aria-label="Drag to reorder"
        >
          ⠿
        </button>
        <span className="text-xs text-muted-foreground">#{index + 1}</span>
      </div>
      <Link href={`/project/${projectId}/screenshot/${shot.id}`} className="block">
        <div className="mb-2 aspect-[9/19] overflow-hidden rounded-md bg-muted">
          {shot.thumbnail_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shot.thumbnail_url} alt={`Screenshot ${index + 1}`} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-[10px] text-muted-foreground">
              {shot.device_frame}
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{shot.layout_preset}</p>
      </Link>
      <div className="mt-2 flex gap-1">
        <form action={duplicateScreenshot}>
          <input type="hidden" name="id" value={shot.id} />
          <input type="hidden" name="projectId" value={projectId} />
          <Button variant="ghost" size="sm" type="submit">
            Duplicate
          </Button>
        </form>
        <form action={deleteScreenshot}>
          <input type="hidden" name="id" value={shot.id} />
          <input type="hidden" name="projectId" value={projectId} />
          <Button variant="ghost" size="sm" type="submit">
            Delete
          </Button>
        </form>
      </div>
    </div>
  );
}

export default function ScreenshotGrid({ projectId, screenshots }: { projectId: string; screenshots: Shot[] }) {
  const [items, setItems] = useState(screenshots);
  // Resync only when membership changes (add/delete), not on reorder-only updates.
  // Adjusting state during render (guarded) is React's documented alternative to
  // a resync effect — it re-renders immediately without a committed intermediate.
  const [knownIds, setKnownIds] = useState(() => screenshots.map((s) => s.id).slice().sort().join(","));
  const incomingIds = screenshots.map((s) => s.id).slice().sort().join(",");
  if (incomingIds !== knownIds) {
    setKnownIds(incomingIds);
    setItems(screenshots);
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((s) => s.id === active.id);
    const newIndex = items.findIndex((s) => s.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(items, oldIndex, newIndex);
    setItems(next);
    void reorderScreenshots(
      projectId,
      next.map((s) => s.id),
    );
  }

  return (
    <DndContext id="screenshot-grid" sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items.map((s) => s.id)} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {items.map((s, i) => (
            <Card key={s.id} shot={s} index={i} projectId={projectId} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
