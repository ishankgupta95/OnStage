"use client";

import { useRef, useState, type ReactNode } from "react";
import { getBackend } from "@/lib/data/backend";
import { imageIdFromRef } from "@/lib/data/imageRefs";
import { s } from "@/lib/onstage/css";
import { readImageFiles } from "@/lib/onstage/readImageFile";
import { useOnstage } from "@/store/onstage";
import { IcoAlert } from "./icons";

/**
 * The design's "Drop a screen" targets, made real: click to pick files or drop
 * them in, and they land on the frames from `from` onward.
 */
export function DropZone({
  from,
  multiple = false,
  base,
  hover,
  children,
}: {
  from: number;
  multiple?: boolean;
  /** The design's own resting style for this target. */
  base: string;
  /** What the border becomes while a file is over it. */
  hover: string;
  children: ReactNode;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setScreenshots = useOnstage((st) => st.setScreenshots);

  const take = async (files: FileList | File[] | null) => {
    if (!files) return;
    setError(null);
    const { setId, frames } = useOnstage.getState();
    // Store only what can land on a frame — a Blob no frame points at would
    // sit in this browser's storage for good.
    const room = multiple ? Math.max(0, frames.length - from) : 1;
    const stored = await readImageFiles(files, room);
    const refs = stored.map((r) => (typeof r === "string" ? r : null));

    // The set changed while the files were being stored (they belong to the
    // one they were dropped on), or frames went away meanwhile. The Blobs
    // this drop just created that no frame received are in no document and
    // no undo history, so removing them loses nothing.
    const now = useOnstage.getState();
    const sameSet = now.setId === setId;
    const placed = sameSet ? Math.max(0, now.frames.length - from) : 0;
    const unplaced = refs
      .slice(placed)
      .map((ref) => imageIdFromRef(ref))
      .filter((id): id is string => Boolean(id));
    if (unplaced.length) void getBackend().deleteImages(unplaced).catch(() => {});
    if (!sameSet) return;

    if (refs.slice(0, placed).some(Boolean)) setScreenshots(from, refs.slice(0, placed));
    const failed = stored.filter((r): r is Error => r instanceof Error);
    if (failed.length) {
      setError(
        stored.length > 1
          ? `${failed.length} of ${stored.length} screenshots couldn't be stored — ${failed[0].message}`
          : `Couldn't store the screenshot — ${failed[0].message}`,
      );
    }
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
        accept="image/*"
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
