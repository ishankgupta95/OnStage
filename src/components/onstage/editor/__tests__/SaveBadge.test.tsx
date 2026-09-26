import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { localBackend } from "@/lib/data/local";
import { openSet, useOnstage } from "@/store/onstage";
import { SaveBadge } from "../SaveBadge";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let host: HTMLDivElement;
let n = 0;

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  await openSet(`badge-${++n}`);
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => root.render(<SaveBadge />));
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("SaveBadge", () => {
  it("reads SAVING… then SAVED", async () => {
    await act(async () => useOnstage.getState().patchFrame({ caption: "Edit" }));
    expect(host.textContent).toBe("SAVING…");
    await act(() => vi.advanceTimersByTimeAsync(400));
    expect(host.textContent).toBe("SAVED");
  });

  it("says why a save failed, keeps the edit on screen and the stored copy as it was", async () => {
    await act(async () => useOnstage.getState().patchFrame({ caption: "Stored" }));
    await act(() => vi.advanceTimersByTimeAsync(400));
    const stored = localStorage.getItem("onstage:set-docs:v1");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("refused", "QuotaExceededError");
    });

    await act(async () => useOnstage.getState().patchFrame({ caption: "Not stored" }));
    await act(() => vi.advanceTimersByTimeAsync(400));

    expect(host.textContent).toBe("Couldn't save — This browser's storage is full.");
    expect(host.firstElementChild?.getAttribute("title")).toBe("Couldn't save — This browser's storage is full.");
    expect(useOnstage.getState().frames[0].caption).toBe("Not stored"); // no silent revert
    vi.restoreAllMocks();
    expect(localStorage.getItem("onstage:set-docs:v1")).toBe(stored);
  });

  it("clears the error once a later save succeeds", async () => {
    vi.spyOn(localBackend, "saveSetDoc").mockRejectedValueOnce(new Error("This browser's storage is full."));
    await act(async () => useOnstage.getState().patchFrame({ caption: "One" }));
    await act(() => vi.advanceTimersByTimeAsync(400));
    expect(host.textContent).toMatch(/^Couldn't save/);
    await act(async () => useOnstage.getState().patchFrame({ caption: "Two" }));
    await act(() => vi.advanceTimersByTimeAsync(400));
    expect(host.textContent).toBe("SAVED");
  });
});
