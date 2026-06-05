"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Stage, Layer, Group, Rect } from "react-konva";
import type Konva from "konva";
import ScreenshotContent, { FRAME_SELECTION_ID } from "./ScreenshotContent";
import { toast } from "sonner";
import { useEditorStore } from "@/store/editor";
import {
  FONT_FAMILY,
  masterDimsFor,
  parseFreeformSel,
  type CaptionAlign,
  type EditorDoc,
  type FreeformFrameSpec,
  type ImageLayer,
  type Orientation,
} from "@/lib/editorDoc";
import { cn } from "@/lib/utils";
import { uploadImage } from "@/lib/uploadImage";
import { saveThumbnail } from "@/lib/localData";
import ExportController from "./ExportController";

const CANVAS_PAD = 120; // breathing room around the board inside the canvas area
const BOARD_GAP = 130; // gap between frames, in master-space units
const FIT_FALLBACK = 0.18; // fit estimate until the container has been measured
const clampZoom = (z: number) => Math.min(6, Math.max(0.2, z));

// A Konva node as the drag handlers see it (mirror of ScreenshotContent's local
// KonvaNode type; structurally identical, so it's assignable to that prop).
type DragNode = {
  x: (v?: number) => number;
  y: (v?: number) => number;
  width: () => number;
  height: () => number;
};

// Loads a dynamic set of screen / image-layer sources to HTMLImageElements, keyed
// by src. Each image populates the map as it resolves, so the canvas redraws per
// image. The board loads every doc's sources through one shared map.
function useHtmlImages(srcs: string[]): Record<string, HTMLImageElement | null> {
  const [map, setMap] = useState<Record<string, HTMLImageElement | null>>({});
  const key = srcs.join("|");
  useEffect(() => {
    let active = true;
    const unique = Array.from(new Set(srcs.filter(Boolean)));
    const imgs = unique.map((src) => {
      const img = new window.Image();
      // Remote (Storage) images need CORS so the export canvas stays untainted.
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

type ClipCtx = {
  beginPath: () => void;
  moveTo: (x: number, y: number) => void;
  arcTo: (x1: number, y1: number, x2: number, y2: number, r: number) => void;
  closePath: () => void;
};

function roundedRectPath(ctx: ClipCtx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

type PlacedFrame = { id: string; doc: EditorDoc; mw: number; mh: number; x: number; y: number };

// One screenshot on the board: a rounded card (shadow + clip + edge/active ring)
// wrapping a positioned ScreenshotContent. Only the active frame is interactive;
// inactive frames carry an invisible click-catcher so they activate on click.
function FrameOnBoard({
  item,
  active,
  contentKey,
  screenImages,
  layerImages,
  selectedLayerId,
  editingTextId,
  guides,
  onActivate,
  onSelectLayer,
  onDragMoveLayer,
  onDragLayer,
  onAdjustFrame,
  onFreeformFrameChange,
  onFrameScale,
  onFrameRotate,
  onToggleFrameOrientation,
  viewScale,
  onSelectFrame,
  selectedFrameIndex,
  onImageLayerChange,
  onRequestEditText,
}: {
  item: PlacedFrame;
  active: boolean;
  contentKey: string;
  screenImages: (HTMLImageElement | null)[];
  layerImages: Record<string, HTMLImageElement | null>;
  selectedLayerId: string | null;
  editingTextId: string | null;
  guides: { x?: number; y?: number };
  onActivate: () => void;
  onSelectLayer: (id: string) => void;
  onDragMoveLayer: (id: string, node: DragNode) => void;
  onDragLayer: (id: string, x: number, y: number) => void;
  onAdjustFrame: (index: number, offset: { offsetX: number; offsetY: number }) => void;
  onFreeformFrameChange: (id: string, partial: Partial<FreeformFrameSpec>) => void;
  onFrameScale: (index: number, scale: number) => void;
  onFrameRotate: (index: number, rotation: number) => void;
  onToggleFrameOrientation: (index: number, orientation: Orientation) => void;
  viewScale: number;
  onSelectFrame: (index: number) => void;
  selectedFrameIndex: number;
  onImageLayerChange: (id: string, partial: Partial<ImageLayer>) => void;
  onRequestEditText: (id: string, node: Konva.Text) => void;
}) {
  const { doc, mw, mh, x, y } = item;
  const R = mw * 0.028;
  const ringW = mw * 0.011;
  return (
    <Group x={x} y={y}>
      {/* Rounded card shadow — same silhouette as the clipped content below, so
          only the soft drop shadow shows beyond the frame's edge. */}
      <Rect
        x={0}
        y={0}
        width={mw}
        height={mh}
        cornerRadius={R}
        fill="#0b0b0f"
        shadowColor="#000000"
        shadowBlur={mw * 0.05}
        shadowOpacity={active ? 0.5 : 0.32}
        shadowOffsetY={mw * 0.018}
        listening={false}
      />
      <Group clipFunc={(ctx) => roundedRectPath(ctx, 0, 0, mw, mh, R)}>
        {/* Inactive frames stay clickable to activate: this rect is covered by the
            opaque background (so it never shows) but is the only listening shape
            in the group, so a click anywhere on the frame activates it. */}
        {!active && <Rect x={0} y={0} width={mw} height={mh} fill="#000000" onMouseDown={onActivate} onTap={onActivate} />}
        <ScreenshotContent
          key={contentKey}
          doc={doc}
          screenImages={screenImages}
          layerImages={layerImages}
          width={mw}
          height={mh}
          editable={active}
          selectedLayerId={active ? selectedLayerId : null}
          onSelectLayer={active ? onSelectLayer : undefined}
          onDragMoveLayer={active ? onDragMoveLayer : undefined}
          onDragLayer={active ? onDragLayer : undefined}
          onAdjustFrame={active ? onAdjustFrame : undefined}
          onFreeformFrameChange={active ? onFreeformFrameChange : undefined}
          onFrameScale={active ? onFrameScale : undefined}
          onFrameRotate={active ? onFrameRotate : undefined}
          onToggleFrameOrientation={active ? onToggleFrameOrientation : undefined}
          viewScale={viewScale}
          onSelectFrame={active ? onSelectFrame : undefined}
          selectedFrameIndex={active ? selectedFrameIndex : 0}
          onImageLayerChange={active ? onImageLayerChange : undefined}
          editingTextId={active ? editingTextId : null}
          onRequestEditText={active ? onRequestEditText : undefined}
          guides={active ? guides : undefined}
        />
      </Group>
      {/* Card edge + active ring, drawn over the clip so the corners read crisp. */}
      <Rect
        x={0}
        y={0}
        width={mw}
        height={mh}
        cornerRadius={R}
        stroke={active ? "#56b8e6" : "rgba(255,255,255,0.12)"}
        strokeWidth={active ? ringW : ringW * 0.5}
        listening={false}
      />
    </Group>
  );
}

const THUMB_W = 320; // thumbnail short-edge px (matches the project/dashboard cards)

// One small off-screen stage per screenshot, rendered clean (no board chrome) at
// thumbnail size. It re-captures + saves that screenshot's project-card thumbnail
// shortly after its doc / loaded images / fonts settle, deduped per session. Keyed
// by id in the board, so it mounts/unmounts with the screenshot.
function ThumbCapturer({
  id,
  doc,
  images,
  contentKey,
  projectId,
}: {
  id: string;
  doc: EditorDoc;
  images: Record<string, HTMLImageElement | null>;
  contentKey: string;
  projectId: string | null;
}) {
  const stageRef = useRef<Konva.Stage>(null);
  const lastSaved = useRef<string | null>(null);
  const m = masterDimsFor(doc.orientation);
  const w = THUMB_W;
  const h = Math.max(1, Math.round(THUMB_W * (m.h / m.w)));
  const screenImages = (doc.frameImages ?? []).map((s) => (s ? images[s] ?? null : null));

  useEffect(() => {
    const t = setTimeout(() => {
      const stage = stageRef.current;
      if (!stage) return;
      let url: string;
      try {
        url = stage.toDataURL({ mimeType: "image/jpeg", quality: 0.6, pixelRatio: 1.5 });
      } catch {
        return; // tainted/oversized canvas — skip this round
      }
      if (url === lastSaved.current) return;
      lastSaved.current = url;
      void saveThumbnail(id, url, projectId ?? undefined);
    }, 800);
    return () => clearTimeout(t);
  }, [doc, contentKey, id, projectId]);

  return (
    <Stage ref={stageRef} width={w} height={h}>
      <Layer>
        <ScreenshotContent key={contentKey} doc={doc} screenImages={screenImages} layerImages={images} editable={false} width={w} height={h} />
      </Layer>
    </Stage>
  );
}

export default function Canvas() {
  // The board reads the WHOLE doc set + order; `doc` is the active mirror used for
  // the active frame's interactions, the inline text edit, and the thumbnail.
  const docs = useEditorStore((s) => s.docs);
  const order = useEditorStore((s) => s.order);
  const activeId = useEditorStore((s) => s.screenshotId);
  const projectId = useEditorStore((s) => s.projectId);
  const doc = useEditorStore((s) => s.doc);
  const setActive = useEditorStore((s) => s.setActive);
  const setFrameImage = useEditorStore((s) => s.setFrameImage);
  const updateFrameAdjust = useEditorStore((s) => s.updateFrameAdjust);
  const updateFreeformFrame = useEditorStore((s) => s.updateFreeformFrame);
  const setFrameScale = useEditorStore((s) => s.setFrameScale);
  const setFrameRotation = useEditorStore((s) => s.setFrameRotation);
  const setFrameDeviceOrientation = useEditorStore((s) => s.setFrameDeviceOrientation);
  const setSelectedFrameIndex = useEditorStore((s) => s.setSelectedFrameIndex);
  const selectedFrameIndex = useEditorStore((s) => s.selectedFrameIndex);
  const updateImageLayer = useEditorStore((s) => s.updateImageLayer);
  const updateTextLayer = useEditorStore((s) => s.updateTextLayer);
  const selectLayer = useEditorStore((s) => s.selectLayer);
  const selectedLayerId = useEditorStore((s) => s.selectedLayerId);
  const previewClass = useEditorStore((s) => s.previewClass);

  const [fontsReady, setFontsReady] = useState(false);
  const [fontTick, setFontTick] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [viewport, setViewport] = useState<{ w: number; h: number } | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [guides, setGuides] = useState<{ x?: number; y?: number }>({});
  // Inline text edit: an HTML textarea overlaid on the active frame's caption.
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
  const scrollRef = useRef<HTMLDivElement>(null);
  // Grab-to-pan: drag start (client coords + scroll offset) and a moved flag so a
  // click-without-drag still deselects.
  const panRef = useRef<{ cx: number; cy: number; left: number; top: number } | null>(null);
  const movedRef = useRef(false);

  // Existing screenshots in board order (defensive fallback to map keys).
  const frames = useMemo(() => {
    const ids = order.length ? order : Object.keys(docs);
    return ids.filter((id) => docs[id]).map((id) => ({ id, doc: docs[id] }));
  }, [order, docs]);

  // Load every screen + image-layer source across all docs (the board shows them
  // all) through one shared map, keyed by src.
  const allSrcs = useMemo(() => {
    const out: string[] = [];
    for (const f of frames) {
      for (const s of f.doc.frameImages ?? []) if (s) out.push(s);
      for (const il of f.doc.imageLayers ?? []) if (il.src) out.push(il.src);
      // Multi-device freeform frames carry their own screenshot src.
      for (const ff of f.doc.freeformFrames ?? []) if (ff.src) out.push(ff.src);
    }
    return out;
  }, [frames]);
  const images = useHtmlImages(allSrcs);
  const screenImagesFor = useCallback(
    (d: EditorDoc) => (d.frameImages ?? []).map((s) => (s ? images[s] ?? null : null)),
    [images],
  );

  // Place frames left→right with gaps; vertically center each on the tallest, so
  // mixed portrait/landscape rows sit on a common centre line. x offsets are a
  // prefix sum (computed without mutation; frame counts are tiny).
  const { items, boardW, boardH } = useMemo(() => {
    const dims = frames.map((f) => {
      const m = masterDimsFor(f.doc.orientation);
      return { id: f.id, doc: f.doc, mw: m.w, mh: m.h };
    });
    const offsets = dims.map((_, i) => dims.slice(0, i).reduce((sum, d) => sum + d.mw + BOARD_GAP, 0));
    const last = dims[dims.length - 1];
    const bW = last ? offsets[dims.length - 1] + last.mw : 1;
    const bH = dims.reduce((mx, d) => Math.max(mx, d.mh), 1);
    const placed: PlacedFrame[] = dims.map((d, i) => ({ ...d, x: offsets[i], y: (bH - d.mh) / 2 }));
    return { items: placed, boardW: bW, boardH: bH };
  }, [frames]);

  // Fit the whole board into the available area on both axes; zoom multiplies.
  const fitScale = viewport
    ? Math.max(0.04, Math.min((viewport.w - CANVAS_PAD) / boardW, (viewport.h - CANVAS_PAD) / boardH))
    : FIT_FALLBACK;
  const scale = fitScale * zoom;

  const activeItem = items.find((it) => it.id === activeId) ?? null;
  const activeMaster = masterDimsFor(doc.orientation);

  // Font signature across ALL docs (other frames may use fonts the active one
  // doesn't) — load every used font+weight, then bump a tick to redraw.
  const fontSig = useMemo(
    () => frames.flatMap((f) => f.doc.textLayers.map((l) => `${l.font}:${l.weight}`)).join(","),
    [frames],
  );

  useEffect(() => {
    document.fonts.ready.then(() => setFontsReady(true));
  }, []);

  useEffect(() => {
    let active = true;
    const specs = new Set<string>();
    const all = useEditorStore.getState().docs;
    for (const id in all) for (const l of all[id].textLayers) specs.add(`${l.weight} 120px "${FONT_FAMILY[l.font]}"`);
    Promise.all([...specs].map((sp) => document.fonts.load(sp).catch(() => {}))).then(() => active && setFontTick((t) => t + 1));
    return () => {
      active = false;
    };
  }, [fontSig]);

  // keyboard: undo/redo, zoom, help, delete layer (acts on the active doc)
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
        const freeformId = parseFreeformSel(sel);
        if (freeformId) {
          // Delete the selected freeform device.
          e.preventDefault();
          st.removeFreeformFrame(freeformId);
        } else if ((st.doc.imageLayers ?? []).some((l) => l.id === sel)) {
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

  // Measure the canvas area so the board fit tracks available space.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (cr) setViewport({ w: cr.width, h: cr.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Grab-to-pan: once a pan starts (mousedown on empty canvas), drag scrolls the
  // board; releasing without having moved counts as a click → deselect.
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const p = panRef.current;
      const el = scrollRef.current;
      if (!p || !el) return;
      const dx = e.clientX - p.cx;
      const dy = e.clientY - p.cy;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) movedRef.current = true;
      el.scrollLeft = p.left - dx;
      el.scrollTop = p.top - dy;
    };
    const onUp = () => {
      if (!panRef.current) return;
      const moved = movedRef.current;
      panRef.current = null;
      if (scrollRef.current) scrollRef.current.style.cursor = "";
      if (!moved) useEditorStore.getState().selectLayer(null);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  // Mirror `editing` into a ref so the (mount-once) keyboard handler can tell
  // when the inline textarea owns the keyboard.
  useEffect(() => {
    editingRef.current = !!editing;
  }, [editing]);

  // Open inline editing for a caption on the active frame: place a textarea over
  // the Konva text. getAbsolutePosition/getAbsoluteScale already fold in the
  // frame's x/y offset on the board AND the stage scale, so the overlay lands
  // exactly over the text regardless of which frame it belongs to.
  const requestEditText = useCallback((id: string, node: Konva.Text) => {
    const stage = node.getStage();
    if (!stage) return;
    const layer = useEditorStore.getState().doc.textLayers.find((l) => l.id === id);
    if (!layer) return;
    const pos = node.getAbsolutePosition();
    const absScale = node.getAbsoluteScale().x;
    setEditing({
      id,
      left: pos.x,
      top: pos.y,
      width: node.width() * absScale,
      fontSize: node.fontSize() * absScale,
      lineHeight: layer.lineHeight,
      letterSpacing: node.letterSpacing() * absScale,
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

  // Per-frame project-card thumbnails are captured by the off-screen
  // <ThumbCapturer> stages below (one per screenshot) — see the hidden block at
  // the end of the render.

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files?.[0];
      if (!file || !file.type.startsWith("image/")) return;
      setFrameImage(0, URL.createObjectURL(file)); // optimistic preview, active frame
      uploadImage(file)
        .then((url) => setFrameImage(0, url)) // swap to the persisted URL
        .catch(() => toast.error("Image upload failed"));
    },
    [setFrameImage],
  );

  // Center-snap guides while dragging a caption on the active frame.
  const handleDragMove = (id: string, node: DragNode) => {
    const w = node.width();
    const h = node.height();
    const cx = node.x() + w / 2;
    const cy = node.y() + h / 2;
    const T = 40;
    const mcx = activeMaster.w / 2;
    const mcy = activeMaster.h / 2;
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
  };
  const handleDragEnd = (id: string, x: number, y: number) => {
    updateTextLayer(id, { x, y });
    setGuides({});
  };

  const contentKeyFor = (it: PlacedFrame) => {
    const imgSig = (it.doc.frameImages ?? []).map((s) => (s && images[s] ? "l" : "n")).join("");
    // Include per-slot device orientations so flipping one slot remounts the frame
    // → its resize/rotate transformer re-fits to the flipped device aspect.
    const devOri = `${it.doc.deviceOrientation ?? "x"}/${(it.doc.frameDeviceOrientations ?? []).join("")}`;
    // Freeform: remount when a device is added/removed/flipped/changed or its image
    // loads, so each FreeformFrame's transformer re-fits to the new aspect/box.
    // (Move/resize/rotate are NOT here — those re-fit via the frame's own effect.)
    const ffSig = (it.doc.freeformFrames ?? [])
      .map((f) => `${f.id}:${f.deviceOrientation ?? "x"}:${f.device}:${f.src && images[f.src] ? "l" : "n"}`)
      .join("|");
    return `${it.id}-${it.doc.orientation ?? "portrait"}-${devOri}-${(it.doc.frameImages ?? []).join("|")}-${imgSig}-ff[${ffSig}]-${fontsReady ? "f" : "nf"}-${fontTick}`;
  };

  return (
    <div className="absolute inset-0" onDrop={onDrop} onDragOver={(e) => e.preventDefault()}>
      <div
        ref={scrollRef}
        role="group"
        aria-label={`Screenshot board — ${items.length} ${items.length === 1 ? "screen" : "screens"}`}
        className="absolute inset-0 overflow-auto"
      >
        {/* `m-auto` (not justify/items-center) centers the board when it fits but
            clamps to the start when it overflows — so EVERY frame stays reachable
            by scrolling/panning (justify-center would make the overflow edge
            unscrollable). */}
        <div className="flex min-h-full min-w-full p-14">
          <div className="relative m-auto">
            <Stage
              width={Math.round(boardW * scale)}
              height={Math.round(boardH * scale)}
              scaleX={scale}
              scaleY={scale}
              dragDistance={4}
              onMouseDown={(e) => {
                // Empty canvas (a gap, or the active frame's bare background)
                // resolves to the Stage itself → start a viewport pan. A click
                // without movement falls through to deselect on mouseup.
                if (e.target === e.target.getStage()) {
                  const el = scrollRef.current;
                  panRef.current = { cx: e.evt.clientX, cy: e.evt.clientY, left: el?.scrollLeft ?? 0, top: el?.scrollTop ?? 0 };
                  movedRef.current = false;
                  if (el) el.style.cursor = "grabbing";
                }
              }}
            >
              <Layer>
                {items.map((it) => (
                  <FrameOnBoard
                    key={it.id}
                    item={it}
                    active={it.id === activeId}
                    contentKey={contentKeyFor(it)}
                    screenImages={screenImagesFor(it.doc)}
                    layerImages={images}
                    selectedLayerId={selectedLayerId}
                    editingTextId={editing?.id ?? null}
                    guides={guides}
                    onActivate={() => {
                      setActive(it.id);
                      setEditing(null);
                    }}
                    onSelectLayer={selectLayer}
                    onDragMoveLayer={handleDragMove}
                    onDragLayer={handleDragEnd}
                    onAdjustFrame={(i, off) => updateFrameAdjust(previewClass, i, off)}
                    onFreeformFrameChange={updateFreeformFrame}
                    onFrameScale={setFrameScale}
                    onFrameRotate={setFrameRotation}
                    onToggleFrameOrientation={setFrameDeviceOrientation}
                    viewScale={scale}
                    onSelectFrame={setSelectedFrameIndex}
                    selectedFrameIndex={selectedFrameIndex}
                    onImageLayerChange={updateImageLayer}
                    onRequestEditText={requestEditText}
                  />
                ))}
              </Layer>
            </Stage>

            {/* Index chips — constant-size HTML overlay, positioned per frame and
                clickable to activate. Sits just above each frame's top edge. */}
            {items.map((it, i) => {
              const isActive = it.id === activeId;
              return (
                <button
                  key={it.id}
                  onClick={() => {
                    setActive(it.id);
                    setEditing(null);
                  }}
                  className={cn(
                    "absolute grid h-5 min-w-5 -translate-y-full place-items-center rounded-md px-1.5 font-mono text-[10px] font-semibold tabular-nums shadow-sm transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "bg-background/85 text-muted-foreground backdrop-blur hover:text-foreground",
                  )}
                  style={{ left: it.x * scale, top: it.y * scale - 6 }}
                  aria-label={`Edit screenshot ${i + 1}`}
                  aria-current={isActive}
                >
                  {i + 1}
                </button>
              );
            })}

            {/* Inline caption editor — absolute INSIDE the stage wrapper. Coords
                come from the node's absolute on-screen position, so it sits over
                the right text even though each frame is offset on the board. */}
            {editing && activeItem && (
              <textarea
                ref={taRef}
                autoFocus
                aria-label="Edit caption text"
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
                  position: "absolute",
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
          </div>
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
              <li className="flex justify-between"><span>Pan board</span><kbd>drag / 2-finger</kbd></li>
              <li className="flex justify-between"><span>This panel</span><kbd>?</kbd></li>
            </ul>
          </div>
        </div>
      )}

      {/* Off-screen thumbnail stages — one per screenshot. Each captures + saves
          its own project-card thumbnail when its content/images/fonts settle. */}
      <div aria-hidden style={{ position: "fixed", left: -100000, top: 0, pointerEvents: "none" }}>
        {items.map((it) => (
          <ThumbCapturer
            key={it.id}
            id={it.id}
            doc={it.doc}
            images={images}
            contentKey={contentKeyFor(it)}
            projectId={projectId}
          />
        ))}
      </div>

      {/* Multi-size export render/harvest engine (mounts its own off-screen stage). */}
      <ExportController />
    </div>
  );
}
