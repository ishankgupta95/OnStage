"use client";

import { create } from "zustand";
import { temporal } from "zundo";
import { applyBrandDefaultsToDoc, applyTemplateToDoc, defaultDoc, isTemplate } from "@/lib/onstage/docOps";
import { getBackend } from "@/lib/data/backend";
import { docImageIds } from "@/lib/data/imageRefs";
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
  /** The set whose saved document is on screen — null until openSet has
   *  loaded one. Until then the frames are placeholders: nothing is saved,
   *  and the editor and guided screens don't offer them for editing. */
  loadedSetId: string | null;
  /** Whether the set on screen is safely stored. */
  saveState: SaveState;
  /** What went wrong the last time a save was attempted. */
  saveError: string | null;

  setState: (patch: Partial<OnstageState>) => void;
  /** ⌘Z / ⌘⇧Z. Always use these, not the temporal store directly: they keep
   *  the selection on a frame that exists. */
  undo: () => void;
  redo: () => void;
  patchFrame: (patch: Partial<Frame>) => void;
  /** A keystroke in a headline field. Keystrokes into one caption fold into
   *  one undo step; anything else (a suggestion click) is its own step. */
  typeCaption: (caption: string) => void;
  addFrame: () => void;
  removeFrame: (index: number) => void;
  moveFrame: (from: number, to: number) => void;
  select: (index: number, sel?: Selection) => void;
  /** Drop screenshot refs in, starting at `from` — one per frame, in order;
   *  a null leaves that frame's screenshot as it was. */
  setScreenshots: (from: number, refs: (string | null)[]) => void;
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

/** The fields undo/redo covers. Selection, popovers and export progress are
 *  not edits and never land in the history. */
const HISTORY_KEYS = [
  "frames",
  "device",
  "frameColor",
  "captionFont",
  "align",
  "captionSize",
  "panorama",
  "shadow",
] as const satisfies readonly (keyof SetDoc)[];

/** Every field the saved document holds: the history fields plus the set's
 *  language, store target and work mode. */
const DOC_KEYS = [...HISTORY_KEYS, "lang", "store", "workMode"] as const satisfies readonly (keyof SetDoc)[];

type HistoryDoc = Pick<SetDoc, (typeof HISTORY_KEYS)[number]>;

/** How many edits ⌘Z can walk back. */
const HISTORY_LIMIT = 80;

const historyOf = (st: HistoryDoc): HistoryDoc => ({
  frames: st.frames,
  device: st.device,
  frameColor: st.frameColor,
  captionFont: st.captionFont,
  align: st.align,
  captionSize: st.captionSize,
  panorama: st.panorama,
  shadow: st.shadow,
});

/** Same frames, by content: an action that rebuilds the array without
 *  changing anything (the swatch that is already selected, Reset on a flat
 *  frame) is not an edit and must not record an entry or clear redo. */
function sameFrames(a: Frame[] | undefined, b: Frame[] | undefined): boolean {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  return a.every((f, i) => {
    const g = b[i];
    if (f === g) return true;
    if (!f || !g) return false;
    const keys = new Set([...Object.keys(f), ...Object.keys(g)]) as Set<keyof Frame>;
    for (const k of keys) if (f[k] !== g[k]) return false;
    return true;
  });
}

const sameHistory = (a: Partial<HistoryDoc>, b: Partial<HistoryDoc>) =>
  HISTORY_KEYS.every((k) => (k === "frames" ? sameFrames(a.frames, b.frames) : a[k] === b[k]));

/* ── one gesture, one history entry ────────────────────────────────────────
   A tilt drag fires a patch per pointermove; a headline gets one per
   keystroke. Recording each would make ⌘Z crawl back through tiny deltas
   and push real edits out of the 80-step history (EDITOR-2).              */

/** Typing pauses longer than this start a new undo step. */
const TYPING_BURST_MS = 1000;

/** The caption being typed, if the change from `a` to `b` is exactly one
 *  frame's caption and nothing else. */
function typingTarget(a: Partial<HistoryDoc>, b: Partial<HistoryDoc>): string | null {
  if (!a.frames || !b.frames || a.frames === b.frames || a.frames.length !== b.frames.length) return null;
  if (!HISTORY_KEYS.every((k) => k === "frames" || a[k] === b[k])) return null;
  let index = -1;
  for (let i = 0; i < a.frames.length; i++) {
    if (a.frames[i] === b.frames[i]) continue;
    if (index >= 0) return null;
    index = i;
  }
  const before = a.frames[index];
  const after = b.frames[index];
  if (!before || !after) return null;
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]) as Set<keyof Frame>;
  for (const k of keys) if (k !== "caption" && before[k] !== after[k]) return null;
  return `caption:${index}`;
}

/** The typing burst in progress: later keystrokes on the same caption fold
 *  into the entry its first keystroke recorded. */
let burst: { target: string; at: number } | null = null;
/** True only while a keystroke (typeCaption) is being applied. */
let typing = false;

/** A drag in progress: the document as it was at pointerdown. */
let gesture: { before: HistoryDoc } | null = null;

/** The frame that was selected, followed by identity through an undo/redo:
 *  `active` isn't part of the history, and after undoing a reorder or a
 *  removal the same index is a different frame (EDITOR-1, EDITOR-12). */
function reselect(selected: Frame | undefined, index: number) {
  return (st: OnstageState): Partial<OnstageState> => {
    const found = selected ? st.frames.indexOf(selected) : -1;
    const active = found >= 0 ? found : Math.max(0, Math.min(index, st.frames.length - 1));
    return active === st.active ? {} : { active };
  };
}

/** The last successful render, kept out of state because blobs don't belong there. */
let lastRender: { files: { path: string; blob: Blob }[]; zipBlob: Blob } | null = null;
/** The export in progress, cancelled if another set is opened under it. */
let exportRun: { cancelled: boolean } | null = null;

/** A new set's document (the default cut). Lives in docOps so screens that
 *  build a new set's document can use it without the store. */
export { defaultDoc };

export const useOnstage = create<OnstageState>()(
    temporal(
      (set, get) => ({
    ...defaultDoc(),
    active: 0,
    sel: "device",
    pop: null,
    overlay: null,
    zoom: 72,
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
    setId: "",
    loadedSetId: null,
    saveState: "saved",
    saveError: null,

    setState: (patch) => set(patch),

    // zundo's undo/redo restore the document but not `active`, which isn't
    // part of it — after undoing an added frame the selection would point
    // past the end, and the next edit would create a malformed frame there
    // (EDITOR-1). Keep the selection on the same frame, or clamp it onto one
    // that exists. A drag still in progress (⌘Z with the button held) is
    // committed first and continues as a fresh gesture, so its remaining
    // moves stay one entry.
    undo: () => {
      const { frames, active } = get();
      const dragging = gesture !== null;
      endHistoryGesture();
      burst = null;
      useOnstage.temporal.getState().undo();
      set(reselect(frames[active], active));
      if (dragging) beginHistoryGesture();
    },
    redo: () => {
      const { frames, active } = get();
      const dragging = gesture !== null;
      endHistoryGesture();
      burst = null;
      useOnstage.temporal.getState().redo();
      set(reselect(frames[active], active));
      if (dragging) beginHistoryGesture();
    },

    // Every edit to "the selected frame" is a no-op if there isn't one —
    // never a partial frame at frames[active].
    patchFrame: (patch) =>
      set((st) => {
        if (!st.frames[st.active]) return {};
        const frames = st.frames.slice();
        frames[st.active] = { ...frames[st.active], ...patch };
        return { frames };
      }),

    typeCaption: (caption) => {
      typing = true;
      try {
        get().patchFrame({ caption });
      } finally {
        typing = false;
      }
    },

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
        if (st.frames.length <= 1 || !st.frames[index]) return {};
        const frames = st.frames.filter((_, i) => i !== index);
        // Keep the selection on the frame it was on (EDITOR-12); if that was
        // the one removed, stay at the same place, or the new last frame.
        const active =
          index < st.active ? st.active - 1 : Math.max(0, Math.min(st.active, frames.length - 1));
        return { frames, active };
      }),

    moveFrame: (from, to) =>
      set((st) => {
        if (from === to || !st.frames[from] || to < 0 || to >= st.frames.length) return {};
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

    setScreenshots: (from, refs) =>
      set((st) => {
        const frames = st.frames.slice();
        refs.forEach((ref, n) => {
          const i = from + n;
          if (ref && frames[i]) frames[i] = { ...frames[i], screenshot: ref };
        });
        return { frames };
      }),

    applyBgToAll: () =>
      set((st) => {
        const bg = st.frames[st.active]?.bg;
        if (!bg) return {};
        return { frames: st.frames.map((f) => ({ ...f, bg })) };
      }),

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
    // Opening another set cancels this run: its files and progress belong
    // to the set it started on, not the one on screen.
    const run = { cancelled: false };
    exportRun = run;
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
        onProgress: (done, total) => {
          if (!run.cancelled) set({ exportDone: done, exportTotal: total });
        },
        signal: run,
      });
      if (run.cancelled) return;

      lastRender = { files, zipBlob };
      set({ exportDone: files.length, exportTotal: files.length, exportBytes: bytes });
      // Metering happens once the files exist, never on a failed render — and
      // not at all while exports are free, so the stored counter stays clean
      // for the day billing comes back.
      // A metering failure is not an export failure: the files exist.
      if (FEATURES.exportQuota) {
        void getBackend()
          .recordExport(files.length)
          .catch((e: unknown) => console.warn("[onstage] couldn't record the export", e));
      }

      const dest = st.exportDest;
      if (dest === "zip") {
        const { downloadBlob } = await import("@/lib/onstage/export/download");
        if (run.cancelled) return;
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
      if (run.cancelled) return;
      if (result.ok) set({ exportState: "done", exportDeliveredTo: destination });
      else set({ exportState: "error", exportError: result.message });
    } catch (e) {
      if (run.cancelled) return;
      console.error("[onstage] export failed", e);
      set({
        exportState: "error",
        exportError: e instanceof Error ? e.message : "Export failed",
      });
    } finally {
      if (exportRun === run) exportRun = null;
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
        if (!cur) return {};
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
        const next = applyTemplateToDoc(readDoc(st), slug);
        if (!next) return {};
        return { frames: next.frames, panorama: next.panorama, sel: "bg" as Selection, pop: null };
      }),

    applyBrandDefaults: () =>
      set((st) => {
        const next = applyBrandDefaultsToDoc(readDoc(st));
        return { frameColor: next.frameColor, align: next.align, frames: next.frames };
      }),
  }),
    {
      // Undo/redo covers the document only — selection, popovers and export
      // progress are not edits and must not land in the history.
      limit: HISTORY_LIMIT,
      partialize: (st: OnstageState): HistoryDoc => historyOf(st),
      // Without this, every unrelated setState (the save-state pill, export
      // progress) records a duplicate entry, because partialize hands back a
      // fresh object each time and the default check is by reference.
      equality: sameHistory,
      // Keystrokes into one caption (typeCaption), with no pause longer
      // than TYPING_BURST_MS, are one entry: the first records the text
      // before typing started, the rest extend the burst without recording.
      // Any other change records normally and ends the burst.
      handleSet: (record) => (pastState, replace, currentState) => {
        const target = typing ? typingTarget(pastState as Partial<HistoryDoc>, currentState) : null;
        const now = Date.now();
        if (target && burst?.target === target && now - burst.at < TYPING_BURST_MS) {
          burst.at = now;
          return;
        }
        burst = target ? { target, at: now } : null;
        record(pastState, replace);
      },
    },
  ),
);

/** Bumped when a drag is cancelled from outside (the set changed under it),
 *  so the drag's pointer handlers stop acting on the new document. */
let gestureGen = 0;

/**
 * Start a drag (tilt pad, depth or caption-size slider). History is paused
 * until `endHistoryGesture`, which records the whole drag as one entry. The
 * returned id goes to `historyGestureLive` in each move and to
 * `endHistoryGesture` on release.
 */
export function beginHistoryGesture(): number {
  if (!gesture) {
    gesture = { before: historyOf(useOnstage.getState()) };
    burst = null;
    useOnstage.temporal.getState().pause();
  }
  return gestureGen;
}

/** False once the drag was cancelled: its moves must change nothing. */
export function historyGestureLive(id: number): boolean {
  return id === gestureGen;
}

/** A set switch ends any drag in progress, recording nothing: its remaining
 *  moves belong to a document that is no longer on screen. */
function cancelHistoryGesture() {
  gestureGen++;
  if (!gesture) return;
  gesture = null;
  useOnstage.temporal.getState().resume();
}

/** Finish the drag started by `beginHistoryGesture`. Safe to call twice, and
 *  a no-op for a drag that was cancelled. */
export function endHistoryGesture(id?: number) {
  if (id !== undefined && id !== gestureGen) return;
  if (!gesture) return;
  const { before } = gesture;
  gesture = null;
  const history = useOnstage.temporal.getState();
  history.resume();
  if (sameHistory(before, historyOf(useOnstage.getState()))) return;
  useOnstage.temporal.setState({
    pastStates: [...history.pastStates, before].slice(-HISTORY_LIMIT),
    futureStates: [],
  });
}

/**
 * A different document was just installed: forget the old history, and end
 * any drag — its pre-drag snapshot is the old document, which undo would
 * otherwise write over the new set.
 */
function resetHistory() {
  cancelHistoryGesture();
  burst = null;
  useOnstage.temporal.getState().clear();
}

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

/** No document field changed — compared by reference, the same test zundo's
 *  `equality` uses, so a zoom change or an export progress tick costs nothing. */
const sameDoc = (a: OnstageState, b: OnstageState) => DOC_KEYS.every((k) => a[k] === b[k]);

/** How long an edit waits for the next one before it is written. */
const SAVE_DEBOUNCE_MS = 400;

type SaveJob = { setId: string; state: OnstageState; seq: number };

let timer: ReturnType<typeof setTimeout> | undefined;
let subscribed = false;
/** Set while openSet installs a loaded document, which is not an edit. */
let loading = false;
/** Bumped on every document edit; each unsaved edit carries its number. */
let editSeq = 0;
/**
 * Edits not yet stored, the newest per set — the store snapshot itself, so
 * nothing is copied or serialised until a flush writes it. A job leaves only
 * once written: a failed write keeps it for the next attempt, and one set's
 * edit never displaces another's. SAVED shows only when this is empty.
 */
const unsaved = new Map<string, SaveJob>();
/** Saves run one after another, so an older one can never land after (and
 *  overwrite) a newer one, whatever the backend's latency. */
let saving: Promise<void> = Promise.resolve();
/**
 * Sets whose saved copy couldn't be read (or is damaged), with the reason.
 * They open on the default so the session still works — edit, export — but
 * are never written, so the stored copy survives for a later fix.
 */
const readOnly = new Map<string, string>();
/** Sets deleted in this tab. Nothing of theirs is ever written again. */
const deleted = new Set<string>();

/** Show where saving stands: an error if a write just failed or the open set
 *  can't be saved; SAVED only when every edit, the newest included, is stored. */
function report(failure: string | null) {
  const open = useOnstage.getState().loadedSetId;
  const locked = open ? readOnly.get(open) : undefined;
  if (failure) useOnstage.setState({ saveState: "error", saveError: failure });
  else if (locked) useOnstage.setState({ saveState: "error", saveError: locked });
  else if (!unsaved.size) useOnstage.setState({ saveState: "saved", saveError: null });
  // Otherwise newer edits are queued, and their flush reports.
}

async function writeAll() {
  let failure: string | null = null;
  for (const job of [...unsaved.values()]) {
    // Deleted while the write was queued: writing it would bring it back.
    if (deleted.has(job.setId)) {
      unsaved.delete(job.setId);
      continue;
    }
    try {
      await getBackend().saveSetDoc(job.setId, readDoc(job.state));
      if (unsaved.get(job.setId)?.seq === job.seq) unsaved.delete(job.setId);
    } catch (e) {
      failure = e instanceof Error ? e.message : "Couldn't save this set.";
    }
  }
  report(failure);
}

/** Write every unsaved edit now, and resolve once stored (or refused) —
 *  e.g. before copying a set, so the copy has its newest edit. */
export function flushSaves(): Promise<void> {
  return flushNow();
}

/** Write every unsaved edit now instead of after the debounce. */
function flushNow(): Promise<void> {
  clearTimeout(timer);
  timer = undefined;
  saving = saving.then(writeAll);
  return saving;
}

/** Start autosaving: once per page, before the first document is loaded. */
function installAutosave() {
  if (subscribed) return;
  subscribed = true;

  useOnstage.subscribe((st, prev) => {
    // Only the loaded set's own edits are saved — never placeholder frames
    // on screen before (or instead of) a loaded document, and never over a
    // saved copy that couldn't be read.
    if (loading || st.loadedSetId === null || st.setId !== st.loadedSetId || sameDoc(st, prev)) return;
    if (readOnly.has(st.setId)) return;
    unsaved.set(st.setId, { setId: st.setId, state: st, seq: ++editSeq });
    if (st.saveState !== "saving") useOnstage.setState({ saveState: "saving" });
    clearTimeout(timer);
    timer = setTimeout(() => void flushNow(), SAVE_DEBOUNCE_MS);
  });

  // Closing or backgrounding the tab inside the debounce mustn't drop the
  // last edit (EDITOR-24). The local backend writes within this task's
  // microtasks, before the page goes away.
  window.addEventListener("pagehide", () => void flushNow());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void flushNow();
  });
}

/** Bumped by every openSet call; a load applies only if no later call has
 *  started since, so the last set asked for is the one shown. */
let openToken = 0;
/** The set the latest openSet call asked for. */
let opening: string | null = null;

const DAMAGED = "This set's saved copy is damaged, so Onstage opened a fresh one.";

/**
 * Load a set into the canvas (by id — plan D10: only the editor and guided
 * screens call this, and only for a set the library lists) and autosave it
 * from then on. Safe to call on every mount: asking for the set that is
 * already loaded changes nothing. The set becomes the one a bare `/editor`
 * reopens.
 */
export async function openSet(setId: string) {
  if (typeof window === "undefined") return;
  if (process.env.NODE_ENV === "development") {
    (window as Window & { __onstage?: typeof useOnstage }).__onstage = useOnstage;
  }
  installAutosave();

  const token = ++openToken;
  opening = setId;
  // Being deleted (or deleted) in this tab: never shown again, so no edit
  // can be made that would silently go nowhere.
  if (deleted.has(setId)) return;
  // Already on screen: nothing to load, but it is still the set opened last
  // (another tab may have opened a different one since).
  if (useOnstage.getState().loadedSetId === setId) {
    rememberOpened(setId);
    return;
  }

  // Store what is waiting first — the set being left, and any earlier edit
  // of this one — so the load below reads the newest stored copy.
  await flushNow();
  if (token !== openToken) return;
  // This set's newest edit, if it still couldn't be written. Nothing can
  // replace it during this call (edits are recorded only for the loaded set,
  // and this one isn't loaded), so it stays the newest copy even if the
  // flush below writes it after the load read an older one.
  const unwritten = unsaved.get(setId);

  let doc: SetDoc | null = null;
  let loadError: string | null = null;
  try {
    doc = await getBackend().loadSetDoc(setId);
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Couldn't load this set.";
  }
  if (token !== openToken) return; // a later openSet wins

  // Edits made to the previous set while this one loaded.
  await flushNow();
  if (token !== openToken) return;

  const valid = doc !== null && Array.isArray(doc.frames) && doc.frames.length > 0;
  const problem = loadError ?? (doc !== null && !valid ? DAMAGED : null);
  // An edit of this set that couldn't be written is newer than any stored
  // copy: reopen that, and keep trying to store it.
  const newer = unsaved.get(setId) ?? unwritten;
  if (problem && !newer) readOnly.set(setId, `${problem} Changes to this set won't be saved.`);
  else readOnly.delete(setId);
  const source = newer ? readDoc(newer.state) : valid ? doc : null;

  const before = useOnstage.getState();
  // Replacing another set's document (not the first load of the page): its
  // drag, export run and export dialog don't carry over.
  const switching = before.loadedSetId !== null;
  if (switching) {
    if (exportRun) exportRun.cancelled = true;
    exportRun = null;
    lastRender = null;
  }

  loading = true;
  try {
    useOnstage.setState({
      // No saved document: start from the default — never the previous
      // set's frames (DATA-4). A saved one lies over the default, so a field
      // an older document lacks gets the default too, not the previous
      // set's value. Work mode is the person's, not the set's (S3.2 moves it
      // out of the document), so it carries over unless the doc has one.
      ...defaultDoc(),
      workMode: before.workMode,
      ...source,
      setId,
      loadedSetId: setId,
      active: 0,
      pop: null,
      ...(switching
        ? {
            overlay: null,
            exportState: null,
            exportDone: 0,
            exportTotal: 0,
            exportError: null,
            exportBytes: 0,
            exportDeliveredTo: null,
          }
        : {}),
    });
  } finally {
    loading = false;
  }
  resetHistory();
  report(null);
  rememberOpened(setId);
}

/** Record `setId` as the set a bare /editor returns to. A convenience, not
 *  the user's work: failing to store it costs that shortcut, nothing else. */
function rememberOpened(setId: string) {
  getBackend()
    .rememberLastSet(setId)
    .catch((e: unknown) => console.warn("[onstage] couldn't remember the last set", e));
}

/**
 * Every screenshot this tab can still reach outside storage: the open set,
 * its undo and redo history, a drag's starting point, and edits waiting to
 * be saved. Deleting a set must keep these, or undo would bring back a ref
 * to a screenshot that no longer exists.
 */
function liveImageIds(): string[] {
  const ids = new Set<string>();
  const add = (frames: Frame[] | undefined) => {
    for (const id of docImageIds({ frames: frames ?? [] })) ids.add(id);
  };
  const st = useOnstage.getState();
  if (st.loadedSetId !== null) add(st.frames);
  const { pastStates, futureStates } = useOnstage.temporal.getState();
  for (const h of [...pastStates, ...futureStates]) add(h.frames);
  if (gesture) add(gesture.before.frames);
  for (const job of unsaved.values()) add(job.state.frames);
  return [...ids];
}

/**
 * Delete a set from this browser (plan S2.2): close it here if it is open,
 * drop its queued edits so no save brings it back, then delete its record,
 * document and the screenshots nothing else uses. If storage refuses, the
 * set stays as it was and its newest queued edit is queued again.
 */
export async function removeSet(setId: string): Promise<void> {
  deleted.add(setId);
  const queued = unsaved.get(setId);
  unsaved.delete(setId);
  // An open of this set still loading must not land.
  if (opening === setId) openToken++;

  if (useOnstage.getState().loadedSetId === setId) {
    if (exportRun) exportRun.cancelled = true;
    exportRun = null;
    lastRender = null;
    loading = true;
    try {
      useOnstage.setState({
        setId: "",
        loadedSetId: null,
        active: 0,
        pop: null,
        overlay: null,
        exportState: null,
        exportDone: 0,
        exportTotal: 0,
        exportError: null,
        exportBytes: 0,
        exportDeliveredTo: null,
      });
    } finally {
      loading = false;
    }
    resetHistory();
  }
  readOnly.delete(setId);
  if (!unsaved.size) {
    clearTimeout(timer);
    timer = undefined;
  }
  // Its dropped edit no longer holds the pill at SAVING….
  report(null);

  // A write already under way lands before the delete, never after it.
  await saving;
  try {
    await getBackend().deleteSet(setId, { keepImages: liveImageIds() });
  } catch (e) {
    const still = await getBackend()
      .listSets()
      .then((sets) => sets.some((x) => x.id === setId))
      .catch(() => true);
    if (still) {
      deleted.delete(setId);
      if (queued && !unsaved.has(setId)) {
        unsaved.set(setId, queued);
        void flushNow();
      }
    }
    throw e;
  }
}

/** Whether this tab has deleted `setId` (or is deleting it). The editor
 *  treats such a set as not in this browser, whatever the library lists. */
export function isSetDeleted(setId: string): boolean {
  return deleted.has(setId);
}

/** The open set's document as it is now — newer than storage while an edit
 *  waits for the autosave. Null until a set has loaded. */
export function currentDoc(): SetDoc | null {
  const st = useOnstage.getState();
  return st.loadedSetId === null ? null : readDoc(st);
}

/**
 * Carry out an `?apply=` intent from another screen on the set that is open:
 * `template:<slug>` or `brand:<kitId>` (one undo step each), or
 * `panel:export` / `panel:localize` (opens the export dialog / the localise
 * drawer — not edits, so no undo step).
 * Screens outside the editor never change a document themselves (D10); they
 * send the editor here instead.
 */
export function applyIntent(intent: string): boolean {
  const colon = intent.indexOf(":");
  const kind = colon < 0 ? intent : intent.slice(0, colon);
  const id = colon < 0 ? "" : intent.slice(colon + 1);
  const st = useOnstage.getState();
  if (kind === "template" && isTemplate(id)) {
    st.applyTemplate(id);
    return true;
  }
  if (kind === "brand") {
    // Every kit applies the same defaults until brand kits are real (S10.4).
    st.applyBrandDefaults();
    return true;
  }
  if (kind === "panel" && id === "export") {
    st.setState({ overlay: "export" });
    return true;
  }
  if (kind === "panel" && id === "localize") {
    st.setState({ overlay: "ai", aiTab: "Localize" });
    return true;
  }
  return false;
}
