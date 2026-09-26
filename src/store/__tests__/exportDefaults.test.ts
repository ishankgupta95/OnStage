import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SetDoc } from "@/lib/data/types";
import { doc, frame } from "@/lib/data/__tests__/helpers";
import { CAPTIONS } from "@/lib/onstage/data";

const DOCS_KEY = "onstage:set-docs:v1";

type RenderReq = { sizeIds: number[]; locales: string[]; frames: { caption: string }[] };

// The heavy renderer is replaced: these tests are about what it is asked for.
const render = vi.hoisted(() => ({
  renderSet: vi.fn(async (req: RenderReq) => ({
    files: [{ path: `${req.locales[0]}/01.png`, blob: new Blob(["png"]) }],
    bytes: 3,
    zipBlob: new Blob(["zip"]),
  })),
  downloadBlob: vi.fn(),
}));
vi.mock("@/lib/onstage/export/renderSet", () => ({ renderSet: render.renderSet }));
vi.mock("@/lib/onstage/export/download", () => ({ downloadBlob: render.downloadBlob }));

/** A fresh store and backend, as on a page load. */
async function boot() {
  vi.resetModules();
  const store = await import("../onstage");
  const { localBackend } = await import("@/lib/data/local");
  return { ...store, localBackend };
}

const stored = (): Record<string, SetDoc> => JSON.parse(localStorage.getItem(DOCS_KEY) ?? "{}");
const seed = (docs: Record<string, unknown>) => localStorage.setItem(DOCS_KEY, JSON.stringify(docs));

/** The sample's five headlines — translated into DE, JA and ES. */
const sampleFrames = () => CAPTIONS.map((caption) => frame({ caption }));

const APPLE = [0, 1]; // Apple — iPhone 6.9″, iPhone 6.5″
const PLAY = [3, 5]; // Google — Phone, Feature graphic
const TABLET_7 = 4;

const appleA = doc(sampleFrames(), { store: "apple" });
const appleC = doc([frame({ caption: "C one" })], { store: "apple" });
const playB = doc(sampleFrames(), { store: "play" });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  render.renderSet.mockClear();
  render.downloadBlob.mockClear();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("the export's starting picks (GAP-7)", () => {
  it("a fresh store starts on the App Store's two iPhone sizes, in English", async () => {
    const { useOnstage } = await boot();
    const st = useOnstage.getState();
    expect(st.store).toBe("apple");
    expect(st.exportPicks).toEqual(APPLE);
    expect(st.exportLangs).toEqual(["EN"]);
  });

  it("opening a Play set starts on Play's phone size and feature graphic, in English", async () => {
    seed({ B: playB });
    const { openSet, useOnstage } = await boot();
    await openSet("B");
    const st = useOnstage.getState();
    expect(st.store).toBe("play");
    expect(st.exportPicks).toEqual(PLAY);
    expect(st.exportLangs).toEqual(["EN"]);
  });

  it("opening an App Store set starts on the iPhone sizes", async () => {
    seed({ A: appleA });
    const { openSet, useOnstage } = await boot();
    await openSet("A");
    expect(useOnstage.getState()).toMatchObject({ store: "apple", exportPicks: APPLE, exportLangs: ["EN"] });
  });

  it("an older document with no store field opens as an App Store set, with its sizes", async () => {
    const legacy: Partial<SetDoc> = { ...appleA };
    delete legacy.store;
    seed({ L: legacy });
    const { openSet, useOnstage } = await boot();
    await openSet("L");
    expect(useOnstage.getState()).toMatchObject({ store: "apple", exportPicks: APPLE, exportLangs: ["EN"] });
  });

  it("a set with no saved document opens on the App Store sizes", async () => {
    const { openSet, useOnstage } = await boot();
    await openSet("brand-new");
    expect(useOnstage.getState()).toMatchObject({ store: "apple", exportPicks: APPLE, exportLangs: ["EN"] });
  });

  it("the first load of the page resets picks made before it", async () => {
    seed({ A: appleA });
    const { openSet, useOnstage } = await boot();
    useOnstage.getState().toggleExportSize(TABLET_7);
    useOnstage.getState().toggleExportLang("DE");
    await openSet("A");
    expect(useOnstage.getState()).toMatchObject({ exportPicks: APPLE, exportLangs: ["EN"] });
  });

  it("switching sets drops a DE and a Tablet 7″ picked on the previous set", async () => {
    seed({ A: appleA, C: appleC });
    const { openSet, useOnstage } = await boot();
    await openSet("A");
    useOnstage.getState().toggleExportLang("DE");
    useOnstage.getState().toggleExportSize(TABLET_7);
    expect(useOnstage.getState().exportLangs).toEqual(["EN", "DE"]);
    expect(useOnstage.getState().exportPicks).toEqual([...APPLE, TABLET_7]);

    await openSet("C");
    expect(useOnstage.getState()).toMatchObject({ setId: "C", exportPicks: APPLE, exportLangs: ["EN"] });
  });

  it("switching from an App Store set to a Play set takes Play's sizes, and back again", async () => {
    seed({ A: appleA, B: playB });
    const { openSet, useOnstage } = await boot();
    await openSet("A");
    useOnstage.getState().toggleExportSize(TABLET_7);

    await openSet("B");
    expect(useOnstage.getState()).toMatchObject({ store: "play", exportPicks: PLAY, exportLangs: ["EN"] });
    useOnstage.getState().toggleExportSize(0);
    useOnstage.getState().toggleExportLang("JA");

    await openSet("A");
    expect(useOnstage.getState()).toMatchObject({ store: "apple", exportPicks: APPLE, exportLangs: ["EN"] });
  });

  it("every reopen of a set resets it — its earlier picks aren't remembered", async () => {
    seed({ A: appleA, B: playB, C: appleC });
    const { openSet, useOnstage } = await boot();
    for (const [id, picks] of [
      ["A", APPLE],
      ["B", PLAY],
      ["C", APPLE],
      ["A", APPLE],
      ["B", PLAY],
    ] as const) {
      await openSet(id);
      expect(useOnstage.getState().exportPicks).toEqual(picks);
      expect(useOnstage.getState().exportLangs).toEqual(["EN"]);
      // Pick something else before leaving it.
      useOnstage.getState().toggleExportSize(TABLET_7);
      useOnstage.getState().toggleExportLang("ES");
    }
  });

  it("asking again for the set already on screen installs nothing, so its picks stay", async () => {
    seed({ A: appleA });
    const { openSet, useOnstage } = await boot();
    await openSet("A");
    useOnstage.getState().toggleExportSize(TABLET_7);
    useOnstage.getState().toggleExportLang("DE");
    await openSet("A");
    expect(useOnstage.getState()).toMatchObject({ exportPicks: [...APPLE, TABLET_7], exportLangs: ["EN", "DE"] });
  });

  it("a Play set opened while its read fails falls back to the default (App Store) sizes, not the last set's", async () => {
    seed({ B: playB, A: appleA });
    const { openSet, useOnstage, localBackend } = await boot();
    await openSet("B");
    expect(useOnstage.getState().exportPicks).toEqual(PLAY);
    vi.spyOn(localBackend, "loadSetDoc").mockRejectedValueOnce(new Error("read failed"));
    await openSet("A");
    expect(useOnstage.getState()).toMatchObject({ setId: "A", store: "apple", exportPicks: APPLE, exportLangs: ["EN"] });
  });

  it("two opens racing: the picks follow the set that wins", async () => {
    seed({ A: appleA, B: playB });
    const { openSet, useOnstage } = await boot();
    await Promise.all([openSet("A"), openSet("B")]);
    expect(useOnstage.getState()).toMatchObject({ loadedSetId: "B", store: "play", exportPicks: PLAY });
    await openSet("A");
    expect(useOnstage.getState()).toMatchObject({ loadedSetId: "A", store: "apple", exportPicks: APPLE });
  });
});

describe("setStore (GAP-5)", () => {
  it("aims the set at Play: its store and its default sizes follow", async () => {
    seed({ A: appleA });
    const { openSet, useOnstage } = await boot();
    await openSet("A");
    useOnstage.getState().toggleExportSize(TABLET_7);

    useOnstage.getState().setStore("play");
    expect(useOnstage.getState()).toMatchObject({ store: "play", exportPicks: PLAY });

    useOnstage.getState().setStore("apple");
    expect(useOnstage.getState()).toMatchObject({ store: "apple", exportPicks: APPLE });
  });

  it("leaves the picked locales alone", async () => {
    seed({ A: appleA });
    const { openSet, useOnstage } = await boot();
    await openSet("A");
    useOnstage.getState().toggleExportLang("DE");
    useOnstage.getState().setStore("play");
    expect(useOnstage.getState().exportLangs).toEqual(["EN", "DE"]);
  });

  it("is not an undo step: the store isn't in the history, and undo leaves it", async () => {
    seed({ A: appleA });
    const { openSet, useOnstage } = await boot();
    await openSet("A");
    const history = () => useOnstage.temporal.getState();
    expect(history().pastStates.length).toBe(0);

    useOnstage.getState().setStore("play");
    expect(history().pastStates.length).toBe(0);
    expect(history().futureStates.length).toBe(0);

    // An edit, then the store: undo walks back the edit only.
    useOnstage.getState().setStore("apple");
    useOnstage.getState().patchFrame({ caption: "Edited" });
    expect(history().pastStates.length).toBe(1);
    useOnstage.getState().setStore("play");
    expect(history().pastStates.length).toBe(1);

    useOnstage.getState().undo();
    const st = useOnstage.getState();
    expect(st.frames[0].caption).toBe(CAPTIONS[0]);
    expect(st.store).toBe("play");
    expect(st.exportPicks).toEqual(PLAY);
  });

  it("is saved with the set: the autosave writes store \"play\", and a reload opens it on Play's sizes", async () => {
    seed({ A: appleA });
    const first = await boot();
    const save = vi.spyOn(first.localBackend, "saveSetDoc");
    await first.openSet("A");

    first.useOnstage.getState().setStore("play");
    expect(first.useOnstage.getState().saveState).toBe("saving");
    await vi.advanceTimersByTimeAsync(399);
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);

    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][0]).toBe("A");
    expect(save.mock.calls[0][1].store).toBe("play");
    expect(stored().A.store).toBe("play");
    expect(first.useOnstage.getState().saveState).toBe("saved");

    // A page load later.
    const second = await boot();
    await second.openSet("A");
    expect(second.useOnstage.getState()).toMatchObject({ store: "play", exportPicks: PLAY, exportLangs: ["EN"] });
  });
});

describe("runExport renders only locales the set has captions in (EDITOR-6 interim)", () => {
  it("the untouched sample with EN + DE picked renders EN and DE", async () => {
    seed({ A: appleA });
    const { openSet, useOnstage } = await boot();
    await openSet("A");
    useOnstage.getState().toggleExportLang("DE");
    expect(useOnstage.getState().exportLangs).toEqual(["EN", "DE"]);

    await useOnstage.getState().runExport();
    expect(render.renderSet).toHaveBeenCalledTimes(1);
    expect(render.renderSet.mock.calls[0][0].locales).toEqual(["EN", "DE"]);
    expect(render.renderSet.mock.calls[0][0].sizeIds).toEqual(APPLE);
    expect(useOnstage.getState().exportState).toBe("done");
  });

  it("with a caption edited, EN + DE picked renders EN alone — the pick itself is kept", async () => {
    seed({ A: appleA });
    const { openSet, useOnstage } = await boot();
    await openSet("A");
    useOnstage.getState().toggleExportLang("DE");
    useOnstage.getState().select(2, "caption");
    useOnstage.getState().typeCaption("Our own headline");

    await useOnstage.getState().runExport();
    expect(render.renderSet).toHaveBeenCalledTimes(1);
    expect(render.renderSet.mock.calls[0][0].locales).toEqual(["EN"]);
    expect(render.renderSet.mock.calls[0][0].frames[2].caption).toBe("Our own headline");
    expect(useOnstage.getState().exportLangs).toEqual(["EN", "DE"]);
  });

  it("DE alone picked on an edited set falls back to EN", async () => {
    seed({ A: appleA });
    const { openSet, useOnstage } = await boot();
    await openSet("A");
    useOnstage.getState().toggleExportLang("DE");
    useOnstage.getState().toggleExportLang("EN");
    expect(useOnstage.getState().exportLangs).toEqual(["DE"]);
    useOnstage.getState().patchFrame({ caption: "Changed" });

    await useOnstage.getState().runExport();
    expect(render.renderSet.mock.calls[0][0].locales).toEqual(["EN"]);
  });

  it("undoing the edit makes DE renderable again", async () => {
    seed({ A: appleA });
    const { openSet, useOnstage } = await boot();
    await openSet("A");
    useOnstage.getState().toggleExportLang("DE");
    useOnstage.getState().patchFrame({ caption: "Changed" });
    await useOnstage.getState().runExport();
    expect(render.renderSet.mock.calls[0][0].locales).toEqual(["EN"]);

    useOnstage.getState().undo();
    await useOnstage.getState().runExport();
    expect(render.renderSet.mock.calls[1][0].locales).toEqual(["EN", "DE"]);
  });

  it("a Play set renders Play's sizes", async () => {
    seed({ B: playB });
    const { openSet, useOnstage } = await boot();
    await openSet("B");
    await useOnstage.getState().runExport();
    expect(render.renderSet.mock.calls[0][0].sizeIds).toEqual(PLAY);
    expect(render.renderSet.mock.calls[0][0].locales).toEqual(["EN"]);
  });
});

describe("setStore and the locale chips agree with what is shown (S3.3 review)", () => {
  it("re-clicking the store already chosen keeps sizes picked by hand", async () => {
    seed({ A: appleA });
    const { openSet, useOnstage } = await boot();
    await openSet("A");
    useOnstage.getState().toggleExportSize(TABLET_7);
    const picks = useOnstage.getState().exportPicks;
    useOnstage.getState().setStore("apple");
    expect(useOnstage.getState().exportPicks).toBe(picks);
    expect(useOnstage.getState().exportPicks).toContain(TABLET_7);
  });

  it("the last locale can't be switched off: clicking EN alone changes nothing, and DE then adds to it", async () => {
    seed({ A: appleA });
    const { openSet, useOnstage } = await boot();
    await openSet("A");
    expect(useOnstage.getState().exportLangs).toEqual(["EN"]);
    useOnstage.getState().toggleExportLang("EN");
    expect(useOnstage.getState().exportLangs).toEqual(["EN"]);
    useOnstage.getState().toggleExportLang("DE");
    expect(useOnstage.getState().exportLangs).toEqual(["EN", "DE"]);
    useOnstage.getState().toggleExportLang("EN");
    expect(useOnstage.getState().exportLangs).toEqual(["DE"]);
  });

  it("toggles what is shown: a stale pick the set can't export no longer counts", async () => {
    seed({ A: appleA });
    const { openSet, useOnstage } = await boot();
    await openSet("A");
    useOnstage.getState().toggleExportLang("DE");
    // An edited caption: DE can't be exported, so the chips show EN alone…
    useOnstage.getState().typeCaption("Our own headline");
    const before = useOnstage.getState().exportLangs;
    useOnstage.getState().toggleExportLang("EN");
    // …and switching EN off would leave nothing: refused, nothing changes.
    expect(useOnstage.getState().exportLangs).toBe(before);
    const { usableLocales } = await import("@/lib/onstage/export/slots");
    expect(usableLocales(useOnstage.getState().frames, useOnstage.getState().exportLangs)).toEqual(["EN"]);
  });
});
