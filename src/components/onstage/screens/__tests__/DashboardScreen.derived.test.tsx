import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// One router per test, stable across renders the way Next's is.
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
  usePathname: () => "/dashboard",
  useSearchParams: () => nav.params,
}));

import { localBackend } from "@/lib/data/local";
import type { App, ScreenshotSet } from "@/lib/data/types";
import { useOnstage } from "@/store/onstage";
import { DashboardScreen } from "../DashboardScreen";
import { seedLibrary } from "@/lib/data/__tests__/library";
import { doc, frame } from "@/lib/data/__tests__/helpers";

/**
 * Plan S2.3 on the dashboard: the subtitle, each app card's meta line, tags
 * and strip, and the recent-sets order are all derived from the stored
 * records — never the text stored when an app was made, and never fixture
 * copy ("last export", "Google will reject").
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  nav.params = new URLSearchParams();
  for (const fn of Object.values(nav.router)) fn.mockReset();
  useOnstage.setState({ workMode: "canvas" });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
});

async function settle() {
  for (let i = 0; i < 3; i++) await act(() => new Promise((r) => setTimeout(r, 5)));
}

async function mount() {
  await act(async () => root.render(<DashboardScreen />));
  await settle();
}

/** Unmount and mount a fresh dashboard, so both library reads run again. */
async function remount() {
  act(() => root.unmount());
  root = createRoot(host);
  await mount();
}

/** Wait (inside act) until `check` holds, or fail naming `what`. */
async function until(check: () => boolean, what: string, ms = 2000) {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > ms) throw new Error(`timed out waiting for ${what}`);
    await act(() => new Promise((r) => setTimeout(r, 5)));
  }
}

const text = () => host.textContent ?? "";
const pushed = () => nav.router.push.mock.calls.map((c) => c[0] as string);

function button(label: string): HTMLButtonElement {
  const b = [...host.querySelectorAll("button")].find((x) => x.textContent?.trim() === label);
  if (!b) throw new Error(`no "${label}" button`);
  return b;
}

/** The line under "Your apps". */
const subtitle = () => host.querySelector("h1")!.nextElementSibling as HTMLElement;

type Card = {
  el: HTMLElement;
  name: string;
  meta: string;
  tags: string[];
  tagColors: string[];
  thumbs: string[];
};

/** The app cards, in grid order: every tile of the grid but "New app". */
function cards(): Card[] {
  const grid = button("New app").parentElement!;
  return [...grid.children]
    .filter((el): el is HTMLElement => el.tagName === "DIV" && el.children.length === 2)
    .map((el) => {
      const [strip, info] = [...el.children] as HTMLElement[];
      const nameBlock = info.children[0].children[1];
      const tags = [...info.children[1].children] as HTMLElement[];
      return {
        el,
        name: nameBlock.children[0].textContent ?? "",
        meta: nameBlock.children[1].textContent ?? "",
        tags: tags.map((t) => t.textContent ?? ""),
        tagColors: tags.map((t) => t.style.color),
        thumbs: [...strip.children].map((t) => (t as HTMLElement).style.background),
      };
    });
}

function card(name: string): Card {
  const c = cards().find((x) => x.name === name);
  if (!c) throw new Error(`no "${name}" card (have ${cards().map((x) => x.name).join(", ")})`);
  return c;
}

/** The "Recent sets" list and its label. */
function recent() {
  const h2 = [...host.querySelectorAll("h2")].find((h) => h.textContent === "Recent sets")!;
  const header = h2.parentElement!;
  const list = header.nextElementSibling as HTMLElement;
  return {
    label: h2.nextElementSibling?.textContent ?? "",
    names: [...list.children]
      .map((row) => row.children[0]?.children[1]?.children[0]?.textContent ?? "")
      .filter(Boolean),
    list,
  };
}

/** Set the field's value the way typing does, so React's onChange sees it. */
async function type(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  await act(async () => {
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

const searchBox = () => host.querySelector<HTMLInputElement>('input[aria-label="Search apps and sets"]')!;

/* ── fixtures ────────────────────────────────────────────────────────── */

const STORED_THUMBS = ["rgb(1, 1, 1)", "rgb(2, 2, 2)", "rgb(3, 3, 3)", "rgb(4, 4, 4)"];

/** An app record whose stored meta and tags are deliberately wrong. */
const app = (id: string, name: string, over: Partial<App> = {}): App => ({
  id,
  name,
  initial: name.charAt(0),
  meta: "99 SETS · IOS + ANDROID",
  tint: "#123456",
  thumbs: [...STORED_THUMBS],
  tags: [
    { label: "App Store live", kind: "ok" },
    { label: "Play missing 7″", kind: "warn" },
  ],
  ...over,
});

const set = (id: string, appId: string, over: Partial<ScreenshotSet> = {}): ScreenshotSet => ({
  id,
  appId,
  name: id,
  sub: "App Store · EN",
  frameCount: 3,
  status: "Draft",
  updatedAt: "2021-01-01T12:00:00.000Z",
  swatch: "rgb(9, 9, 9)",
  ...over,
});

/**
 * Five apps, each covering one case of the derived card:
 *  - Kite: an App Store set (Ready) and a newer Play set (Draft).
 *  - Moss: two App Store drafts; stored meta claims Android.
 *  - Fern: one Play set (Ready); stored meta claims 12 iOS sets.
 *  - Reed: no sets at all; stored meta claims 5.
 *  - Sage: one record from before sets were real — no store, "Uploaded".
 */
function cardLibrary() {
  return seedLibrary({
    apps: [
      app("kite", "Kite"),
      app("moss", "Moss", { meta: "7 SETS · IOS + ANDROID", tags: [{ label: "4 locales", kind: "neutral" }] }),
      app("fern", "Fern", { meta: "12 SETS · IOS" }),
      app("reed", "Reed", { meta: "5 SETS · IOS + ANDROID", tags: [{ label: "App Store live", kind: "ok" }] }),
      app("sage", "Sage", { meta: "3 SETS · DRAFT", tags: [{ label: "Draft", kind: "neutral" }] }),
    ],
    sets: [
      set("kite-ios", "kite", {
        name: "Kite — iPhone",
        store: "apple",
        status: "Ready",
        updatedAt: "2021-03-01T12:00:00.000Z",
        swatches: ["rgb(10, 0, 0)", "rgb(20, 0, 0)", "rgb(30, 0, 0)"],
      }),
      set("kite-play", "kite", {
        name: "Kite — Play phone",
        sub: "Google Play · EN",
        store: "play",
        status: "Draft",
        updatedAt: "2021-05-01T12:00:00.000Z",
        swatches: ["rgb(0, 10, 0)", "rgb(0, 20, 0)"],
      }),
      set("moss-a", "moss", {
        name: "Moss — spring",
        store: "apple",
        updatedAt: "2021-02-01T12:00:00.000Z",
        swatch: "rgb(0, 0, 50)",
      }),
      set("moss-b", "moss", {
        name: "Moss — winter",
        store: "apple",
        updatedAt: "2021-01-01T12:00:00.000Z",
        swatch: "rgb(0, 0, 60)",
      }),
      set("fern-play", "fern", {
        name: "Fern — Play phone",
        sub: "Google Play · EN",
        store: "play",
        status: "Ready",
        updatedAt: "2021-04-01T12:00:00.000Z",
      }),
      set("sage-old", "sage", { name: "Sage — launch", status: "Uploaded", updatedAt: "6 Mar" }),
    ],
  });
}

/** Every stored meta / tag string above that the cards must never show. */
const STORED_WORDS = [
  "99 SETS",
  "7 SETS",
  "12 SETS",
  "5 SETS",
  "3 SETS · DRAFT",
  "App Store live",
  "Play missing 7″",
  "4 locales",
];

/* ── the subtitle ────────────────────────────────────────────────────── */

describe("DashboardScreen — the library summary line", () => {
  it("with the sample library (3 apps, 4 sets) reads '3 apps · 4 sets' and never 'last export'", async () => {
    const seeded = seedLibrary();
    expect(seeded.apps).toHaveLength(3);
    expect(seeded.sets).toHaveLength(4);
    await mount();
    expect(subtitle().textContent).toBe("3 apps · 4 sets");
    expect(text()).not.toMatch(/last export/i);
    // The old fixed line is gone in every part.
    expect(text()).not.toContain("Three apps");
    expect(text()).not.toContain("6 sets");
  });

  it("follows the library: a created set, a created app, a duplicate and a delete each show on remount", async () => {
    seedLibrary();
    await mount();
    expect(subtitle().textContent).toBe("3 apps · 4 sets");

    const made = await localBackend.createSet({ appId: "ferry", name: "Ferry — Play phone" });
    await remount();
    expect(subtitle().textContent).toBe("3 apps · 5 sets");

    const kite = await localBackend.createApp({ name: "Kite" });
    await remount();
    expect(subtitle().textContent).toBe("4 apps · 5 sets");

    await localBackend.duplicateSet("lumen-draft");
    await remount();
    expect(subtitle().textContent).toBe("4 apps · 6 sets");

    await localBackend.deleteSet(made.id);
    await remount();
    expect(subtitle().textContent).toBe("4 apps · 5 sets");

    // The stored library agrees with what the line says.
    expect(JSON.parse(localStorage.getItem("onstage:apps:v1")!)).toHaveLength(4);
    expect(JSON.parse(localStorage.getItem("onstage:sets:v1")!)).toHaveLength(5);
    expect(cards().map((c) => c.name)).toContain(kite.name);
    expect(text()).not.toMatch(/last export/i);
  });

  it("uses the singular for one of each, and says '0 sets' for an app with none", async () => {
    seedLibrary({ apps: [app("kite", "Kite")], sets: [set("kite-ios", "kite", { store: "apple" })] });
    await mount();
    expect(subtitle().textContent).toBe("1 app · 1 set");

    seedLibrary({ apps: [app("kite", "Kite")], sets: [] });
    await remount();
    expect(subtitle().textContent).toBe("1 app · 0 sets");
  });

  it("is blank, and the cards carry no meta or tags, until the sets have loaded", async () => {
    const { sets } = cardLibrary();
    let release!: (rows: ScreenshotSet[]) => void;
    vi.spyOn(localBackend, "listSets").mockImplementation(
      () => new Promise<ScreenshotSet[]>((resolve) => (release = resolve)),
    );
    await mount();

    // The apps are listed, but nothing is counted yet — and the stored
    // (wrong) meta and tags don't stand in for the real ones.
    expect(subtitle().textContent).toBe(" ");
    expect(cards().map((c) => c.name)).toEqual(["Kite", "Moss", "Fern", "Reed", "Sage"]);
    for (const c of cards()) {
      expect(c.meta).toBe("");
      expect(c.tags).toEqual([]);
    }
    for (const word of STORED_WORDS) expect(text()).not.toContain(word);
    expect(text()).not.toContain("0 SETS");

    await act(async () => release(sets));
    await until(() => card("Kite").meta !== "", "the derived meta line");
    expect(subtitle().textContent).toBe("5 apps · 6 sets");
    expect(card("Kite").meta).toBe("2 SETS · IOS + ANDROID");
    expect(card("Reed").meta).toBe("0 SETS");
  });
});

/* ── no fixed alert ──────────────────────────────────────────────────── */

describe("DashboardScreen — no fixed rejection banner", () => {
  it("'Google will reject' and a 'Fix it' link are absent with the sample library", async () => {
    // The sample includes a "Missing size" set — the old banner's subject.
    const { sets } = seedLibrary();
    expect(sets.some((x) => x.status === "Missing size")).toBe(true);
    await mount();
    expect(text()).not.toContain("Google will reject");
    expect(text()).not.toContain("missing the 7″ tablet size");
    expect(text()).not.toContain("Fix it");
    const links = [...host.querySelectorAll("a, button")].map((el) => el.textContent?.trim());
    expect(links).not.toContain("Fix it");
    // Nothing links to a bare /project (the banner's target).
    expect([...host.querySelectorAll("a")].map((a) => a.getAttribute("href"))).not.toContain("/project");
  });

  it("is absent with any library, including one with Play sets", async () => {
    cardLibrary();
    await mount();
    expect(text()).not.toContain("Google will reject");
    expect(text()).not.toContain("Fix it");
  });
});

/* ── app cards ───────────────────────────────────────────────────────── */

describe("DashboardScreen — app cards derive from their own sets", () => {
  it("each card's meta line counts its sets and names the stores they target", async () => {
    cardLibrary();
    await mount();
    expect(cards().map((c) => [c.name, c.meta])).toEqual([
      ["Kite", "2 SETS · IOS + ANDROID"],
      ["Moss", "2 SETS · IOS"],
      ["Fern", "1 SET · ANDROID"],
      ["Reed", "0 SETS"],
      ["Sage", "1 SET"],
    ]);
  });

  it("each card's tags count ready sets and drafts, or say 'No sets yet'", async () => {
    cardLibrary();
    await mount();
    expect(cards().map((c) => [c.name, c.tags])).toEqual([
      ["Kite", ["1 ready", "1 draft"]],
      ["Moss", ["2 drafts"]],
      ["Fern", ["1 ready"]],
      ["Reed", ["No sets yet"]],
      // "Uploaded" is neither ready nor a draft.
      ["Sage", []],
    ]);
    // "ready" is tinted ok; drafts and "No sets yet" neutral.
    expect(card("Kite").tagColors).toEqual(["var(--ok)", "var(--muted)"]);
    expect(card("Reed").tagColors).toEqual(["var(--muted)"]);
  });

  it("never renders the meta or tags stored in the app records", async () => {
    cardLibrary();
    await mount();
    for (const word of STORED_WORDS) expect(text()).not.toContain(word);
    // The stored records are unchanged — the cards derive, they don't rewrite.
    const stored = JSON.parse(localStorage.getItem("onstage:apps:v1")!) as App[];
    expect(stored.find((a) => a.id === "kite")!.meta).toBe("99 SETS · IOS + ANDROID");
    expect(stored.find((a) => a.id === "reed")!.tags).toEqual([{ label: "App Store live", kind: "ok" }]);
  });

  it("each card's strip is its newest set's swatches repeated to four, else its swatch, else the stored strip", async () => {
    cardLibrary();
    await mount();
    // Kite's newest set is the Play one (May), not the iPhone one (March).
    expect(card("Kite").thumbs).toEqual(["rgb(0, 10, 0)", "rgb(0, 20, 0)", "rgb(0, 10, 0)", "rgb(0, 20, 0)"]);
    // Moss's sets have no swatches: the newest one's swatch, four times.
    expect(card("Moss").thumbs).toEqual(Array(4).fill("rgb(0, 0, 50)"));
    // Reed has no sets: the strip stored with the app.
    expect(card("Reed").thumbs).toEqual(STORED_THUMBS);
  });

  it("an app made in this browser shows '0 SETS' and 'No sets yet', not its stored '0 SETS · DRAFT' and 'Draft'", async () => {
    seedLibrary();
    const kite = await localBackend.createApp({ name: "Kite" });
    // What the record stores — which the card must not echo.
    expect(kite.meta).toBe("0 SETS · DRAFT");
    expect(kite.tags).toEqual([{ label: "Draft", kind: "neutral" }]);
    await mount();
    expect(card("Kite").meta).toBe("0 SETS");
    expect(card("Kite").tags).toEqual(["No sets yet"]);
    expect(text()).not.toContain("0 SETS · DRAFT");
  });

  it("the sample apps' cards come from the sample sets, not the fixture copy", async () => {
    seedLibrary();
    await mount();
    // trailhead-69 (Ready) and trailhead-play (Missing size): no store on
    // either legacy record, so no platforms.
    expect(card("Trailhead").meta).toBe("2 SETS");
    expect(card("Trailhead").tags).toEqual(["1 ready"]);
    expect(card("Ferry").meta).toBe("1 SET");
    expect(card("Ferry").tags).toEqual([]);
    expect(card("Lumen").meta).toBe("1 SET");
    expect(card("Lumen").tags).toEqual(["1 draft"]);
    // (Ferry's stored "4 locales" tag is covered by its [] above: the words
    // also appear in its set row's sub line, which is the set's own record.)
    for (const word of ["3 SETS · IOS + ANDROID", "2 SETS · IOS", "1 SET · DRAFT", "App Store live", "Play missing 7″"]) {
      expect(text()).not.toContain(word);
    }
  });

  it("a set created in an app updates that card (and only that card) on remount", async () => {
    cardLibrary();
    await mount();
    expect(card("Reed").meta).toBe("0 SETS");

    const made = await localBackend.createSet({
      appId: "reed",
      name: "Reed — Play phone",
      doc: doc([frame({ bg: "ember" }), frame({ bg: "ember" })], { store: "play" }),
    });
    expect(made.store).toBe("play");
    expect(made.status).toBe("Draft");
    await remount();

    expect(card("Reed").meta).toBe("1 SET · ANDROID");
    expect(card("Reed").tags).toEqual(["1 draft"]);
    // Its strip is now the new set's backgrounds, not the stored strip.
    expect(card("Reed").thumbs).not.toEqual(STORED_THUMBS);
    expect(card("Reed").thumbs).toHaveLength(4);
    // The others are as they were.
    expect(card("Kite").meta).toBe("2 SETS · IOS + ANDROID");
    expect(card("Fern").meta).toBe("1 SET · ANDROID");
    expect(subtitle().textContent).toBe("5 apps · 7 sets");
  });
});

/* ── recent sets ─────────────────────────────────────────────────────── */

describe("DashboardScreen — recent sets, newest first", () => {
  function orderLibrary() {
    return seedLibrary({
      apps: [app("kite", "Kite")],
      sets: [
        set("undated-1", "kite", { name: "Undated one", updatedAt: "2h ago" }),
        set("mid", "kite", { name: "Mid", updatedAt: "2021-03-01T12:00:00.000Z" }),
        set("undated-2", "kite", { name: "Undated two", updatedAt: "Yesterday" }),
        set("newest", "kite", { name: "Newest", updatedAt: "2021-06-01T12:00:00.000Z" }),
        set("oldest", "kite", { name: "Oldest", updatedAt: "2020-12-01T12:00:00.000Z" }),
      ],
    });
  }

  it("lists the sets newest first by ISO updatedAt, undated ones after in stored order, under 'NEWEST FIRST'", async () => {
    orderLibrary();
    await mount();
    expect(recent().label).toBe("NEWEST FIRST");
    expect(text()).not.toContain("EDITED IN THE LAST 30 DAYS");
    expect(recent().names).toEqual(["Newest", "Mid", "Oldest", "Undated one", "Undated two"]);
    // Only the order is derived; the stored list is left as it was.
    const stored = JSON.parse(localStorage.getItem("onstage:sets:v1")!) as ScreenshotSet[];
    expect(stored.map((x) => x.id)).toEqual(["undated-1", "mid", "undated-2", "newest", "oldest"]);
  });

  it("an edit the editor left waiting for its autosave is stored first: that set is listed newest", async () => {
    orderLibrary();
    localStorage.setItem("onstage:set-docs:v1", JSON.stringify({ oldest: doc([frame({ caption: "Before" })]) }));
    const { openSet } = await import("@/store/onstage");
    await openSet("oldest");
    act(() => useOnstage.getState().patchFrame({ caption: "After" })); // 400 ms debounce pending
    await mount();
    expect(recent().names[0]).toBe("Oldest");
    expect(JSON.parse(localStorage.getItem("onstage:set-docs:v1")!).oldest.frames[0].caption).toBe("After");
    useOnstage.setState({ loadedSetId: null, setId: "" });
  });

  it("the first row is the newest set and opens it by id", async () => {
    orderLibrary();
    await mount();
    const first = recent().list.children[0].children[0] as HTMLElement;
    expect(first.textContent).toContain("Newest");
    await act(async () => first.click());
    expect(pushed()).toEqual(["/editor?set=newest"]);
  });

  it("a set created now goes to the top on remount", async () => {
    orderLibrary();
    await mount();
    await localBackend.createSet({ appId: "kite", name: "Brand new" });
    await remount();
    expect(recent().names).toEqual(["Brand new", "Newest", "Mid", "Oldest", "Undated one", "Undated two"]);
  });

  it("a duplicate of the oldest set is newest, and goes to the top on remount", async () => {
    orderLibrary();
    await mount();
    await localBackend.duplicateSet("oldest");
    await remount();
    expect(recent().names).toEqual(["Oldest copy", "Newest", "Mid", "Oldest", "Undated one", "Undated two"]);
  });

  it("the sample library's legacy (undated) sets keep their stored order", async () => {
    seedLibrary();
    await mount();
    expect(recent().names).toEqual([
      "Trailhead — 6.9″ set",
      "Trailhead — Play phone",
      "Ferry — 6.9″ set",
      "Lumen — first draft",
    ]);
  });
});

/* ── search ──────────────────────────────────────────────────────────── */

describe("DashboardScreen — search matches the derived meta", () => {
  const names = () => cards().map((c) => c.name);

  it("'android' keeps only apps with a Play set — not those whose stored meta says ANDROID", async () => {
    cardLibrary();
    await mount();
    await type(searchBox(), "android");
    // Stored meta would have kept Kite, Moss and Reed; derived keeps Kite and Fern.
    expect(names()).toEqual(["Kite", "Fern"]);
  });

  it("'ios' keeps only apps with an App Store set", async () => {
    cardLibrary();
    await mount();
    await type(searchBox(), "IOS");
    expect(names()).toEqual(["Kite", "Moss"]);
  });

  it("'0 sets' finds the app with no sets; a stored-only count like '99' finds nothing", async () => {
    cardLibrary();
    await mount();
    await type(searchBox(), "0 sets");
    expect(names()).toEqual(["Reed"]);
    await type(searchBox(), "99");
    expect(names()).toEqual([]);
    // The New app tile stays.
    expect(() => button("New app")).not.toThrow();
  });

  it("names still match, and clearing the search brings every card back", async () => {
    cardLibrary();
    await mount();
    await type(searchBox(), "fern");
    expect(names()).toEqual(["Fern"]);
    await act(async () => button("×").click());
    expect(searchBox().value).toBe("");
    expect(names()).toEqual(["Kite", "Moss", "Fern", "Reed", "Sage"]);
  });

  it("a new Play set makes its app match 'android' after remount", async () => {
    cardLibrary();
    await mount();
    await type(searchBox(), "android");
    expect(names()).toEqual(["Kite", "Fern"]);

    await localBackend.createSet({
      appId: "moss",
      name: "Moss — Play phone",
      doc: doc([frame()], { store: "play" }),
    });
    await remount();
    await type(searchBox(), "android");
    expect(names()).toEqual(["Kite", "Moss", "Fern"]);
  });
});
