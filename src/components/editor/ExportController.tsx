"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Stage, Layer } from "react-konva";
import type Konva from "konva";
import JSZip from "jszip";
import { toast } from "sonner";
import ScreenshotContent from "./ScreenshotContent";
import { ensure3DLoaded } from "./device3d/loader";
import { useEditorStore, type ExportShot } from "@/store/editor";
import { deviceForSize, orientSize, sizeById, type ExportSize } from "@/lib/sizes";
import { FONT_FAMILY, docUses3D, type EditorDoc } from "@/lib/editorDoc";
import { downloadBlob } from "@/lib/download";
import { blobDimensions, canvasToBlob, loadExportImage } from "@/lib/exportImages";
import { recordExport, getExportAllowance } from "@/app/actions";
import { track } from "@/lib/analytics";

type RenderJob = {
  key: string;
  w: number;
  h: number;
  doc: EditorDoc;
  images: (HTMLImageElement | null)[];
  layerImages: Record<string, HTMLImageElement | null>;
  watermark: boolean;
};

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

export default function ExportController() {
  const nonce = useEditorStore((s) => s.exportRequest?.nonce ?? 0);
  // A single persistent off-screen stage, resized/recolored per job. Keeping it
  // mounted (rather than a keyed remount per size) avoids react-konva + Strict
  // Mode destroying the stage out from under the harvest step.
  const [job, setJob] = useState<RenderJob | null>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const committedKey = useRef<string | null>(null);
  const running = useRef(false);

  // Marks which job is actually committed to the DOM so the export loop only
  // harvests once the stage reflects that job (and at its exact size).
  useLayoutEffect(() => {
    committedKey.current = job?.key ?? null;
  }, [job?.key]);

  useEffect(() => {
    if (!nonce || running.current) return;
    const request = useEditorStore.getState().exportRequest;
    if (!request) return;

    running.current = true;
    let cancelled = false;
    const setProgress = useEditorStore.getState().setExportProgress;

    // Resolve once the persistent stage reflects `key`. Polling across frames is
    // resilient to React's async commit timing and Strict Mode double-invokes.
    const waitForStage = async (key: string): Promise<Konva.Stage> => {
      for (let i = 0; i < 180; i++) {
        if (committedKey.current === key && stageRef.current) return stageRef.current;
        await nextFrame();
      }
      throw new Error(
        `export stage not ready (committedKey=${committedKey.current ?? "null"}, hasStage=${Boolean(stageRef.current)})`,
      );
    };

    (async () => {
      try {
        const sizes = request.sizeIds.map(sizeById).filter((s): s is ExportSize => Boolean(s));
        if (!sizes.length) throw new Error("No export sizes selected");

        // For "all", use each saved doc but swap in the live doc for the
        // screenshot currently open so unsaved edits are included.
        const state = useEditorStore.getState();
        const liveDoc = state.doc;
        const liveId = state.screenshotId;
        const shots: ExportShot[] =
          request.scope === "all" && request.shots.length
            ? request.shots.map((s) => (s.id === liveId ? { ...s, doc: liveDoc } : s))
            : [{ id: liveId ?? "screenshot", position: 0, doc: liveDoc }];

        // Free-tier export gate: 3 exports/month + watermark, checked against the
        // open project's team (export_history is the source of truth, server-side).
        let exportWatermark = false;
        if (state.projectId) {
          const allowance = await getExportAllowance(state.projectId);
          if (!allowance.allowed) {
            track("export_blocked", { plan: allowance.plan, used: allowance.used, limit: allowance.limit ?? 0 });
            setProgress({
              state: "error",
              message: `Free plan allows ${allowance.limit} exports/month — you've used ${allowance.used}. Upgrade for unlimited.`,
            });
            toast.error("Export limit reached", {
              description: "The free plan allows 3 exports/month. Upgrade for unlimited exports.",
              action: {
                label: "Upgrade",
                onClick: () => {
                  window.location.assign("/pricing");
                },
              },
              duration: 8000,
            });
            return;
          }
          exportWatermark = allowance.watermark;
        }

        const multiShot = shots.length > 1;
        const total = shots.length * sizes.length;
        let completed = 0;
        setProgress({ state: "running", completed, total });
        track("export_started", { scope: request.scope, sizes: sizes.length, shots: shots.length, total });

        // Load every font used across the batch (other shots may use fonts not
        // yet requested on this page) so text never renders with a fallback.
        const fontSpecs = new Set<string>();
        for (const shot of shots) {
          for (const l of shot.doc.textLayers) fontSpecs.add(`${l.weight} 120px "${FONT_FAMILY[l.font]}"`);
        }
        await Promise.all([...fontSpecs].map((sp) => document.fonts.load(sp).catch(() => {})));
        await document.fonts.ready;

        // Preload the Three.js renderer chunk if any shot uses a 3D angle, so the
        // synchronous harvest below has it ready (no flat-frame fallback on export).
        if (shots.some((s) => docUses3D(s.doc))) await ensure3DLoaded();

        const files: { path: string; blob: Blob }[] = [];
        const decoded: { id: string; w: number; h: number }[] = [];

        for (const shot of shots) {
          const images = await Promise.all(
            (shot.doc.frameImages ?? []).map((src) => (src ? loadExportImage(src) : Promise.resolve(null))),
          );
          // Load every free-floating image layer AND every multi-device freeform
          // frame's screenshot for this shot (both keyed by src; ScreenshotContent
          // resolves freeform frames via this same src→image map).
          const layerImages: Record<string, HTMLImageElement | null> = {};
          await Promise.all([
            ...(shot.doc.imageLayers ?? []).map(async (il) => {
              layerImages[il.src] = await loadExportImage(il.src).catch(() => null);
            }),
            ...(shot.doc.freeformFrames ?? []).map(async (ff) => {
              if (ff.src) layerImages[ff.src] = await loadExportImage(ff.src).catch(() => null);
            }),
          ]);
          if (cancelled) return;

          for (const size of sizes) {
            // Landscape docs export at the transposed pixel dimensions.
            const osize = orientSize(size, shot.doc.orientation);
            const key = `${shot.id}-${size.id}-${request.nonce}-${completed}`;
            // The export size picks the frame family (iPad slot → iPad frame, etc.)
            // for PRESET layouts. Freeform devices are placed explicitly (any mix
            // of models), so they keep their own device on every size — no swap.
            const doc =
              shot.doc.layout === "freeform"
                ? shot.doc
                : { ...shot.doc, device: deviceForSize(size, shot.doc.device) };
            setJob({ key, w: osize.w, h: osize.h, doc, images, layerImages, watermark: exportWatermark });
            const stage = await waitForStage(key);
            if (cancelled) return;

            // Force a synchronous raster of the committed scene before reading.
            await nextFrame();
            stage.draw();
            const canvas = stage.toCanvas({ pixelRatio: 1 });
            const blob = await canvasToBlob(canvas, "image/png");

            // Exact-dimensions gate: decode the PNG and confirm w/h. Apple
            // rejects off-by-one, so we never trust the source canvas alone.
            const dim = await blobDimensions(blob);
            if (dim.w !== osize.w || dim.h !== osize.h) {
              throw new Error(`Size mismatch for ${size.label}: expected ${osize.w}×${osize.h}, got ${dim.w}×${dim.h}`);
            }
            decoded.push({ id: size.id, w: dim.w, h: dim.h });

            const path = multiShot
              ? `${size.id}/${String(shot.position + 1).padStart(2, "0")}.png`
              : `onstage-${size.id}.png`;
            files.push({ path, blob });

            completed += 1;
            setProgress({ state: "running", completed, total });
          }
        }

        setJob(null);

        if (process.env.NODE_ENV === "development") {
          (window as Window & { __onstageExportSizes?: { id: string; w: number; h: number }[] }).__onstageExportSizes =
            decoded;
        }

        if (files.length === 1) {
          downloadBlob(files[0].blob, files[0].path);
        } else {
          const zip = new JSZip();
          for (const f of files) zip.file(f.path, f.blob);
          const out = await zip.generateAsync({ type: "blob" });
          downloadBlob(out, `onstage-${request.scope === "all" ? "project" : "screenshot"}-export.zip`);
        }

        setProgress({ state: "done", total: files.length });
        toast.success(`Exported ${files.length} PNG${files.length > 1 ? "s" : ""}`);
        track("screenshot_exported", { count: files.length, scope: request.scope });

        const pid = useEditorStore.getState().projectId;
        if (pid) void recordExport(pid, files.length).catch(() => {});
      } catch (e) {
        if (cancelled) return;
        console.error("[onstage] export failed", e);
        setJob(null);
        setProgress({ state: "error", message: e instanceof Error ? e.message : "Export failed" });
        toast.error("Export failed");
      } finally {
        running.current = false;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [nonce]);

  return (
    <div aria-hidden style={{ position: "fixed", left: -100000, top: 0, pointerEvents: "none" }}>
      <Stage ref={stageRef} width={job?.w ?? 1} height={job?.h ?? 1}>
        <Layer>
          {job ? (
            <ScreenshotContent doc={job.doc} screenImages={job.images} layerImages={job.layerImages} editable={false} width={job.w} height={job.h} watermark={job.watermark} />
          ) : null}
        </Layer>
      </Stage>
    </div>
  );
}
