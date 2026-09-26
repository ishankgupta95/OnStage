import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SetDoc } from "@/lib/data/types";
import { doc, frame } from "@/lib/data/__tests__/helpers";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  vi.resetModules();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

async function mount() {
  const { useSetPreview } = await import("../useSetPreview");
  const store = await import("@/store/onstage");
  const seen: { captions: string[]; store: string; loading: boolean }[] = [];
  function Probe() {
    const p = useSetPreview();
    seen.push({ captions: p.frames.map((f) => f.caption), store: p.store, loading: p.loading });
    return null;
  }
  await act(async () => root.render(<Probe />));
  await act(() => new Promise((r) => setTimeout(r, 10)));
  return { seen, ...store };
}

const saved: SetDoc = doc([frame({ caption: "Mine one" }), frame({ caption: "Mine two" })], { store: "play" });

describe("useSetPreview", () => {
  it("shows the saved set without opening it when no set is loaded", async () => {
    localStorage.setItem("onstage:set-docs:v1", JSON.stringify({ "trailhead-69": saved }));
    const { seen, useOnstage } = await mount();
    expect(seen.at(-1)).toEqual({ captions: ["Mine one", "Mine two"], store: "play", loading: false });
    expect(useOnstage.getState().loadedSetId).toBeNull(); // read, not opened
    expect(useOnstage.getState().frames[0].caption).not.toBe("Mine one");
  });

  it("shows the open set as it is now when one is loaded", async () => {
    localStorage.setItem("onstage:set-docs:v1", JSON.stringify({ "trailhead-69": saved }));
    const store = await import("@/store/onstage");
    await store.openSet("trailhead-69");
    store.useOnstage.getState().patchFrame({ caption: "Unsaved edit" });
    const { seen } = await mount();
    expect(seen.at(-1)!.captions[0]).toBe("Unsaved edit");
  });

  it("shows the default set when nothing is saved", async () => {
    const { seen, defaultDoc } = await mount();
    expect(seen.at(-1)!.captions).toEqual(defaultDoc().frames.map((f) => f.caption));
  });
});
