"use client";

/**
 * The export engine: every selected size × locale × frame, rendered to an
 * exact-dimension PNG and zipped.
 *
 * The editor canvas is DOM + CSS 3D, which nothing can rasterise faithfully,
 * so output is composed independently: Konva paints the artboard (gradient,
 * headline, shadow) and Three.js renders the tilted device into it. Both
 * libraries are dynamically imported here, so neither is in the app's main
 * bundle — they download the first time someone exports.
 */
import type { Frame } from "@/store/onstage";
import { bgCss, capInk } from "@/lib/onstage/data";
import { geometryFor } from "./geometry";
import { cssGradientToKonva } from "./gradient";
import { ensure3DLoaded } from "./loader";
import { paintSampleScreen } from "./sampleScreen";
import { featureGraphicLayout, featureTextNodes } from "./featureGraphic";
import { FEATURE_FILE, exportLocales, exportPlan, frameFile, localeFolder } from "./plan";
import { EXPORT_SLOTS, localise, type ExportSlot } from "./slots";
import { blobDimensions, canvasToBlob } from "./images";

type ExportRequest = {
  frames: Frame[];
  panorama: boolean;
  align: "left" | "center" | "right";
  captionSize: number;
  captionFont: string;
  device: string;
  frameColor: string;
  shadow: boolean;
  /** Indices into EXPORT_SLOTS. */
  sizeIds: number[];
  /** Locale chips, e.g. ["EN","DE"]. */
  locales: string[];
  /** A user-supplied screenshot per frame, if one has been dropped in. */
  screenshots?: (HTMLImageElement | null)[];
  /** The app the set belongs to, for the Play feature graphic; null when
   *  nothing names it (the graphic then carries no name). */
  appName: string | null;
  /** The zip's top folder (`exportRoot(appName)`). */
  root: string;
  onProgress?: (done: number, total: number) => void;
  signal?: { cancelled: boolean };
};

type ExportFile = { path: string; blob: Blob };
type ExportResult = { files: ExportFile[]; bytes: number; zipBlob: Blob };

/** The design authors every artboard against a 268×580 frame. */
const DESIGN_W = 268;

export async function renderSet(req: ExportRequest): Promise<ExportResult> {
  const [{ default: Konva }, JSZip, render3D] = await Promise.all([
    import("konva"),
    import("jszip").then((m) => m.default),
    ensure3DLoaded(),
  ]);

  const locales = exportLocales(req.locales);

  // Load the caption font before measuring text, so nothing renders in a
  // fallback face and reflows between preview and output: every weight the
  // output uses — captions (700), the feature graphic's name (600) and
  // tagline (400), and 500 — for the text it will draw, so each
  // unicode-range face it needs (latin-ext, cyrillic, …) loads, not only the
  // basic Latin one.
  const drawn = [
    req.appName ?? "",
    ...req.frames.flatMap((f) => locales.map((l) => localise(f.caption, l))),
  ].join(" ");
  await Promise.all(
    ["700", "600", "500", "400"].map((weight) =>
      document.fonts.load(`${weight} 120px "${req.captionFont}"`, drawn || " ").catch(() => {}),
    ),
  );
  await document.fonts.ready;

  const sampleScreen = paintSampleScreen();
  // Each picked size once, as the plan counts them.
  const slots = [...new Set(req.sizeIds)]
    .map((i) => EXPORT_SLOTS[i])
    .filter((s): s is ExportSlot => Boolean(s));

  const perFrameSlots = slots.filter((s) => s.kind === "frames");
  const featureSlots = slots.filter((s) => s.kind === "feature");
  // The same count the export dialog promised.
  const total = exportPlan({
    picks: req.sizeIds,
    langs: req.locales,
    frameCount: req.frames.length,
    root: req.root,
  }).files;

  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText = "position:fixed;left:-100000px;top:0;pointer-events:none";
  document.body.appendChild(host);

  const files: ExportFile[] = [];
  let done = 0;

  const emit = async (stage: InstanceType<typeof Konva.Stage>, path: string, w: number, h: number) => {
    stage.draw();
    const blob = await canvasToBlob(stage.toCanvas({ pixelRatio: 1 }), "image/png");
    // Exact-dimensions gate: decode the PNG and confirm its true pixel size.
    // Apple rejects off-by-one, so the encoded output is what gets checked.
    const dim = await blobDimensions(blob);
    if (dim.w !== w || dim.h !== h) {
      throw new Error(`Size mismatch for ${path}: expected ${w}×${h}, got ${dim.w}×${dim.h}`);
    }
    files.push({ path, blob });
    done += 1;
    req.onProgress?.(done, total);
  };

  try {
    for (const locale of locales) {
      const dir = localeFolder(locale);

      for (const slot of perFrameSlots) {
        const geom = geometryFor(req.device, slot.cls);
        const k = slot.w / DESIGN_W;

        for (let i = 0; i < req.frames.length; i++) {
          if (req.signal?.cancelled) throw new Error("cancelled");
          const fr = req.frames[i];
          const bgId = req.panorama ? req.frames[0].bg : fr.bg;

          const stage = new Konva.Stage({ container: host, width: slot.w, height: slot.h });
          const layer = new Konva.Layer({ listening: false });
          stage.add(layer);

          // ── background ────────────────────────────────────────────────
          // Panoramic sets paint one gradient across the whole strip; each
          // frame samples its own slice, exactly as the canvas does.
          const span = req.panorama ? req.frames.length : 1;
          const offset = req.panorama
            ? -(i / Math.max(1, req.frames.length - 1)) * (span - 1) * slot.w
            : 0;
          const grad = cssGradientToKonva(bgCss(bgId), slot.w, slot.h, span, offset);
          layer.add(
            new Konva.Rect({
              width: slot.w,
              height: slot.h,
              fillLinearGradientStartPoint: grad.start,
              fillLinearGradientEndPoint: grad.end,
              fillLinearGradientColorStops: grad.stops,
            }),
          );

          // ── headline ──────────────────────────────────────────────────
          const fontSize = req.captionSize * 0.62 * k;
          const text = new Konva.Text({
            x: 24 * k,
            y: 30 * k,
            width: slot.w - 48 * k,
            text: localise(fr.caption, locale),
            fontFamily: req.captionFont,
            fontStyle: "700",
            fontSize,
            lineHeight: 1.14,
            letterSpacing: -0.025 * fontSize,
            align: req.align,
            fill: capInk(bgId),
            wrap: "word",
          });
          layer.add(text);

          // ── device ────────────────────────────────────────────────────
          // The canvas draws the device inside `perspective: 1400px` at a
          // design width of 176px, so one device-width of world equals
          // 1400/176 world units of camera distance at any export scale.
          const dw = 176 * k * fr.scale;
          const dh = dw / geom.aspect;
          const canvas = render3D({
            deviceKey: `${req.device}:${slot.cls}`,
            geom,
            // CSS +rotateX tips the top away; Three's +rotation.x tips it
            // toward the camera, so the pitch is negated. Yaw needs no flip —
            // both use the same right-handed matrix about their own Y.
            perspective: {
              yaw: fr.tiltY,
              pitch: -fr.tiltX,
              z: (fr.depth * 0.35) / (176 * fr.scale),
            },
            pixelsPerWorld: dw,
            perspectiveDistance: 1400 / (176 * fr.scale),
            finish: req.frameColor,
            screen: {
              source: req.screenshots?.[i] ?? sampleScreen,
              width: req.screenshots?.[i]?.naturalWidth ?? sampleScreen.width,
              height: req.screenshots?.[i]?.naturalHeight ?? sampleScreen.height,
            },
            screenKey: req.screenshots?.[i]?.src ?? "sample",
            width: Math.round(dw * 1.55),
            height: Math.round(dh * 1.2),
          });

          const capBottom = 30 * k + text.height();
          layer.add(
            new Konva.Image({
              image: canvas,
              x: slot.w / 2 - canvas.width / 2,
              y: (capBottom + slot.h) / 2 - canvas.height / 2,
              width: canvas.width,
              height: canvas.height,
              ...(req.shadow
                ? {
                    shadowColor: "black",
                    shadowOpacity: 0.42,
                    shadowBlur: 26 * k,
                    shadowOffsetY: 26 * k,
                  }
                : {}),
            }),
          );

          await emit(stage, `${dir}/${slot.folder}/${frameFile(i)}`, slot.w, slot.h);
          stage.destroy();
        }
      }

      // ── Play feature graphic (EXPORT-7) ──────────────────────────────
      // The set's own frame-0 background and caption, its app's name when
      // something names it, all inside Play's safe zone.
      for (const slot of featureSlots) {
        if (req.signal?.cancelled) throw new Error("cancelled");
        const stage = new Konva.Stage({ container: host, width: slot.w, height: slot.h });
        const layer = new Konva.Layer({ listening: false });
        stage.add(layer);

        const first = req.frames[0];
        const spec = {
          appName: req.appName,
          caption: first ? localise(first.caption, locale) : "",
          // No frame (a damaged document): the first background.
          bg: first?.bg ?? "",
          w: slot.w,
          h: slot.h,
        };
        const layout = featureGraphicLayout(spec);
        const grad = cssGradientToKonva(layout.background, slot.w, slot.h);
        layer.add(
          new Konva.Rect({
            width: slot.w,
            height: slot.h,
            fillLinearGradientStartPoint: grad.start,
            fillLinearGradientEndPoint: grad.end,
            fillLinearGradientColorStops: grad.stops,
          }),
        );
        const nodes = featureTextNodes(Konva, spec, req.captionFont);
        for (const node of nodes) layer.add(node);
        await emit(stage, `${dir}/${FEATURE_FILE}`, slot.w, slot.h);
        stage.destroy();
      }
    }
  } finally {
    host.remove();
  }

  if (process.env.NODE_ENV === "development") {
    (
      window as Window & {
        __onstageExport?: { path: string; w: number; h: number; url: string }[];
      }
    ).__onstageExport = await Promise.all(
      files.map(async (f) => ({
        path: f.path,
        ...(await blobDimensions(f.blob)),
        url: URL.createObjectURL(f.blob),
      })),
    );
  }

  // The zip is built either way — it is the size readout, and the fallback
  // when a store upload is refused. Delivery is the caller's decision.
  const zip = new JSZip();
  for (const f of files) zip.file(`${req.root}/${f.path}`, f.blob);
  const out = await zip.generateAsync({ type: "blob" });

  return { files, bytes: out.size, zipBlob: out };
}
