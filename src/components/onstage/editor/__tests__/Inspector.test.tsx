import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getBackend } from "@/lib/data/backend";
import { s } from "@/lib/onstage/css";
import { MAX_BYTES } from "@/lib/onstage/readImageFile";
import { openSet, useOnstage } from "@/store/onstage";
import { Inspector } from "../Inspector";

/**
 * S3.2: the Inspector claims nothing it can't back up. The caption meta
 * counts characters but no longer says the headline "fits" (nothing measures
 * the wrap yet), the device panel points at the real tilt control, and the
 * footer names no brand kit (nothing records which kit a set uses) — only
 * the way to the kits.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Sel = "caption" | "device" | "bg" | null;

let root: Root;
let host: HTMLDivElement;
let n = 0;

beforeEach(async () => {
  // Autosave is debounced on setTimeout; keep it from firing after a test.
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  // A loaded document (an unknown id opens the default cut).
  await openSet(`inspector-${++n}`);
  useOnstage.setState({ active: 0, sel: "caption", pop: null });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

async function mount(sel: Sel, active = 0) {
  useOnstage.setState({ sel, active });
  await act(async () => root.render(<Inspector />));
}

const text = () => host.textContent ?? "";

/** The caption panel's meta line: the row under the HEADLINE textarea. */
function captionMeta(): HTMLElement {
  const area = host.querySelector("textarea");
  expect(area).not.toBeNull();
  const meta = area!.nextElementSibling as HTMLElement | null;
  expect(meta).not.toBeNull();
  return meta!;
}

/** The footer row that starts with "Brand kit". */
function brandRow(): HTMLElement {
  const label = [...host.querySelectorAll("span")].find((el) => el.textContent?.trim() === "Brand kit");
  expect(label).toBeDefined();
  return label!.parentElement as HTMLElement;
}

// The retired footer's fixed "Trailhead" swatches, in the forms jsdom may
// report an inline colour.
const SWATCHES = [
  ["#1b6f6a", "rgb(27, 111, 106)"],
  ["#134f63", "rgb(19, 79, 99)"],
  ["#f0efe9", "rgb(240, 239, 233)"],
].flat();

/** Every element whose inline background is exactly one solid swatch colour. */
function solidSwatches(scope: ParentNode): HTMLElement[] {
  return [...scope.querySelectorAll<HTMLElement>("*")].filter((el) => {
    const values = [el.style.background, el.style.backgroundColor].map((v) => v.trim().toLowerCase());
    return values.some((v) => SWATCHES.includes(v));
  });
}

describe("Inspector — caption meta", () => {
  it("counts the active frame's characters and makes no fit claim", async () => {
    await mount("caption");
    const caption = useOnstage.getState().frames[0].caption;
    expect(caption.length).toBeGreaterThan(0);

    const meta = captionMeta();
    expect(meta.textContent?.trim()).toBe(`${caption.length} chars`);
    expect(text()).not.toMatch(/fits/i);
    expect(text()).not.toContain("6.9″");
    expect(text()).not.toContain("6.5″");
  });

  it("reads the frame that is active, not the first one", async () => {
    await act(async () => {
      useOnstage.getState().patchFrame({ caption: "x" });
    });
    await mount("caption", 2);
    const { frames } = useOnstage.getState();
    expect(frames[2].caption.length).not.toBe(1);
    expect(captionMeta().textContent?.trim()).toBe(`${frames[2].caption.length} chars`);
  });

  it("follows the caption as it is typed", async () => {
    await mount("caption");
    await act(async () => {
      useOnstage.getState().typeCaption("Run further");
    });
    expect(captionMeta().textContent?.trim()).toBe("11 chars");
    expect(text()).not.toMatch(/fits/i);

    await act(async () => {
      useOnstage.getState().typeCaption("");
    });
    expect(captionMeta().textContent?.trim()).toBe("0 chars");
  });
});

describe("Inspector — device panel", () => {
  it("points at the Perspective control's tilt pad and presets, not a handle on the phone", async () => {
    await mount("device");
    expect(text()).toContain("Open Perspective above to drag the tilt pad or pick a preset.");
    expect(text()).not.toContain("drag the handle");
    expect(text()).not.toContain("Tilt lives on the phone itself");
  });

  it("its Perspective button opens that popover", async () => {
    await mount("device");
    const button = [...host.querySelectorAll("button")].find((b) => b.textContent?.includes("tilt"));
    expect(button).toBeDefined();
    await act(async () => button!.click());
    expect(useOnstage.getState().pop).toBe("persp");
  });
});

/**
 * S3.3 / SCREENSB-9: the drop target's hint says what DropZone really checks —
 * PNG, JPEG or WebP, up to MAX_BYTES (20 MB) — not the design file's
 * "PNG up to 12 MB".
 */
describe("Inspector — device panel drop hint", () => {
  const HINT = "PNG, JPEG or WebP · up to 20 MB";

  /** The device panel's drop target: the role=button holding the drop copy. */
  function dropZone(): HTMLElement {
    const zone = [...host.querySelectorAll<HTMLElement>('[role="button"]')].find((el) =>
      /Drop a screen|Replace this screen/.test(el.textContent ?? ""),
    );
    expect(zone).toBeDefined();
    return zone!;
  }

  function drop(files: File[]) {
    const event = new Event("drop", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "dataTransfer", { value: { files } });
    dropZone().dispatchEvent(event);
  }

  /** Let the drop's checks and (mocked) store settle — microtasks only, as
   *  setTimeout is faked here. */
  async function until(done: () => boolean) {
    for (let i = 0; i < 200 && !done(); i++) {
      await act(async () => {
        await Promise.resolve();
      });
    }
    expect(done()).toBe(true);
  }

  const alertText = () => host.querySelector('[role="alert"]')?.textContent ?? null;
  const file = (bytes: number, name: string, type: string) => new File([new Uint8Array(bytes)], name, { type });

  beforeEach(() => {
    useOnstage.setState({
      frames: useOnstage.getState().frames.map((f) => ({ ...f, screenshot: null })),
    });
    // jsdom decodes no images: every file measures as a real 6.9″ screenshot.
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => ({ width: 1320, height: 2868, close() {} })),
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads 'PNG, JPEG or WebP · up to 20 MB', not 'PNG up to 12 MB'", async () => {
    await mount("device");
    const zone = dropZone();
    const hint = [...zone.querySelectorAll("div")].find((el) => el.textContent?.includes("MB"));
    expect(hint?.textContent?.trim()).toBe(HINT);
    expect(text()).toContain(HINT);
    expect(text()).not.toContain("PNG up to 12 MB");
    expect(text()).not.toContain("12 MB");
  });

  it("says the same once the frame has a screen to replace", async () => {
    useOnstage.getState().patchFrame({ screenshot: "img:already-here" });
    await mount("device");
    expect(dropZone().textContent).toContain("Replace this screen");
    expect(dropZone().textContent).toContain(HINT);
  });

  it("matches what the drop zone takes: its picker, its size limit", async () => {
    expect(MAX_BYTES).toBe(20 * 1024 * 1024);
    await mount("device");
    const input = dropZone().querySelector<HTMLInputElement>('input[type="file"]');
    expect(input?.accept.split(",").sort()).toEqual(["image/jpeg", "image/png", "image/webp"]);
  });

  it.each([
    ["a JPEG", "shot.jpg", "image/jpeg"],
    ["a WebP", "shot.webp", "image/webp"],
  ])("takes %s, as the hint says", async (_, name, type) => {
    const put = vi.spyOn(getBackend(), "putImage").mockResolvedValue("dropped-1");
    await mount("device");
    drop([file(64, name, type)]);
    await until(() => useOnstage.getState().frames[0].screenshot === "img:dropped-1");

    expect(put).toHaveBeenCalledTimes(1);
    expect(alertText()).toBeNull();
  });

  it("takes a file of exactly 20 MB ('up to' includes it)", async () => {
    const put = vi.spyOn(getBackend(), "putImage").mockResolvedValue("dropped-20");
    await mount("device");
    drop([file(20 * 1024 * 1024, "big.png", "image/png")]);
    await until(() => useOnstage.getState().frames[0].screenshot === "img:dropped-20");
    expect(put).toHaveBeenCalledTimes(1);
    expect(alertText()).toBeNull();
  });

  it("turns away a file over 20 MB and a GIF, naming the limit the hint states", async () => {
    const put = vi.spyOn(getBackend(), "putImage");
    await mount("device");

    drop([file(20 * 1024 * 1024 + 1, "huge.png", "image/png")]);
    await until(() => alertText() !== null);
    expect(alertText()).toBe('"huge.png" is over 20 MB.');

    drop([file(64, "anim.gif", "image/gif")]);
    await until(() => alertText()?.includes("anim.gif") ?? false);
    expect(alertText()).toBe('"anim.gif" isn\'t a PNG, JPEG or WebP.');

    expect(put).not.toHaveBeenCalled();
    expect(useOnstage.getState().frames[0].screenshot).toBeNull();
  });
});

describe("Inspector — a drop message belongs to its frame (S3.3 review)", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => ({ width: 400, height: 800, close() {} })),
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("a file turned away on one frame doesn't leave its message on the next frame's drop target", async () => {
    await mount("device", 0);
    const zone = [...host.querySelectorAll<HTMLElement>('[role="button"]')].find((el) =>
      (el.textContent ?? "").includes("Drop a screen"),
    )!;
    const event = new Event("drop", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "dataTransfer", {
      value: { files: [new File([new Uint8Array([1])], "small.png", { type: "image/png" })] },
    });
    await act(async () => {
      zone.dispatchEvent(event);
    });
    await vi.waitFor(() => expect(host.querySelector('[role="alert"]')?.textContent).toContain("small.png"));

    await act(async () => useOnstage.getState().select(1, "device"));
    expect(host.querySelector('[role="alert"]')).toBeNull();
  });
});

describe("Inspector — brand kit footer", () => {
  it("(the swatch check below would see the old footer's swatches)", async () => {
    // The removed markup, rendered the same way — so an empty result below
    // means "gone", not "the check can't see them".
    const probe = document.createElement("div");
    const probeRoot = createRoot(probe);
    await act(async () =>
      probeRoot.render(
        <span>
          <span style={s("width:9px;height:9px;border-radius:2px;background:#1b6f6a")} />
          <span style={s("width:9px;height:9px;border-radius:2px;background:#134f63")} />
          <span style={s("width:9px;height:9px;border-radius:2px;background:#f0efe9")} />
        </span>,
      ),
    );
    expect(solidSwatches(probe)).toHaveLength(3);
    act(() => probeRoot.unmount());
  });

  it.each<Sel>(["caption", "device", "bg", null])(
    "with %s selected, offers a way to the kits and names none",
    async (sel) => {
      await mount(sel);
      const row = brandRow();

      const links = [...row.querySelectorAll("a")];
      expect(links.map((a) => a.textContent?.trim())).toEqual(["Choose a kit"]);
      expect(links[0].getAttribute("href")).toBe("/brand");

      expect(text()).not.toContain("Trailhead");
      // No swatches at all in the footer row: nothing records a kit's colours.
      expect(
        [...row.querySelectorAll<HTMLElement>("*")].filter(
          (el) => el.style.background || el.style.backgroundColor,
        ),
      ).toEqual([]);
      // …and nowhere in the panel a solid swatch of the old fixed kit.
      expect(solidSwatches(host)).toEqual([]);
    },
  );
});
