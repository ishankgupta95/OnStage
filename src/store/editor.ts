import { create } from "zustand";
import { temporal } from "zundo";
import {
  type EditorDoc,
  type TextLayer,
  type FrameAdjust,
  type FrameAdjustByClass,
  type FrameTransform,
  type ImageLayer,
  type Orientation,
  DEFAULT_DOC,
  DEFAULT_FRAME_ADJUST,
  DEFAULT_FRAME_TRANSFORM,
  defaultFrameTransformFor,
  masterDimsFor,
  makeImageLayer,
  makeTextLayer,
} from "@/lib/editorDoc";
import { computeLayout } from "@/lib/layout";
import type { LayoutPreset } from "@/lib/schema";
import type { DeviceClass } from "@/lib/deviceGeometry";

export type SaveState = "idle" | "saving" | "saved";

export type ExportScope = "current" | "all";
export type ExportShot = { id: string; position: number; doc: EditorDoc };
export type ExportRequest = {
  // Bumped per request so the renderer fires once per submit.
  nonce: number;
  sizeIds: string[];
  scope: ExportScope;
  // Populated for scope "all": every screenshot's doc, ordered by position.
  shots: ExportShot[];
};
export type ExportProgress =
  | { state: "idle" }
  | { state: "running"; completed: number; total: number }
  | { state: "done"; total: number }
  | { state: "error"; message: string };

type EditorState = {
  doc: EditorDoc;
  selectedLayerId: string | null;
  saveState: SaveState;
  setSaveState: (s: SaveState) => void;
  // Current screenshot id (set when the editor loads a screenshot); used for thumbnails.
  screenshotId: string | null;
  // Current project id; used for the "export all" fetch and usage tracking.
  projectId: string | null;
  // One-shot export request emitted by the export dialog, consumed by ExportController.
  exportRequest: ExportRequest | null;
  setExportRequest: (r: ExportRequest) => void;
  exportProgress: ExportProgress;
  setExportProgress: (p: ExportProgress) => void;
  // Which device class the editor canvas previews (and whose crop is edited).
  previewClass: DeviceClass;
  setPreviewClass: (cls: DeviceClass) => void;
  updateDoc: (partial: Partial<EditorDoc>) => void;
  setFrameImage: (index: number, url: string | null) => void;
  updateFrameAdjust: (deviceClass: DeviceClass, index: number, partial: Partial<FrameAdjust>) => void;
  updateFrameTransform: (partial: Partial<FrameTransform>) => void;
  addImageLayer: (src: string, aspect: number) => void;
  updateImageLayer: (id: string, partial: Partial<ImageLayer>) => void;
  removeImageLayer: (id: string) => void;
  setOrientation: (orientation: Orientation) => void;
  setLayout: (layout: LayoutPreset) => void;
  addTextLayer: () => void;
  updateTextLayer: (id: string, partial: Partial<TextLayer>) => void;
  removeTextLayer: (id: string) => void;
  moveTextLayer: (id: string, dir: "up" | "down") => void;
  selectLayer: (id: string | null) => void;
};

export const useEditorStore = create<EditorState>()(
  temporal(
    (set) => ({
      doc: DEFAULT_DOC,
      selectedLayerId: DEFAULT_DOC.textLayers[0]?.id ?? null,
      saveState: "idle",
      setSaveState: (saveState) => set({ saveState }),
      screenshotId: null,
      projectId: null,
      exportRequest: null,
      setExportRequest: (exportRequest) => set({ exportRequest }),
      exportProgress: { state: "idle" },
      setExportProgress: (exportProgress) => set({ exportProgress }),
      previewClass: "iphone",
      setPreviewClass: (previewClass) => set({ previewClass }),
      updateDoc: (partial) => set((s) => ({ doc: { ...s.doc, ...partial } })),
      setFrameImage: (index, url) =>
        set((s) => {
          const arr = [...s.doc.frameImages];
          while (arr.length <= index) arr.push(null);
          arr[index] = url;
          return { doc: { ...s.doc, frameImages: arr } };
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
          return { doc: { ...s.doc, frameAdjust: map } };
        }),
      updateFrameTransform: (partial) =>
        set((s) => ({
          doc: { ...s.doc, frameTransform: { ...DEFAULT_FRAME_TRANSFORM, ...(s.doc.frameTransform ?? {}), ...partial } },
        })),
      addImageLayer: (src, aspect) =>
        set((s) => {
          const layer = makeImageLayer(src, aspect);
          // Center in the current orientation's master (makeImageLayer assumes portrait).
          const m = masterDimsFor(s.doc.orientation);
          layer.x = Math.round((m.w - layer.width) / 2);
          layer.y = Math.round((m.h - layer.height) / 2);
          return { doc: { ...s.doc, imageLayers: [...(s.doc.imageLayers ?? []), layer] }, selectedLayerId: layer.id };
        }),
      updateImageLayer: (id, partial) =>
        set((s) => ({
          doc: { ...s.doc, imageLayers: (s.doc.imageLayers ?? []).map((l) => (l.id === id ? { ...l, ...partial } : l)) },
        })),
      removeImageLayer: (id) =>
        set((s) => ({
          doc: { ...s.doc, imageLayers: (s.doc.imageLayers ?? []).filter((l) => l.id !== id) },
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
          return { doc: { ...s.doc, orientation, textLayers, imageLayers, frameTransform } };
        }),
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
          return { doc: { ...s.doc, layout, textLayers, frameTransform } };
        }),
      addTextLayer: () =>
        set((s) => {
          // Center the new caption in the current orientation's master space.
          const m = masterDimsFor(s.doc.orientation);
          const width = Math.round(m.w * 0.6);
          const layer = makeTextLayer({ x: Math.round((m.w - width) / 2), y: Math.round(m.h * 0.45), width });
          return { doc: { ...s.doc, textLayers: [...s.doc.textLayers, layer] }, selectedLayerId: layer.id };
        }),
      updateTextLayer: (id, partial) =>
        set((s) => ({
          doc: { ...s.doc, textLayers: s.doc.textLayers.map((l) => (l.id === id ? { ...l, ...partial } : l)) },
        })),
      removeTextLayer: (id) =>
        set((s) => ({
          doc: { ...s.doc, textLayers: s.doc.textLayers.filter((l) => l.id !== id) },
          selectedLayerId: s.selectedLayerId === id ? null : s.selectedLayerId,
        })),
      moveTextLayer: (id, dir) =>
        set((s) => {
          const arr = [...s.doc.textLayers];
          const i = arr.findIndex((l) => l.id === id);
          const j = dir === "up" ? i - 1 : i + 1;
          if (i < 0 || j < 0 || j >= arr.length) return s;
          [arr[i], arr[j]] = [arr[j], arr[i]];
          return { doc: { ...s.doc, textLayers: arr } };
        }),
      selectLayer: (id) => set({ selectedLayerId: id }),
    }),
    {
      // Undo/redo tracks the document only — not selection or the export signal.
      partialize: (state) => ({ doc: state.doc }),
      limit: 50,
    },
  ),
);
