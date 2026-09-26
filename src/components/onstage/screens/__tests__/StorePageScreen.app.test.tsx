import { act, Suspense } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { doc, frame } from "@/lib/data/__tests__/helpers";
import type { ScreenshotSet, SetDoc } from "@/lib/data/types";
import { bgCss, capInk } from "@/lib/onstage/data";

const nav = vi.hoisted(() => ({
  params: new URLSearchParams(),
  router: { push: vi.fn(), replace: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => nav.router,
  usePathname: () => "/store-preview",
  useSearchParams: () => nav.params,
}));

import { useOnstage } from "@/store/onstage";
import { StorePageScreen } from "../StorePageScreen";
import { seedLibrary } from "@/lib/data/__tests__/library";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Everything the sample's hard-coded Trailhead listing used to put on this
 *  page, whatever set it previewed. */
const SAMPLE_LISTING = [
  "Trailhead",
  "Run & Trail Log",
  "4.8 ★",
  "★",
  "1.2K ratings",
  "Health & Fitness",
  "Age 4+",
  "Rated for 3+",
  "About this app",
  "logs every run",
  "Every run, mapped",
  "Listing checks",
];

/** A Ferry set whose first frame is on "sun" and its second on "ember", so
 *  the feature graphic's background can only have come from frame 0. */
const FERRY_FRAMES = [
  frame({ caption: "Cross in minutes", bg: "sun" }),
  frame({ caption: "Every sailing, live", bg: "ember" }),
  frame({ caption: "Tickets offline", bg: "bone" }),
];

let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  // A returning user's library: Trailhead, Ferry and Lumen as stored records.
  seedLibrary();
  // Nothing open in the editor, so the preview reads the saved document.
  useOnstage.setState({ workMode: "canvas", setId: "", loadedSetId: null, appName: undefined });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

function saveDocs(docs: Record<string, SetDoc>) {
  localStorage.setItem("onstage:set-docs:v1", JSON.stringify(docs));
}

async function mount(query: string) {
  nav.params = new URLSearchParams(query);
  await act(async () =>
    root.render(
      <Suspense>
        <StorePageScreen />
      </Suspense>,
    ),
  );
  for (let i = 0; i < 3; i++) await act(() => new Promise((r) => setTimeout(r, 5)));
}

const text = () => host.textContent ?? "";

function button(label: string): HTMLButtonElement {
  const b = [...host.querySelectorAll("button")].find((x) => x.textContent?.trim() === label);
  if (!b) throw new Error(`no "${label}" button`);
  return b;
}

async function click(el: HTMLElement) {
  await act(async () => el.click());
}

/** The app icon: the 74px tile at the head of the listing. */
function icon(): HTMLElement {
  const el = [...host.querySelectorAll<HTMLElement>("span")].find((x) => x.style.width === "74px");
  if (!el) throw new Error("no app icon");
  return el;
}

/** The app's name, as the line beside the icon shows it. */
function shownName(): string {
  const name = icon().nextElementSibling?.firstElementChild?.textContent;
  if (name == null) throw new Error("no app name beside the icon");
  return name;
}

/** The Play view's feature-graphic mock, or null when it isn't drawn. */
function featureGraphic(): HTMLElement | null {
  const badge = [...host.querySelectorAll("span")].find((x) => x.textContent === "FEATURE GRAPHIC · 1024×500");
  return badge?.parentElement ?? null;
}

/** The mock's text lines, top to bottom (the name, if any, then the caption). */
function featureLines(): HTMLElement[] {
  const fg = featureGraphic();
  if (!fg) throw new Error("no feature graphic");
  return [...fg.firstElementChild!.children] as HTMLElement[];
}

/** How jsdom writes `background: css` back, to compare like with like. */
function cssBackground(css: string): string {
  const probe = document.createElement("div");
  probe.style.background = css;
  return probe.style.background;
}

/** Every hex colour in a CSS value, as jsdom serialises it ("rgb(r, g, b)"). */
const coloursOf = (css: string) => (css.match(/#[0-9a-f]{6}/gi) ?? []).map(cssBackground);

describe("StorePageScreen — the set's own app, never the sample's listing (S3.4)", () => {
  it("previews a Ferry set as Ferry: name, initial and tint from its app record", async () => {
    saveDocs({ "ferry-69": doc(FERRY_FRAMES) });
    await mount("set=ferry-69");

    expect(shownName()).toBe("Ferry");
    expect(icon().textContent).toBe("F");
    expect(icon().style.background).toBe(cssBackground("#3f6fa8"));
    expect(button("GET").style.background).toBe(cssBackground("#3f6fa8"));
    expect(text()).toContain("Cross in minutes");
  });

  it("shows none of the sample's name, subtitle, ratings, age, category, description or checks — in either store", async () => {
    saveDocs({ "ferry-69": doc(FERRY_FRAMES) });
    await mount("set=ferry-69");
    for (const t of SAMPLE_LISTING) expect(text()).not.toContain(t);

    // Play's view had its own age line ("Rated for 3+") and the feature graphic.
    await click(button("Play Store"));
    expect(button("Install")).toBeTruthy();
    expect(shownName()).toBe("Ferry");
    for (const t of SAMPLE_LISTING) expect(text()).not.toContain(t);
  });

  it("a name the set's document gives its app wins over the app record's", async () => {
    saveDocs({ "ferry-69": doc(FERRY_FRAMES, { appName: "Harbour Hopper", store: "play" }) });
    await mount("set=ferry-69");

    expect(shownName()).toBe("Harbour Hopper");
    expect(featureLines()[0].textContent).toBe("Harbour Hopper");
    expect(text()).not.toContain("Ferry");
    // Its icon follows that name, not Ferry's tile.
    expect(icon().textContent).toBe("H");
    expect(icon().style.background).toBe(cssBackground("#5d5294"));
  });

  it("while the editor has the set open, its unsaved name is the one shown", async () => {
    saveDocs({ "ferry-69": doc(FERRY_FRAMES) });
    // As openSet leaves it, plus a rename the autosave hasn't stored yet.
    act(() =>
      useOnstage.setState({ loadedSetId: "ferry-69", frames: FERRY_FRAMES, store: "apple", appName: "Ferry Pro" }),
    );
    await mount("set=ferry-69");

    expect(shownName()).toBe("Ferry Pro");
  });

  it("the sample set still shows Trailhead, since it is that app — but none of its invented listing", async () => {
    saveDocs({ "trailhead-69": doc([frame({ caption: "Log the climb" })]) });
    await mount("set=trailhead-69");

    expect(shownName()).toBe("Trailhead");
    expect(icon().textContent).toBe("T");
    expect(icon().style.background).toBe(cssBackground("#1b6f6a"));
    for (const t of SAMPLE_LISTING.filter((x) => x !== "Trailhead")) expect(text()).not.toContain(t);
  });
});

describe("StorePageScreen — the Play feature graphic mock", () => {
  it("shows the app's name and frame 0's caption on frame 0's background", async () => {
    saveDocs({ "ferry-69": doc(FERRY_FRAMES, { store: "play" }) });
    await mount("set=ferry-69");

    const fg = featureGraphic();
    expect(fg).not.toBeNull();
    // Frame 0's background, colour for colour — not the sample's teal, and
    // not frame 1's ember.
    expect(fg!.style.background).toBe(cssBackground(bgCss("sun")));
    const colours = coloursOf(bgCss("sun"));
    expect(colours.length).toBeGreaterThan(0);
    for (const c of colours) expect(fg!.style.background).toContain(c);
    for (const c of coloursOf(bgCss("ember"))) expect(fg!.style.background).not.toContain(c);
    expect(fg!.style.background).not.toContain(cssBackground("#1b6f6a"));

    const [nameLine, captionLine, ...rest] = featureLines();
    expect(rest).toHaveLength(0);
    expect(nameLine.textContent).toBe("Ferry");
    expect(captionLine.textContent).toBe("Cross in minutes");
    // Ink that reads on frame 0's (light) background.
    expect(nameLine.style.color).toBe(cssBackground(capInk("sun")));
  });

  it("follows frame 0 when the set's first frame is on a dark background", async () => {
    saveDocs({
      "ferry-69": doc([frame({ caption: "Night crossings", bg: "ember" }), frame({ caption: "Day", bg: "sun" })]),
    });
    await mount("set=ferry-69");
    // Starts in the App Store view: no feature graphic there.
    expect(featureGraphic()).toBeNull();

    await click(button("Play Store"));
    expect(featureGraphic()!.style.background).toBe(cssBackground(bgCss("ember")));
    expect(featureLines().map((el) => el.textContent)).toEqual(["Ferry", "Night crossings"]);
  });

  it("with no app record and no name in the set, it shows only the caption — no name line", async () => {
    const { sets } = seedLibrary();
    const orphan: ScreenshotSet = { ...sets[0], id: "orphan-1", appId: "app_gone", name: "Orphan set" };
    seedLibrary({ sets: [...sets, orphan] });
    saveDocs({ "orphan-1": doc(FERRY_FRAMES, { store: "play" }) });
    await mount("set=orphan-1");

    const fg = featureGraphic();
    expect(fg).not.toBeNull();
    expect(fg!.style.background).toBe(cssBackground(bgCss("sun")));
    const lines = featureLines();
    expect(lines.map((el) => el.textContent)).toEqual(["Cross in minutes"]);
    // The placeholder name labels the listing, never the artwork.
    expect(fg!.textContent).not.toContain("Onstage export");
    expect(shownName()).toBe("Onstage export");
    expect(icon().textContent).toBe("O");
    for (const t of SAMPLE_LISTING) expect(text()).not.toContain(t);
  });
});
