"use client";

import { useRef, useState, type ReactNode } from "react";
import { getBackend } from "@/lib/data/backend";
import { imageIdFromRef } from "@/lib/data/imageRefs";
import { s } from "@/lib/onstage/css";
import { MAX_FRAMES } from "@/lib/onstage/export/slots";
import { readImageFiles, type ReadResult } from "@/lib/onstage/readImageFile";
import { useOnstage } from "@/store/onstage";
import { IcoAlert } from "./icons";

const STORE_NAME = { apple: "The App Store", play: "Google Play" } as const;

/** One sentence per thing that went wrong with a drop, in the order met. */
function dropProblems(
  read: ReadResult,
  opts: { multiple: boolean; store: "apple" | "play"; placed: number },
): string | null {
  const lines: string[] = [];
  if (read.rejected.length) {
    // Each turned-away file with its own reason (a few, then a count).
    const named = read.rejected.slice(0, 3).map((r) => `"${r.name}" ${r.reason}`);
    const more = read.rejected.length - named.length;
    lines.push(`${named.join("; ")}${more > 0 ? `; and ${more} more weren't added` : ""}.`);
  }
  const failed = read.stored.filter((s) => s.result instanceof Error);
  if (failed.length) {
    const reason = (failed[0].result as Error).message;
    lines.push(
      read.stored.length > 1
        ? `${failed.length} of ${read.stored.length} screenshots couldn't be stored — ${reason}`
        : `Couldn't store the screenshot — ${reason}`,
    );
  }
  // Good files that found no frame: past the store's limit.
  const left = read.overflow + Math.max(0, read.stored.length - failed.length - opts.placed);
  if (opts.multiple && left > 0) {
    lines.push(
      `${STORE_NAME[opts.store]} takes ${MAX_FRAMES[opts.store]} screenshots per device, so the last ${left} ${
        left === 1 ? "wasn't" : "weren't"
      } added.`,
    );
  }
  return lines.length ? lines.join(" ") : null;
}

/**
 * The design's "Drop a screen" targets, made real: click to pick files or drop
 * them in, and they land on the frames from `from` onward — a multi-file
 * target adds frames past the last one, up to the store's MAX_FRAMES (GAP-1).
 * Each file is checked first (SCREENSB-9); anything turned away says why.
 */
export function DropZone({
  from,
  multiple = false,
  base,
  hover,
  onPlaced,
  children,
}: {
  /** The first frame the files land on — or a function giving it, asked
   *  when the drop is placed (so a target that appends sees the frames as
   *  they are then, not when it rendered). */
  from: number | (() => number);
  multiple?: boolean;
  /** The design's own resting style for this target. */
  base: string;
  /** What the border becomes while a file is over it. */
  hover: string;
  /** Which dropped files landed, by the screenshot ref each became. */
  onPlaced?: (placed: { ref: string; name: string }[]) => void;
  children: ReactNode;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setScreenshots = useOnstage((st) => st.setScreenshots);
  // One drop at a time: a second drop waits for the first to land, so two
  // quick drops never aim at the same frames.
  const queue = useRef<Promise<void>>(Promise.resolve());

  const take = (files: FileList | File[] | null) => {
    if (!files) return;
    const list = Array.from(files);
    queue.current = queue.current.then(() => place(list)).catch(() => {});
  };

  const place = async (files: File[]) => {
    setError(null);
    const { setId, frames, store } = useOnstage.getState();
    const start = typeof from === "function" ? from() : from;
    // Store only what can land on a frame — a Blob no frame points at would
    // sit in this browser's storage for good.
    const cap = (n: number, st: "apple" | "play") => Math.max(n, MAX_FRAMES[st]);
    const room = multiple ? Math.max(0, cap(frames.length, store) - start) : 1;
    const read = await readImageFiles(files, room);
    const good = read.stored.flatMap((s) => (typeof s.result === "string" ? [{ ref: s.result, name: s.name }] : []));

    // The set changed while the files were being stored (they belong to the
    // one they were dropped on), or frames went away meanwhile. The Blobs
    // this drop just created that no frame received are in no document and
    // no undo history, so removing them loses nothing.
    // Stored screenshots land side by side from `start` — a failed store
    // leaves no hole (GAP-1).
    const now = useOnstage.getState();
    const sameSet = now.setId === setId;
    const placed = !sameSet
      ? 0
      : multiple
        ? Math.min(good.length, Math.max(0, cap(now.frames.length, now.store) - start))
        : Math.min(good.length, now.frames[start] ? 1 : 0);
    const unplaced = good
      .slice(placed)
      .map((g) => imageIdFromRef(g.ref))
      .filter((id): id is string => Boolean(id));
    if (unplaced.length) void getBackend().deleteImages(unplaced).catch(() => {});
    if (!sameSet) return;

    const landed = good.slice(0, placed);
    if (landed.length) {
      setScreenshots(
        start,
        landed.map((g) => g.ref),
      );
      onPlaced?.(landed);
    }
    setError(dropProblems(read, { multiple, store: now.store, placed: landed.length }));
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => input.current?.click()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") input.current?.click();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        void take(e.dataTransfer.files);
      }}
      style={s(`${base};cursor:pointer${over ? `;${hover}` : ""}`)}
    >
      {children}
      {error && (
        <div
          role="alert"
          style={s(
            "display:flex;align-items:center;justify-content:center;gap:7px;margin-top:8px;font-size:12.5px;color:var(--warn)",
          )}
        >
          <IcoAlert size={13} w={2} style={s("flex:none")} />
          {error}
        </div>
      )}
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple={multiple}
        onChange={(e) => {
          void take(e.target.files);
          e.target.value = "";
        }}
        style={s("display:none")}
      />
    </div>
  );
}
