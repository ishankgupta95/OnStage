"use client";

import { useRef, useState, type ReactNode } from "react";
import { s } from "@/lib/onstage/css";
import { readImageFiles } from "@/lib/onstage/readImageFile";
import { useOnstage } from "@/store/onstage";

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
  const setScreenshots = useOnstage((st) => st.setScreenshots);

  const take = async (files: FileList | File[] | null) => {
    if (!files) return;
    const urls = await readImageFiles(files);
    if (urls.length) setScreenshots(from, multiple ? urls : urls.slice(0, 1));
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
