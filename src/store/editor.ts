import { create } from "zustand";
import { temporal } from "zundo";
import {
  type EditorDoc,
  type TextLayer,
  type FrameAdjust,
  type FrameAdjustByClass,
  type FrameTransform,
  type FreeformFrameSpec,
  type ImageLayer,
  type Orientation,
  DEFAULT_DOC,
  DEFAULT_FRAME_ADJUST,
  DEFAULT_FRAME_TRANSFORM,
  FRAME_SCALE_MIN,
  FRAME_SCALE_MAX,
  defaultFrameTransformFor,
  frameDeviceOrientationAt,
  freeformSelId,
  makeFreeformFrameId,
  masterDimsFor,
  makeImageLayer,
  makeTextLayer,
  normalizeAngle,
  parseFreeformSel,
  resolveFreeformFrames,
} from "@/lib/editorDoc";
import { computeLayout } from "@/lib/layout";
import { coalesceBursts, reconcileDocs, selectableIds } from "@/lib/history";
import type { DeviceFrame, LayoutPreset } from "@/lib/schema";
import { deviceClassOf, type DeviceClass } from "@/lib/deviceGeometry";

export type SaveState = "idle" | "saving" | "saved";

// Attributes the "apply to all" menu can push from the active frame to every frame.
export type ApplyAttr = "background" | "typography" | "device" | "layout";

export type ExportScope = "current" | "all";
export type ExportShot = { id: string; position: number; doc: EditorDoc };
export type ExportRequest = {
  // Bumped per request so the renderer fires once per submit.
  nonce: number;
  sizeIds: string[];
  scope: ExportScope;
  // Populated for scope "all": every screenshot's doc, ordered by position.
  shots: ExportShot[];
  // Languages to render (null = the default captions). More than one writes a
  // folder per language. Absent = default only.
  locales?: (string | null)[];
};
export type ExportProgress =
  | { state: "idle" }
  | { state: "running"; completed: number; total: number }
  | { state: "done"; total: number }
  | { state: "error"; message: string };

type EditorState = {
  // Editor v2: the store holds EVERY screenshot's doc, keyed by id (`docs`), so
  // the multi-screenshot board can render and edit them all. `doc` is the ACTIVE
  // screenshot's doc, kept as a synced mirror of docs[screenshotId] — existing
  // single-frame components read `doc` unchanged. Undo (zundo) tracks `docs`, so
  // it spans the whole set and makes "apply to all" a single undoable step.
  docs: Record<string, EditorDoc>;
  // Screenshot ids in board/filmstrip order (docs is an unordered map). The board
  // renders frames in this order; kept synced on add/remove/reorder. Not tracked
  // by undo (only `docs` is partialized), so structural order never pollutes history.
  order: string[];
  doc: EditorDoc;
  selectedLayerId: string | null;
  // Which frame SLOT is selected (multi-frame layouts), so the resize transformer
  // and the sidebar device-size control target the same device. Not undoable.
  selectedFrameIndex: number;
  saveState: SaveState;
  setSaveState: (s: SaveState) => void;
  // Current (active) screenshot id; used for thumbnails + the active-doc mirror.
  screenshotId: string | null;
  // Current project id; used for the "export all" fetch and usage tracking.
  projectId: string | null;
  // One-shot export request emitted by the export dialog, consumed by ExportController.
  exportRequest: ExportRequest | null;
  setExportRequest: (r: ExportRequest) => void;
  exportProgress: ExportProgress;
  setExportProgress: (p: ExportProgress) => void;
  // Bumped to stop a running export (ExportController abandons it).
  exportCancel: number;
  cancelExport: () => void;
  // Which device class the editor canvas previews (and whose crop is edited).
  previewClass: DeviceClass;
  setPreviewClass: (cls: DeviceClass) => void;
  // Caption language shown on the canvas and edited in the sidebar (null =
  // default). UI state only; not saved and not undoable.
  previewLocale: string | null;
  setPreviewLocale: (locale: string | null) => void;
  // Replace the whole doc set + active id (editor load). Caller clears temporal.
  hydrateDocs: (docs: Record<string, EditorDoc>, activeId: string) => void;
  // Switch the active screenshot (reads from docs; not tracked by undo).
  setActive: (id: string) => void;
  // Add/remove a screenshot's doc (filmstrip create/duplicate/delete); untracked.
  // Both keep `order` in sync (append / filter).
  upsertDoc: (id: string, doc: EditorDoc) => void;
  removeDoc: (id: string) => void;
  // Reorder the board/filmstrip (drag-to-reorder); untracked.
  setOrder: (ids: string[]) => void;
  updateDoc: (partial: Partial<EditorDoc>) => void;
  setFrameImage: (index: number, url: string | null) => void;
  updateFrameAdjust: (deviceClass: DeviceClass, index: number, partial: Partial<FrameAdjust>) => void;
  updateFrameTransform: (partial: Partial<FrameTransform>) => void;
  // Multi-device freeform: add a device, edit one, or remove one. Each migrates a
  // legacy single-device freeform into the freeformFrames[] array on first write.
  addFreeformFrame: () => void;
  updateFreeformFrame: (id: string, partial: Partial<FreeformFrameSpec>) => void;
  removeFreeformFrame: (id: string) => void;
  // Set the device model on the active target: the selected freeform device when
  // in freeform with one selected, else the doc-level device (presets).
  setActiveDevice: (device: DeviceFrame) => void;
  // Preset-layout per-slot device-size multiplier (resize on canvas / via slider).
  setFrameScale: (index: number, scale: number) => void;
  // Preset-layout per-slot USER rotation (degrees), on top of the layout tilt
  // (on-canvas rotate handle / via slider). One undoable commit each.
  setFrameRotation: (index: number, rotation: number) => void;
  // Per-slot device orientation flip (upright↔sideways) — on-canvas control.
  setFrameDeviceOrientation: (index: number, orientation: Orientation) => void;
  // Select which frame slot the resize transformer + size control act on.
  setSelectedFrameIndex: (index: number) => void;
  addImageLayer: (src: string, aspect: number) => void;
  updateImageLayer: (id: string, partial: Partial<ImageLayer>) => void;
  removeImageLayer: (id: string) => void;
  setOrientation: (orientation: Orientation) => void;
  // Rotate the device independently of the canvas (upright vs sideways).
  setDeviceOrientation: (orientation: Orientation) => void;
  setLayout: (layout: LayoutPreset) => void;
  addTextLayer: () => void;
  updateTextLayer: (id: string, partial: Partial<TextLayer>) => void;
  removeTextLayer: (id: string) => void;
  moveTextLayer: (id: string, dir: "up" | "down") => void;
  selectLayer: (id: string | null) => void;
  // Push the active frame's attribute to ALL docs in one set → one undoable step.
  applyToAll: (attr: ApplyAttr) => void;
};

// Write the active screenshot's doc to BOTH the mirror and the docs map in one
// set, so they never diverge. Edits flow through here; undo tracks `docs`.
// An edit whose active screenshot is missing from `docs` does nothing, so it can
// never resurrect a screenshot as a malformed "ghost" entry.
function writeActive(s: EditorState, doc: EditorDoc): Partial<EditorState> {
  if (!s.screenshotId) return { doc };
  if (!s.docs[s.screenshotId]) return {};
  return { doc, docs: { ...s.docs, [s.screenshotId]: doc } };
}

// Copy ONE attribute from the active (source) doc onto a target doc, returning a
// new doc. Used by applyToAll. Text CONTENT, positions, screen images and order
// are always preserved — only the chosen attribute is pushed.
function applyAttr(attr: ApplyAttr, source: EditorDoc, target: EditorDoc, srcLayer: TextLayer | null): EditorDoc {
  switch (attr) {
    case "background":
      return { ...target, background: source.background };
    case "device":
      // Carry the device model AND its rotation (resolved, so every frame's phone
      // ends up oriented like the source's regardless of each canvas orientation).
      return {
        ...target,
        device: source.device,
        deviceOrientation: source.deviceOrientation ?? source.orientation ?? "portrait",
      };
    case "typography":
      if (!srcLayer) return target;
      // Push the source caption's type onto every text layer; keep each layer's
      // content + geometry (x/y/width).
      return {
        ...target,
        textLayers: target.textLayers.map((l) => ({
          ...l,
          font: srcLayer.font,
          weight: srcLayer.weight,
          size: srcLayer.size,
          color: srcLayer.color,
          letterSpacing: srcLayer.letterSpacing,
          lineHeight: srcLayer.lineHeight,
          align: srcLayer.align,
        })),
      };
    case "layout": {
      // Adopt the layout preset and move the primary caption to its slot (in the
      // target's own orientation), mirroring setLayout.
      const m = masterDimsFor(target.orientation);
      const cap = computeLayout(source.layout, m.w, m.h).caption;
      const textLayers =
        cap && target.textLayers.length
          ? target.textLayers.map((l, i) => (i === 0 ? { ...l, x: cap.x, y: cap.y, width: cap.width } : l))
          : target.textLayers;
      return { ...target, layout: source.layout, textLayers };
    }
    default:
      return target;
  }
}

// Declared (with its return type) outside the store options so its type
// doesn't depend on the store's own inferred type.
function startsNewUndoStep(): boolean {
  const t = useEditorStore.temporal.getState();
  return t.pastStates.length === 0 || t.futureStates.length > 0;
}

export const useEditorStore = create<EditorState>()(
  temporal(
    (set) => ({
      docs: {},
      order: [],
      doc: DEFAULT_DOC,
      selectedLayerId: DEFAULT_DOC.textLayers[0]?.id ?? null,
      selectedFrameIndex: 0,
      saveState: "idle",
      setSaveState: (saveState) => set({ saveState }),
      screenshotId: null,
      projectId: null,
      exportRequest: null,
      setExportRequest: (exportRequest) => set({ exportRequest }),
      exportProgress: { state: "idle" },
      setExportProgress: (exportProgress) => set({ exportProgress }),
      exportCancel: 0,
      cancelExport: () => set((s) => ({ exportCancel: s.exportCancel + 1, exportProgress: { state: "idle" } })),
      previewClass: "iphone",
      setPreviewClass: (previewClass) => set({ previewClass }),
      previewLocale: null,
      setPreviewLocale: (previewLocale) => set({ previewLocale }),
      hydrateDocs: (docs, activeId) =>
        set({
          docs,
          // docs is built in position order (Object.fromEntries over the ordered
          // screenshots prop), so its keys ARE the board order.
          order: Object.keys(docs),
          doc: docs[activeId] ?? DEFAULT_DOC,
          screenshotId: activeId,
          selectedLayerId: docs[activeId]?.textLayers[0]?.id ?? null,
          selectedFrameIndex: 0,
          previewClass: deviceClassOf((docs[activeId] ?? DEFAULT_DOC).device),
          saveState: "idle",
        }),
      // Changing only `doc`/`screenshotId`/selection (not `docs`) produces no undo
      // snapshot, so switching frames never pollutes edit history.
      setActive: (id) =>
        set((s) => {
          const next = s.docs[id];
          if (!next) return s;
          // Point previewClass at the newly-active doc's device family so the
          // RightSidebar crop controls (which read previewClass) target the same
          // class the board renders for this frame.
          return {
            screenshotId: id,
            doc: next,
            selectedLayerId: next.textLayers[0]?.id ?? null,
            selectedFrameIndex: 0,
            previewClass: deviceClassOf(next.device),
            saveState: "idle",
          };
        }),
      upsertDoc: (id, doc) => {
        // Structural (add/duplicate), not an edit — keep it out of undo history.
        const t = useEditorStore.temporal.getState();
        t.pause();
        set((s) => ({
          docs: { ...s.docs, [id]: doc },
          order: s.order.includes(id) ? s.order : [...s.order, id],
        }));
        t.resume();
      },
      removeDoc: (id) => {
        const t = useEditorStore.temporal.getState();
        t.pause();
        set((s) => {
          const docs = { ...s.docs };
          delete docs[id];
          return { docs, order: s.order.filter((x) => x !== id) };
        });
        t.resume();
      },
      // Order isn't tracked by undo (not in `partialize`), so a plain set is fine.
      setOrder: (ids) => set({ order: ids }),
      updateDoc: (partial) => set((s) => writeActive(s, { ...s.doc, ...partial })),
      setFrameImage: (index, url) =>
        set((s) => {
          const arr = [...s.doc.frameImages];
          while (arr.length <= index) arr.push(null);
          arr[index] = url;
          return writeActive(s, { ...s.doc, frameImages: arr });
        }),
      updateFrameAdjust: (deviceClass, index, partial) =>
        set((s) => {
          const prev = s.doc.frameAdjust;
          // Migrate a legacy flat array (global crop) into the iPhone class.
          const map: FrameAdjustByClass = Array.isArray(prev)
            ? { iphone: prev as (FrameAdjust | null)[] }
            : { ...(prev ?? {}) };
          const arr = [...(map[deviceClass] ?? [])];
          while (arr.length <= index) arr.push(null);
          arr[index] = { ...DEFAULT_FRAME_ADJUST, ...(arr[index] ?? {}), ...partial };
          map[deviceClass] = arr;
          return writeActive(s, { ...s.doc, frameAdjust: map });
        }),
      updateFrameTransform: (partial) =>
        set((s) =>
          writeActive(s, {
            ...s.doc,
            frameTransform: { ...DEFAULT_FRAME_TRANSFORM, ...(s.doc.frameTransform ?? {}), ...partial },
          }),
        ),
      addFreeformFrame: () =>
        set((s) => {
          const frames = resolveFreeformFrames(s.doc);
          const m = masterDimsFor(s.doc.orientation);
          const width = Math.round(Math.min(m.w * 0.5, DEFAULT_FRAME_TRANSFORM.width));
          // Cascade placement so a new device doesn't land exactly atop another.
          const off = (frames.length % 6) * Math.round(m.w * 0.045);
          const frame: FreeformFrameSpec = {
            id: makeFreeformFrameId(),
            device: s.doc.device,
            deviceOrientation: s.doc.deviceOrientation,
            src: null,
            x: Math.round((m.w - width) / 2) + off,
            y: Math.round(m.h * 0.26) + off,
            width,
            rotation: 0,
          };
          return {
            ...writeActive(s, { ...s.doc, freeformFrames: [...frames, frame] }),
            selectedLayerId: freeformSelId(frame.id),
          };
        }),
      updateFreeformFrame: (id, partial) =>
        set((s) => {
          const frames = resolveFreeformFrames(s.doc).map((f) => (f.id === id ? { ...f, ...partial } : f));
          return writeActive(s, { ...s.doc, freeformFrames: frames });
        }),
      removeFreeformFrame: (id) =>
        set((s) => {
          const frames = resolveFreeformFrames(s.doc).filter((f) => f.id !== id);
          return {
            ...writeActive(s, { ...s.doc, freeformFrames: frames }),
            selectedLayerId: s.selectedLayerId === freeformSelId(id) ? null : s.selectedLayerId,
          };
        }),
      setActiveDevice: (device) =>
        set((s) => {
          const fid = parseFreeformSel(s.selectedLayerId);
          if (s.doc.layout === "freeform" && fid) {
            const frames = resolveFreeformFrames(s.doc).map((f) => (f.id === fid ? { ...f, device } : f));
            return writeActive(s, { ...s.doc, freeformFrames: frames });
          }
          return writeActive(s, { ...s.doc, device });
        }),
      setFrameScale: (index, scale) =>
        set((s) => {
          const clamped = Math.max(FRAME_SCALE_MIN, Math.min(FRAME_SCALE_MAX, scale));
          // Grow the per-slot array, seeding earlier slots from the legacy shared
          // value (or 1) so un-resized frames look unchanged.
          const arr = [...(s.doc.frameScales ?? [])];
          while (arr.length <= index) arr.push(s.doc.frameScale ?? 1);
          arr[index] = clamped;
          return writeActive(s, { ...s.doc, frameScales: arr });
        }),
      setFrameRotation: (index, rotation) =>
        set((s) => {
          const norm = normalizeAngle(rotation);
          // Grow the per-slot array (earlier un-rotated slots default to 0).
          const arr = [...(s.doc.frameRotations ?? [])];
          while (arr.length <= index) arr.push(0);
          arr[index] = norm;
          return writeActive(s, { ...s.doc, frameRotations: arr });
        }),
      setFrameDeviceOrientation: (index, orientation) =>
        set((s) => {
          // Grow the per-slot array, seeding earlier slots from their resolved
          // orientation so un-flipped frames stay exactly as they render now.
          const arr = [...(s.doc.frameDeviceOrientations ?? [])];
          while (arr.length <= index) arr.push(frameDeviceOrientationAt(s.doc, arr.length));
          arr[index] = orientation;
          return writeActive(s, { ...s.doc, frameDeviceOrientations: arr });
        }),
      setSelectedFrameIndex: (index) => set({ selectedFrameIndex: index }),
      addImageLayer: (src, aspect) =>
        set((s) => {
          const layer = makeImageLayer(src, aspect);
          // Center in the current orientation's master (makeImageLayer assumes portrait).
          const m = masterDimsFor(s.doc.orientation);
          layer.x = Math.round((m.w - layer.width) / 2);
          layer.y = Math.round((m.h - layer.height) / 2);
          return { ...writeActive(s, { ...s.doc, imageLayers: [...(s.doc.imageLayers ?? []), layer] }), selectedLayerId: layer.id };
        }),
      updateImageLayer: (id, partial) =>
        set((s) =>
          writeActive(s, {
            ...s.doc,
            imageLayers: (s.doc.imageLayers ?? []).map((l) => (l.id === id ? { ...l, ...partial } : l)),
          }),
        ),
      removeImageLayer: (id) =>
        set((s) => ({
          ...writeActive(s, { ...s.doc, imageLayers: (s.doc.imageLayers ?? []).filter((l) => l.id !== id) }),
          selectedLayerId: s.selectedLayerId === id ? null : s.selectedLayerId,
        })),
      setOrientation: (orientation) =>
        set((s) => {
          const cur = s.doc.orientation ?? "portrait";
          if (cur === orientation) return s;
          // Transpose the master space; remap layer positions by the new/old
          // ratio so the composition keeps the same fractional placement. Font
          // size stays put (it's relative to the unchanged short edge, 1290).
          const old = masterDimsFor(cur);
          const next = masterDimsFor(orientation);
          const fx = next.w / old.w;
          const fy = next.h / old.h;
          const textLayers = s.doc.textLayers.map((l) => ({ ...l, x: l.x * fx, y: l.y * fy, width: l.width * fx }));
          const imageLayers = (s.doc.imageLayers ?? []).map((l) => ({
            ...l,
            x: l.x * fx,
            y: l.y * fy,
            width: l.width * fx,
            height: l.height * fx,
          }));
          const frameTransform = s.doc.frameTransform
            ? {
                ...s.doc.frameTransform,
                x: s.doc.frameTransform.x * fx,
                y: s.doc.frameTransform.y * fy,
                width: s.doc.frameTransform.width * fx,
              }
            : s.doc.frameTransform;
          // Remap each multi-device freeform frame the same way (keep fractional
          // placement across the transpose). Untouched when absent (legacy docs).
          const freeformFrames = s.doc.freeformFrames?.map((f) => ({
            ...f,
            x: f.x * fx,
            y: f.y * fy,
            width: f.width * fx,
          }));
          return writeActive(s, { ...s.doc, orientation, textLayers, imageLayers, frameTransform, freeformFrames });
        }),
      // Device-only rotation: changes the device aspect + rendering, not the
      // canvas/master, so layer positions stay put (no transpose needed).
      setDeviceOrientation: (orientation) => set((s) => writeActive(s, { ...s.doc, deviceOrientation: orientation })),
      setLayout: (layout) =>
        set((s) => {
          // Reposition the primary text layer to the layout's caption slot, in
          // the CURRENT orientation's master space (portrait 1290×2796 vs
          // landscape 2796×1290) — otherwise a landscape doc gets portrait coords.
          const m = masterDimsFor(s.doc.orientation);
          const cap = computeLayout(layout, m.w, m.h).caption;
          const textLayers =
            cap && s.doc.textLayers.length
              ? s.doc.textLayers.map((l, i) => (i === 0 ? { ...l, x: cap.x, y: cap.y, width: cap.width } : l))
              : s.doc.textLayers;
          // Seed an orientation-appropriate freeform placement the first time.
          const frameTransform =
            layout === "freeform" ? s.doc.frameTransform ?? defaultFrameTransformFor(s.doc.orientation) : s.doc.frameTransform;
          return writeActive(s, { ...s.doc, layout, textLayers, frameTransform });
        }),
      addTextLayer: () =>
        set((s) => {
          // Center the new caption in the current orientation's master space.
          const m = masterDimsFor(s.doc.orientation);
          const width = Math.round(m.w * 0.6);
          const layer = makeTextLayer({ x: Math.round((m.w - width) / 2), y: Math.round(m.h * 0.45), width });
          return { ...writeActive(s, { ...s.doc, textLayers: [...s.doc.textLayers, layer] }), selectedLayerId: layer.id };
        }),
      updateTextLayer: (id, partial) =>
        set((s) =>
          writeActive(s, { ...s.doc, textLayers: s.doc.textLayers.map((l) => (l.id === id ? { ...l, ...partial } : l)) }),
        ),
      removeTextLayer: (id) =>
        set((s) => ({
          ...writeActive(s, { ...s.doc, textLayers: s.doc.textLayers.filter((l) => l.id !== id) }),
          selectedLayerId: s.selectedLayerId === id ? null : s.selectedLayerId,
        })),
      moveTextLayer: (id, dir) =>
        set((s) => {
          const arr = [...s.doc.textLayers];
          const i = arr.findIndex((l) => l.id === id);
          const j = dir === "up" ? i - 1 : i + 1;
          if (i < 0 || j < 0 || j >= arr.length) return s;
          [arr[i], arr[j]] = [arr[j], arr[i]];
          return writeActive(s, { ...s.doc, textLayers: arr });
        }),
      selectLayer: (id) => set({ selectedLayerId: id }),
      applyToAll: (attr) =>
        set((s) => {
          const activeId = s.screenshotId;
          const source = activeId ? s.docs[activeId] : null;
          if (!activeId || !source) return s;
          // Typography source = the selected text layer, else the first caption.
          const srcLayer = source.textLayers.find((l) => l.id === s.selectedLayerId) ?? source.textLayers[0] ?? null;
          // Single set() over the WHOLE map → one zundo transaction → one Cmd+Z.
          const nextDocs: Record<string, EditorDoc> = {};
          for (const id in s.docs) nextDocs[id] = applyAttr(attr, source, s.docs[id], srcLayer);
          return { docs: nextDocs, doc: nextDocs[activeId] };
        }),
    }),
    {
      // Undo/redo tracks the whole doc SET (not the mirror), so it spans every
      // screenshot and makes "apply to all" a single undoable transaction. The
      // mirror (`doc`) is re-synced from `docs` after restore by the subscription below.
      partialize: (state) => ({ docs: state.docs }),
      // Only a change to `docs` is an undo step — selection, the save badge and
      // the mirror sync below must not record entries (or wipe redo).
      equality: (past, current) => past.docs === current.docs,
      // One step per gesture/typing burst, not per slider tick or keystroke.
      // An edit always records when history is empty (fresh load) or right
      // after an undo (redo stack non-empty), so it starts a new step.
      handleSet: (handleSet) => coalesceBursts(handleSet, { windowMs: 500, force: startsNewUndoStep }),
      limit: 50,
    },
  ),
);

// Undo/redo one step. The restored snapshot may predate a screenshot added
// since (or include one deleted since) — add/remove are structural and kept out
// of history — so screenshot membership keeps following `order`. Then clamp the
// selection to what the restored doc still has.
export function stepHistory(dir: "undo" | "redo") {
  const t = useEditorStore.temporal.getState();
  const before = useEditorStore.getState();
  if (dir === "undo") t.undo();
  else t.redo();
  const s = useEditorStore.getState();
  if (s.docs === before.docs) return; // nothing to undo/redo
  const docs = reconcileDocs(s.docs, before.docs, s.order);
  const active = s.screenshotId ? docs[s.screenshotId] : undefined;
  const doc = active ?? s.doc;
  const sel = s.selectedLayerId;
  const selectedLayerId = sel && selectableIds(before.doc).has(sel) && !selectableIds(doc).has(sel) ? null : sel;
  const m = masterDimsFor(doc.orientation);
  const slots = computeLayout(doc.layout, m.w, m.h).frames.length;
  const selectedFrameIndex = s.selectedFrameIndex < slots ? s.selectedFrameIndex : 0;
  t.pause();
  useEditorStore.setState({ docs, doc, selectedLayerId, selectedFrameIndex });
  t.resume();
}

// Keep the active mirror (`doc`) consistent with docs[screenshotId]. Edits already
// dual-write both, so this only does real work after an undo/redo restores `docs`
// (which leaves the mirror stale). Setting `doc` alone changes no tracked slice, so
// it never creates a history entry and can't loop.
if (typeof window !== "undefined") {
  useEditorStore.subscribe((s) => {
    const id = s.screenshotId;
    if (!id) return;
    const active = s.docs[id];
    if (active && active !== s.doc) useEditorStore.setState({ doc: active });
  });
}
