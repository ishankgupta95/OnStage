import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ScreenshotSet, SetDoc } from "@/lib/data/types";
import type { SetRoute } from "../useSetRoute";
import { seedLibrary } from "@/lib/data/__tests__/library";

// The router is one stable object, as Next's is; the search params are
// whatever the test puts in the URL.
const nav = vi.hoisted(() => ({
  params: new URLSearchParams(),
  router: {
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => nav.router,
  usePathname: () => "/editor",
  useSearchParams: () => nav.params,
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const DOCS_KEY = "onstage:set-docs:v1";
const LAST_KEY = "onstage:last-set:v1";
const SETS_KEY = "onstage:sets:v1";

let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  // A returning user's library: the sample apps and sets as stored records.
  seedLibrary();
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  vi.resetModules();
  nav.params = new URLSearchParams();
  Object.values(nav.router).forEach((fn) => fn.mockClear());
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

/** A fresh store, backend and hook, as on a page load. */
async function boot() {
  const { useSetRoute } = await import("../useSetRoute");
  const store = await import("@/store/onstage");
  const { localBackend } = await import("@/lib/data/local");
  return { useSetRoute, localBackend, ...store };
}

/** Render a probe on `query` that records every value the hook returns. */
async function mount(query: string, mode: "canvas" | "guided" = "canvas") {
  nav.params = new URLSearchParams(query);
  const mods = await boot();
  const seen: SetRoute[] = [];
  function Probe() {
    seen.push(mods.useSetRoute(mode));
    return null;
  }
  const render = () => act(async () => root.render(<Probe />));
  await render();
  await settle();
  return { ...mods, seen, latest: () => seen.at(-1)!, rerender: render };
}

/** Let promise chains and effects run, with `ms` of (fake) time passing. */
async function settle(ms = 0) {
  for (let i = 0; i < 5; i++) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
      await new Promise((r) => setImmediate(r));
    });
  }
}

const storedDocs = (): Record<string, SetDoc> => JSON.parse(localStorage.getItem(DOCS_KEY) ?? "{}");

/** The single URL the hook replaced to, parsed. */
function replacedTo() {
  expect(nav.router.replace).toHaveBeenCalledTimes(1);
  const url = new URL(nav.router.replace.mock.calls[0][0] as string, "http://onstage.test");
  return { path: url.pathname, set: url.searchParams.get("set"), apply: url.searchParams.get("apply") };
}

describe("useSetRoute — a set this tab is deleting", () => {
  it("is 'missing' while its record still waits to be removed, and never opens", async () => {
    const pre = await boot();
    let release!: () => void;
    const real = pre.localBackend.deleteSet.bind(pre.localBackend);
    vi.spyOn(pre.localBackend, "deleteSet").mockImplementation(async (id, options) => {
      await new Promise<void>((r) => (release = r));
      return real(id, options);
    });
    const removing = pre.removeSet("trailhead-play");
    // The record is still listed…
    expect((await pre.localBackend.listSets()).some((x) => x.id === "trailhead-play")).toBe(true);

    const { latest, useOnstage } = await mount("set=trailhead-play");
    // …but the editor treats the set as gone.
    expect(latest().status).toBe("missing");
    expect(useOnstage.getState().loadedSetId).toBeNull();

    release();
    await removing;
  });
});

describe("useSetRoute — a set the library doesn't list", () => {
  it("is 'missing', never opened, and nothing is saved under it", async () => {
    const { latest, seen, useOnstage } = await mount("set=not-in-this-browser");

    expect(seen[0].status).toBe("checking");
    expect(latest().status).toBe("missing");
    expect(latest().setId).toBe("not-in-this-browser");
    expect(latest().set).toBeNull();
    expect(useOnstage.getState().loadedSetId).toBeNull();

    // Even an edit to what is on screen, well past the autosave debounce,
    // writes nothing: no document for that id, and it isn't remembered.
    useOnstage.getState().patchFrame({ caption: "typed anyway" });
    await settle(1000);
    expect(storedDocs()["not-in-this-browser"]).toBeUndefined();
    expect(localStorage.getItem(LAST_KEY)).toBeNull();
    expect(nav.router.replace).not.toHaveBeenCalled();
    expect(nav.router.push).not.toHaveBeenCalled();
  });

  it("an apply intent for it changes nothing", async () => {
    const { latest, useOnstage } = await mount("set=not-in-this-browser&apply=template:moss");
    await settle(1000);
    expect(latest().status).toBe("missing");
    expect(useOnstage.getState().loadedSetId).toBeNull();
    expect(useOnstage.temporal.getState().pastStates).toHaveLength(0);
    expect(localStorage.getItem(DOCS_KEY)).toBeNull();
    expect(localStorage.getItem(LAST_KEY)).toBeNull();
    expect(nav.router.replace).not.toHaveBeenCalled();
  });
});

describe("useSetRoute — a listed set", () => {
  it("is 'ready' with its library record, opened by id and remembered", async () => {
    const { latest, useOnstage } = await mount("set=trailhead-69");

    expect(latest().status).toBe("ready");
    expect(latest().setId).toBe("trailhead-69");
    expect(latest().error).toBeNull();
    expect(latest().set?.id).toBe("trailhead-69");
    expect(latest().set?.name).toBe("Trailhead — 6.9″ set");
    expect(useOnstage.getState().loadedSetId).toBe("trailhead-69");
    expect(useOnstage.getState().setId).toBe("trailhead-69");
    expect(localStorage.getItem(LAST_KEY)).toBe('"trailhead-69"');
    expect(nav.router.replace).not.toHaveBeenCalled();
  });
});

describe("useSetRoute — a bare route", () => {
  it("replaces the URL with the last opened set when the library still lists it", async () => {
    localStorage.setItem(LAST_KEY, JSON.stringify("ferry-69"));
    const { latest, useOnstage } = await mount("");

    expect(replacedTo()).toEqual({ path: "/editor", set: "ferry-69", apply: null });
    expect(nav.router.replace.mock.calls[0][0]).toBe("/editor?set=ferry-69");
    expect(nav.router.push).not.toHaveBeenCalled();
    // The hook itself opens nothing until the URL names the set.
    expect(latest().status).toBe("resolving");
    expect(latest().setId).toBeNull();
    expect(useOnstage.getState().loadedSetId).toBeNull();
  });

  it("keeps an apply intent on the replaced URL, without applying it yet", async () => {
    localStorage.setItem(LAST_KEY, JSON.stringify("ferry-69"));
    const { useOnstage } = await mount("apply=brand:trailhead");

    expect(replacedTo()).toEqual({ path: "/editor", set: "ferry-69", apply: "brand:trailhead" });
    expect(useOnstage.getState().loadedSetId).toBeNull();
    expect(useOnstage.temporal.getState().pastStates).toHaveLength(0);
  });

  it("in guided mode, replaces to /guided", async () => {
    localStorage.setItem(LAST_KEY, JSON.stringify("lumen-draft"));
    await mount("", "guided");
    expect(replacedTo()).toEqual({ path: "/guided", set: "lumen-draft", apply: null });
  });

  it("falls back to the most recently edited set when the remembered one is gone", async () => {
    localStorage.setItem(LAST_KEY, JSON.stringify("deleted-long-ago"));
    const mine: ScreenshotSet = {
      id: "set_recent",
      appId: "trailhead",
      name: "Recent",
      sub: "New set · EN",
      frameCount: 5,
      status: "Draft",
      updatedAt: "2026-09-20T10:00:00.000Z",
      swatch: "linear-gradient(150deg,#ff6b53,#c9315f)",
    };
    localStorage.setItem(SETS_KEY, JSON.stringify([mine]));
    await mount("");
    expect(replacedTo()).toEqual({ path: "/editor", set: "set_recent", apply: null });
  });

  it("with an empty library, creates one set with createSet and replaces to it", async () => {
    nav.params = new URLSearchParams();
    const before: ScreenshotSet[] = JSON.parse(localStorage.getItem(SETS_KEY) ?? "[]");
    const mods = await boot();
    vi.spyOn(mods.localBackend, "listSets").mockResolvedValue([]);
    const create = vi.spyOn(mods.localBackend, "createSet");
    function Probe() {
      mods.useSetRoute("canvas");
      return null;
    }
    await act(async () => root.render(<Probe />));
    await settle();

    expect(create).toHaveBeenCalledTimes(1);
    const made = await create.mock.results[0].value;
    const { path, set } = replacedTo();
    expect(path).toBe("/editor");
    expect(set).toBe(made.id);
    // Exactly one record was added — the one it replaced to — and the records
    // already stored (the list is only mocked empty) are as they were.
    const records: ScreenshotSet[] = JSON.parse(localStorage.getItem(SETS_KEY) ?? "[]");
    const had = new Set(before.map((r) => r.id));
    expect(records.filter((r) => !had.has(r.id))).toEqual([made]);
    expect(records.filter((r) => had.has(r.id))).toEqual(before);
    expect(storedDocs()[made.id]?.frames.length).toBeGreaterThan(0);
  });
});

describe("useSetRoute — ?apply= on a listed set", () => {
  it("applies the template once the set loads, as one undo step, then drops it from the URL", async () => {
    const { latest, useOnstage, rerender, defaultDoc } = await mount("set=trailhead-69&apply=template:moss");
    const { TEMPLATES } = await import("@/lib/onstage/data");
    const moss = TEMPLATES.find((t) => t.slug === "moss")!;

    expect(latest().status).toBe("ready");
    const st = useOnstage.getState();
    expect(st.loadedSetId).toBe("trailhead-69");
    expect(st.frames.length).toBeGreaterThan(0);
    expect(st.frames.every((f) => f.bg === "moss" && f.tiltY === moss.ty)).toBe(true);
    expect(st.panorama).toBe(moss.panoramic);
    expect(useOnstage.temporal.getState().pastStates).toHaveLength(1);
    expect(nav.router.replace).toHaveBeenCalledTimes(1);
    expect(nav.router.replace).toHaveBeenCalledWith("/editor?set=trailhead-69");

    // A plain re-render doesn't apply it again.
    await rerender();
    await settle();
    expect(useOnstage.temporal.getState().pastStates).toHaveLength(1);
    expect(nav.router.replace).toHaveBeenCalledTimes(1);

    // Nor does the URL the replace leads to.
    nav.params = new URLSearchParams("set=trailhead-69");
    await rerender();
    await settle();
    expect(latest().status).toBe("ready");
    expect(useOnstage.temporal.getState().pastStates).toHaveLength(1);
    expect(nav.router.replace).toHaveBeenCalledTimes(1);

    // The applied look is autosaved to that set, and one undo takes it back
    // to the set as it opened (no saved copy: the default document).
    await settle(1000);
    expect(storedDocs()["trailhead-69"].frames.every((f) => f.bg === "moss")).toBe(true);
    act(() => useOnstage.getState().undo());
    expect(useOnstage.getState().frames.map((f) => f.bg)).toEqual(defaultDoc().frames.map((f) => f.bg));
    expect(useOnstage.temporal.getState().pastStates).toHaveLength(0);
  });
});

describe("useSetRoute — a library that can't be read", () => {
  it("is 'error' with the reason, and retry() looks again", async () => {
    nav.params = new URLSearchParams("set=trailhead-69");
    const mods = await boot();
    const real = mods.localBackend.listSets.bind(mods.localBackend);
    const list = vi.spyOn(mods.localBackend, "listSets").mockRejectedValue(new Error("boom"));
    const seen: SetRoute[] = [];
    function Probe() {
      seen.push(mods.useSetRoute("canvas"));
      return null;
    }
    await act(async () => root.render(<Probe />));
    await settle();

    expect(seen.at(-1)!.status).toBe("error");
    expect(seen.at(-1)!.error).toBe("boom");
    expect(seen.at(-1)!.set).toBeNull();
    expect(mods.useOnstage.getState().loadedSetId).toBeNull();
    expect(list).toHaveBeenCalledTimes(1);

    list.mockImplementation(real);
    await act(async () => seen.at(-1)!.retry());
    await settle();

    expect(list).toHaveBeenCalledTimes(2);
    expect(seen.at(-1)!.status).toBe("ready");
    expect(seen.at(-1)!.error).toBeNull();
    expect(mods.useOnstage.getState().loadedSetId).toBe("trailhead-69");
  });
});
