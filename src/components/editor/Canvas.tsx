"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Stage } from "react-konva";
import type Konva from "konva";
import ScreenshotContent, { FRAME_SELECTION_ID } from "./ScreenshotContent";
import { toast } from "sonner";
import { useEditorStore } from "@/store/editor";
import { FONT_FAMILY, masterDimsFor, type CaptionAlign } from "@/lib/editorDoc";
import { deviceForSize, representativeSizeForClass, PREVIEW_CLASSES, orientSize } from "@/lib/sizes";
import { cn } from "@/lib/utils";
import { uploadImage } from "@/lib/uploadImage";
import { saveThumbnail } from "@/app/actions";
import ExportController from "./ExportController";

const FIT_H = 680;
const clampZoom = (z: number) => Math.min(3, Math.max(0.3, z));

function useHtmlImage(src: string | null) {
  // Only the async onload sets state; when there's no src we derive null on
  // render rather than resetting state synchronously inside the effect.
  const [loaded, setLoaded] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!src) return;
    const img = new window.Image();
    // Remote (Storage) images need CORS so the export canvas stays untainted.
    if (/^https?:/i.test(src)) img.crossOrigin = "anonymous";
    img.onload = () => setLoaded(img);
    img.src = src;
    return () => {
      img.onload = null;
    };
  }, [src]);
  return src ? loaded : null;
}

// Loads a dynamic set of image-layer sources to HTMLImageElements, keyed by src.
// Each image populates the map as it resolves, so the canvas redraws per image.
function useHtmlImages(srcs: string[]): Record<string, HTMLImageElement | null> {
  const [map, setMap] = useState<Record<string, HTMLImageElement | null>>({});
  const key = srcs.join("|");
  useEffect(() => {
    let active = true;
    const unique = Array.from(new Set(srcs.filter(Boolean)));
    const imgs = unique.map((src) => {
      const img = new window.Image();
      if (/^https?:/i.test(src)) img.crossOrigin = "anonymous";
      img.onload = () => active && setMap((m) => ({ ...m, [src]: img }));
      img.onerror = () => active && setMap((m) => ({ ...m, [src]: null }));
      img.src = src;
      return img;
    });
    return () => {
      active = false;
      imgs.forEach((img) => {
        img.onload = null;
        img.onerror = null;
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return map;
}

export default function Canvas() {
  const doc = useEditorStore((s) => s.doc);
  const screenshotId = useEditorStore((s) => s.screenshotId);
  const setFrameImage = useEditorStore((s) => s.setFrameImage);
  const updateFrameAdjust = useEditorStore((s) => s.updateFrameAdjust);
  const updateFrameTransform = useEditorStore((s) => s.updateFrameTransform);
  const updateImageLayer = useEditorStore((s) => s.updateImageLayer);
  const updateTextLayer = useEditorStore((s) => s.updateTextLayer);
  const selectLayer = useEditorStore((s) => s.selectLayer);
  const selectedLayerId = useEditorStore((s) => s.selectedLayerId);
  const previewClass = useEditorStore((s) => s.previewClass);
  const setPreviewClass = useEditorStore((s) => s.setPreviewClass);

  const [fontsReady, setFontsReady] = useState(false);
  const [fontTick, setFontTick] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [showHelp, setShowHelp] = useState(false);
  const [guides, setGuides] = useState<{ x?: number; y?: number }>({});
  // Inline text edit: an HTML textarea overlaid on the selected caption.
  const [editing, setEditing] = useState<{
    id: string;
    left: number;
    top: number;
    width: number;
    fontSize: number;
    lineHeight: number;
    letterSpacing: number;
    align: CaptionAlign;
    fontFamily: string;
    fontWeight: string;
    color: string;
  } | null>(null);
  const editingRef = useRef(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const thumbStageRef = useRef<Konva.Stage>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const latestThumbRef = useRef<string | null>(null);
  const lastSavedThumbRef = useRef<string | null>(null);

  // Up to 3 frame slots (triptych is the largest layout).
  const img0 = useHtmlImage(doc.frameImages[0] ?? null);
  const img1 = useHtmlImage(doc.frameImages[1] ?? null);
  const img2 = useHtmlImage(doc.frameImages[2] ?? null);
  const screenImages = [img0, img1, img2];

  // Free-floating image layers (logos/art), loaded by src.
  const layerImages = useHtmlImages((doc.imageLayers ?? []).map((l) => l.src));

  // The editor previews one device class at a time at that class's representative
  // export size, substituting the right frame — so what you see matches the export.
  // Sizes transpose with the doc's orientation.
  const orientation = doc.orientation ?? "portrait";
  const master = masterDimsFor(orientation);
  const previewSize = orientSize(representativeSizeForClass(previewClass), orientation);
  const previewDevice = deviceForSize(previewSize, doc.device);
  const previewDoc = previewDevice === doc.device ? doc : { ...doc, device: previewDevice };
  // Fit the long edge so portrait is unchanged and landscape fits its width.
  const fitScale = FIT_H / Math.max(previewSize.w, previewSize.h);
  // Text is authored in the master space, so only edit it in the iPhone preview.
  const textEditable = previewClass === "iphone";

  const contentKey = `${orientation}-${doc.frameImages.join("|")}-${[img0, img1, img2].map((i) => (i ? "l" : "n")).join("")}-${fontsReady ? "f" : "nf"}-${fontTick}-${previewClass}`;

  const fontSig = doc.textLayers.map((l) => `${l.font}:${l.weight}`).join(",");

  useEffect(() => {
    document.fonts.ready.then(() => setFontsReady(true));
  }, []);

  // Ensure every layer's font+weight is loaded, then redraw.
  useEffect(() => {
    let active = true;
    const specs = new Set(useEditorStore.getState().doc.textLayers.map((l) => `${l.weight} 120px "${FONT_FAMILY[l.font]}"`));
    Promise.all([...specs].map((sp) => document.fonts.load(sp).catch(() => {}))).then(() => active && setFontTick((t) => t + 1));
    return () => {
      active = false;
    };
  }, [fontSig]);

  // keyboard: undo/redo, zoom, help, delete layer
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // While inline-editing a caption, the textarea owns the keyboard.
      if (editingRef.current) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA";
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        const t = useEditorStore.temporal.getState();
        if (e.shiftKey) t.redo();
        else t.undo();
      } else if (mod && (e.key === "=" || e.key === "+")) {
        e.preventDefault();
        setZoom((z) => clampZoom(z * 1.2));
      } else if (mod && e.key === "-") {
        e.preventDefault();
        setZoom((z) => clampZoom(z / 1.2));
      } else if (mod && e.key === "0") {
        e.preventDefault();
        setZoom(1);
      } else if (!typing && e.key === "?") {
        e.preventDefault();
        setShowHelp((s) => !s);
      } else if (!typing && (e.key === "Delete" || e.key === "Backspace")) {
        const st = useEditorStore.getState();
        const sel = st.selectedLayerId;
        if (!sel || sel === FRAME_SELECTION_ID) return;
        if ((st.doc.imageLayers ?? []).some((l) => l.id === sel)) {
          e.preventDefault();
          st.removeImageLayer(sel);
        } else if (st.doc.textLayers.some((l) => l.id === sel) && st.doc.textLayers.length > 1) {
          e.preventDefault();
          st.removeTextLayer(sel);
        }
      } else if (e.key === "Escape") {
        setShowHelp(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ctrl/cmd + wheel to zoom
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        setZoom((z) => clampZoom(z * (1 - e.deltaY * 0.0015)));
        setEditing(null);
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // Mirror `editing` into a ref so the (mount-once) keyboard handler can tell
  // when the inline textarea owns the keyboard.
  useEffect(() => {
    editingRef.current = !!editing;
  }, [editing]);

  // Open inline editing for a caption: place a textarea over the Konva text,
  // matching its on-screen geometry and type styling.
  const requestEditText = useCallback((id: string, node: Konva.Text) => {
    const stage = node.getStage();
    if (!stage) return;
    const layer = useEditorStore.getState().doc.textLayers.find((l) => l.id === id);
    if (!layer) return;
    const sc = stage.scaleX();
    const abs = node.getAbsolutePosition();
    const rect = stage.container().getBoundingClientRect();
    setEditing({
      id,
      left: rect.left + abs.x,
      top: rect.top + abs.y,
      width: node.width() * sc,
      fontSize: node.fontSize() * sc,
      lineHeight: layer.lineHeight,
      letterSpacing: node.letterSpacing() * sc,
      align: layer.align,
      fontFamily: FONT_FAMILY[layer.font],
      fontWeight: layer.weight,
      color: layer.color,
    });
  }, []);

  // Grow the textarea to fit its content as the user types.
  useLayoutEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${ta.scrollHeight}px`;
  }, [editing, doc.textLayers]);

  // Thumbnail for the project card. Captured from the off-screen master stage.
  const captureThumb = useCallback((): string | null => {
    const stage = thumbStageRef.current;
    if (!stage) return null;
    // ~320px on the short edge; read orientation fresh so the ratio matches the
    // (orientation-sized) thumbnail stage.
    const masterW = masterDimsFor(useEditorStore.getState().doc.orientation ?? "portrait").w;
    try {
      return stage.toDataURL({ mimeType: "image/jpeg", quality: 0.6, pixelRatio: 320 / masterW });
    } catch {
      return null;
    }
  }, []);

  // Persist + revalidate the project page (dynamic, so it refetches on return).
  // Deduped so we don't re-save an unchanged thumbnail.
  const persistThumb = useCallback((dataUrl: string | null) => {
    const sid = useEditorStore.getState().screenshotId;
    if (!sid || !dataUrl || dataUrl === lastSavedThumbRef.current) return;
    lastSavedThumbRef.current = dataUrl;
    void saveThumbnail(sid, dataUrl, useEditorStore.getState().projectId ?? undefined);
  }, []);

  // Save shortly after edits settle.
  useEffect(() => {
    if (!screenshotId) return;
    const t = setTimeout(() => {
      const dataUrl = captureThumb();
      if (dataUrl) {
        latestThumbRef.current = dataUrl;
        persistThumb(dataUrl);
      }
    }, 700);
    return () => clearTimeout(t);
  }, [doc, screenshotId, captureThumb, persistThumb]);

  // Flush on exit so a quick navigate-away (before the debounce fires) still saves.
  // Prefer a fresh capture; fall back to the last one captured while editing.
  useEffect(() => {
    return () => {
      persistThumb(captureThumb() ?? latestThumbRef.current);
    };
  }, [captureThumb, persistThumb]);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files?.[0];
      if (!file || !file.type.startsWith("image/")) return;
      setFrameImage(0, URL.createObjectURL(file)); // optimistic preview
      uploadImage(file)
        .then((url) => setFrameImage(0, url)) // swap to the persisted URL
        .catch(() => toast.error("Image upload failed"));
    },
    [setFrameImage],
  );

  const scale = fitScale * zoom;

  return (
    <div className="absolute inset-0" onDrop={onDrop} onDragOver={(e) => e.preventDefault()}>
      {/* Preview-as switcher: shows each device family's export, and targets its crop. */}
      <div className="absolute left-1/2 top-4 z-10 flex -translate-x-1/2 items-center gap-0.5 rounded-full border bg-background/90 p-0.5 font-mono text-[11px] uppercase tracking-wider shadow backdrop-blur">
        {PREVIEW_CLASSES.map((c) => (
          <button
            key={c.id}
            onClick={() => {
              setPreviewClass(c.id);
              setEditing(null);
            }}
            className={cn(
              "rounded-full px-3 py-1 transition-colors",
              previewClass === c.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div ref={scrollRef} className="absolute inset-0 overflow-auto" onScroll={() => editing && setEditing(null)}>
        <div className="flex min-h-full min-w-full items-center justify-center p-8">
          <Stage
            width={Math.round(previewSize.w * scale)}
            height={Math.round(previewSize.h * scale)}
            scaleX={scale}
            scaleY={scale}
            dragDistance={4}
            onMouseDown={(e) => {
              // The background no longer listens, so a click on empty canvas
              // resolves to the Stage itself — that's our "deselect" gesture.
              if (e.target === e.target.getStage()) selectLayer(null);
            }}
            style={{ borderRadius: 14, overflow: "hidden", boxShadow: "0 24px 70px rgba(0,0,0,0.35)" }}
          >
            <ScreenshotContent
              key={contentKey}
              doc={previewDoc}
              screenImages={screenImages}
              editable
              textEditable={textEditable}
              width={previewSize.w}
              height={previewSize.h}
              selectedLayerId={selectedLayerId}
              onSelectLayer={selectLayer}
              guides={guides}
              onDragMoveLayer={(id, node) => {
                const w = node.width();
                const h = node.height();
                const cx = node.x() + w / 2;
                const cy = node.y() + h / 2;
                const T = 40;
                const mcx = master.w / 2;
                const mcy = master.h / 2;
                let gx: number | undefined;
                let gy: number | undefined;
                if (Math.abs(cx - mcx) < T) {
                  node.x(mcx - w / 2);
                  gx = mcx;
                }
                if (Math.abs(cy - mcy) < T) {
                  node.y(mcy - h / 2);
                  gy = mcy;
                }
                setGuides({ x: gx, y: gy });
              }}
              onDragLayer={(id, x, y) => {
                updateTextLayer(id, { x, y });
                setGuides({});
              }}
              onAdjustFrame={(i, off) => updateFrameAdjust(previewClass, i, off)}
              onFrameTransform={updateFrameTransform}
              layerImages={layerImages}
              onImageLayerChange={updateImageLayer}
              editingTextId={textEditable ? editing?.id ?? null : null}
              onRequestEditText={requestEditText}
            />
          </Stage>
        </div>
      </div>

      <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-full border bg-background/90 px-2 py-1 text-sm shadow backdrop-blur">
        <button className="h-7 w-7 rounded hover:bg-accent" onClick={() => { setZoom((z) => clampZoom(z / 1.2)); setEditing(null); }} aria-label="Zoom out">
          −
        </button>
        <span className="w-12 text-center tabular-nums text-xs text-muted-foreground">{Math.round(zoom * 100)}%</span>
        <button className="h-7 w-7 rounded hover:bg-accent" onClick={() => { setZoom((z) => clampZoom(z * 1.2)); setEditing(null); }} aria-label="Zoom in">
          +
        </button>
        <button className="ml-1 rounded px-2 py-0.5 text-xs hover:bg-accent" onClick={() => { setZoom(1); setEditing(null); }}>
          Fit
        </button>
        <button className="ml-1 h-7 w-7 rounded hover:bg-accent" onClick={() => setShowHelp(true)} aria-label="Keyboard shortcuts">
          ?
        </button>
      </div>

      {showHelp && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40" onClick={() => setShowHelp(false)}>
          <div className="w-80 rounded-lg border bg-background p-5 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-3 text-sm font-semibold">Keyboard shortcuts</h2>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              <li className="flex justify-between"><span>Undo</span><kbd>⌘Z</kbd></li>
              <li className="flex justify-between"><span>Redo</span><kbd>⌘⇧Z</kbd></li>
              <li className="flex justify-between"><span>Delete layer</span><kbd>Del</kbd></li>
              <li className="flex justify-between"><span>Zoom in / out</span><kbd>⌘ + / −</kbd></li>
              <li className="flex justify-between"><span>Fit to screen</span><kbd>⌘0</kbd></li>
              <li className="flex justify-between"><span>Zoom (mouse)</span><kbd>⌘ + scroll</kbd></li>
              <li className="flex justify-between"><span>This panel</span><kbd>?</kbd></li>
            </ul>
          </div>
        </div>
      )}

      {/* Inline caption editor: a textarea overlaid on the selected text, styled
          to match. Content is committed live to the store; closes on blur/Esc. */}
      {editing && textEditable && (
        <textarea
          ref={taRef}
          autoFocus
          spellCheck={false}
          value={doc.textLayers.find((l) => l.id === editing.id)?.content ?? ""}
          onChange={(e) => updateTextLayer(editing.id, { content: e.target.value })}
          onBlur={() => setEditing(null)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Escape") {
              e.preventDefault();
              setEditing(null);
            }
          }}
          style={{
            position: "fixed",
            left: editing.left,
            top: editing.top,
            width: editing.width,
            fontSize: editing.fontSize,
            lineHeight: editing.lineHeight,
            letterSpacing: editing.letterSpacing,
            fontFamily: editing.fontFamily,
            fontWeight: editing.fontWeight,
            textAlign: editing.align,
            color: editing.color,
            margin: 0,
            padding: 0,
            border: "none",
            outline: "2px solid #56b8e6",
            outlineOffset: 4,
            background: "transparent",
            resize: "none",
            overflow: "hidden",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            caretColor: "#56b8e6",
            zIndex: 30,
          }}
        />
      )}

      {/* Off-screen full-res stage at the master size (orientation-sized), used
          only for thumbnails. */}
      <div aria-hidden style={{ position: "fixed", left: -100000, top: 0, pointerEvents: "none" }}>
        <Stage ref={thumbStageRef} width={master.w} height={master.h}>
          <ScreenshotContent key={contentKey} doc={doc} screenImages={screenImages} editable={false} layerImages={layerImages} />
        </Stage>
      </div>

      {/* Multi-size export render/harvest engine (mounts its own off-screen stages). */}
      <ExportController />
    </div>
  );
}
