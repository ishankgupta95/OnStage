import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { localBackend } from "@/lib/data/local";
import { imageIdFromRef } from "@/lib/data/imageRefs";
import { frame, resetImageDb } from "@/lib/data/__tests__/helpers";
import { openSet, useOnstage } from "@/store/onstage";
import { DropZone } from "../DropZone";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let host: HTMLDivElement;

const png = (n: number) => new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, n])], `${n}.png`, { type: "image/png" });

function drop(files: File[]) {
  const target = host.querySelector('[role="button"]')!;
  const event = new Event("drop", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "dataTransfer", { value: { files } });
  target.dispatchEvent(event);
}

async function settle(ms = 50) {
  await act(() => new Promise((r) => setTimeout(r, ms)));
}

beforeEach(async () => {
  // jsdom decodes no images: every dropped file measures as a real 6.9″
  // screenshot unless a test says otherwise.
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(async () => ({ width: 1320, height: 2868, close() {} })),
  );
  await resetImageDb();
  await openSet(`drop-${Math.random()}`);
  useOnstage.setState({
    frames: useOnstage.getState().frames.slice(0, 5).map((f) => ({ ...f, screenshot: null })),
  });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(async () => {
  act(() => root.unmount());
  host.remove();
  await settle(450); // let the autosave these drops trigger finish
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const render = (props: {
  from: number;
  multiple?: boolean;
  onPlaced?: (placed: { ref: string; name: string }[]) => void;
}) =>
  act(async () =>
    root.render(
      <DropZone {...props} base="" hover="">
        Drop a screen
      </DropZone>,
    ),
  );

describe("DropZone", () => {
  it("stores the File itself and points the frame at it", async () => {
    const put = vi.spyOn(localBackend, "putImage");
    await render({ from: 2 });
    const file = png(1);
    drop([file]);
    await settle();

    expect(put).toHaveBeenCalledTimes(1);
    expect(put.mock.calls[0][0]).toBe(file);
    const id = imageIdFromRef(useOnstage.getState().frames[2].screenshot);
    expect(id).not.toBeNull();
    expect((await localBackend.getImage(id!))!.size).toBe(file.size);
  });

  it("adds frames for screenshots past the last one, up to the App Store's 10 (GAP-1)", async () => {
    const put = vi.spyOn(localBackend, "putImage");
    await render({ from: 0, multiple: true });
    drop(Array.from({ length: 10 }, (_, i) => png(i)));
    await settle();

    expect(put).toHaveBeenCalledTimes(10);
    const frames = useOnstage.getState().frames;
    expect(frames).toHaveLength(10);
    expect(frames.every((f) => imageIdFromRef(f.screenshot))).toBe(true);
    expect(host.querySelector('[role="alert"]')).toBeNull();
  });

  it("never stores more than the store takes, and says how many didn't fit", async () => {
    const put = vi.spyOn(localBackend, "putImage");
    await render({ from: 0, multiple: true });
    drop(Array.from({ length: 12 }, (_, i) => png(i)));
    await settle();

    expect(put).toHaveBeenCalledTimes(10);
    expect(useOnstage.getState().frames).toHaveLength(10);
    expect(host.querySelector('[role="alert"]')?.textContent).toBe(
      "The App Store takes 10 screenshots per device, so the last 2 weren't added.",
    );
  });

  it("a single-image target stores only the first file", async () => {
    const put = vi.spyOn(localBackend, "putImage");
    await render({ from: 0 });
    drop([png(1), png(2), png(3)]);
    await settle();
    expect(put).toHaveBeenCalledTimes(1);
  });

  it("shows a storage failure where the file was dropped, and autosave doesn't erase it", async () => {
    const real = localBackend.putImage;
    vi.spyOn(localBackend, "putImage")
      .mockImplementationOnce(real)
      .mockImplementationOnce(async () => {
        throw new Error("This browser is out of storage space, so Onstage couldn't store the screenshot.");
      })
      .mockImplementation(real);
    await render({ from: 0, multiple: true });
    drop([png(1), png(2), png(3)]);
    await settle(600); // past the 400 ms autosave the placed files trigger

    const alert = host.querySelector('[role="alert"]');
    expect(alert?.textContent).toMatch(/1 of 3 screenshots couldn't be stored — This browser is out of storage space/);
    // The two that were stored land side by side — no hole where the
    // failed one would have gone (a later drop could never reach it).
    const shots = useOnstage.getState().frames.slice(0, 3).map((f) => f.screenshot);
    expect(imageIdFromRef(shots[0])).not.toBeNull();
    expect(imageIdFromRef(shots[1])).not.toBeNull();
    expect(shots[2]).toBeNull();
    expect(useOnstage.getState().saveState).toBe("saved");
  });

  it("drops the Blobs if the set changed while they were stored", async () => {
    const real = localBackend.putImage;
    const created: string[] = [];
    vi.spyOn(localBackend, "putImage").mockImplementation(async (blob) => {
      const id = await real(blob);
      created.push(id);
      useOnstage.setState({ setId: "another-set" });
      return id;
    });
    const before = useOnstage.getState().frames;
    await render({ from: 0 });
    drop([png(1)]);
    await settle();

    expect(useOnstage.getState().frames).toBe(before);
    expect(created).toHaveLength(1);
    expect(await localBackend.getImage(created[0])).toBeNull();
  });
});

/* ── S3.3: the store's own limit, checked files, undo (GAP-1, SCREENSB-9) ── */

const frames = () => useOnstage.getState().frames;
const alertText = () => host.querySelector('[role="alert"]')?.textContent ?? null;
/** Set the open set's frames without leaving an undo step behind. */
function useFrames(next: ReturnType<typeof frames>) {
  useOnstage.setState({ frames: next });
  useOnstage.temporal.getState().clear();
}
/** Measure every file as a real screenshot except the ones named here. */
function measureAs(sizes: Record<string, { w: number; h: number }>) {
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(async (blob: File) => {
      const size = sizes[blob.name] ?? { w: 1320, h: 2868 };
      return { width: size.w, height: size.h, close() {} };
    }),
  );
}

describe("DropZone — each store's limit (GAP-1)", () => {
  it("fills a Google Play set up to its 8 and says how many didn't fit", async () => {
    useOnstage.setState({ store: "play" });
    const put = vi.spyOn(localBackend, "putImage");
    await render({ from: 0, multiple: true });
    drop(Array.from({ length: 10 }, (_, i) => png(i)));
    await settle();

    expect(put).toHaveBeenCalledTimes(8);
    expect(frames()).toHaveLength(8);
    expect(frames().every((f) => imageIdFromRef(f.screenshot))).toBe(true);
    expect(alertText()).toBe("Google Play takes 8 screenshots per device, so the last 2 weren't added.");
  });

  it("a drop past a full App Store set stores nothing and says none were added", async () => {
    useFrames(Array.from({ length: 10 }, (_, i) => frame({ caption: `F${i}` })));
    const before = frames();
    const put = vi.spyOn(localBackend, "putImage");
    await render({ from: 10, multiple: true });
    drop([png(1), png(2), png(3)]);
    await settle();

    expect(put).not.toHaveBeenCalled();
    expect(frames()).toBe(before);
    expect(alertText()).toBe("The App Store takes 10 screenshots per device, so the last 3 weren't added.");
  });

  it("dropping from the middle fills to the limit from there", async () => {
    const put = vi.spyOn(localBackend, "putImage");
    await render({ from: 3, multiple: true });
    drop(Array.from({ length: 9 }, (_, i) => png(i)));
    await settle();

    // Frames 3…9: seven files land, two don't.
    expect(put).toHaveBeenCalledTimes(7);
    expect(frames()).toHaveLength(10);
    expect(frames().slice(0, 3).every((f) => f.screenshot === null)).toBe(true);
    expect(frames().slice(3).every((f) => imageIdFromRef(f.screenshot))).toBe(true);
    expect(alertText()).toBe("The App Store takes 10 screenshots per device, so the last 2 weren't added.");
  });

  it("new frames take the last frame's look, with a placeholder headline", async () => {
    const last = { caption: "Last one", bg: "moss", tiltX: 7, tiltY: -12, depth: 33, scale: 0.9 };
    useFrames([
      frame({ caption: "One", bg: "dusk", tiltX: 3 }),
      frame({ caption: "Two", bg: "ink" }),
      frame(last),
    ]);
    await render({ from: 0, multiple: true });
    drop(Array.from({ length: 6 }, (_, i) => png(i)));
    await settle();

    const now = frames();
    expect(now).toHaveLength(6);
    expect(now.slice(0, 3).map((f) => f.caption)).toEqual(["One", "Two", "Last one"]);
    expect(now[0]).toMatchObject({ bg: "dusk", tiltX: 3 });
    for (const added of now.slice(3)) {
      expect(added).toEqual({
        caption: "New headline",
        bg: "moss",
        tiltX: 7,
        tiltY: -12,
        depth: 33,
        scale: 0.9,
        screenshot: expect.stringMatching(/^img:/),
      });
    }
    // Each file on its own frame, in the order dropped.
    expect(new Set(now.map((f) => f.screenshot)).size).toBe(6);
  });

  it("a drop that grows the set is one undo step, and undo keeps the stored Blobs (D1)", async () => {
    const before = frames();
    useOnstage.temporal.getState().clear();
    await render({ from: 0, multiple: true });
    drop(Array.from({ length: 7 }, (_, i) => png(i)));
    await settle();

    const grown = frames();
    expect(grown).toHaveLength(7);
    const ids = grown.map((f) => imageIdFromRef(f.screenshot));
    expect(ids.every(Boolean)).toBe(true);
    expect(useOnstage.temporal.getState().pastStates).toHaveLength(1);

    act(() => useOnstage.getState().undo());
    expect(frames()).toEqual(before);
    expect(frames()).toHaveLength(5);
    expect(frames().every((f) => f.screenshot === null)).toBe(true);
    expect(useOnstage.getState().active).toBeLessThan(5);
    await settle();
    for (const id of ids) expect(await localBackend.getImage(id!)).not.toBeNull();

    act(() => useOnstage.getState().redo());
    expect(frames().map((f) => f.screenshot)).toEqual(grown.map((f) => f.screenshot));
  });
});

describe("DropZone — checked before stored (SCREENSB-9)", () => {
  it("a file of the wrong type says why and isn't stored; the good ones land", async () => {
    const put = vi.spyOn(localBackend, "putImage");
    await render({ from: 0, multiple: true });
    const heic = new File([new Uint8Array([1, 2, 3])], "IMG_0001.heic", { type: "image/heic" });
    drop([png(1), heic, png(2)]);
    await settle();

    expect(put).toHaveBeenCalledTimes(2);
    expect(put.mock.calls.map(([blob]) => (blob as File).name)).toEqual(["1.png", "2.png"]);
    expect(imageIdFromRef(frames()[0].screenshot)).not.toBeNull();
    expect(imageIdFromRef(frames()[1].screenshot)).not.toBeNull();
    expect(frames()[2].screenshot).toBeNull();
    expect(frames()).toHaveLength(5);
    expect(alertText()).toBe('"IMG_0001.heic" isn\'t a PNG, JPEG or WebP.');
  });

  it("an image that's too small says its size", async () => {
    measureAs({ "small.png": { w: 400, h: 800 } });
    const small = new File([new Uint8Array([9])], "small.png", { type: "image/png" });
    const put = vi.spyOn(localBackend, "putImage");
    await render({ from: 1 });
    drop([small]);
    await settle();

    expect(put).not.toHaveBeenCalled();
    expect(frames()[1].screenshot).toBeNull();
    expect(alertText()).toBe(
      '"small.png" is 400 × 800 — screenshots need at least 600 px on the short side.',
    );
  });

  it("an undecodable file says so", async () => {
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => {
        throw new DOMException("The source image could not be decoded.", "InvalidStateError");
      }),
    );
    const put = vi.spyOn(localBackend, "putImage");
    await render({ from: 0 });
    drop([png(1)]);
    await settle();

    expect(put).not.toHaveBeenCalled();
    expect(alertText()).toBe('"1.png" couldn\'t be read as an image.');
  });

  it("several turned away are each named with their own reason", async () => {
    measureAs({ "3.png": { w: 300, h: 300 } });
    const gif = new File([new Uint8Array([1])], "loop.gif", { type: "image/gif" });
    await render({ from: 0, multiple: true });
    drop([gif, png(1), png(3)]);
    await settle();

    expect(imageIdFromRef(frames()[0].screenshot)).not.toBeNull();
    expect(frames()[1].screenshot).toBeNull();
    expect(alertText()).toBe(
      '"loop.gif" isn\'t a PNG, JPEG or WebP; "3.png" is 300 × 300 — screenshots need at least 600 px on the short side.',
    );
  });

  it("rejected files don't use up the store's limit", async () => {
    useOnstage.setState({ store: "play" });
    const put = vi.spyOn(localBackend, "putImage");
    await render({ from: 0, multiple: true });
    const bad = Array.from(
      { length: 4 },
      (_, i) => new File([new Uint8Array([i])], `${i}.tiff`, { type: "image/tiff" }),
    );
    drop([...bad, ...Array.from({ length: 8 }, (_, i) => png(i))]);
    await settle();

    expect(put).toHaveBeenCalledTimes(8);
    expect(frames()).toHaveLength(8);
    // The first three by name, then a count.
    expect(alertText()).toBe(
      '"0.tiff" isn\'t a PNG, JPEG or WebP; "1.tiff" isn\'t a PNG, JPEG or WebP; "2.tiff" isn\'t a PNG, JPEG or WebP; and 1 more weren\'t added.',
    );
  });

  it("a fresh drop clears the last drop's message", async () => {
    await render({ from: 0, multiple: true });
    drop([new File([new Uint8Array([1])], "x.gif", { type: "image/gif" })]);
    await settle();
    expect(alertText()).not.toBeNull();

    drop([png(1)]);
    await settle();
    expect(alertText()).toBeNull();
  });

  it("only offers the types it takes in the file picker", async () => {
    await render({ from: 0, multiple: true });
    const input = host.querySelector<HTMLInputElement>('input[type="file"]')!;
    expect(input.getAttribute("accept")).toBe("image/png,image/jpeg,image/webp");
    expect(input.multiple).toBe(true);

    await render({ from: 0 });
    expect(host.querySelector<HTMLInputElement>('input[type="file"]')!.multiple).toBe(false);
  });

  it("files picked in the file picker go through the same checks", async () => {
    const put = vi.spyOn(localBackend, "putImage");
    await render({ from: 0, multiple: true });
    const input = host.querySelector<HTMLInputElement>('input[type="file"]')!;
    const picked = [png(1), new File([new Uint8Array([1])], "x.gif", { type: "image/gif" })];
    Object.defineProperty(input, "files", { value: picked, configurable: true });
    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await settle();

    expect(put).toHaveBeenCalledTimes(1);
    expect(imageIdFromRef(frames()[0].screenshot)).not.toBeNull();
    expect(alertText()).toBe('"x.gif" isn\'t a PNG, JPEG or WebP.');
  });
});

describe("DropZone — onPlaced", () => {
  it("hears each landed file's ref and name, in order", async () => {
    const onPlaced = vi.fn();
    await render({ from: 0, multiple: true, onPlaced });
    const [a, b, c] = ["a.png", "b.png", "c.png"].map(
      (name, i) => new File([new Uint8Array([0x89, i])], name, { type: "image/png" }),
    );
    drop([a, b, c]);
    await settle();

    expect(onPlaced).toHaveBeenCalledTimes(1);
    const shots = frames().slice(0, 3).map((f) => f.screenshot);
    expect(onPlaced.mock.calls[0][0]).toEqual([
      { ref: shots[0], name: "a.png" },
      { ref: shots[1], name: "b.png" },
      { ref: shots[2], name: "c.png" },
    ]);
  });

  it("leaves out files that were turned away, failed to store, or didn't fit", async () => {
    useOnstage.setState({ store: "play" });
    useFrames(Array.from({ length: 6 }, (_, i) => frame({ caption: `F${i}` })));
    measureAs({ "tiny.png": { w: 100, h: 100 } });
    const real = localBackend.putImage;
    vi.spyOn(localBackend, "putImage").mockImplementation(async (blob) => {
      if ((blob as File).name === "fails.png") throw new Error("Out of space.");
      return real(blob);
    });
    const onPlaced = vi.fn();
    await render({ from: 5, multiple: true, onPlaced });
    const named = (name: string) => new File([new Uint8Array([1])], name, { type: "image/png" });
    drop([named("tiny.png"), named("one.png"), named("fails.png"), named("two.png"), named("extra.png")]);
    await settle();

    // Room for 3 on a 6-frame Play set from frame 5. "fails.png" can't be
    // stored, so "extra.png" takes its place; nothing is left out for room.
    expect(onPlaced).toHaveBeenCalledTimes(1);
    const placed = onPlaced.mock.calls[0][0] as { ref: string; name: string }[];
    expect(placed.map((p) => p.name)).toEqual(["one.png", "two.png", "extra.png"]);
    expect(frames()).toHaveLength(8);
    expect(frames().slice(5).map((f) => f.screenshot)).toEqual(placed.map((p) => p.ref));
    expect(alertText()).not.toMatch(/takes 8 screenshots/);
  });

  it("isn't called when nothing landed", async () => {
    const onPlaced = vi.fn();
    await render({ from: 0, multiple: true, onPlaced });
    drop([new File([new Uint8Array([1])], "x.gif", { type: "image/gif" })]);
    await settle();
    expect(onPlaced).not.toHaveBeenCalled();
  });
});

describe("setScreenshots (store)", () => {
  const refs = (...names: (string | null)[]) => names.map((n) => (n === null ? null : `img:${n}`));

  it("sets each frame from `from` on; a null leaves that frame as it was", () => {
    useFrames(Array.from({ length: 5 }, (_, i) => frame({ caption: `F${i}`, screenshot: `img:old${i}` })));
    useOnstage.getState().setScreenshots(1, refs("a", null, "c"));
    expect(frames().map((f) => f.screenshot)).toEqual(["img:old0", "img:a", "img:old2", "img:c", "img:old4"]);
  });

  it("past the end, a null makes no frame: the next screenshot takes the next new one", () => {
    useFrames(Array.from({ length: 5 }, (_, i) => frame({ caption: `F${i}` })));
    useOnstage.getState().setScreenshots(5, refs("a", null, "b"));

    expect(frames()).toHaveLength(7);
    expect(frames().map((f) => f.screenshot)).toEqual([null, null, null, null, null, "img:a", "img:b"]);
  });

  it("nulls alone never add frames", () => {
    useFrames(Array.from({ length: 5 }, (_, i) => frame({ caption: `F${i}` })));
    useOnstage.getState().setScreenshots(5, refs(null, null, null));
    expect(frames()).toHaveLength(5);
  });

  it("grows up to the App Store's 10, never past it", () => {
    useFrames(Array.from({ length: 5 }, (_, i) => frame({ caption: `F${i}` })));
    useOnstage.getState().setScreenshots(0, refs(...Array.from({ length: 12 }, (_, i) => `s${i}`)));

    expect(frames()).toHaveLength(10);
    expect(frames().map((f) => f.screenshot)).toEqual(refs(...Array.from({ length: 10 }, (_, i) => `s${i}`)));
  });

  it("a full 10-frame Play set takes nothing more at the end (cap = max(10, 8))", () => {
    useOnstage.setState({ store: "play" });
    useFrames(Array.from({ length: 10 }, (_, i) => frame({ caption: `F${i}` })));
    useOnstage.getState().setScreenshots(10, refs("x", "y"));
    expect(frames()).toHaveLength(10);
    expect(frames().every((f) => f.screenshot === null)).toBe(true);

    useOnstage.getState().setScreenshots(8, refs("x", "y", "z"));
    expect(frames()).toHaveLength(10);
    expect(frames().slice(8).map((f) => f.screenshot)).toEqual(["img:x", "img:y"]);
  });

  it("never removes frames from a set already past its store's limit", () => {
    useOnstage.setState({ store: "play" });
    const ten = Array.from({ length: 10 }, (_, i) => frame({ caption: `F${i}` }));
    useFrames(ten);
    useOnstage.getState().setScreenshots(0, refs("a", "b", "c"));

    expect(frames()).toHaveLength(10);
    expect(frames().map((f) => f.caption)).toEqual(ten.map((f) => f.caption));
    expect(frames().slice(0, 3).map((f) => f.screenshot)).toEqual(refs("a", "b", "c"));
  });

  it("a Play set grows to 8", () => {
    useOnstage.setState({ store: "play" });
    useFrames([frame({ caption: "Only" })]);
    useOnstage.getState().setScreenshots(0, refs(...Array.from({ length: 9 }, (_, i) => `s${i}`)));
    expect(frames()).toHaveLength(8);
  });

  it("new frames copy the last frame's look with the placeholder headline", () => {
    useFrames([
      frame({ caption: "First", bg: "dusk" }),
      frame({ caption: "Last", bg: "moss", tiltX: 4, tiltY: -9, depth: 21, scale: 1.1, screenshot: "img:kept" }),
    ]);
    useOnstage.getState().setScreenshots(2, refs("n"));
    expect(frames()[2]).toEqual({
      caption: "New headline",
      bg: "moss",
      tiltX: 4,
      tiltY: -9,
      depth: 21,
      scale: 1.1,
      screenshot: "img:n",
    });
    expect(frames()[1].screenshot).toBe("img:kept");
  });

  it("one call is one undo step, however many frames it adds", () => {
    useFrames(Array.from({ length: 5 }, (_, i) => frame({ caption: `F${i}` })));
    const before = frames();
    useOnstage.getState().setScreenshots(3, refs("a", "b", "c", "d", "e"));
    expect(frames()).toHaveLength(8);
    expect(useOnstage.temporal.getState().pastStates).toHaveLength(1);

    useOnstage.getState().undo();
    expect(frames()).toEqual(before);
  });

  it("all-null refs record no undo step", () => {
    useFrames(Array.from({ length: 5 }, (_, i) => frame({ caption: `F${i}` })));
    useOnstage.getState().setScreenshots(0, refs(null, null));
    expect(useOnstage.temporal.getState().pastStates).toHaveLength(0);
  });
});

describe("DropZone — the frames are checked again once the files are stored (S3.3 review)", () => {
  it("the store switched to Play while storing: only Play's 8 land, the rest are removed and reported", async () => {
    const real = localBackend.putImage;
    const created: string[] = [];
    vi.spyOn(localBackend, "putImage").mockImplementation(async (blob) => {
      const id = await real(blob);
      created.push(id);
      useOnstage.setState({ store: "play" });
      return id;
    });
    await render({ from: 0, multiple: true });
    drop(Array.from({ length: 10 }, (_, i) => png(i)));
    await settle(200);

    expect(created).toHaveLength(10);
    expect(frames()).toHaveLength(8);
    expect(alertText()).toBe("Google Play takes 8 screenshots per device, so the last 2 weren't added.");
    // The two that found no frame are gone from storage.
    const kept = frames().map((f) => imageIdFromRef(f.screenshot));
    const dropped = created.filter((id) => !kept.includes(id));
    expect(dropped).toHaveLength(2);
    for (const id of dropped) expect(await localBackend.getImage(id)).toBeNull();
  });

  it("a single-image target whose frame went away meanwhile places nothing and keeps nothing", async () => {
    const real = localBackend.putImage;
    const created: string[] = [];
    vi.spyOn(localBackend, "putImage").mockImplementation(async (blob) => {
      const id = await real(blob);
      created.push(id);
      useOnstage.setState({ frames: useOnstage.getState().frames.slice(0, 4) });
      return id;
    });
    await render({ from: 4 });
    drop([png(1)]);
    await settle();

    expect(frames()).toHaveLength(4);
    expect(frames().every((f) => f.screenshot === null)).toBe(true);
    expect(created).toHaveLength(1);
    expect(await localBackend.getImage(created[0])).toBeNull();
  });
});
