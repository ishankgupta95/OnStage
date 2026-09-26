import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { doc, frame } from "@/lib/data/__tests__/helpers";

const DOCS_KEY = "onstage:set-docs:v1";

// The heavy renderer is replaced: these tests are about where the files go.
const render = vi.hoisted(() => ({
  renderSet: vi.fn(async () => ({
    files: [{ path: "en-US/APP_IPHONE_69/01.png", blob: new Blob(["png"]) }],
    bytes: 3,
    zipBlob: new Blob(["zip"]),
  })),
  downloadBlob: vi.fn(),
}));
vi.mock("@/lib/onstage/export/renderSet", () => ({ renderSet: render.renderSet }));
vi.mock("@/lib/onstage/export/download", () => ({ downloadBlob: render.downloadBlob }));

/** A fresh store and backend, as on a page load, built with `flags` on. */
async function boot(flags: Partial<typeof import("@/lib/features").FEATURES> = {}) {
  vi.resetModules();
  vi.doMock("@/lib/features", async (importOriginal) => {
    const real = await importOriginal<typeof import("@/lib/features")>();
    return { FEATURES: { ...real.FEATURES, ...flags } };
  });
  try {
    const store = await import("../onstage");
    const { localBackend } = await import("@/lib/data/local");
    return { ...store, localBackend };
  } finally {
    vi.doUnmock("@/lib/features");
  }
}

beforeEach(() => {
  localStorage.setItem(DOCS_KEY, JSON.stringify({ A: doc([frame({ caption: "A" })]) }));
  render.renderSet.mockClear();
  render.downloadBlob.mockClear();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("runExport without a store backend (S3.1, EDITOR-14)", () => {
  it("downloads the zip even if a store destination was picked, and never uploads", async () => {
    const { openSet, useOnstage, localBackend } = await boot();
    const upload = vi.spyOn(localBackend, "uploadToStore");
    await openSet("A");
    useOnstage.setState({ overlay: "export", exportDest: "asc" });
    await useOnstage.getState().runExport();
    expect(render.renderSet).toHaveBeenCalledTimes(1);
    expect(render.downloadBlob).toHaveBeenCalledTimes(1);
    expect(upload).not.toHaveBeenCalled();
    expect(useOnstage.getState()).toMatchObject({ exportState: "done", exportDeliveredTo: "zip", exportError: null });
  });

  it("with storeUpload on, a store destination still goes to the store", async () => {
    const { openSet, useOnstage, localBackend } = await boot({ storeUpload: true });
    const upload = vi.spyOn(localBackend, "uploadToStore");
    await openSet("A");
    useOnstage.setState({ overlay: "export", exportDest: "asc" });
    await useOnstage.getState().runExport();
    expect(upload).toHaveBeenCalledTimes(1);
    expect(upload.mock.calls[0][0].destination).toBe("apple");
    expect(render.downloadBlob).not.toHaveBeenCalled();
  });
});

describe("a new run never offers an earlier run's files", () => {
  it("a render that fails after a successful one leaves nothing to download", async () => {
    const { openSet, useOnstage } = await boot({ storeUpload: true });
    await openSet("A");
    useOnstage.setState({ overlay: "export" });
    await useOnstage.getState().runExport();
    expect(useOnstage.getState().exportBytes).toBeGreaterThan(0);
    render.downloadBlob.mockClear();

    render.renderSet.mockRejectedValueOnce(new Error("render broke"));
    await useOnstage.getState().runExport();
    expect(useOnstage.getState()).toMatchObject({ exportState: "error", exportError: "render broke", exportBytes: 0 });
    // "Download instead" would find no render to hand over.
    useOnstage.getState().downloadRenderedZip();
    await vi.dynamicImportSettled();
    expect(render.downloadBlob).not.toHaveBeenCalled();
  });
});

describe("editorMounted / editorUnmounted (StrictMode-safe leave)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("an unmount closes the dialogs a task later", async () => {
    const { openSet, useOnstage, editorUnmounted } = await boot();
    await openSet("A");
    useOnstage.setState({ overlay: "export", exportState: "done", exportDeliveredTo: "zip" });
    editorUnmounted();
    expect(useOnstage.getState().overlay).toBe("export");
    await vi.advanceTimersByTimeAsync(0);
    expect(useOnstage.getState()).toMatchObject({ overlay: null, exportState: null });
  });

  it("an unmount followed at once by a mount (StrictMode's remount) closes nothing", async () => {
    const { openSet, useOnstage, editorMounted, editorUnmounted } = await boot();
    await openSet("A");
    useOnstage.setState({ overlay: "export", exportState: "done", exportDeliveredTo: "zip" });
    editorUnmounted();
    editorMounted();
    await vi.advanceTimersByTimeAsync(0);
    expect(useOnstage.getState()).toMatchObject({ overlay: "export", exportState: "done" });
  });
});

describe("leaveEditor (GAP-16)", () => {
  it("closes a finished export's dialog, so returning to the same set shows the canvas", async () => {
    const { openSet, useOnstage, leaveEditor } = await boot();
    await openSet("A");
    useOnstage.setState({ overlay: "export" });
    await useOnstage.getState().runExport();
    expect(useOnstage.getState().exportState).toBe("done");

    leaveEditor();
    expect(useOnstage.getState()).toMatchObject({
      overlay: null,
      exportState: null,
      exportError: null,
      exportDone: 0,
      exportDeliveredTo: null,
      exportBlockedByQuota: false,
    });
    // Coming back to the set that is still loaded changes nothing else.
    await openSet("A");
    expect(useOnstage.getState().overlay).toBeNull();
    expect(useOnstage.getState().frames[0].caption).toBe("A");
  });

  it("closes a failed export's error card and any other dialog", async () => {
    const { openSet, useOnstage, leaveEditor } = await boot();
    await openSet("A");
    useOnstage.setState({ overlay: "export", exportState: "error", exportError: "Export failed" });
    leaveEditor();
    expect(useOnstage.getState()).toMatchObject({ overlay: null, exportState: null, exportError: null });
    useOnstage.setState({ overlay: "store" });
    leaveEditor();
    expect(useOnstage.getState().overlay).toBeNull();
  });

  it("keeps a run in progress and its dialog: the files are still on their way", async () => {
    const { openSet, useOnstage, leaveEditor } = await boot();
    await openSet("A");
    for (const exportState of ["rendering", "uploading"] as const) {
      useOnstage.setState({ overlay: "export", exportState, exportDone: 3, exportTotal: 10 });
      leaveEditor();
      expect(useOnstage.getState()).toMatchObject({ overlay: "export", exportState, exportDone: 3 });
    }
  });

  it("leaves the document and its history alone", async () => {
    const { openSet, useOnstage, leaveEditor } = await boot();
    await openSet("A");
    useOnstage.getState().patchFrame({ caption: "edited" });
    const past = useOnstage.temporal.getState().pastStates.length;
    useOnstage.setState({ overlay: "export", exportState: "done" });
    leaveEditor();
    expect(useOnstage.getState().frames[0].caption).toBe("edited");
    expect(useOnstage.temporal.getState().pastStates.length).toBe(past);
  });
});
