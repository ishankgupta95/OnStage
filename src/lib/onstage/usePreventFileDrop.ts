"use client";

import { useEffect } from "react";

const carriesFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");

/**
 * A file dropped anywhere that isn't a drop target does nothing, instead of
 * the browser leaving the app to open the image (GAP-2). Real drop targets
 * (DropZone, the filmstrip) handle the event first and call preventDefault
 * themselves, so a target the browser already accepted is left alone.
 */
export function usePreventFileDrop() {
  useEffect(() => {
    const over = (e: DragEvent) => {
      if (e.defaultPrevented || !carriesFiles(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "none";
    };
    const drop = (e: DragEvent) => {
      if (carriesFiles(e)) e.preventDefault();
    };
    window.addEventListener("dragover", over);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragover", over);
      window.removeEventListener("drop", drop);
    };
  }, []);
}
