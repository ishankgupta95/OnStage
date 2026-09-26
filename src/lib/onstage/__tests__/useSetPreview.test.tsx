import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ScreenshotSet, SetDoc } from "@/lib/data/types";
import { doc, frame } from "@/lib/data/__tests__/helpers";
import { seedLibrary } from "@/lib/data/__tests__/library";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const DOCS_KEY = "onstage:set-docs:v1";
const LAST_KEY = "onstage:last-set:v1";

let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  // A returning user's library: the sample apps and sets as stored records.
  seedLibrary();
  vi.resetModules();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(async () => {
  act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  // Write any edit a test left inside the autosave debounce now, so a stale
  // store's timer can't land in a later test's storage.
  window.dispatchEvent(new Event("pagehide"));
  await new Promise((r) => setTimeout(r, 0));
});

type Preview = { frames: { caption: string }[]; store: string; loading: boolean; set: ScreenshotSet | null };

async function mount() {
  const { useSetPreview } = await import("../useSetPreview");
  const store = await import("@/store/onstage");
  const seen: { captions: string[]; store: string; loading: boolean }[] = [];
  let latest: Preview | undefined;
  function Probe() {
    const p = useSetPreview();
    latest = p;
    seen.push({ captions: p.frames.map((f) => f.caption), store: p.store, loading: p.loading });
    return null;
  }
  await act(async () => root.render(<Probe />));
  await act(() => new Promise((r) => setTimeout(r, 10)));
  return { seen, now: () => latest!, ...store };
}

/** This test's backend (the same module instance the hook reads through). */
const backend = async () => (await import("@/lib/data/local")).localBackend;

const saved: SetDoc = doc([frame({ caption: "Mine one" }), frame({ caption: "Mine two" })], { store: "play" });
const other: SetDoc = doc([frame({ caption: "Other one" })], { store: "apple" });

describe("useSetPreview", () => {
  it("shows the saved set without opening it when no set is loaded", async () => {
    localStorage.setItem(DOCS_KEY, JSON.stringify({ "trailhead-69": saved }));
    const { seen, useOnstage } = await mount();
    expect(seen.at(-1)).toEqual({ captions: ["Mine one", "Mine two"], store: "play", loading: false });
    expect(useOnstage.getState().loadedSetId).toBeNull(); // read, not opened
    expect(useOnstage.getState().frames[0].caption).not.toBe("Mine one");
  });

  it("shows the open set as it is now when one is loaded", async () => {
    localStorage.setItem(DOCS_KEY, JSON.stringify({ "trailhead-69": saved }));
    const store = await import("@/store/onstage");
    await store.openSet("trailhead-69");
    store.useOnstage.getState().patchFrame({ caption: "Unsaved edit" });
    const { seen, now } = await mount();
    expect(seen.at(-1)!.captions).toEqual(["Unsaved edit", "Mine two"]);
    expect(seen.at(-1)!.loading).toBe(false);
    expect(now().set?.id).toBe("trailhead-69");
    expect(now().set?.name).toBe("Trailhead — 6.9″ set");
  });

  it("shows the default set when nothing is saved", async () => {
    const { seen, defaultDoc } = await mount();
    expect(seen.at(-1)!.captions).toEqual(defaultDoc().frames.map((f) => f.caption));
  });

  it("with no set loaded, previews the set this browser last opened — not the first listed one", async () => {
    localStorage.setItem(DOCS_KEY, JSON.stringify({ "trailhead-69": other, "trailhead-play": saved }));
    localStorage.setItem(LAST_KEY, JSON.stringify("trailhead-play"));
    const { seen, now, useOnstage } = await mount();

    expect(seen.at(-1)).toEqual({ captions: ["Mine one", "Mine two"], store: "play", loading: false });
    expect(now().set?.id).toBe("trailhead-play");
    expect(now().set?.name).toBe("Trailhead — Play phone");
    // Read, never opened: nothing loaded, and the remembered set is left as it was.
    expect(useOnstage.getState().loadedSetId).toBeNull();
    expect(localStorage.getItem(LAST_KEY)).toBe(JSON.stringify("trailhead-play"));
  });

  it("falls back to the first listed set, with its library record, when the remembered one was deleted", async () => {
    localStorage.setItem(DOCS_KEY, JSON.stringify({ "trailhead-69": saved, "trailhead-play": other }));
    localStorage.setItem(LAST_KEY, JSON.stringify("trailhead-play"));
    await (await backend()).deleteSet("trailhead-play");
    const { seen, now } = await mount();

    expect(seen.at(-1)).toEqual({ captions: ["Mine one", "Mine two"], store: "play", loading: false });
    expect(now().set?.id).toBe("trailhead-69");
    expect(now().set?.name).toBe("Trailhead — 6.9″ set");
  });

  it("falls back to the most recently edited set when the remembered id isn't listed", async () => {
    const record = (id: string, updatedAt: string): ScreenshotSet => ({
      id,
      appId: "app_x",
      name: `Set ${id}`,
      sub: "",
      frameCount: 1,
      status: "Draft",
      updatedAt,
      swatch: "",
    });
    const lb = await backend();
    vi.spyOn(lb, "listSets").mockResolvedValue([
      record("older", "2026-09-01T10:00:00.000Z"),
      record("undated", "2h ago"),
      record("newer", "2026-09-20T10:00:00.000Z"),
    ]);
    localStorage.setItem(
      DOCS_KEY,
      JSON.stringify({
        older: doc([frame({ caption: "Older" })]),
        undated: doc([frame({ caption: "Undated" })]),
        newer: doc([frame({ caption: "Newer" })]),
      }),
    );
    localStorage.setItem(LAST_KEY, JSON.stringify("set_gone"));
    const { seen, now } = await mount();

    expect(seen.at(-1)!.captions).toEqual(["Newer"]);
    expect(now().set?.id).toBe("newer");
  });

  it("previews the open set even when it couldn't be remembered", async () => {
    localStorage.setItem(DOCS_KEY, JSON.stringify({ "trailhead-69": saved, "trailhead-play": other }));
    localStorage.setItem(LAST_KEY, JSON.stringify("trailhead-play"));
    vi.spyOn(await backend(), "rememberLastSet").mockRejectedValue(new Error("Storage is full."));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const store = await import("@/store/onstage");
    await store.openSet("trailhead-69");
    store.useOnstage.getState().patchFrame({ caption: "Unsaved edit" });

    const { seen, now } = await mount();

    expect(seen.at(-1)!.captions).toEqual(["Unsaved edit", "Mine two"]);
    expect(now().set?.id).toBe("trailhead-69");
    expect(localStorage.getItem(LAST_KEY)).toBe(JSON.stringify("trailhead-play"));
  });

  it("switches to the live set when one is opened after it mounted, without showing the old preview again", async () => {
    localStorage.setItem(DOCS_KEY, JSON.stringify({ "trailhead-69": saved, "trailhead-play": other }));
    localStorage.setItem(LAST_KEY, JSON.stringify("trailhead-play"));
    const { seen, now, openSet, useOnstage } = await mount();
    expect(seen.at(-1)!.captions).toEqual(["Other one"]);
    expect(now().set?.id).toBe("trailhead-play");

    const from = seen.length;
    await act(async () => {
      await openSet("trailhead-69");
      useOnstage.getState().patchFrame({ caption: "Unsaved edit" });
    });
    await act(() => new Promise((r) => setTimeout(r, 10)));

    expect(seen.at(-1)).toEqual({ captions: ["Unsaved edit", "Mine two"], store: "play", loading: false });
    expect(now().set?.id).toBe("trailhead-69");
    expect(now().set?.name).toBe("Trailhead — 6.9″ set");
    // Once the set is loaded, every render shows it — never the set previewed before.
    for (const s of seen.slice(from)) expect(s.captions).not.toEqual(["Other one"]);
  });
});
