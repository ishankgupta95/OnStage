import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SetDoc } from "@/lib/data/types";
import { doc, frame } from "@/lib/data/__tests__/helpers";
import { seedLibrary } from "@/lib/data/__tests__/library";

/* Plan S3.4 at the store: the name an export carries (zip, its folder, the
   feature graphic), where it comes from, how it is edited, loaded and saved,
   and the export's refusal to swap an unreadable screenshot for the sample. */

type RenderSet = typeof import("@/lib/onstage/export/renderSet").renderSet;
type RenderRequest = Parameters<RenderSet>[0];
type RenderResult = Awaited<ReturnType<RenderSet>>;
type LoadExportImage = typeof import("@/lib/onstage/export/images").loadExportImage;
type DownloadBlob = typeof import("@/lib/onstage/export/download").downloadBlob;

const DOCS_KEY = "onstage:set-docs:v1";

// The heavy renderer, the download and the image decoder are replaced: these
// tests are about which name, folder and screenshots reach them.
const render = vi.hoisted(() => ({
  renderSet: vi.fn<RenderSet>(),
  downloadBlob: vi.fn<DownloadBlob>(),
  loadExportImage: vi.fn<LoadExportImage>(),
}));
vi.mock("@/lib/onstage/export/renderSet", () => ({ renderSet: render.renderSet }));
vi.mock("@/lib/onstage/export/download", () => ({ downloadBlob: render.downloadBlob }));
vi.mock("@/lib/onstage/export/images", () => ({ loadExportImage: render.loadExportImage }));

const ZIP = new Blob(["zip"]);

/** What the real renderer returns: files under the folder it was given. */
const rendered = (req: RenderRequest): RenderResult => ({
  files: [{ path: `${req.root}/en-US/APP_IPHONE_69/01.png`, blob: new Blob(["png"]) }],
  bytes: 3,
  zipBlob: ZIP,
});

/** A decoded screenshot, told apart by its alt text. */
const image = (name: string): HTMLImageElement => Object.assign(new Image(), { alt: name });

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

type Booted = typeof import("../onstage") & {
  localBackend: typeof import("@/lib/data/local").localBackend;
};
/** The store the current test booted, so its queued saves can be flushed. */
let booted: Booted | null = null;

/** A fresh store and backend, as on a page load, built with `flags` on. */
async function boot(flags: Partial<typeof import("@/lib/features").FEATURES> = {}): Promise<Booted> {
  vi.resetModules();
  vi.doMock("@/lib/features", async (importOriginal) => {
    const real = await importOriginal<typeof import("@/lib/features")>();
    return { FEATURES: { ...real.FEATURES, ...flags } };
  });
  try {
    const store = await import("../onstage");
    const { localBackend } = await import("@/lib/data/local");
    const b: Booted = { ...store, localBackend };
    booted = b;
    return b;
  } finally {
    vi.doUnmock("@/lib/features");
  }
}

/** A new app called `name` (or none: an app id with no record) holding one
 *  set with document `d`. */
async function setInApp(b: Booted, name: string | null, d: SetDoc = doc([frame()])) {
  const app = name === null ? null : await b.localBackend.createApp({ name });
  const set = await b.localBackend.createSet({ appId: app?.id ?? "app_deleted", name: "Launch set", doc: d });
  return { app, set };
}

/** Open `setId` and export it from the dialog. */
async function exportSet(
  b: Booted,
  setId: string,
  patch: Partial<ReturnType<Booted["useOnstage"]["getState"]>> = {},
) {
  await b.openSet(setId);
  b.useOnstage.setState({ overlay: "export", ...patch });
  await b.useOnstage.getState().runExport();
}

const lastRequest = (): RenderRequest => {
  const call = render.renderSet.mock.calls.at(-1);
  if (!call) throw new Error("renderSet was never called");
  return call[0];
};

const stored = (): Record<string, SetDoc> => JSON.parse(localStorage.getItem(DOCS_KEY) ?? "{}");
const seedDocs = (docs: Record<string, unknown>) => localStorage.setItem(DOCS_KEY, JSON.stringify(docs));

beforeEach(() => {
  render.renderSet.mockReset().mockImplementation(async (req) => rendered(req));
  render.downloadBlob.mockReset();
  render.loadExportImage.mockReset().mockImplementation(async (ref) => image(ref));
});
afterEach(async () => {
  // Nothing queued by this test's store may land in the next test's storage.
  await booted?.flushSaves();
  booted = null;
  vi.restoreAllMocks();
});

describe("the zip is named after the set's app, not the sample (EXPORT-20)", () => {
  it("the sample set exports as Trailhead's", async () => {
    const b = await boot();
    await exportSet(b, "trailhead-69");
    expect(lastRequest()).toMatchObject({ appName: "Trailhead", root: "trailhead-store-assets" });
    expect(render.downloadBlob).toHaveBeenCalledTimes(1);
    expect(render.downloadBlob).toHaveBeenCalledWith(ZIP, "trailhead-store-assets.zip");
    expect(b.useOnstage.getState()).toMatchObject({ exportState: "done", exportDeliveredTo: "zip", exportError: null });
  });

  it("a set in a new app called Ferry exports as ferry-store-assets.zip", async () => {
    const b = await boot();
    const { set } = await setInApp(b, "Ferry");
    await exportSet(b, set.id);
    expect(lastRequest()).toMatchObject({ appName: "Ferry", root: "ferry-store-assets" });
    expect(render.downloadBlob).toHaveBeenCalledWith(ZIP, "ferry-store-assets.zip");
    // The files themselves sit under the app's folder too.
    expect(lastRequest().root).not.toContain("trailhead");
  });

  it("a returning user's Lumen set exports as Lumen's, beside the other sample apps", async () => {
    seedLibrary();
    const b = await boot();
    await exportSet(b, "lumen-draft");
    expect(lastRequest()).toMatchObject({ appName: "Lumen", root: "lumen-store-assets" });
    expect(render.downloadBlob).toHaveBeenCalledWith(ZIP, "lumen-store-assets.zip");
  });

  it("a name the set's document gives wins over the app's", async () => {
    const b = await boot();
    const { set } = await setInApp(b, "Ferry", doc([frame()], { appName: "Lumen Pro" }));
    await exportSet(b, set.id);
    expect(lastRequest()).toMatchObject({ appName: "Lumen Pro", root: "lumen-pro-store-assets" });
    expect(render.downloadBlob).toHaveBeenCalledWith(ZIP, "lumen-pro-store-assets.zip");
  });

  it("a saved name with stray spaces reaches the renderer trimmed", async () => {
    const b = await boot();
    const { set } = await setInApp(b, "Ferry", doc([frame()], { appName: "  Lumen Pro  " }));
    await exportSet(b, set.id);
    expect(lastRequest().appName).toBe("Lumen Pro");
    expect(render.downloadBlob).toHaveBeenCalledWith(ZIP, "lumen-pro-store-assets.zip");
  });

  it("a name typed in the dialog is used at once, before it is saved, and clearing it goes back to the app's", async () => {
    const b = await boot();
    const { set } = await setInApp(b, "Ferry");
    await b.openSet(set.id);
    b.useOnstage.getState().setAppName("Ferry Pro");
    b.useOnstage.setState({ overlay: "export" });
    await b.useOnstage.getState().runExport();
    expect(lastRequest()).toMatchObject({ appName: "Ferry Pro", root: "ferry-pro-store-assets" });
    expect(render.downloadBlob).toHaveBeenLastCalledWith(ZIP, "ferry-pro-store-assets.zip");

    b.useOnstage.getState().setAppName("");
    await b.useOnstage.getState().runExport();
    expect(lastRequest()).toMatchObject({ appName: "Ferry", root: "ferry-store-assets" });
    expect(render.downloadBlob).toHaveBeenLastCalledWith(ZIP, "ferry-store-assets.zip");
  });

  it("a set whose app record is gone exports under the neutral name, with no name for the graphic", async () => {
    const b = await boot();
    const { set } = await setInApp(b, null);
    await exportSet(b, set.id);
    expect(lastRequest()).toMatchObject({ appName: null, root: "onstage-export-store-assets" });
    expect(render.downloadBlob).toHaveBeenCalledWith(ZIP, "onstage-export-store-assets.zip");
    expect(b.useOnstage.getState().exportState).toBe("done");
  });

  it("a document with no set record at all exports under the neutral name", async () => {
    seedDocs({ orphan: doc([frame()]) });
    const b = await boot();
    await exportSet(b, "orphan");
    expect(lastRequest()).toMatchObject({ appName: null, root: "onstage-export-store-assets" });
    expect(render.downloadBlob).toHaveBeenCalledWith(ZIP, "onstage-export-store-assets.zip");
  });

  it("an app whose name is only spaces counts as unnamed", async () => {
    const b = await boot();
    const { set } = await setInApp(b, "   ");
    await exportSet(b, set.id);
    expect(lastRequest().appName).toBeNull();
    expect(render.downloadBlob).toHaveBeenCalledWith(ZIP, "onstage-export-store-assets.zip");
  });

  it("a library that can't be read doesn't fail the export: it goes out under the neutral name", async () => {
    const b = await boot();
    const { set } = await setInApp(b, "Ferry");
    await b.openSet(set.id);
    vi.spyOn(b.localBackend, "listApps").mockRejectedValue(new Error("storage refused"));
    b.useOnstage.setState({ overlay: "export" });
    await b.useOnstage.getState().runExport();
    expect(lastRequest().appName).toBeNull();
    expect(render.downloadBlob).toHaveBeenCalledWith(ZIP, "onstage-export-store-assets.zip");
    expect(b.useOnstage.getState()).toMatchObject({ exportState: "done", exportError: null });
  });
});

describe("Download instead hands over the zip under the name it was rendered with", () => {
  it("after a refused store upload, the rendered zip downloads as the app's", async () => {
    const b = await boot({ storeUpload: true });
    const { set } = await setInApp(b, "Ferry");
    vi.spyOn(b.localBackend, "uploadToStore").mockResolvedValue({
      ok: false,
      reason: "not-connected",
      message: "Connect App Store Connect in Settings before uploading.",
    });
    await exportSet(b, set.id, { exportDest: "asc" });
    expect(b.useOnstage.getState().exportState).toBe("error");
    expect(render.downloadBlob).not.toHaveBeenCalled();

    b.useOnstage.getState().downloadRenderedZip();
    await vi.waitFor(() => expect(render.downloadBlob).toHaveBeenCalledTimes(1));
    expect(render.downloadBlob).toHaveBeenCalledWith(ZIP, "ferry-store-assets.zip");
    expect(b.useOnstage.getState()).toMatchObject({ exportState: "done", exportDeliveredTo: "zip", exportError: null });
  });

  it("after a zip run, downloading again uses the same file name", async () => {
    const b = await boot();
    const { set } = await setInApp(b, "Ferry", doc([frame()], { appName: "Lumen Pro" }));
    await exportSet(b, set.id);
    b.useOnstage.getState().downloadRenderedZip();
    await vi.waitFor(() => expect(render.downloadBlob).toHaveBeenCalledTimes(2));
    expect(render.downloadBlob.mock.calls.map((c) => c[1])).toEqual([
      "lumen-pro-store-assets.zip",
      "lumen-pro-store-assets.zip",
    ]);
  });

  it("renaming after the render doesn't rename a zip whose folder carries the old name", async () => {
    const b = await boot({ storeUpload: true });
    const { set } = await setInApp(b, "Ferry");
    vi.spyOn(b.localBackend, "uploadToStore").mockResolvedValue({
      ok: false,
      reason: "not-connected",
      message: "Connect App Store Connect in Settings before uploading.",
    });
    await exportSet(b, set.id, { exportDest: "asc" });
    b.useOnstage.getState().setAppName("Renamed Later");

    b.useOnstage.getState().downloadRenderedZip();
    await vi.waitFor(() => expect(render.downloadBlob).toHaveBeenCalledTimes(1));
    expect(render.downloadBlob).toHaveBeenCalledWith(ZIP, "ferry-store-assets.zip");
  });
});

describe("a store upload goes to the set's own app (with storeUpload)", () => {
  it("a Ferry set is uploaded for Ferry's app record, never Trailhead's", async () => {
    const b = await boot({ storeUpload: true });
    const { app, set } = await setInApp(b, "Ferry");
    const upload = vi.spyOn(b.localBackend, "uploadToStore").mockResolvedValue({ ok: true, jobId: "job_1" });
    await exportSet(b, set.id, { exportDest: "asc" });

    expect(upload).toHaveBeenCalledTimes(1);
    const input = upload.mock.calls[0][0];
    expect(input.appId).toBe(app!.id);
    expect(input.appId).not.toBe("trailhead");
    expect(input.destination).toBe("apple");
    expect(input.files.every((f) => f.path.startsWith("ferry-store-assets/"))).toBe(true);
    expect(render.downloadBlob).not.toHaveBeenCalled();
    expect(b.useOnstage.getState()).toMatchObject({ exportState: "done", exportDeliveredTo: "apple" });
  });

  it("a name the set gives changes the folder, not the app the upload is for", async () => {
    const b = await boot({ storeUpload: true });
    const { app, set } = await setInApp(b, "Ferry", doc([frame()], { appName: "Lumen Pro" }));
    const upload = vi.spyOn(b.localBackend, "uploadToStore").mockResolvedValue({ ok: true, jobId: "job_1" });
    await exportSet(b, set.id, { exportDest: "asc" });
    expect(upload.mock.calls[0][0].appId).toBe(app!.id);
    expect(upload.mock.calls[0][0].files[0].path.startsWith("lumen-pro-store-assets/")).toBe(true);
  });

  it("the sample set is uploaded for Trailhead", async () => {
    const b = await boot({ storeUpload: true });
    const upload = vi.spyOn(b.localBackend, "uploadToStore").mockResolvedValue({ ok: true, jobId: "job_1" });
    await exportSet(b, "trailhead-69", { exportDest: "asc" });
    expect(upload.mock.calls[0][0].appId).toBe("trailhead");
  });
});

describe("an unreadable screenshot stops the export and says which (EXPORT-5)", () => {
  /** A set whose frames carry these screenshot refs (null: none dropped in). */
  async function setWithShots(b: Booted, refs: (string | null)[]) {
    const { set } = await setInApp(b, "Ferry", doc(refs.map((screenshot) => frame({ screenshot }))));
    return set.id;
  }

  const brokenOnes = (broken: string[]) =>
    render.loadExportImage.mockImplementation(async (ref) => (broken.includes(ref) ? null : image(ref)));

  it("one broken screenshot names its frame, and nothing is rendered or downloaded", async () => {
    const b = await boot();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const id = await setWithShots(b, ["img:ok", "img:broken", null]);
    brokenOnes(["img:broken"]);
    await exportSet(b, id);

    expect(b.useOnstage.getState()).toMatchObject({
      exportState: "error",
      exportError: "Frame 2's screenshot couldn't be read — drop it in again.",
      exportBytes: 0,
    });
    expect(render.renderSet).not.toHaveBeenCalled();
    expect(render.downloadBlob).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalled();
    // Nothing was rendered, so there is nothing to hand over either.
    b.useOnstage.getState().downloadRenderedZip();
    await vi.dynamicImportSettled();
    expect(render.downloadBlob).not.toHaveBeenCalled();
  });

  it("two broken screenshots are named together in one message", async () => {
    const b = await boot();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const id = await setWithShots(b, ["img:a", "img:b", "img:c"]);
    brokenOnes(["img:a", "img:c"]);
    await exportSet(b, id);
    expect(b.useOnstage.getState().exportError).toBe(
      "The screenshots of frames 1 and 3 couldn't be read — drop them in again.",
    );
    expect(render.renderSet).not.toHaveBeenCalled();
    expect(render.downloadBlob).not.toHaveBeenCalled();
  });

  it("three broken screenshots are listed in frame order", async () => {
    const b = await boot();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const id = await setWithShots(b, ["img:a", null, "img:c", "img:d", "img:e"]);
    brokenOnes(["img:a", "img:c", "img:e"]);
    await exportSet(b, id);
    expect(b.useOnstage.getState()).toMatchObject({
      exportState: "error",
      exportError: "The screenshots of frames 1, 3 and 5 couldn't be read — drop them in again.",
    });
    expect(render.renderSet).not.toHaveBeenCalled();
  });

  it("frames without a screenshot go to the renderer as null, unread; loaded ones by index", async () => {
    const b = await boot();
    const a = image("a");
    const c = image("c");
    render.loadExportImage.mockImplementation(async (ref) => (ref === "img:a" ? a : ref === "img:c" ? c : null));
    const id = await setWithShots(b, [null, "img:a", null, "img:c"]);
    await exportSet(b, id);

    expect(render.loadExportImage.mock.calls.map((call) => call[0])).toEqual(["img:a", "img:c"]);
    const shots = lastRequest().screenshots!;
    expect(shots).toHaveLength(4);
    expect(shots[0]).toBeNull();
    expect(shots[1]).toBe(a);
    expect(shots[2]).toBeNull();
    expect(shots[3]).toBe(c);
    expect(b.useOnstage.getState().exportState).toBe("done");
  });

  it("a set with no screenshots reads none and renders the sample screen in every frame", async () => {
    const b = await boot();
    await exportSet(b, "trailhead-69");
    expect(render.loadExportImage).not.toHaveBeenCalled();
    const shots = lastRequest().screenshots!;
    expect(shots.length).toBe(b.useOnstage.getState().frames.length);
    expect(shots.every((s) => s === null)).toBe(true);
  });
});

describe("opening another set cancels an export in progress", () => {
  /** Sets A (Ferry, with a screenshot) and B (Lumen), with A open. */
  async function twoSets() {
    const b = await boot();
    const { set: a } = await setInApp(b, "Ferry", doc([frame({ screenshot: "img:a" })]));
    const { set: bSet } = await setInApp(b, "Lumen");
    await b.openSet(a.id);
    b.useOnstage.setState({ overlay: "export" });
    return { b, a: a.id, other: bSet.id };
  }

  it("a screenshot that turns out unreadable after the switch leaves no error behind", async () => {
    const { b, other } = await twoSets();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const load = deferred<HTMLImageElement | null>();
    render.loadExportImage.mockImplementationOnce(() => load.promise);

    const running = b.useOnstage.getState().runExport();
    await vi.waitFor(() => expect(render.loadExportImage).toHaveBeenCalledTimes(1));
    await b.openSet(other);
    load.resolve(null);
    await running;

    expect(b.useOnstage.getState()).toMatchObject({
      loadedSetId: other,
      overlay: null,
      exportState: null,
      exportError: null,
      exportBytes: 0,
    });
    expect(render.renderSet).not.toHaveBeenCalled();
    expect(render.downloadBlob).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it("a render that finishes after the switch downloads nothing and leaves nothing to download", async () => {
    const { b, other } = await twoSets();
    const gate = deferred<RenderResult>();
    let request: RenderRequest | null = null;
    render.renderSet.mockImplementationOnce((req) => {
      request = req;
      return gate.promise;
    });

    const running = b.useOnstage.getState().runExport();
    await vi.waitFor(() => expect(render.renderSet).toHaveBeenCalledTimes(1));
    await b.openSet(other);
    // Late progress from the old run doesn't move the new set's numbers.
    request!.onProgress?.(3, 10);
    gate.resolve(rendered(request!));
    await running;

    expect(b.useOnstage.getState()).toMatchObject({
      loadedSetId: other,
      exportState: null,
      exportError: null,
      exportDone: 0,
      exportTotal: 0,
      exportBytes: 0,
    });
    expect(render.downloadBlob).not.toHaveBeenCalled();
    b.useOnstage.getState().downloadRenderedZip();
    await vi.dynamicImportSettled();
    expect(render.downloadBlob).not.toHaveBeenCalled();
  });

  it("a render that fails after the switch leaves no error behind", async () => {
    const { b, other } = await twoSets();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const gate = deferred<RenderResult>();
    render.renderSet.mockImplementationOnce(() => gate.promise);

    const running = b.useOnstage.getState().runExport();
    await vi.waitFor(() => expect(render.renderSet).toHaveBeenCalledTimes(1));
    await b.openSet(other);
    gate.reject(new Error("render broke"));
    await running;

    expect(b.useOnstage.getState()).toMatchObject({ exportState: null, exportError: null });
    expect(error).not.toHaveBeenCalled();
  });

  it("the next export, on the set now open, carries that set's app name", async () => {
    const { b, other } = await twoSets();
    const load = deferred<HTMLImageElement | null>();
    render.loadExportImage.mockImplementationOnce(() => load.promise);
    const running = b.useOnstage.getState().runExport();
    await vi.waitFor(() => expect(render.loadExportImage).toHaveBeenCalledTimes(1));
    await b.openSet(other);
    load.resolve(image("a"));
    await running;
    expect(render.renderSet).not.toHaveBeenCalled();

    b.useOnstage.setState({ overlay: "export" });
    await b.useOnstage.getState().runExport();
    expect(lastRequest()).toMatchObject({ appName: "Lumen", root: "lumen-store-assets" });
    expect(render.downloadBlob).toHaveBeenCalledTimes(1);
    expect(render.downloadBlob).toHaveBeenCalledWith(ZIP, "lumen-store-assets.zip");
  });
});

describe("setAppName", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  });
  afterEach(async () => {
    await vi.runOnlyPendingTimersAsync();
    vi.useRealTimers();
  });

  const pastCount = (b: Booted) => b.useOnstage.temporal.getState().pastStates.length;

  it("trims the name, and a blank one goes back to the app's own name", async () => {
    seedDocs({ A: doc([frame()]) });
    const b = await boot();
    await b.openSet("A");
    b.useOnstage.getState().setAppName("  Ferry Pro  ");
    expect(b.useOnstage.getState().appName).toBe("Ferry Pro");
    b.useOnstage.getState().setAppName("   ");
    expect(b.useOnstage.getState().appName).toBeUndefined();
  });

  it("the name already there (after trimming) records nothing and saves nothing", async () => {
    seedDocs({ A: doc([frame()], { appName: "Ferry Pro" }) });
    const b = await boot();
    await b.openSet("A");
    const save = vi.spyOn(b.localBackend, "saveSetDoc");
    const before = b.useOnstage.getState();

    b.useOnstage.getState().setAppName("Ferry Pro");
    b.useOnstage.getState().setAppName("  Ferry Pro ");
    expect(b.useOnstage.getState().appName).toBe("Ferry Pro");
    expect(b.useOnstage.getState().frames).toBe(before.frames);
    expect(pastCount(b)).toBe(0);
    expect(b.useOnstage.getState().saveState).toBe("saved");
    await vi.advanceTimersByTimeAsync(1000);
    expect(save).not.toHaveBeenCalled();
  });

  it("blank on a set that names nothing records nothing and saves nothing", async () => {
    seedDocs({ A: doc([frame()]) });
    const b = await boot();
    await b.openSet("A");
    const save = vi.spyOn(b.localBackend, "saveSetDoc");
    b.useOnstage.getState().setAppName("");
    b.useOnstage.getState().setAppName("   ");
    expect(b.useOnstage.getState().appName).toBeUndefined();
    expect(pastCount(b)).toBe(0);
    await vi.advanceTimersByTimeAsync(1000);
    expect(save).not.toHaveBeenCalled();
  });

  it("each call is one undo step, and undo / redo walk the names back and forth", async () => {
    seedDocs({ A: doc([frame({ caption: "Keep me" })]) });
    const b = await boot();
    await b.openSet("A");
    const st = () => b.useOnstage.getState();

    st().setAppName("Ferry");
    st().setAppName("Ferry Pro");
    expect(pastCount(b)).toBe(2);

    st().undo();
    expect(st().appName).toBe("Ferry");
    st().undo();
    expect(st().appName).toBeUndefined();
    st().redo();
    expect(st().appName).toBe("Ferry");
    // The name's steps touch nothing else in the document.
    expect(st().frames.map((f) => f.caption)).toEqual(["Keep me"]);
  });

  it("undoing a cleared name brings the name back", async () => {
    seedDocs({ A: doc([frame()], { appName: "Lumen Pro" }) });
    const b = await boot();
    await b.openSet("A");
    b.useOnstage.getState().setAppName("");
    expect(b.useOnstage.getState().appName).toBeUndefined();
    expect(pastCount(b)).toBe(1);
    b.useOnstage.getState().undo();
    expect(b.useOnstage.getState().appName).toBe("Lumen Pro");
  });
});

describe("openSet and the app name", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  });
  afterEach(async () => {
    await vi.runOnlyPendingTimersAsync();
    vi.useRealTimers();
  });

  it("a set that names no app doesn't keep the previous set's name", async () => {
    seedDocs({ A: doc([frame()], { appName: "Lumen Pro" }), B: doc([frame()]) });
    const b = await boot();
    await b.openSet("A");
    expect(b.useOnstage.getState().appName).toBe("Lumen Pro");
    await b.openSet("B");
    expect(b.useOnstage.getState().appName).toBeUndefined();
    await b.openSet("A");
    expect(b.useOnstage.getState().appName).toBe("Lumen Pro");
  });

  it("a name typed on one set neither follows to the next nor comes back with undo there", async () => {
    seedDocs({ A: doc([frame()]), B: doc([frame()]) });
    const b = await boot();
    await b.openSet("A");
    b.useOnstage.getState().setAppName("Typed on A");
    await b.openSet("B");
    expect(b.useOnstage.getState().appName).toBeUndefined();
    b.useOnstage.getState().undo();
    expect(b.useOnstage.getState().appName).toBeUndefined();
    // …and A kept it.
    expect(stored().A.appName).toBe("Typed on A");
    expect(stored().B).not.toHaveProperty("appName");
  });

  for (const [label, value] of [
    ["only spaces", "   "],
    ["empty", ""],
    ["a number", 42],
    ["null", null],
  ] as const) {
    it(`a saved name that is ${label} opens as no name`, async () => {
      seedDocs({ A: doc([frame()], { appName: "Lumen Pro" }), D: { ...doc([frame()]), appName: value } });
      const b = await boot();
      // A named set first, so a leak would show.
      await b.openSet("A");
      await b.openSet("D");
      expect(b.useOnstage.getState().appName).toBeUndefined();
      expect(b.currentDoc()).not.toHaveProperty("appName");
    });
  }

  it("a damaged saved name doesn't rename the export: the set's app names it", async () => {
    const b = await boot();
    const { set } = await setInApp(b, "Ferry");
    // Written behind the backend's back, as an older or broken build might.
    seedDocs({ ...stored(), [set.id]: { ...doc([frame()]), appName: 42 } });
    await exportSet(b, set.id);
    expect(lastRequest().appName).toBe("Ferry");
    expect(render.downloadBlob).toHaveBeenCalledWith(ZIP, "ferry-store-assets.zip");
  });
});

describe("autosave and the app name", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  });
  afterEach(async () => {
    await vi.runOnlyPendingTimersAsync();
    vi.useRealTimers();
  });

  it("changing only the name is saved with the document", async () => {
    const frames = [frame({ caption: "One" }), frame({ caption: "Two" })];
    seedDocs({ A: doc(frames) });
    const b = await boot();
    await b.openSet("A");
    b.useOnstage.getState().setAppName("Ferry Pro");
    expect(b.useOnstage.getState().saveState).toBe("saving");

    await vi.advanceTimersByTimeAsync(400);
    expect(b.useOnstage.getState().saveState).toBe("saved");
    expect(stored().A.appName).toBe("Ferry Pro");
    expect(stored().A.frames).toEqual(frames);
  });

  it("flushSaves writes a name change without waiting for the debounce", async () => {
    seedDocs({ A: doc([frame()]) });
    const b = await boot();
    await b.openSet("A");
    b.useOnstage.getState().setAppName("Lumen Pro");
    await b.flushSaves();
    expect(stored().A.appName).toBe("Lumen Pro");
  });

  it("a set that names nothing is saved with no appName key at all", async () => {
    seedDocs({ A: doc([frame()]) });
    const b = await boot();
    await b.openSet("A");
    const save = vi.spyOn(b.localBackend, "saveSetDoc");
    b.useOnstage.getState().patchFrame({ caption: "Edited" });
    await vi.advanceTimersByTimeAsync(400);

    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][1]).not.toHaveProperty("appName");
    expect(stored().A.frames[0].caption).toBe("Edited");
    expect(stored().A).not.toHaveProperty("appName");
  });

  it("clearing a saved name removes the key from the saved document", async () => {
    seedDocs({ A: doc([frame()], { appName: "Lumen Pro" }) });
    const b = await boot();
    await b.openSet("A");
    b.useOnstage.getState().setAppName("");
    await vi.advanceTimersByTimeAsync(400);
    expect(stored().A).not.toHaveProperty("appName");
  });

  it("undoing a name saves the document as it was before", async () => {
    seedDocs({ A: doc([frame()]) });
    const b = await boot();
    await b.openSet("A");
    b.useOnstage.getState().setAppName("Ferry Pro");
    await vi.advanceTimersByTimeAsync(400);
    expect(stored().A.appName).toBe("Ferry Pro");

    b.useOnstage.getState().undo();
    await vi.advanceTimersByTimeAsync(400);
    expect(stored().A).not.toHaveProperty("appName");
  });
});
