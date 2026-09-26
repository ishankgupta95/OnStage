import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Plan D10: screens outside the editor never change the document themselves.
 * The landing page's export controls send the editor an export intent — on
 * the set that is open, or on the one a bare /editor opens — and leave the
 * store's overlay alone, so the dialog can't open on a placeholder document.
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
  usePathname: () => "/",
  useSearchParams: () => nav.params,
}));

import { useOnstage } from "@/store/onstage";
import { LandingScreen } from "../LandingScreen";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  for (const fn of Object.values(nav.router)) fn.mockReset();
  // A first visit: nothing open, no dialog.
  useOnstage.setState({ loadedSetId: null, overlay: null });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
});

async function mount() {
  await act(async () => root.render(<LandingScreen />));
}

function button(label: string): HTMLButtonElement {
  const b = [...host.querySelectorAll("button")].find((el) => el.textContent?.trim() === label);
  if (!b) throw new Error(`no button labelled ${label}`);
  return b;
}

async function click(el: HTMLElement) {
  await act(async () => el.click());
}

const pushed = () => nav.router.push.mock.calls.map((c) => String(c[0]));

/** An href's path and query, so an escaped `:` reads the same as a bare one. */
const target = (href: string) => {
  const u = new URL(href, "http://x");
  return { path: u.pathname, query: Object.fromEntries(u.searchParams) };
};

// "See an export" in WHAT COMES OUT. (The hero's button opens the canvas —
// its demo tilt and background aren't a set, so it doesn't offer to export.)
const EXPORT_CONTROLS = ["See an export"];

describe("LandingScreen — export controls send the editor an intent", () => {
  it.each(EXPORT_CONTROLS)(
    "%s, with no set open, opens a bare /editor carrying the export intent",
    async (label) => {
      await mount();
      await click(button(label));

      // /editor?apply=panel:export — the editor opens the last set, then the dialog.
      expect(pushed().map(target)).toEqual([{ path: "/editor", query: { apply: "panel:export" } }]);
      expect(useOnstage.getState().overlay).toBeNull();
      expect(useOnstage.getState().loadedSetId).toBeNull();
    },
  );

  it.each(EXPORT_CONTROLS)(
    "%s, with a set open, opens that set in the editor carrying the export intent",
    async (label) => {
      useOnstage.setState({ loadedSetId: "trailhead-69" });
      await mount();
      await click(button(label));

      // /editor?set=trailhead-69&apply=panel:export
      expect(pushed().map(target)).toEqual([
        { path: "/editor", query: { set: "trailhead-69", apply: "panel:export" } },
      ]);
      expect(useOnstage.getState().overlay).toBeNull();
      expect(useOnstage.getState().loadedSetId).toBe("trailhead-69");
    },
  );

  it("reads the open set when clicked, not when the page rendered", async () => {
    await mount();
    // The set is opened (say, in the editor's store) after the landing page
    // rendered: the link still targets it.
    useOnstage.setState({ loadedSetId: "ferry-69" });
    await click(button("See an export"));

    expect(pushed().map(target)).toEqual([
      { path: "/editor", query: { set: "ferry-69", apply: "panel:export" } },
    ]);
    expect(useOnstage.getState().overlay).toBeNull();
  });

  it("an export control changes nothing in the store besides navigating", async () => {
    useOnstage.setState({ loadedSetId: "trailhead-69" });
    await mount();
    const before = useOnstage.getState();
    await click(button("See an export"));

    const after = useOnstage.getState();
    expect(after).toBe(before);
    expect(nav.router.push).toHaveBeenCalledTimes(1);
  });
});

describe("LandingScreen — the hero says what it does (GAP-2)", () => {
  it("asks you to open the canvas and drop your screens there, not onto the demo phone", async () => {
    await mount();
    const copy = host.textContent ?? "";
    expect(copy).toContain("Open the canvas and drop your screens");
    expect(copy).not.toContain("Drop a screen onto the phone below");
    // The demo phone is not a drop target and doesn't invite one.
    expect(copy).not.toContain("Drop a screenshot");
    expect(copy).toContain("Your screenshot here");
  });

  it("its button opens the canvas — no export of a demo that isn't a set", async () => {
    await mount();
    expect(() => button("Export this set")).toThrow();
    const before = useOnstage.getState();
    await click(button("Open the canvas"));
    expect(pushed().map(target)).toEqual([{ path: "/editor", query: {} }]);
    expect(useOnstage.getState()).toBe(before);
  });
});

// ── S3.2: the hero demo tilts the way the editor does ───────────────────────

/** The hero stage: the grab-cursor area that takes the drag. */
function stage(): HTMLDivElement {
  const el = [...host.querySelectorAll<HTMLDivElement>("div")].find((d) => d.style.cursor === "grab");
  if (!el) throw new Error("no hero stage");
  return el;
}

/** The hero's Perspective readout — "<yaw>° / <pitch>°". */
function readout(): string {
  const el = [...host.querySelectorAll("span")].find((sp) => /^[+-]?\d+° \/ [+-]?\d+°$/.test(sp.textContent ?? ""));
  if (!el) throw new Error("no tilt readout");
  return el.textContent ?? "";
}

/** The tilted demo phone's transform (the only element turned on both axes). */
function phoneTransform(): string {
  const el = [...host.querySelectorAll<HTMLElement>("div")].find((d) => d.style.transform.includes("rotateX("));
  if (!el) throw new Error("no tilted phone");
  return el.style.transform;
}

// jsdom lays nothing out: the stage is given a box, 800 × 400 at (100, 50).
const BOX = { left: 100, top: 50, width: 800, height: 400 };
/** A point on the stage, as fractions of its width and height. */
const at = (fx: number, fy: number) => ({ x: BOX.left + BOX.width * fx, y: BOX.top + BOX.height * fy });

function layOut(el: HTMLElement) {
  vi.spyOn(el, "getBoundingClientRect").mockReturnValue({
    ...BOX,
    right: BOX.left + BOX.width,
    bottom: BOX.top + BOX.height,
    x: BOX.left,
    y: BOX.top,
    toJSON: () => ({}),
  } as DOMRect);
}

/** jsdom may lack PointerEvent; React reads the type and client position. */
function pointer(target: EventTarget, type: string, p: { x: number; y: number }) {
  act(() => {
    target.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: p.x, clientY: p.y }));
  });
}

describe("LandingScreen — the hero drag turns the phone the editor's way (S3.2)", () => {
  it("starts flat and invites a drag", async () => {
    await mount();
    expect(readout()).toBe("0° / 0°");
    expect(host.textContent).toContain("drag anywhere to tilt");
    expect(host.textContent).not.toContain("nice — now open the canvas");
  });

  it("dragging right turns the phone right: a negative yaw, rotateY(-…deg)", async () => {
    await mount();
    const el = stage();
    layOut(el);

    // Near the right edge, halfway down: 0.9 of the way right → round(0.9 × -26).
    pointer(el, "pointerdown", at(0.95, 0.5));
    expect(readout()).toBe("-23° / 0°");
    expect(phoneTransform()).toContain("rotateY(-23deg)");
    // Same sign as the editor's Right preset (y: -17).
    expect(host.textContent).toContain("nice — now open the canvas");
    expect(host.textContent).not.toContain("drag anywhere to tilt");

    // To the bottom-right corner: full yaw right, and the top tips back.
    pointer(window, "pointermove", at(1, 1));
    expect(readout()).toBe("-26° / -14°");
    expect(phoneTransform()).toMatch(/rotateX\(-14deg\).*rotateY\(-26deg\)/);

    pointer(window, "pointerup", at(1, 1));
  });

  it("dragging left and up turns it the other way: positive yaw and pitch", async () => {
    await mount();
    const el = stage();
    layOut(el);

    pointer(el, "pointerdown", at(0, 0));
    expect(readout()).toBe("+26° / +14°");
    expect(phoneTransform()).toMatch(/rotateX\(14deg\).*rotateY\(26deg\)/);
    pointer(window, "pointerup", at(0, 0));
  });

  it("stays within the demo's range when the pointer leaves the stage", async () => {
    await mount();
    const el = stage();
    layOut(el);

    pointer(el, "pointerdown", at(0.5, 0.5));
    pointer(window, "pointermove", { x: 5000, y: 5000 });
    expect(readout()).toBe("-26° / -14°");
    pointer(window, "pointermove", { x: -5000, y: -5000 });
    expect(readout()).toBe("+26° / +14°");
    pointer(window, "pointerup", { x: -5000, y: -5000 });
  });

  it("pointerup ends the drag: later moves change nothing", async () => {
    await mount();
    const el = stage();
    layOut(el);

    pointer(el, "pointerdown", at(0.95, 0.5));
    pointer(window, "pointerup", at(0.95, 0.5));
    pointer(window, "pointermove", at(0, 0));
    expect(readout()).toBe("-23° / 0°");
  });

  it("pointercancel ends the drag too", async () => {
    await mount();
    const el = stage();
    layOut(el);

    pointer(el, "pointerdown", at(1, 1));
    expect(readout()).toBe("-26° / -14°");
    pointer(window, "pointercancel", at(1, 1));
    pointer(window, "pointermove", at(0, 0));
    expect(readout()).toBe("-26° / -14°");
    expect(phoneTransform()).toMatch(/rotateX\(-14deg\).*rotateY\(-26deg\)/);
  });

  it("the drag leaves the editor's document alone and navigates nowhere", async () => {
    await mount();
    const el = stage();
    layOut(el);
    const before = useOnstage.getState();

    pointer(el, "pointerdown", at(0.9, 0.2));
    pointer(window, "pointermove", at(0.1, 0.8));
    pointer(window, "pointerup", at(0.1, 0.8));

    expect(useOnstage.getState()).toBe(before);
    expect(nav.router.push).not.toHaveBeenCalled();
  });
});

// ── S3.2: the three claims say only what the product does ───────────────────

const TILT_TITLE = "Tilt the phone, not a slider";
const TILT_BODY =
  "Drag the tilt pad and the phone follows, shadow and all. Four presets when you just want it done.";
const AI_TITLE = "Captions that fit the frame";
const PLAIN_TITLE = "A headline on every frame";

/** The claims row: each card's title and body, in order. */
function featureCards(): { title: string; body: string }[] {
  const tilt = [...host.querySelectorAll("h3")].find((h) => h.textContent?.trim() === TILT_TITLE);
  if (!tilt) throw new Error("no tilt card");
  const grid = tilt.parentElement!.parentElement!;
  return [...grid.children].map((card) => ({
    title: card.querySelector("h3")?.textContent?.trim() ?? "",
    body: card.querySelector("p")?.textContent?.trim() ?? "",
  }));
}

describe("LandingScreen — feature cards (S3.2)", () => {
  it("the tilt card describes the tilt pad, not grabbing the phone", async () => {
    await mount();
    const [tilt] = featureCards();
    expect(tilt).toEqual({ title: TILT_TITLE, body: TILT_BODY });
    expect(host.textContent).not.toContain("Grab it, drag it");
    expect(host.textContent).not.toContain("Perspective lives on the device itself");
  });

  it("with AI assist off (the default), the second card is the plain headline one", async () => {
    await mount();
    const cards = featureCards();
    expect(cards.map((c) => c.title)).toEqual([
      TILT_TITLE,
      PLAIN_TITLE,
      "Named the way the stores expect",
    ]);
    expect(cards[1].body).toBe(
      "Write each frame's headline, then set the font, size and alignment once for the whole set.",
    );
    expect(host.textContent).not.toContain(AI_TITLE);
    expect(host.textContent).not.toContain("three sharper ones");
    // (WHAT COMES OUT's "Locales get their own folders" is about the zip's
    // folders, which the export does write — so only the cards are checked.)
    for (const card of cards) {
      expect(card.body).not.toMatch(/locales/i);
      expect(card.body).not.toMatch(/sharper|suggest/i);
    }
  });

  it("with AI assist on, the original caption card returns", async () => {
    vi.resetModules();
    vi.doMock("@/lib/features", async (importOriginal) => {
      const real = await importOriginal<typeof import("@/lib/features")>();
      return { FEATURES: { ...real.FEATURES, aiAssist: true } };
    });
    try {
      const { LandingScreen: WithAi } = await import("../LandingScreen");
      await act(async () => root.render(<WithAi />));
    } finally {
      vi.doUnmock("@/lib/features");
    }

    const cards = featureCards();
    expect(cards.map((c) => c.title)).toEqual([
      TILT_TITLE,
      AI_TITLE,
      "Named the way the stores expect",
    ]);
    expect(cards[1].body).toContain("three sharper ones");
    expect(cards[1].body).toContain("locales");
    expect(host.textContent).not.toContain(PLAIN_TITLE);
    // The tilt card's copy doesn't depend on the flag.
    expect(cards[0].body).toBe(TILT_BODY);
  });
});
