"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Stage, Layer } from "react-konva";
import type Konva from "konva";
import JSZip from "jszip";
import { toast } from "sonner";
import ScreenshotContent from "./ScreenshotContent";
import { ensure3DLoaded, release3DMemory, take3DRenderError } from "./device3d/loader";
import { useEditorStore, type ExportShot } from "@/store/editor";
import { STORE_SCREENSHOT_LIMIT, exportDocForSize, exportFileCount, orientSize, sizeById, type ExportSize } from "@/lib/sizes";
import { FONT_FAMILY, FONT_LABEL, docUses3D, type EditorDoc } from "@/lib/editorDoc";
import { downloadBlob } from "@/lib/download";
import { blobDimensions, canvasToBlob, loadExportImage } from "@/lib/exportImages";
import { recordExport } from "@/lib/localData";
import { localizeDoc } from "@/lib/locales";

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
  const layerRef = useRef<Konva.Layer>(null);
  const committedKey = useRef<string | null>(null);
  const running = useRef(false);
  // The export in progress; cancelling flags it so it stops at its next step.
  const runRef = useRef<{ cancelled: boolean } | null>(null);

  // Draw the export layer at 1× device pixels: it's read straight off as the
  // PNG, so rendering at the screen's pixel ratio would only cost memory/time.
  useEffect(() => {
    layerRef.current?.getCanvas().setPixelRatio(1);
  }, []);

  // Cancel (from the export dialog): abandon the run and free the stage now, so
  // a new export can start straight away.
  useEffect(
    () =>
      useEditorStore.subscribe((s, prev) => {
        if (s.exportCancel === prev.exportCancel || !runRef.current) return;
        runRef.current.cancelled = true;
        runRef.current = null;
        running.current = false;
        setJob(null);
      }),
    [],
  );

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
    const run = { cancelled: false };
    runRef.current = run;
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

        // For "all", use the live in-editor doc of every screenshot (the board
        // edits them all, and the latest edits may not be saved yet), falling
        // back to the saved doc.
        const state = useEditorStore.getState();
        const liveDoc = state.doc;
        const liveId = state.screenshotId;
        const shots: ExportShot[] =
          request.scope === "all" && request.shots.length
            ? request.shots.map((s) => ({ ...s, doc: state.docs[s.id] ?? s.doc }))
            : [{ id: liveId ?? "screenshot", position: 0, doc: liveDoc }];

        // No paywall on the demo — every export is allowed, no watermark.
        const exportWatermark = false;

        // Languages to render (null = default captions); translated languages
        // each get their own top-level folder.
        const locales = request.locales?.length ? request.locales : [null];
        const byLanguage = locales.length > 1 || locales[0] !== null;

        // Each store takes a limited number of screenshots; later ones are skipped.
        const total = exportFileCount(request.sizeIds, shots.length) * locales.length;
        let completed = 0;
        setProgress({ state: "running", completed, total });

        // Load every font used across the batch (other shots may use fonts not
        // yet requested on this page) so text never renders with a fallback.
        // A font that can't load would silently render as a fallback, so fail
        // with a clear message instead.
        const fontSpecs = new Map<string, string>();
        for (const shot of shots) {
          for (const l of shot.doc.textLayers) {
            fontSpecs.set(`${l.weight} 120px "${FONT_FAMILY[l.font]}"`, FONT_LABEL[l.font]);
          }
        }
        const missing = new Set<string>();
        await Promise.all(
          [...fontSpecs].map(async ([spec, label]) => {
            const faces = await document.fonts.load(spec).catch(() => []);
            if (!faces.length) missing.add(label);
          }),
        );
        if (missing.size) {
          throw new Error(
            `Couldn't load the ${[...missing].join(", ")} font${missing.size > 1 ? "s" : ""}. Check your connection and try again.`,
          );
        }
        await document.fonts.ready;
        if (run.cancelled) return;

        // Preload the Three.js renderer chunk if any shot uses a 3D angle, so the
        // synchronous harvest below has it ready (no flat-frame fallback on export).
        if (shots.some((s) => docUses3D(s.doc))) await ensure3DLoaded();
        if (run.cancelled) return;

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
            (async () => {
              const bg = shot.doc.background;
              if (bg.kind === "image") layerImages[bg.src] = await loadExportImage(bg.src).catch(() => null);
            })(),
          ]);
          if (run.cancelled) return;

          // Every language × size; a language only swaps the caption text.
          const jobs = locales.flatMap((locale) => sizes.map((size) => ({ locale, size })));
          for (const { locale, size } of jobs) {
            if (shot.position >= STORE_SCREENSHOT_LIMIT[size.os]) continue;
            // Landscape docs export at the transposed pixel dimensions.
            const osize = orientSize(size, shot.doc.orientation);
            const key = `${shot.id}-${locale ?? "default"}-${size.id}-${request.nonce}-${completed}`;
            // The export size picks the frame family (iPad slot → iPad frame, etc.)
            // for PRESET layouts, letterboxing phone screenshots in tablet frames.
            // Freeform devices keep their own models on every size.
            const doc = exportDocForSize(localizeDoc(shot.doc, locale), size);
            take3DRenderError(); // clear any failure from before this job
            setJob({ key, w: osize.w, h: osize.h, doc, images, layerImages, watermark: exportWatermark });
            const stage = await waitForStage(key);
            if (run.cancelled) return;

            // Force a synchronous raster of the committed scene, then read the
            // layer's own 1× canvas (no second render at another pixel ratio).
            await nextFrame();
            if (run.cancelled) return;
            const layer = layerRef.current;
            if (!layer || layer.getStage() !== stage) throw new Error("export layer not ready");
            layer.draw();
            // A 3D device that failed to draw would leave the PNG without it.
            const err3d = take3DRenderError();
            if (err3d) throw err3d;
            const blob = await canvasToBlob(layer.getNativeCanvasElement(), "image/png");
            if (run.cancelled) return;

            // Exact-dimensions gate: decode the PNG and confirm w/h. Apple
            // rejects off-by-one, so we never trust the source canvas alone.
            const dim = await blobDimensions(blob);
            if (run.cancelled) return;
            if (dim.w !== osize.w || dim.h !== osize.h) {
              throw new Error(`Size mismatch for ${size.label}: expected ${osize.w}×${osize.h}, got ${dim.w}×${dim.h}`);
            }
            decoded.push({ id: size.id, w: dim.w, h: dim.h });

            // Folder per OS + exact resolution, e.g. `iOS/1320x2868/01.png`
            // (under `de-DE/…` etc. when exporting languages). Uses osize
            // (orientation-adjusted, dimension-verified) so the folder name
            // always matches the file's real pixels.
            const nn = String(shot.position + 1).padStart(2, "0");
            const lang = byLanguage ? `${locale ?? "default"}/` : "";
            const path = `${lang}${size.os}/${osize.w}x${osize.h}/${nn}.png`;
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
          // Single PNG: flat download (a `download` attr with "/" gets mangled
          // by browsers), so collapse the folder path into the filename.
          downloadBlob(files[0].blob, `onstage-${files[0].path.replace(/\//g, "-")}`);
        } else {
          const zip = new JSZip();
          for (const f of files) zip.file(f.path, f.blob);
          const out = await zip.generateAsync({ type: "blob" });
          if (run.cancelled) return;
          downloadBlob(out, `onstage-${request.scope === "all" ? "project" : "screenshot"}-export.zip`);
        }

        setProgress({ state: "done", total: files.length });
        toast.success(`Exported ${files.length} PNG${files.length > 1 ? "s" : ""}`);

        const pid = useEditorStore.getState().projectId;
        if (pid) void recordExport(pid, files.length).catch(() => {});
      } catch (e) {
        if (run.cancelled) return;
        console.error("[onstage] export failed", e);
        setJob(null);
        setProgress({ state: "error", message: e instanceof Error ? e.message : "Export failed" });
        toast.error("Export failed");
      } finally {
        if (runRef.current === run) {
          running.current = false;
          runRef.current = null;
        }
        release3DMemory(); // full-size 3D renders aren't needed after an export
      }
    })();

    return () => {
      run.cancelled = true;
    };
  }, [nonce]);

  return (
    <div aria-hidden style={{ position: "fixed", left: -100000, top: 0, pointerEvents: "none" }}>
      <Stage ref={stageRef} width={job?.w ?? 1} height={job?.h ?? 1}>
        <Layer ref={layerRef} listening={false}>
          {job ? (
            <ScreenshotContent doc={job.doc} screenImages={job.images} layerImages={job.layerImages} editable={false} width={job.w} height={job.h} watermark={job.watermark} />
          ) : null}
        </Layer>
      </Stage>
    </div>
  );
}
