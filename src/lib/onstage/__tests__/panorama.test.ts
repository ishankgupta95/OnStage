import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { frame } from "@/lib/data/__tests__/helpers";
import { panoramaSlice } from "../panorama";

/**
 * Plan S3.2: one function says how a panoramic set is sliced — frame `i` of
 * `n` shows its share of a background `n` frames wide — and the canvas and
 * the template page both draw with it.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const positions = (n: number) => Array.from({ length: n }, (_, i) => panoramaSlice(i, n).position);

describe("panoramaSlice", () => {
  it("sizes the background n frames wide and one frame tall", () => {
    for (let n = 1; n <= 9; n++) {
      for (let i = 0; i < n; i++) {
        expect(panoramaSlice(i, n).size).toBe(`${n * 100}% 100%`);
      }
    }
  });

  it("spreads positions evenly from 0% to 100%, vertically centred", () => {
    expect(positions(5)).toEqual(["0% 50%", "25% 50%", "50% 50%", "75% 50%", "100% 50%"]);
    expect(positions(3)).toEqual(["0% 50%", "50% 50%", "100% 50%"]);
    expect(positions(2)).toEqual(["0% 50%", "100% 50%"]);
    for (let n = 2; n <= 9; n++) {
      const xs = positions(n).map((p) => {
        const [x, y] = p.split(" ");
        expect(y).toBe("50%");
        return parseFloat(x);
      });
      expect(xs[0]).toBe(0);
      expect(xs[n - 1]).toBe(100);
      xs.forEach((x, i) => expect(x).toBeCloseTo((i / (n - 1)) * 100, 10));
    }
  });

  it("a one-frame set shows the background from its left edge", () => {
    expect(panoramaSlice(0, 1)).toEqual({ size: "100% 100%", position: "0% 50%" });
  });
});

describe("CanvasStage — draws a panoramic set with panoramaSlice", () => {
  let root: Root;
  let host: HTMLDivElement;

  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });
  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  /** Each frame's artboard: the element that paints the frame's background,
   *  found as the parent of its caption. */
  const artboards = () =>
    [...host.querySelectorAll<HTMLElement>("div")]
      .filter((el) => /^Frame \d+$/.test(el.textContent ?? "") && el.children.length === 0)
      .map((caption) => caption.parentElement!);

  async function render(n: number, panorama: boolean) {
    const { useOnstage } = await import("@/store/onstage");
    const { CanvasStage } = await import("@/components/onstage/editor/CanvasStage");
    useOnstage.setState({
      frames: Array.from({ length: n }, (_, i) => frame({ caption: `Frame ${i + 1}`, bg: i === 0 ? "moss" : "ember" })),
      active: 0,
      panorama,
    });
    await act(async () => root.render(createElement(CanvasStage)));
  }

  it.each([3, 4, 5])("with panorama on, frame i of %i gets panoramaSlice(i, n)", async (n) => {
    await render(n, true);
    const boards = artboards();
    expect(boards).toHaveLength(n);
    expect(boards.map((el) => el.children[0].textContent)).toEqual(Array.from({ length: n }, (_, i) => `Frame ${i + 1}`));
    boards.forEach((el, i) => {
      const slice = panoramaSlice(i, n);
      expect(el.style.backgroundImage.startsWith("linear-gradient")).toBe(true);
      expect(el.style.backgroundSize).toBe(slice.size);
      expect(el.style.backgroundPosition).toBe(slice.position);
    });
    expect(boards[0].style.backgroundSize).toBe(`${n * 100}% 100%`);
    expect(boards[0].style.backgroundPosition).toBe("0% 50%");
    expect(boards[n - 1].style.backgroundPosition).toBe("100% 50%");
    // One background across the set: every frame paints the first frame's.
    expect(new Set(boards.map((el) => el.style.backgroundImage)).size).toBe(1);
  });

  it("with panorama off, every frame shows its whole background", async () => {
    await render(3, false);
    const boards = artboards();
    expect(boards).toHaveLength(3);
    for (const el of boards) {
      expect(el.style.backgroundSize).toBe("100% 100%");
      expect(el.style.backgroundPosition).toBe("50% 50%");
    }
  });
});
