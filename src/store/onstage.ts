"use client";

import { create } from "zustand";
import { temporal } from "zundo";
import { CAPTIONS, TEMPLATES } from "@/lib/onstage/data";
import { getBackend } from "@/lib/data/backend";
import { FEATURES } from "@/lib/features";
import type { SetDoc, SetFrame } from "@/lib/data/types";

/** One artboard. Re-exported from the domain model so the editor and the
 *  backend can't drift apart. */
export type Frame = SetFrame;

type Selection = "device" | "caption" | "bg" | null;
type Popover = "persp" | "device" | "font" | null;
type Overlay = "export" | "ai" | "store" | null;

type OnstageState = {
  /* the set being edited */
  frames: Frame[];
  active: number;

  /* canvas chrome */
  sel: Selection;
  pop: Popover;
  overlay: Overlay;
  zoom: number;
  panorama: boolean;
  shadow: boolean;
  device: string;
  frameColor: string;
  captionFont: string;
  align: "left" | "center" | "right";
  captionSize: number;
  lang: string;

  /* product-level */
  store: "apple" | "play";
  workMode: "guided" | "canvas";
  gStep: number;

  /* overlays */
  aiTab: "Captions" | "Localize";
  aiTone: string;
  exportPicks: number[];
  exportLangs: string[];
  exportDest: string;
  exportState: null | "rendering" | "uploading" | "done" | "error";
  /** Where a finished export actually went, for the dialog's footer. */
  exportDeliveredTo: "zip" | "apple" | "google" | null;
  /** The failure is the plan's allowance, not the render. */
  exportBlockedByQuota: boolean;
  exportDone: number;
  exportTotal: number;
  exportError: string | null;
  exportBytes: number;

  /** Which set the canvas is editing. */
  setId: string;
  /** Whether the set on screen is safely stored. */
  saveState: SaveState;
  /** What went wrong the last time a save was attempted. */
  saveError: string | null;

  setState: (patch: Partial<OnstageState>) => void;
  patchFrame: (patch: Partial<Frame>) => void;
  addFrame: () => void;
  removeFrame: (index: number) => void;
  moveFrame: (from: number, to: number) => void;
  select: (index: number, sel?: Selection) => void;
  /** Drop screenshots in, starting at `from` — one per frame, in order. */
  setScreenshots: (from: number, urls: string[]) => void;
  applyBgToAll: () => void;
  rewriteAllCaptions: () => void;
  runExport: () => Promise<void>;
  /** After a refused upload, take the files that were already rendered. */
  downloadRenderedZip: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  nudgeScale: (delta: number) => void;
  resetTilt: () => void;
  toggleExportSize: (i: number) => void;
  toggleExportLang: (l: string) => void;
  /** Restyle the whole set from a template — the "the whole set restyles" promise. */
  applyTemplate: (slug: string) => void;
  /** Push the brand kit's frame + angle defaults onto every frame. */
  applyBrandDefaults: () => void;
};

type SaveState = "saved" | "saving" | "error";

/** The set the canvas opens when nothing else is asked for. */
export const DEFAULT_SET_ID = "trailhead-69";

/** The last successful render, kept out of state because blobs don't belong there. */
let lastRender: { files: { path: string; blob: Blob }[]; zipBlob: Blob } | null = null;

const initialFrames: Frame[] = CAPTIONS.map((c, i) => ({
  caption: c,
  bg: i === 0 ? "ember" : i === 1 ? "dusk" : i === 2 ? "moss" : i === 3 ? "ember" : "ink",
  tiltX: i === 0 ? 0 : i === 1 ? 6 : i === 2 ? 0 : i === 3 ? 6 : 0,
  tiltY: i === 0 ? 0 : i === 1 ? -16 : i === 2 ? 15 : i === 3 ? -22 : 0,
  depth: i === 0 ? 0 : i === 1 ? 42 : i === 2 ? 38 : i === 3 ? 66 : 0,
  scale: 1,
  screenshot: null,
}));

export const useOnstage = create<OnstageState>()(
    temporal(
      (set, get) => ({
    frames: initialFrames,
    active: 0,
    sel: "device",
    pop: null,
    overlay: null,
    zoom: 72,
    panorama: false,
    shadow: true,
    device: "ip16pm",
    frameColor: "graphite",
    captionFont: "Inter",
    align: "center",
    captionSize: 44,
    lang: "EN",
    store: "apple",
    workMode: "canvas",
    gStep: 0,
    aiTab: "Captions",
    aiTone: "Direct",
    exportPicks: [0, 1, 3, 4],
    exportLangs: ["EN", "DE"],
    exportDest: "zip",
    exportState: null,
    exportDeliveredTo: null,
    exportBlockedByQuota: false,
    exportDone: 0,
    exportTotal: 0,
    exportError: null,
    exportBytes: 0,
    setId: DEFAULT_SET_ID,
    saveState: "saved",
    saveError: null,

    setState: (patch) => set(patch),

    patchFrame: (patch) =>
      set((st) => {
        const frames = st.frames.slice();
        frames[st.active] = { ...frames[st.active], ...patch };
        return { frames };
      }),

    addFrame: () =>
      set((st) => ({
        frames: st.frames.concat([
          {
            caption: "New headline",
            bg: st.frames[0].bg,
            tiltX: 0,
            tiltY: 0,
            depth: 0,
            scale: 1,
            screenshot: null,
          },
        ]),
        active: st.frames.length,
        sel: "caption",
      })),

    removeFrame: (index) =>
      set((st) => {
        // A set always has at least one frame; emptying it has no meaning.
        if (st.frames.length <= 1) return {};
        const frames = st.frames.filter((_, i) => i !== index);
        return { frames, active: Math.min(st.active, frames.length - 1) };
      }),

    moveFrame: (from, to) =>
      set((st) => {
        if (from === to || to < 0 || to >= st.frames.length) return {};
        const frames = st.frames.slice();
        const [moved] = frames.splice(from, 1);
        frames.splice(to, 0, moved);
        // Keep the selection on the frame the user was holding.
        const active =
          st.active === from
            ? to
            : st.active > from && st.active <= to
              ? st.active - 1
              : st.active < from && st.active >= to
                ? st.active + 1
                : st.active;
        return { frames, active };
      }),

    select: (index, sel = "device") => set({ active: index, sel, pop: null }),

    setScreenshots: (from, urls) =>
      set((st) => {
        const frames = st.frames.slice();
        urls.forEach((url, n) => {
          const i = from + n;
          if (frames[i]) frames[i] = { ...frames[i], screenshot: url };
        });
        return { frames };
      }),

    applyBgToAll: () =>
      set((st) => ({ frames: st.frames.map((f) => ({ ...f, bg: st.frames[st.active].bg })) })),

    rewriteAllCaptions: () =>
      set((st) => ({
        frames: st.frames.map((f, i) => ({
          ...f,
          caption:
            [
              "Every run, on one map",
              "Pace you can trust",
              "Trails a minute away",
              "Send the route to anyone",
              "Made for long seasons",
            ][i] || f.caption,
        })),
        overlay: null,
      })),

    // Renders every selected size × locale to exact-dimension PNGs, then
  // delivers them where the user asked. The heavy renderers (Konva, Three.js,
  // JSZip) load on demand inside renderSet, so nothing ships in the main
  // bundle.
  runExport: async () => {
    const st = get();
    if (st.exportState === "rendering" || st.exportState === "uploading") return;

    // The free plan's allowance is enforced here, before anything renders.
    // Off by default: exports are unlimited and unmetered. `exportBlockedByQuota`
    // stays in the state shape (permanently false) because the export error
    // card is shared with store-upload failures and keys its Reconnect /
    // Download-instead buttons off it.
    if (FEATURES.exportQuota) {
      const session = await getBackend().getSession();
      if (
        session &&
        session.exportsAllowed !== null &&
        session.exportsUsed >= session.exportsAllowed
      ) {
        set({
          exportState: "error",
          exportError: `You've used all ${session.exportsAllowed} exports on the free plan. Upgrade to keep shipping.`,
          exportBlockedByQuota: true,
        });
        return;
      }
    }

    set({
      exportState: "rendering",
      exportDone: 0,
      exportTotal: 0,
      exportError: null,
      exportDeliveredTo: null,
      exportBlockedByQuota: false,
    });
    try {
      const { renderSet } = await import("@/lib/onstage/export/renderSet");
      const { files, bytes, zipBlob } = await renderSet({
        frames: st.frames,
        panorama: st.panorama,
        align: st.align,
        captionSize: st.captionSize,
        captionFont: st.captionFont,
        device: st.device,
        frameColor: st.frameColor,
        shadow: st.shadow,
        sizeIds: st.exportPicks,
        locales: st.exportLangs,
        screenshots: await Promise.all(
          st.frames.map((f) =>
            f.screenshot
              ? import("@/lib/onstage/export/images").then((m) => m.loadExportImage(f.screenshot!))
              : Promise.resolve(null),
          ),
        ),
        onProgress: (done, total) => set({ exportDone: done, exportTotal: total }),
      });

      lastRender = { files, zipBlob };
      set({ exportDone: files.length, exportTotal: files.length, exportBytes: bytes });
      // Metering happens once the files exist, never on a failed render — and
      // not at all while exports are free, so the stored counter stays clean
      // for the day billing comes back.
      if (FEATURES.exportQuota) void getBackend().recordExport(files.length);

      const dest = st.exportDest;
      if (dest === "zip") {
        const { downloadBlob } = await import("@/lib/onstage/export/download");
        downloadBlob(zipBlob, "trailhead-store-assets.zip");
        set({ exportState: "done", exportDeliveredTo: "zip" });
        return;
      }

      // A store destination: the files exist either way, so a refusal is
      // recoverable — the dialog offers the zip.
      set({ exportState: "uploading" });
      const destination = dest === "asc" ? "apple" : "google";
      const result = await getBackend().uploadToStore({
        appId: "trailhead",
        destination,
        files,
      });
      if (result.ok) set({ exportState: "done", exportDeliveredTo: destination });
      else set({ exportState: "error", exportError: result.message });
    } catch (e) {
      console.error("[onstage] export failed", e);
      set({
        exportState: "error",
        exportError: e instanceof Error ? e.message : "Export failed",
      });
    }
  },

  downloadRenderedZip: () => {
    if (!lastRender) return;
    void import("@/lib/onstage/export/download").then((m) => {
      m.downloadBlob(lastRender!.zipBlob, "trailhead-store-assets.zip");
      set({ exportState: "done", exportDeliveredTo: "zip", exportError: null });
    });
  },


    zoomIn: () => set({ zoom: Math.min(110, get().zoom + 8) }),
    zoomOut: () => set({ zoom: Math.max(44, get().zoom - 8) }),

    nudgeScale: (delta) =>
      set((st) => {
        const frames = st.frames.slice();
        const cur = frames[st.active];
        const next = +(cur.scale + delta).toFixed(2);
        frames[st.active] = { ...cur, scale: Math.max(0.7, Math.min(1.3, next)) };
        return { frames };
      }),

    resetTilt: () => get().patchFrame({ tiltX: 0, tiltY: 0, depth: 0 }),

    toggleExportSize: (i) =>
      set((st) => ({
        exportPicks:
          st.exportPicks.indexOf(i) >= 0
            ? st.exportPicks.filter((x) => x !== i)
            : st.exportPicks.concat([i]),
      })),

    toggleExportLang: (l) =>
      set((st) => ({
        exportLangs:
          st.exportLangs.indexOf(l) >= 0
            ? st.exportLangs.filter((x) => x !== l)
            : st.exportLangs.concat([l]),
      })),

    applyTemplate: (slug) =>
      set((st) => {
        const tpl = TEMPLATES.find((t) => t.slug === slug);
        if (!tpl) return {};
        return {
          frames: st.frames.map((f) => ({
            ...f,
            bg: tpl.bg,
            tiltY: tpl.ty,
            tiltX: 0,
            depth: tpl.ty === 0 ? 0 : 40,
          })),
          panorama: tpl.panoramic,
          sel: "bg" as Selection,
          pop: null,
        };
      }),

    applyBrandDefaults: () =>
      set((st) => ({
        // The kit's Defaults panel: Graphite frame, Right 17°, caption on top.
        frameColor: "graphite",
        align: "center" as const,
        frames: st.frames.map((f) => ({ ...f, tiltX: 0, tiltY: -17, depth: 40 })),
      })),
  }),
    {
      // Undo/redo covers the document only — selection, popovers and export
      // progress are not edits and must not land in the history.
      limit: 80,
      partialize: (st) => ({
        frames: st.frames,
        device: st.device,
        frameColor: st.frameColor,
        captionFont: st.captionFont,
        align: st.align,
        captionSize: st.captionSize,
        panorama: st.panorama,
        shadow: st.shadow,
      }),
      // Without this, every unrelated setState (the save-state pill, export
      // progress) records a duplicate entry, because partialize hands back a
      // fresh object each time and the default check is by reference.
      equality: (a, b) =>
        a.frames === b.frames &&
        a.device === b.device &&
        a.frameColor === b.frameColor &&
        a.captionFont === b.captionFont &&
        a.align === b.align &&
        a.captionSize === b.captionSize &&
        a.panorama === b.panorama &&
        a.shadow === b.shadow,
    },
  ),
);

/* ── persistence ───────────────────────────────────────────────────────────
   The top bar claims the set is SAVED, so it has to actually be saved. Writes
   go through the backend, which is localStorage today and Supabase later;
   everything transient (selection, overlays, export progress) stays out.    */

const readDoc = (st: OnstageState): SetDoc => ({
  frames: st.frames,
  device: st.device,
  frameColor: st.frameColor,
  captionFont: st.captionFont,
  align: st.align,
  captionSize: st.captionSize,
  panorama: st.panorama,
  shadow: st.shadow,
  lang: st.lang,
  store: st.store,
  workMode: st.workMode,
});

let timer: ReturnType<typeof setTimeout> | undefined;
let subscribed = false;

async function flush(setId: string, doc: SetDoc) {
  try {
    await getBackend().saveSetDoc(setId, doc);
    useOnstage.setState({ saveState: "saved", saveError: null });
  } catch (e) {
    useOnstage.setState({
      saveState: "error",
      saveError: e instanceof Error ? e.message : "Couldn't save this set.",
    });
  }
}

/**
 * Load a set into the canvas and start autosaving it. Safe to call on every
 * mount; only the first call installs the subscription.
 */
export async function openSet(setId: string = DEFAULT_SET_ID) {
  if (typeof window === "undefined") return;
  if (process.env.NODE_ENV === "development") {
    (window as Window & { __onstage?: typeof useOnstage }).__onstage = useOnstage;
  }

  if (useOnstage.getState().setId !== setId || !subscribed) {
    const doc = await getBackend().loadSetDoc(setId);
    useOnstage.setState({
      setId,
      saveState: "saved",
      saveError: null,
      ...(doc && Array.isArray(doc.frames) && doc.frames.length ? doc : {}),
    });
    useOnstage.temporal.getState().clear();
  }

  if (subscribed) return;
  subscribed = true;

  let prev = JSON.stringify(readDoc(useOnstage.getState()));
  useOnstage.subscribe((st) => {
    const doc = readDoc(st);
    const next = JSON.stringify(doc);
    if (next === prev) return;
    prev = next;
    if (st.saveState !== "saving") useOnstage.setState({ saveState: "saving" });
    clearTimeout(timer);
    const id = st.setId;
    timer = setTimeout(() => void flush(id, doc), 400);
  });
}
