import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SetDoc, SetFrame } from "@/lib/data/types";
import { doc, frame } from "@/lib/data/__tests__/helpers";
import { seedLibrary } from "@/lib/data/__tests__/library";

/**
 * Plan S3.3 ("Flows do what they say"): the guided flow works on the set it
 * says it does.
 * - The canvas shows every frame the export renders (GAP-1), the one being
 *   worked on enlarged — not the first three with the middle one enlarged.
 * - The upload step shows the screenshots the set really holds (SCREENSA-7):
 *   a frame with one draws it, only an empty frame is a dashed box.
 * - A drop lands after the last filled frame, so a second drop appends
 *   instead of overwriting the first (GAP-1).
 * - The upload list is the set's own screens, named by the dropped files this
 *   visit and "Frame 0N" otherwise (SCREENSA-9) — no fixed "01-today.png".
 * - "Next frame →" walks every frame, and the drop copy and step 4's hint say
 *   what the flow actually does.
 */

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
  usePathname: () => "/guided",
  useSearchParams: () => nav.params,
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const DOCS_KEY = "onstage:set-docs:v1";
const SET = "trailhead-69";
const PLAY_SET = "trailhead-play";

type Store = typeof import("@/store/onstage");

let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  // A returning user's library: the sample apps and sets as stored records.
  seedLibrary();
  // jsdom decodes no images: every dropped file measures as a real 6.9″
  // screenshot.
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(async () => ({ width: 1320, height: 2868, close() {} })),
  );
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  vi.resetModules();
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
  vi.unstubAllGlobals();
});

async function settle(ms = 0) {
  for (let i = 0; i < 5; i++) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
      await new Promise((r) => setImmediate(r));
    });
  }
}

/** A stored set document for `setId`, as a previous visit saved it. */
function seedDoc(setId: string, d: SetDoc) {
  const docs = JSON.parse(localStorage.getItem(DOCS_KEY) ?? "{}") as Record<string, SetDoc>;
  localStorage.setItem(DOCS_KEY, JSON.stringify({ ...docs, [setId]: d }));
}

/** A real Blob in the image store (the same module graph the screen reads),
 *  as the frame ref that points at it. */
async function storedShot(n: number): Promise<string> {
  const { localBackend } = await import("@/lib/data/local");
  const id = await localBackend.putImage(
    new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, n])], { type: "image/png" }),
  );
  return `img:${id}`;
}

/** `n` frames with distinct captions. */
const frames = (n: number, over: (i: number) => Partial<SetFrame> = () => ({})): SetFrame[] =>
  Array.from({ length: n }, (_, i) => frame({ caption: `Headline ${i + 1}`, ...over(i) }));

/**
 * A page load of /guided?set=<setId>: the screen and the store from one fresh
 * module graph (flags off). Resolves once the set has loaded and the flow is
 * on `step`.
 */
async function renderGuided(step: number, setId = SET): Promise<Store> {
  nav.params = new URLSearchParams(`set=${setId}`);
  const [{ GuidedScreen }, store] = [await import("../GuidedScreen"), await import("@/store/onstage")];
  await act(async () => root.render(<GuidedScreen />));
  await settle();
  await vi.waitFor(() => expect(store.useOnstage.getState().loadedSetId).toBe(setId));
  await act(async () => store.useOnstage.setState({ gStep: step }));
  await settle();
  return store;
}

const text = () => host.textContent ?? "";

/** A frame tile's number badge ("01"…) or, for the active one on step 3, EDITING. */
const isBadge = (el: Element) => /^\d{2}$/.test(el.textContent ?? "") || el.textContent === "EDITING";

/** The canvas tiles, in order, found by their badges (pinned to each tile's
 *  bottom-left corner — step 4's file count is two digits too). */
function tiles(): HTMLElement[] {
  return [...host.querySelectorAll<HTMLElement>("span")]
    .filter((sp) => sp.children.length === 0 && isBadge(sp) && sp.style.bottom === "9px" && sp.style.left === "10px")
    .map((sp) => sp.parentElement!);
}

const badge = (tile: HTMLElement) => [...tile.children].find((c) => c.tagName === "SPAN" && isBadge(c))?.textContent;
const size = (tile: HTMLElement) => `${tile.style.width}×${tile.style.height}`;

/** The phone (or empty-slot box) inside a tile. */
const phone = (tile: HTMLElement) => tile.children[1]!.firstElementChild as HTMLElement;

/** The drop target on step 1. */
function dropZone(): HTMLElement {
  const z = [...host.querySelectorAll<HTMLElement>('[role="button"]')].find((el) =>
    (el.textContent ?? "").includes("Drop up to"),
  );
  if (!z) throw new Error("no drop zone");
  return z;
}

const png = (name: string, n: number) =>
  new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, n])], name, { type: "image/png" });

async function drop(files: File[]) {
  const event = new Event("drop", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "dataTransfer", { value: { files } });
  await act(async () => {
    dropZone().dispatchEvent(event);
  });
}

/** The upload list's rows as [name, badge]. */
function uploadRows(): [string, string][] {
  const list = dropZone().parentElement!.lastElementChild!;
  return [...list.children]
    .filter((row) => row.children.length === 3)
    .map((row) => [row.children[1].textContent ?? "", row.children[2].textContent ?? ""]);
}

function button(label: string): HTMLButtonElement {
  const b = [...host.querySelectorAll("button")].find((el) => el.textContent?.trim() === label);
  if (!b) throw new Error(`no button labelled ${label}`);
  return b;
}

async function click(el: HTMLElement) {
  await act(async () => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
  await settle();
}

describe("GuidedScreen — the canvas shows every frame (GAP-1)", () => {
  it("a 7-frame set shows 7 tiles, the active one large, and clicking another enlarges that one", async () => {
    seedDoc(SET, doc(frames(7)));
    const { useOnstage } = await renderGuided(0);

    expect(tiles()).toHaveLength(7);
    expect(tiles().map(badge)).toEqual(["01", "02", "03", "04", "05", "06", "07"]);
    // The first frame is active on load, so it is the large one.
    expect(tiles().map(size)).toEqual([
      "226px×470px",
      ...Array.from({ length: 6 }, () => "200px×418px"),
    ]);

    await click(tiles()[5]);
    expect(useOnstage.getState().active).toBe(5);
    expect(tiles().map(size)).toEqual(
      Array.from({ length: 7 }, (_, i) => (i === 5 ? "226px×470px" : "200px×418px")),
    );
  });

  it("on the caption step the active tile says EDITING, the rest keep their numbers", async () => {
    seedDoc(SET, doc(frames(7)));
    const { useOnstage } = await renderGuided(2);

    expect(tiles()).toHaveLength(7);
    expect(tiles().map(badge)).toEqual(["EDITING", "02", "03", "04", "05", "06", "07"]);
    // Each tile shows its own frame's headline.
    expect(tiles().map((t) => t.firstElementChild?.textContent)).toEqual(
      useOnstage.getState().frames.map((f) => f.caption),
    );

    await click(tiles()[6]);
    expect(tiles().map(badge)).toEqual(["01", "02", "03", "04", "05", "06", "EDITING"]);
    expect(size(tiles()[6])).toBe("226px×470px");
    expect(size(tiles()[0])).toBe("200px×418px");
  });

  it("the upload step draws a frame's own screenshot; only empty frames are dashed boxes (SCREENSA-7)", async () => {
    const shot = await storedShot(1);
    seedDoc(SET, doc(frames(5, (i) => ({ screenshot: i === 0 ? shot : null }))));
    await renderGuided(0);

    await vi.waitFor(() => expect(tiles()[0].querySelector("img")).not.toBeNull());
    const img = tiles()[0].querySelector("img")!;
    expect(img.getAttribute("src")).toMatch(/^blob:/);
    // The filled frame is a phone holding the picture, not a dashed slot.
    expect(phone(tiles()[0]).style.border).not.toContain("dashed");
    expect(phone(tiles()[0]).getAttribute("style")).toContain("linear-gradient");

    for (const t of tiles().slice(1)) {
      expect(t.querySelector("img")).toBeNull();
      expect(phone(t).getAttribute("style")).toContain("dashed");
      expect(phone(t).children).toHaveLength(0);
    }
  });

  it("step 4's hint says the export renders every frame, and every frame is on the canvas", async () => {
    seedDoc(SET, doc(frames(7)));
    await renderGuided(3);

    expect(text()).toContain("Every frame the export will render");
    expect(text()).not.toContain("This is exactly what gets rendered");
    expect(tiles()).toHaveLength(7);
  });
});

describe("GuidedScreen — dropping screenshots (GAP-1, SCREENSA-9)", () => {
  it("a drop lands after the last filled frame, and a second drop appends past it", async () => {
    const first = await storedShot(1);
    const second = await storedShot(2);
    seedDoc(SET, doc(frames(5, (i) => ({ screenshot: i === 0 ? first : i === 1 ? second : null }))));
    const { useOnstage } = await renderGuided(0);

    // Before this visit's drops: the set's own two screens, by frame number.
    expect(uploadRows()).toEqual([
      ["Frame 01", "IN SEARCH"],
      ["Frame 02", "IN SEARCH"],
    ]);

    await drop([png("today.png", 3), png("pace.png", 4), png("trails.png", 5)]);
    await vi.waitFor(() => expect(useOnstage.getState().frames[4].screenshot).toMatch(/^img:/));
    await settle();

    let fs = useOnstage.getState().frames;
    expect(fs).toHaveLength(5);
    // Frames 0–1 keep what they held; the three files fill frames 2–4.
    expect(fs[0].screenshot).toBe(first);
    expect(fs[1].screenshot).toBe(second);
    const dropped = fs.slice(2).map((f) => f.screenshot);
    expect(dropped.every((r) => typeof r === "string" && r.startsWith("img:"))).toBe(true);
    expect(new Set([first, second, ...dropped]).size).toBe(5);
    expect(host.querySelector('[role="alert"]')).toBeNull();

    expect(uploadRows()).toEqual([
      ["Frame 01", "IN SEARCH"],
      ["Frame 02", "IN SEARCH"],
      ["today.png", "READY"],
      ["pace.png", "READY"],
      ["trails.png", "READY"],
    ]);

    // A second drop appends: the set grows to hold it, nothing is replaced.
    await drop([png("share.png", 6), png("season.png", 7)]);
    await vi.waitFor(() => expect(useOnstage.getState().frames).toHaveLength(7));
    await settle();

    fs = useOnstage.getState().frames;
    expect(fs.slice(0, 5).map((f) => f.screenshot)).toEqual([first, second, ...dropped]);
    expect(fs.slice(5).every((f) => typeof f.screenshot === "string" && f.screenshot.startsWith("img:"))).toBe(true);
    expect(uploadRows()).toEqual([
      ["Frame 01", "IN SEARCH"],
      ["Frame 02", "IN SEARCH"],
      ["today.png", "READY"],
      ["pace.png", "READY"],
      ["trails.png", "READY"],
      ["share.png", "READY"],
      ["season.png", "READY"],
    ]);
    // The canvas grew with the set.
    expect(tiles()).toHaveLength(7);
  });

  it("dropped screenshots show on the canvas right away, in the frames they landed on", async () => {
    const { useOnstage } = await renderGuided(0);
    expect(tiles().every((t) => t.querySelector("img") === null)).toBe(true);

    await drop([png("a.png", 1), png("b.png", 2)]);
    await vi.waitFor(() => expect(useOnstage.getState().frames[1].screenshot).toMatch(/^img:/));
    await vi.waitFor(() => expect(tiles()[1].querySelector("img")).not.toBeNull());

    expect(tiles()[0].querySelector("img")).not.toBeNull();
    expect(tiles().slice(2).every((t) => t.querySelector("img") === null)).toBe(true);
    expect(uploadRows()).toEqual([
      ["a.png", "IN SEARCH"],
      ["b.png", "IN SEARCH"],
    ]);
  });

  it("an empty set says it has no screens yet, and lists none", async () => {
    // No stored document: the set opens on the default, which holds no screenshots.
    const { useOnstage } = await renderGuided(0);
    expect(useOnstage.getState().frames.every((f) => f.screenshot === null)).toBe(true);

    expect(text()).toContain("No screens yet.");
    expect(uploadRows()).toEqual([]);
    for (const fixture of ["01-today.png", "02-pace.png", "03-trails.png", "04-share.png", "05-season.png"]) {
      expect(text()).not.toContain(fixture);
    }
  });

  it("a set with screens doesn't say it has none", async () => {
    seedDoc(SET, doc(frames(3, (i) => ({ screenshot: i === 2 ? "img:not-read-yet" : null }))));
    await renderGuided(0);

    expect(text()).not.toContain("No screens yet.");
    expect(uploadRows()).toEqual([["Frame 03", "READY"]]);
  });

  it("a Play set's drop copy gives Google Play's limit of 8", async () => {
    seedDoc(PLAY_SET, doc(frames(5), { store: "play" }));

    await renderGuided(0, PLAY_SET);
    expect(text()).toContain("Drop up to 8 screenshots");
    expect(text()).not.toContain("Drop up to 10 screenshots");
    expect(text()).not.toContain("Drop 3–10 screenshots");
  });

  it("an App Store set says 10", async () => {
    seedDoc(SET, doc(frames(5)));
    await renderGuided(0);
    expect(text()).toContain("Drop up to 10 screenshots");
    expect(text()).not.toContain("Drop 3–10 screenshots");
  });
});

describe("GuidedScreen — Next frame", () => {
  it("visits every frame of a 7-frame set in order and wraps back to the first", async () => {
    seedDoc(SET, doc(frames(7)));
    const { useOnstage } = await renderGuided(2);
    expect(useOnstage.getState().active).toBe(0);

    const seen: number[] = [];
    for (let n = 0; n < 7; n++) {
      await click(button("Next frame →"));
      const { active, frames: fs } = useOnstage.getState();
      seen.push(active);
      // The step follows the frame: its label, its headline and its tile.
      expect(text()).toContain(`FRAME ${String(active + 1).padStart(2, "0")} OF 7`);
      expect(host.querySelector("textarea")?.value).toBe(fs[active].caption);
      expect(badge(tiles()[active])).toBe("EDITING");
    }
    expect(seen).toEqual([1, 2, 3, 4, 5, 6, 0]);
  });
});

describe("GuidedScreen — drops never overwrite (S3.3 review)", () => {
  it("two drops made back to back both append: the second waits for the first", async () => {
    seedDoc(SET, doc(frames(5)));
    const shot0 = await storedShot(1);
    seedDoc(SET, doc(frames(5, (i) => (i === 0 ? { screenshot: shot0 } : {}))));
    const store = await renderGuided(0);

    // The second drop starts before the first has been checked and stored.
    await drop([png("a.png", 2), png("b.png", 3)]);
    await drop([png("c.png", 4), png("d.png", 5)]);
    await settle();

    const shots = store.useOnstage.getState().frames.map((f) => f.screenshot);
    expect(shots[0]).toBe(shot0);
    expect(shots.slice(1, 5).every((s) => typeof s === "string" && s.startsWith("img:"))).toBe(true);
    expect(new Set(shots).size).toBe(5);
    expect(uploadRows().map((r) => r[0])).toEqual(["Frame 01", "a.png", "b.png", "c.png", "d.png"]);
  });

  it("with a gap in the set, a drop starts after the last filled frame and leaves the gap and the filled frames alone", async () => {
    const s0 = await storedShot(1);
    const s3 = await storedShot(2);
    seedDoc(SET, doc(frames(5, (i) => (i === 0 ? { screenshot: s0 } : i === 3 ? { screenshot: s3 } : {}))));
    const store = await renderGuided(0);
    await drop([png("x.png", 3), png("y.png", 4)]);
    await settle();

    const shots = store.useOnstage.getState().frames.map((f) => f.screenshot);
    expect(shots).toHaveLength(6);
    expect(shots[0]).toBe(s0);
    expect(shots[1]).toBeNull();
    expect(shots[2]).toBeNull();
    expect(shots[3]).toBe(s3);
    expect(shots[4]).toMatch(/^img:/);
    expect(shots[5]).toMatch(/^img:/);
  });
});

describe("GuidedScreen — your screenshots on every step (SCREENSA-7)", () => {
  it.each([1, 2, 3])("on step %i a frame with a screenshot draws it, and an empty one a plain phone", async (step) => {
    const s0 = await storedShot(1);
    seedDoc(SET, doc(frames(3, (i) => (i === 0 ? { screenshot: s0 } : {}))));
    await renderGuided(step);
    await vi.waitFor(() => expect(tiles()[0].querySelector("img")?.getAttribute("src")).toMatch(/^blob:/));
    expect(tiles()[1].querySelector("img")).toBeNull();
    expect(phone(tiles()[1]).style.border).not.toContain("dashed");
    expect(phone(tiles()[1]).style.background).toContain("linear-gradient");
  });
});

describe("GuidedScreen — the frame being worked on stays in view", () => {
  it("each Next frame scrolls that frame's tile into view", async () => {
    const scroll = vi.fn();
    const proto = HTMLElement.prototype as unknown as { scrollIntoView?: (this: HTMLElement, arg?: unknown) => void };
    const had = Object.prototype.hasOwnProperty.call(proto, "scrollIntoView");
    const before = proto.scrollIntoView;
    proto.scrollIntoView = function (this: HTMLElement, arg?: unknown) {
      scroll(this, arg);
    };
    try {
      seedDoc(SET, doc(frames(7)));
      const store = await renderGuided(2);
      for (let n = 1; n <= 7; n++) {
        await click(button("Next frame →"));
        const active = store.useOnstage.getState().active;
        expect(active).toBe(n % 7);
        const [el, arg] = scroll.mock.calls.at(-1)!;
        expect(el).toBe(tiles()[active]);
        expect(arg).toEqual({ block: "nearest", inline: "center" });
      }
    } finally {
      if (had) proto.scrollIntoView = before;
      else delete proto.scrollIntoView;
    }
  });
});
