import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { doc, frame } from "@/lib/data/__tests__/helpers";
import { seedLibrary } from "@/lib/data/__tests__/library";
import { localBackend } from "@/lib/data/local";
import type { ScreenshotSet } from "@/lib/data/types";
import { FALLBACK_APP_NAME } from "@/lib/onstage/appName";
import { flushSaves, openSet, useOnstage } from "@/store/onstage";
import { StoreOverlay } from "../StoreOverlay";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Captions that name nothing, so any app name on screen came from the app. */
const FRAMES = [
  frame({ caption: "Cross in minutes" }),
  frame({ caption: "Every sailing, live", bg: "bone" }),
  frame({ caption: "Tickets offline" }),
];

/** What the sample's hard-coded listing used to put in this overlay. */
const SAMPLE_LISTING = ["Trailhead", "Run & Trail Log", "★", "ratings", "Health & Fitness"];

/** The tint `createApp` gives a new app — the fallback when there's no record. */
const FALLBACK_TINT = "#5d5294";

let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  // A returning user's library: Trailhead, Ferry and Lumen as stored records.
  seedLibrary();
  // setId stays "" so these direct state changes never look like an edit
  // of the loaded set (the autosave only records those).
  useOnstage.setState({
    setId: "",
    loadedSetId: null,
    appName: undefined,
    frames: FRAMES,
    store: "apple",
    overlay: "store",
  });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(async () => {
  act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  // Nothing from an opened set may land in the next test's storage.
  await flushSaves();
});

/** Let the library reads resolve and the overlay re-render. */
async function settle() {
  for (let i = 0; i < 3; i++) await act(() => new Promise((r) => setTimeout(r, 5)));
}

async function mount() {
  await act(async () => root.render(<StoreOverlay />));
  await settle();
}

const text = () => host.textContent ?? "";

/** The app icon: the 56px tile left of the name. */
function icon(): HTMLElement {
  const el = [...host.querySelectorAll<HTMLElement>("span")].find((x) => x.style.width === "56px");
  if (!el) throw new Error("no app icon");
  return el;
}

/** The app's name, as the line beside the icon shows it. */
function shownName(): string {
  const name = icon().nextElementSibling?.firstElementChild?.textContent;
  if (name == null) throw new Error("no app name beside the icon");
  return name;
}

function button(label: string): HTMLButtonElement {
  const b = [...host.querySelectorAll("button")].find((x) => x.textContent?.trim() === label);
  if (!b) throw new Error(`no "${label}" button`);
  return b;
}

/** A colour as the DOM serialises it, so "#3f6fa8" and "rgb(63, 111, 168)" compare equal. */
function cssColour(c: string): string {
  const probe = document.createElement("div");
  probe.style.background = c;
  return probe.style.background;
}

/** Point the editor at `setId` as openSet leaves it, without the load. */
function loaded(setId: string, appName?: string) {
  act(() => useOnstage.setState({ loadedSetId: setId, appName }));
}

describe("StoreOverlay — the set's own app, never the sample's listing (S3.4)", () => {
  it("shows a Ferry set as Ferry: its name, initial and tint from the app record", async () => {
    loaded("ferry-69");
    await mount();

    expect(shownName()).toBe("Ferry");
    expect(icon().textContent).toBe("F");
    expect(icon().style.background).toBe(cssColour("#3f6fa8"));
    // The GET button wears the app's tint too.
    expect(button("GET").style.background).toBe(cssColour("#3f6fa8"));
    // And the set's own frames, not anything of the sample's.
    expect(text()).toContain("Cross in minutes");
  });

  it("never shows the sample's name, subtitle or ratings for a Ferry set", async () => {
    loaded("ferry-69");
    await mount();

    for (const t of SAMPLE_LISTING) expect(text()).not.toContain(t);
    expect(icon().style.background).not.toBe(cssColour("#1b6f6a"));
  });

  it("follows the Play toggle without bringing the sample back", async () => {
    loaded("ferry-69");
    act(() => useOnstage.setState({ store: "play" }));
    await mount();

    expect(text()).toContain("As Google Play shows it");
    expect(shownName()).toBe("Ferry");
    for (const t of SAMPLE_LISTING) expect(text()).not.toContain(t);
  });

  it("a name the set itself gives its app wins over the app record's", async () => {
    loaded("ferry-69", "Harbour Hopper");
    await mount();

    expect(shownName()).toBe("Harbour Hopper");
    expect(text()).not.toContain("Ferry");
    // The icon follows the name shown — not Ferry's "F" tile in Ferry's blue.
    expect(icon().textContent).toBe("H");
    expect(icon().style.background).toBe(cssColour("#5d5294"));
  });

  it("the record's own name, given by the set too, keeps the record's tile", async () => {
    loaded("ferry-69", "Ferry");
    await mount();

    expect(shownName()).toBe("Ferry");
    expect(icon().style.background).toBe(cssColour("#3f6fa8"));
  });

  it("the sample set still shows Trailhead, since it is that app", async () => {
    loaded("trailhead-69");
    await mount();

    expect(shownName()).toBe("Trailhead");
    expect(icon().textContent).toBe("T");
    expect(icon().style.background).toBe(cssColour("#1b6f6a"));
    // The name is the record's; the invented subtitle and ratings stay gone.
    expect(text()).not.toContain("Run & Trail Log");
    expect(text()).not.toContain("★");
  });
});

describe("StoreOverlay — nothing names the app", () => {
  it("with no set loaded it reads 'Onstage export' on the default tint", async () => {
    await mount();

    expect(shownName()).toBe(FALLBACK_APP_NAME);
    expect(shownName()).toBe("Onstage export");
    expect(icon().textContent).toBe("O");
    expect(icon().style.background).toBe(cssColour(FALLBACK_TINT));
    for (const t of SAMPLE_LISTING) expect(text()).not.toContain(t);
  });

  it("a set whose app record is gone reads 'Onstage export', not another app's name", async () => {
    const { sets } = seedLibrary();
    const orphan: ScreenshotSet = { ...sets[0], id: "orphan-1", appId: "app_gone", name: "Orphan set" };
    seedLibrary({ sets: [...sets, orphan] });
    loaded("orphan-1");
    await mount();

    expect(shownName()).toBe("Onstage export");
    expect(icon().textContent).toBe("O");
    expect(icon().style.background).toBe(cssColour(FALLBACK_TINT));
    for (const t of ["Trailhead", "Ferry", "Lumen"]) expect(text()).not.toContain(t);
  });

  it("an unreadable library falls back to 'Onstage export' rather than failing", async () => {
    vi.spyOn(localBackend, "listApps").mockRejectedValue(new Error("storage is unavailable"));
    loaded("ferry-69");
    await mount();

    expect(shownName()).toBe("Onstage export");
    expect(text()).not.toContain("storage is unavailable");
  });

  it("a set's own name still shows when there's no app record", async () => {
    loaded("orphan-2", "Tidewater");
    await mount();

    expect(shownName()).toBe("Tidewater");
    // No record to take an initial from: the name's own.
    expect(icon().textContent).toBe("T");
    expect(icon().style.background).toBe(cssColour(FALLBACK_TINT));
  });
});

describe("StoreOverlay — a set opened from storage", () => {
  it("shows the app name saved in the set's document, over its app record's", async () => {
    localStorage.setItem(
      "onstage:set-docs:v1",
      JSON.stringify({ "ferry-69": doc(FRAMES, { appName: "Harbour Hopper" }) }),
    );
    await act(() => openSet("ferry-69"));
    expect(useOnstage.getState().appName).toBe("Harbour Hopper");
    await mount();

    expect(shownName()).toBe("Harbour Hopper");
    for (const t of SAMPLE_LISTING) expect(text()).not.toContain(t);
  });

  it("a saved document without a name shows the app record's", async () => {
    localStorage.setItem("onstage:set-docs:v1", JSON.stringify({ "ferry-69": doc(FRAMES) }));
    await act(() => openSet("ferry-69"));
    await mount();

    expect(shownName()).toBe("Ferry");
    expect(icon().textContent).toBe("F");
  });
});
