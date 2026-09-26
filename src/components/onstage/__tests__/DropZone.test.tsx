import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { localBackend } from "@/lib/data/local";
import { imageIdFromRef } from "@/lib/data/imageRefs";
import { resetImageDb } from "@/lib/data/__tests__/helpers";
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
});

const render = (props: { from: number; multiple?: boolean }) =>
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

  it("never stores more files than there are frames to hold them", async () => {
    const put = vi.spyOn(localBackend, "putImage");
    await render({ from: 0, multiple: true });
    drop(Array.from({ length: 10 }, (_, i) => png(i)));
    await settle();

    expect(put).toHaveBeenCalledTimes(5);
    expect(useOnstage.getState().frames.every((f) => imageIdFromRef(f.screenshot))).toBe(true);
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
    const shots = useOnstage.getState().frames.slice(0, 3).map((f) => f.screenshot);
    expect(imageIdFromRef(shots[0])).not.toBeNull();
    expect(shots[1]).toBeNull(); // left as it was
    expect(imageIdFromRef(shots[2])).not.toBeNull();
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
