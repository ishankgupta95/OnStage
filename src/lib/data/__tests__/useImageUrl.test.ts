import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { localBackend } from "../local";
import { acquireImageUrl, peekImageUrl, releaseImageUrl, useImageUrl } from "../useImageUrl";
import { resetImageDb } from "./helpers";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const tick = () => new Promise((r) => setTimeout(r, 0));
/** Let the backend read and the deferred revoke run. */
const settle = async () => {
  for (let i = 0; i < 5; i++) await act(tick);
};

let root: Root;
let host: HTMLDivElement;

beforeEach(async () => {
  await resetImageDb();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(async () => {
  act(() => root.unmount());
  host.remove();
  // Let every deferred revoke from this test run before the next one spies.
  await new Promise((r) => setTimeout(r, 5));
  vi.restoreAllMocks();
});

function Probe({ shot, seen }: { shot: string | null; seen: (url: string | null) => void }) {
  seen(useImageUrl(shot));
  return null;
}

async function stored(bytes = [1, 2, 3]) {
  const id = await localBackend.putImage(new Blob([new Uint8Array(bytes)], { type: "image/png" }));
  return { id, ref: `img:${id}` };
}

describe("useImageUrl", () => {
  it("passes data: URLs and plain URLs through, and null stays null", async () => {
    const seen: (string | null)[] = [];
    const data = "data:image/png;base64,AAAA";
    await act(async () => root.render(createElement(Probe, { shot: data, seen: (u) => seen.push(u) })));
    expect(seen.at(-1)).toBe(data);
    await act(async () => root.render(createElement(Probe, { shot: null, seen: (u) => seen.push(u) })));
    expect(seen.at(-1)).toBeNull();
  });

  it("resolves an img: ref to one shared object URL, revoked when the last viewer goes", async () => {
    const { ref } = await stored();
    const create = vi.spyOn(URL, "createObjectURL");
    const revoke = vi.spyOn(URL, "revokeObjectURL");
    const read = vi.spyOn(localBackend, "getImage");
    const a: (string | null)[] = [];
    const b: (string | null)[] = [];

    const both = () =>
      createElement("div", null, [
        createElement(Probe, { key: "a", shot: ref, seen: (u) => a.push(u) }),
        createElement(Probe, { key: "b", shot: ref, seen: (u) => b.push(u) }),
      ]);
    await act(async () => root.render(both()));
    await settle();

    const url = a.at(-1);
    expect(url).toMatch(/^blob:/);
    expect(b.at(-1)).toBe(url);
    expect(read).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledTimes(1);

    // One viewer leaves: the URL stays.
    await act(async () =>
      root.render(createElement("div", null, [createElement(Probe, { key: "a", shot: ref, seen: (u) => a.push(u) })])),
    );
    await settle();
    expect(revoke).not.toHaveBeenCalled();
    expect(a.at(-1)).toBe(url);

    // The last one leaves: revoked.
    await act(async () => root.render(createElement("div")));
    await settle();
    expect(revoke).toHaveBeenCalledWith(url);
  });

  it("shows nothing for a ref whose image is missing", async () => {
    const seen: (string | null)[] = [];
    await act(async () => root.render(createElement(Probe, { shot: "img:missing", seen: (u) => seen.push(u) })));
    await settle();
    expect(seen.at(-1)).toBeNull();
  });
});

describe("the object-URL cache", () => {
  it("creates nothing if released before the read finishes", async () => {
    const { id } = await stored();
    const create = vi.spyOn(URL, "createObjectURL");
    const onChange = vi.fn();
    acquireImageUrl(id, onChange);
    releaseImageUrl(id, onChange);
    await tick();
    await new Promise((r) => setTimeout(r, 20));
    expect(create).not.toHaveBeenCalled();
    expect(peekImageUrl(id)).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("reads again for a viewer that arrives after a dropped read", async () => {
    const { id } = await stored();
    const read = vi.spyOn(localBackend, "getImage");
    const first = vi.fn();
    acquireImageUrl(id, first);
    releaseImageUrl(id, first);
    // The read lands while nobody is watching, but before the deferred cleanup.
    await vi.waitFor(() => expect(read).toHaveBeenCalledTimes(1));
    await Promise.resolve();
    const second = vi.fn();
    acquireImageUrl(id, second);
    await vi.waitFor(() => expect(peekImageUrl(id)).toMatch(/^blob:/));
    expect(second).toHaveBeenCalled();
    releaseImageUrl(id, second);
    await tick();
  });

  it("retries a failed read while the picture is still on screen", async () => {
    const { id } = await stored();
    const real = localBackend.getImage;
    const read = vi
      .spyOn(localBackend, "getImage")
      .mockImplementationOnce(async () => {
        throw new Error("transient");
      })
      .mockImplementation(real);
    const viewer = vi.fn();
    acquireImageUrl(id, viewer);
    await vi.waitFor(() => expect(peekImageUrl(id)).toMatch(/^blob:/), { timeout: 2000 });
    expect(read).toHaveBeenCalledTimes(2);
    expect(viewer).toHaveBeenCalled();
    releaseImageUrl(id, viewer);
    await tick();
  });

  it("reuses the URL when re-acquired before the deferred revoke", async () => {
    const { id } = await stored();
    const revoke = vi.spyOn(URL, "revokeObjectURL");
    const first = vi.fn();
    acquireImageUrl(id, first);
    await vi.waitFor(() => expect(peekImageUrl(id)).not.toBeNull());
    const url = peekImageUrl(id);
    releaseImageUrl(id, first);
    const second = vi.fn();
    acquireImageUrl(id, second); // same task, e.g. StrictMode's re-subscribe
    await tick();
    expect(revoke).not.toHaveBeenCalled();
    expect(peekImageUrl(id)).toBe(url);
    releaseImageUrl(id, second);
    await tick();
    expect(revoke).toHaveBeenCalledWith(url);
    expect(peekImageUrl(id)).toBeNull();
  });
});
