import { act, type ComponentType } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { localBackend } from "@/lib/data/local";
import { frame } from "@/lib/data/__tests__/helpers";
import { EXPORT_ROOT, exportPlan, formatMB } from "@/lib/onstage/export/plan";
import { EXPORT_SLOTS } from "@/lib/onstage/export/slots";
import { useOnstage } from "@/store/onstage";
import { ExportOverlay } from "../ExportOverlay";
import { CAPTIONS } from "@/lib/onstage/data";
import { usableLocales } from "@/lib/onstage/export/slots";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Store = typeof useOnstage;
type StoreState = ReturnType<Store["getState"]>;
type Flags = Partial<typeof import("@/lib/features").FEATURES>;

/** Three frames of the default cut, so the file counts below are explicit. */
const FRAMES = useOnstage.getState().frames.slice(0, 3);

/**
 * The dialog's inputs, as a fresh editor would have them: three frames,
 * iPhone 6.9″ + Google phone + the feature graphic, EN and DE — 3·2 + 3·2 +
 * 1·2 = 14 files — and no export run yet.
 */
function prime(store: Store, patch: Partial<StoreState> = {}) {
  act(() =>
    store.setState({
      frames: FRAMES,
      overlay: "export",
      exportPicks: [0, 3, 5],
      exportLangs: ["EN", "DE"],
      exportDest: "zip",
      exportState: null,
      exportError: null,
      exportDeliveredTo: null,
      exportBlockedByQuota: false,
      exportDone: 0,
      exportTotal: 0,
      exportBytes: 0,
      ...patch,
    }),
  );
}

/** The dialog from a fresh module graph with `flags` on, with that graph's
 *  store and backend (the ones the dialog reads). */
async function flagged(flags: Flags) {
  vi.resetModules();
  vi.doMock("@/lib/features", async (importOriginal) => {
    const real = await importOriginal<typeof import("@/lib/features")>();
    return { FEATURES: { ...real.FEATURES, ...flags } };
  });
  try {
    const { ExportOverlay: Overlay } = await import("../ExportOverlay");
    const store = await import("@/store/onstage");
    const local = await import("@/lib/data/local");
    return { Overlay, useOnstage: store.useOnstage, localBackend: local.localBackend };
  } finally {
    vi.doUnmock("@/lib/features");
  }
}

let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  prime(useOnstage);
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
});

/** Let the backend reads resolve and the dialog re-render. */
async function settle() {
  for (let i = 0; i < 3; i++) await act(() => new Promise((r) => setTimeout(r, 5)));
}

async function mount(Overlay: ComponentType = ExportOverlay) {
  await act(async () => root.render(<Overlay />));
  await settle();
}

const text = () => host.textContent ?? "";

/** Elements whose whole text is exactly `t`. */
const byText = (t: string) =>
  [...host.querySelectorAll<HTMLElement>("*")].filter((el) => el.textContent === t);

/** The rows under the DESTINATION heading. */
function destRows(): HTMLElement[] {
  const heading = byText("DESTINATION")[0];
  if (!heading) throw new Error("no DESTINATION heading");
  const list = heading.nextElementSibling;
  if (!list) throw new Error("no destination list");
  return [...list.children] as HTMLElement[];
}

function destRow(label: string): HTMLElement {
  const row = destRows().find((r) => r.textContent?.includes(label));
  if (!row) throw new Error(`no destination row "${label}"`);
  return row;
}

/** Whether a destination row's radio is filled (the picked one). */
const picked = (row: HTMLElement) => {
  const radio = row.querySelector("span");
  if (!radio) throw new Error("destination row has no radio");
  return radio.style.boxShadow.includes("inset");
};

const buttonTexts = () => [...host.querySelectorAll("button")].map((b) => b.textContent?.trim() ?? "");

function button(label: string): HTMLButtonElement {
  const b = [...host.querySelectorAll("button")].find((x) => x.textContent?.trim() === label);
  if (!b) throw new Error(`no "${label}" button`);
  return b;
}

const link = (label: string) =>
  [...host.querySelectorAll("a")].find((a) => a.textContent?.trim() === label) ?? null;

async function click(el: HTMLElement) {
  await act(async () => el.click());
}

describe("ExportOverlay — without a store backend (storeUpload off)", () => {
  it("offers exactly one destination, the zip, and it is picked", async () => {
    await mount();
    const rows = destRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain("Download a zip");
    expect(rows[0].textContent).toContain("Folders per locale and size");
    expect(picked(rows[0])).toBe(true);
    for (const t of ["App Store Connect", "Play Console", "CONNECTED", "ACTION NEEDED"]) {
      expect(text()).not.toContain(t);
    }
  });

  it("shows the zip as picked even when the store still says App Store Connect", async () => {
    prime(useOnstage, { exportDest: "asc" });
    await mount();
    const rows = destRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain("Download a zip");
    expect(picked(rows[0])).toBe(true);
    expect(text()).not.toContain("App Store Connect");
  });

  it("never reads the store connections", async () => {
    const connections = vi.spyOn(localBackend, "listConnections");
    prime(useOnstage, { exportDest: "asc" });
    await mount();
    expect(connections).not.toHaveBeenCalled();
  });

  it("the main button renders files, never uploads them", async () => {
    await mount();
    expect(buttonTexts()).toContain("Render 14 files");
    act(() => useOnstage.setState({ exportDest: "asc" }));
    expect(buttonTexts()).toContain("Render 14 files");
    expect(text()).not.toContain("upload");
    expect(text()).not.toContain("Render & upload");
  });

  it("the zip row picks the zip", async () => {
    prime(useOnstage, { exportDest: "play" });
    await mount();
    await click(destRow("Download a zip"));
    expect(useOnstage.getState().exportDest).toBe("zip");
  });

  it("a failed export is 'Export failed' with its message, and no Reconnect or Download instead", async () => {
    prime(useOnstage, { exportState: "error", exportError: "boom", exportDest: "asc" });
    await mount();
    expect(byText("Export failed").length).toBeGreaterThan(0);
    expect(byText("boom").length).toBeGreaterThan(0);
    expect(text()).not.toContain("didn't accept it");
    expect(link("Reconnect")).toBeNull();
    expect(host.querySelector('a[href^="/settings"]')).toBeNull();
    expect(buttonTexts()).not.toContain("Download instead");
    // …and no empty row of actions under the message.
    const message = byText("boom").at(-1)!;
    expect(message.nextElementSibling).toBeNull();
    // The main button retries the render.
    expect(buttonTexts()).toContain("Try again");
  });

  it("a finished export says the zip was saved, without mentioning uploads", async () => {
    prime(useOnstage, { exportState: "done", exportDeliveredTo: "zip" });
    await mount();
    expect(byText("Zip saved to Downloads").length).toBeGreaterThan(0);
    expect(text()).not.toContain("Uploaded nothing yet");
    expect(buttonTexts()).toContain("Done — download ready");
  });
});

/**
 * Plan S3.2: the dialog's rows, counts, weight, tree and tablet note come
 * from the export plan for this set's frames and the picked sizes and
 * locales — no fixed "40 files", "16.8 MB", "Missing frames" or "stretched".
 */
describe("ExportOverlay — what the picks produce (S3.2)", () => {
  /** Seven frames: more than the default cut, so no count is a leftover.
   *  Their captions are the sample's, which have DE/JA/ES translations, so
   *  those locales can be exported (S3.3 offers only locales with captions). */
  const SEVEN = Array.from({ length: 7 }, (_, i) => frame({ caption: CAPTIONS[i % CAPTIONS.length] }));

  const IPHONE_69 = 0;
  const IPHONE_65 = 1;
  const IPAD = 2;
  const PHONE = 3;
  const TABLET_7 = 4;
  const FEATURE = 5;

  const TABLET_NOTE = "Tablet sizes use your phone screenshots, cropped to fit the tablet screen.";

  /** The plan for whatever the store holds now. */
  const planNow = () => {
    const st = useOnstage.getState();
    return exportPlan({
      picks: st.exportPicks,
      langs: usableLocales(st.frames, st.exportLangs),
      frameCount: st.frames.length,
      root: EXPORT_ROOT,
    });
  };

  /** The six rows under the SIZES heading. */
  function sizeRows(): HTMLElement[] {
    const heading = byText("SIZES")[0];
    if (!heading) throw new Error("no SIZES heading");
    const list = heading.nextElementSibling;
    if (!list) throw new Error("no size list");
    return [...list.children] as HTMLElement[];
  }

  /** A size row's file-count cell (its last column). */
  const rowCount = (row: HTMLElement) => row.lastElementChild?.textContent ?? "";

  /** "PNG files · …" under YOU'LL GET. */
  function weightLine(): HTMLElement {
    const el = [...host.querySelectorAll<HTMLElement>("span")].find((x) =>
      x.textContent?.startsWith("PNG files · "),
    );
    if (!el) throw new Error("no PNG files line");
    return el;
  }

  /** The big number beside it. */
  const bigCount = () => weightLine().previousElementSibling?.textContent ?? "";

  /** The folder tree's lines, top to bottom. The innermost match is the
   *  root's own line (a root-only tree's box reads the same). */
  function treeLines(): string[] {
    const rootLine = byText(`${EXPORT_ROOT}/`).at(-1);
    if (!rootLine?.parentElement) throw new Error("no export tree");
    return [...rootLine.parentElement.children].map((l) => l.textContent ?? "");
  }

  /** The note's text — and its box, so an empty warning box can't hide. */
  const note = () => {
    const boxes = [...host.querySelectorAll('[role="note"]')];
    expect(boxes.length).toBe(byText(TABLET_NOTE).length > 0 ? 1 : 0);
    return byText(TABLET_NOTE);
  };

  it("with seven frames, only JA and only the iPad, every readout is that export", async () => {
    prime(useOnstage, { frames: SEVEN, exportPicks: [IPAD], exportLangs: ["JA"] });
    await mount();
    const plan = planNow();
    expect(plan.files).toBe(7);

    expect(byText("7 FRAMES · 1 LOCALE").length).toBeGreaterThan(0);
    expect(treeLines()).toEqual([`${EXPORT_ROOT}/`, "ja-JP/", "APP_IPAD_PRO_3GEN_129/ 01…07.png"]);
    for (const absent of ["en-US", "de-DE", "TABLET_7", "APP_IPHONE_69", "PHONE/", "feature-graphic"]) {
      expect(text()).not.toContain(absent);
    }
    expect(bigCount()).toBe(String(plan.files));
    expect(weightLine().textContent).toBe(`PNG files · ~${formatMB(plan.estBytes)}`);
    expect(buttonTexts()).toContain(`Render ${plan.files} files`);
    expect(rowCount(sizeRows()[IPAD])).toBe("7 files");
  });

  it("the header counts the set's frames and the locales that will be written", async () => {
    prime(useOnstage, { frames: SEVEN, exportLangs: ["EN", "DE", "ES"] });
    await mount();
    expect(byText("7 FRAMES · 3 LOCALES").length).toBeGreaterThan(0);

    // No locale picked still writes English.
    act(() => useOnstage.setState({ exportLangs: [] }));
    expect(byText("7 FRAMES · 1 LOCALE").length).toBeGreaterThan(0);
    expect(treeLines()[1]).toBe("en-US/");
  });

  it("lists the six store sizes from the slot table, with their pixel sizes", async () => {
    await mount();
    const rows = sizeRows();
    expect(rows).toHaveLength(EXPORT_SLOTS.length);
    expect(rows).toHaveLength(6);
    EXPORT_SLOTS.forEach((slot, i) => {
      expect(rows[i].textContent).toContain(slot.label);
      expect(rows[i].textContent).toContain(`${slot.w} × ${slot.h}`);
    });
  });

  it("each picked row counts its own files; unpicked rows show a dash", async () => {
    // 3 frames × EN, DE: sizes write 6 files each, the feature graphic 2.
    await mount();
    const counts = sizeRows().map(rowCount);
    expect(counts).toEqual(["6 files", "—", "—", "6 files", "—", "2 files"]);
    const plan = planNow();
    for (const p of plan.slots) expect(counts[p.index]).toBe(`${p.files} files`);
  });

  it("marks only the iPhone 6.9″ and the Google phone as required", async () => {
    await mount();
    const required = sizeRows()
      .map((row, i) => ({ i, badge: [...row.querySelectorAll("span")].some((s) => s.textContent === "Required") }))
      .filter((r) => r.badge)
      .map((r) => r.i);
    expect(required).toEqual([IPHONE_69, PHONE]);
    expect(byText("Required")).toHaveLength(2);
  });

  it("never claims frames are missing", async () => {
    for (const patch of [
      {},
      { exportPicks: [0, 1, 2, 3, 4, 5], exportLangs: ["EN", "DE", "JA", "ES"] },
      { frames: SEVEN, exportPicks: [TABLET_7] },
      { frames: [frame()], exportPicks: [IPAD, FEATURE] },
      { exportPicks: [] },
    ]) {
      prime(useOnstage, patch);
      await mount();
      expect(text()).not.toMatch(/missing/i);
    }
  });

  it("the count, weight, tree and button follow every change to the picks", async () => {
    prime(useOnstage, { frames: SEVEN });
    await mount();
    const check = () => {
      const plan = planNow();
      expect(bigCount()).toBe(String(plan.files));
      expect(weightLine().textContent).toBe(`PNG files · ~${formatMB(plan.estBytes)}`);
      expect(treeLines()).toEqual(plan.tree.map((l) => l.text));
      expect(buttonTexts()).toContain(`Render ${plan.files} files`);
      return plan.files;
    };
    // (7 + 7 + 1) × 2
    expect(check()).toBe(30);

    await click(sizeRows()[IPHONE_65]);
    expect(useOnstage.getState().exportPicks).toContain(IPHONE_65);
    expect(check()).toBe(44);
    expect(rowCount(sizeRows()[IPHONE_65])).toBe("14 files");

    await click(button("JA"));
    expect(useOnstage.getState().exportLangs).toEqual(["EN", "DE", "JA"]);
    expect(check()).toBe(66);
    expect(treeLines()[1]).toBe("en-US/ · de-DE/ · ja-JP/");

    await click(sizeRows()[FEATURE]);
    expect(check()).toBe(63);
    expect(text()).not.toContain("feature-graphic-1024x500.png");

    // Three more frames in the set: every size writes ten per locale.
    act(() => useOnstage.setState({ frames: [...SEVEN, ...SEVEN.slice(0, 3)] }));
    expect(check()).toBe(90);
    expect(treeLines()).toContain("APP_IPHONE_69/ 01…10.png");
    expect(byText("10 FRAMES · 3 LOCALES").length).toBeGreaterThan(0);
  });

  it("with nothing picked, it promises no files and cannot render", async () => {
    prime(useOnstage, { exportPicks: [] });
    await mount();
    expect(bigCount()).toBe("0");
    expect(weightLine().textContent).toBe("PNG files · ~0.0 MB");
    expect(treeLines()).toEqual([`${EXPORT_ROOT}/`]);
    expect(button("Render 0 files").disabled).toBe(true);
    expect(sizeRows().map(rowCount)).toEqual(["—", "—", "—", "—", "—", "—"]);
  });

  it("one file reads '1 file', and a tablet with No frame gets no crop note", async () => {
    prime(useOnstage, { frames: [frame()], exportPicks: [FEATURE], exportLangs: ["EN"] });
    await mount();
    expect(rowCount(sizeRows()[FEATURE])).toBe("1 file");
    expect(buttonTexts()).toContain("Render 1 file");
    expect(text()).not.toContain("1 files");

    act(() => useOnstage.setState({ exportPicks: [IPAD], device: "none" }));
    expect(note()).toEqual([]);
    act(() => useOnstage.setState({ device: "ip16pm" }));
    expect(note().length).toBeGreaterThan(0);
  });

  it("names a single frame 01.png, not a range", async () => {
    prime(useOnstage, { frames: [frame({ caption: CAPTIONS[0] })], exportPicks: [PHONE], exportLangs: ["DE"] });
    await mount();
    expect(treeLines()).toEqual([`${EXPORT_ROOT}/`, "de-DE/", "PHONE/ 01.png"]);
    // (Whether one frame reads FRAME or FRAMES is copy, not the count.)
    expect([...host.querySelectorAll("div")].some((d) => /^1 FRAMES? · 1 LOCALE$/.test(d.textContent ?? ""))).toBe(
      true,
    );
  });

  it("warns about tablets only while the iPad or the 7″ tablet is picked, and never says stretched or soft", async () => {
    // iPhone 6.9″ + Google phone + feature graphic: no tablet.
    await mount();
    expect(note()).toHaveLength(0);
    expect(text()).not.toContain("Tablet sizes");

    await click(sizeRows()[IPAD]);
    expect(note().length).toBeGreaterThan(0);

    await click(sizeRows()[IPAD]);
    expect(note()).toHaveLength(0);

    await click(sizeRows()[TABLET_7]);
    expect(note().length).toBeGreaterThan(0);

    await click(sizeRows()[IPAD]);
    expect(note().length).toBeGreaterThan(0);
    expect(text()).not.toMatch(/stretch/i);
    expect(text()).not.toMatch(/\bsoft\b/i);

    await click(sizeRows()[IPAD]);
    await click(sizeRows()[TABLET_7]);
    expect(note()).toHaveLength(0);
  });

  it("the weight is an estimate until an export is done, then the zip's real size", async () => {
    await mount();
    const est = `PNG files · ~${formatMB(planNow().estBytes)}`;
    expect(weightLine().textContent).toBe(est);
    expect(weightLine().textContent).not.toContain("16.8 MB");

    // Mid-run: still the estimate.
    act(() => useOnstage.setState({ exportState: "rendering", exportDone: 3, exportTotal: 14 }));
    expect(weightLine().textContent).toBe(est);

    // Done, with the zip's bytes: exactly those, not approximate.
    act(() =>
      useOnstage.setState({ exportState: "done", exportDeliveredTo: "zip", exportBytes: 3_250_586 }),
    );
    expect(weightLine().textContent).toBe(`PNG files · ${formatMB(3_250_586)}`);
    expect(weightLine().textContent).toBe("PNG files · 3.1 MB");
    expect(weightLine().textContent).not.toContain("~");
  });

  it("a finished run without a byte count, or a failed one, still shows the estimate", async () => {
    prime(useOnstage, { exportState: "done", exportDeliveredTo: "zip", exportBytes: 0 });
    await mount();
    const est = `PNG files · ~${formatMB(planNow().estBytes)}`;
    expect(weightLine().textContent).toBe(est);

    act(() => useOnstage.setState({ exportState: "error", exportError: "boom", exportBytes: 4096 }));
    expect(weightLine().textContent).toBe(est);
  });
});

// Last: each swaps in a fresh module graph with the flags on, proving the
// selectors above would have found these surfaces had they mounted.
describe("ExportOverlay — with a store backend (storeUpload on)", () => {
  it("lists App Store Connect and Play Console with their connection state", async () => {
    const f = await flagged({ storeUpload: true });
    const connections = vi.spyOn(f.localBackend, "listConnections");
    prime(f.useOnstage);
    await mount(f.Overlay);
    // Wait for the connections themselves: before they load, both store rows
    // already read ACTION NEEDED.
    await vi.waitFor(() => expect(text()).toContain("Token expires in 41 days"));
    expect(connections).toHaveBeenCalled();

    const rows = destRows();
    expect(rows).toHaveLength(3);
    expect(rows[0].textContent).toContain("Download a zip");
    const asc = destRow("App Store Connect");
    const play = destRow("Play Console");
    // The sample connections: Apple connected, Google's key revoked.
    expect(asc.textContent).toContain("CONNECTED");
    expect(asc.textContent).not.toContain("ACTION NEEDED");
    expect(asc.textContent).toContain("Token expires in 41 days");
    expect(play.textContent).toContain("ACTION NEEDED");
    expect(play.textContent).toContain("Service account key was revoked on 2 March");
    expect(picked(rows[0])).toBe(true);
    expect(picked(asc)).toBe(false);
    expect(picked(play)).toBe(false);
  });

  it("picking a store row sets the destination and the button uploads", async () => {
    const f = await flagged({ storeUpload: true });
    prime(f.useOnstage);
    await mount(f.Overlay);
    expect(buttonTexts()).toContain("Render 14 files");

    await click(destRow("App Store Connect"));
    expect(f.useOnstage.getState().exportDest).toBe("asc");
    expect(picked(destRow("App Store Connect"))).toBe(true);
    expect(picked(destRow("Download a zip"))).toBe(false);
    expect(buttonTexts()).toContain("Render & upload 14 files");

    await click(destRow("Play Console"));
    expect(f.useOnstage.getState().exportDest).toBe("play");
    expect(picked(destRow("Play Console"))).toBe(true);
    expect(picked(destRow("App Store Connect"))).toBe(false);
    expect(buttonTexts()).toContain("Render & upload 14 files");

    await click(destRow("Download a zip"));
    expect(f.useOnstage.getState().exportDest).toBe("zip");
    expect(picked(destRow("Download a zip"))).toBe(true);
    expect(buttonTexts()).toContain("Render 14 files");
  });

  it("a refused upload names the store, links to Reconnect and offers the rendered zip", async () => {
    const f = await flagged({ storeUpload: true });
    const downloadRenderedZip = vi.fn();
    // The render finished (runExport sets exportBytes), then the store refused.
    prime(f.useOnstage, { exportState: "error", exportError: "boom", exportDest: "asc", exportBytes: 4096 });
    act(() => f.useOnstage.setState({ downloadRenderedZip }));
    await mount(f.Overlay);
    expect(byText("App Store Connect didn't accept it").length).toBeGreaterThan(0);
    expect(byText("boom").length).toBeGreaterThan(0);
    expect(text()).not.toContain("Export failed");
    expect(link("Reconnect")?.getAttribute("href")).toBe("/settings?tab=Store+connections");
    await click(button("Download instead"));
    expect(downloadRenderedZip).toHaveBeenCalledTimes(1);
  });

  it("after a refusal, picking the zip row keeps Download instead: this run's files still exist", async () => {
    const f = await flagged({ storeUpload: true });
    const downloadRenderedZip = vi.fn();
    prime(f.useOnstage, { exportState: "error", exportError: "boom", exportDest: "asc", exportBytes: 4096 });
    act(() => f.useOnstage.setState({ downloadRenderedZip }));
    await mount(f.Overlay);
    await click(destRow("Download a zip"));
    expect(f.useOnstage.getState().exportDest).toBe("zip");
    await click(button("Download instead"));
    expect(downloadRenderedZip).toHaveBeenCalledTimes(1);
  });

  it("a render that failed with a store picked offers no Download instead: this run made no files", async () => {
    const f = await flagged({ storeUpload: true });
    prime(f.useOnstage, { exportState: "error", exportError: "boom", exportDest: "asc", exportBytes: 0 });
    await mount(f.Overlay);
    expect(link("Reconnect")).not.toBeNull();
    expect(buttonTexts()).not.toContain("Download instead");
  });

  it("a failed zip render is 'Export failed', with no Download instead (there are no files) and no Reconnect", async () => {
    const f = await flagged({ storeUpload: true });
    prime(f.useOnstage, { exportState: "error", exportError: "boom", exportDest: "zip" });
    await mount(f.Overlay);
    expect(byText("Export failed").length).toBeGreaterThan(0);
    expect(byText("boom").length).toBeGreaterThan(0);
    expect(text()).not.toContain("didn't accept it");
    expect(link("Reconnect")).toBeNull();
    expect(buttonTexts()).not.toContain("Download instead");
    expect(buttonTexts()).toContain("Try again");
  });

  it("a finished zip export notes that nothing was uploaded", async () => {
    const f = await flagged({ storeUpload: true });
    prime(f.useOnstage, { exportState: "done", exportDeliveredTo: "zip" });
    await mount(f.Overlay);
    expect(byText("Uploaded nothing yet — zip saved to Downloads").length).toBeGreaterThan(0);
  });

  it("a finished upload names the store, without pointing at the job queue while it is off", async () => {
    const f = await flagged({ storeUpload: true });
    prime(f.useOnstage, { exportState: "done", exportDest: "asc", exportDeliveredTo: "apple" });
    await mount(f.Overlay);
    expect(byText("Sent to App Store Connect").length).toBeGreaterThan(0);
    expect(text()).not.toContain("track it in Renders & uploads");
    expect(buttonTexts()).toContain("Uploaded to App Store Connect");
  });

  it("with the job queue on too, a finished upload points at Renders & uploads", async () => {
    const f = await flagged({ storeUpload: true, jobQueue: true });
    prime(f.useOnstage, { exportState: "done", exportDest: "asc", exportDeliveredTo: "apple" });
    await mount(f.Overlay);
    expect(byText("Sent to App Store Connect — track it in Renders & uploads").length).toBeGreaterThan(0);
  });
});
