import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { seedLibrary } from "@/lib/data/__tests__/library";

/**
 * Plan S3.1 / D3: guided mode's fixture-only surfaces — the store-URL import
 * on step 1 and the caption assistant's tone chips and suggestions on step 3
 * — stay out unless their flags are on, and "Export N files" sends the
 * canvas an export intent instead of pre-setting the dialog on whatever
 * document happens to be in the store.
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

type Flags = Partial<typeof import("@/lib/features").FEATURES>;

const SET = "trailhead-69";

let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  // A returning user's library: the sample apps and sets as stored records.
  seedLibrary();
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
});

async function settle(ms = 0) {
  for (let i = 0; i < 5; i++) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
      await new Promise((r) => setImmediate(r));
    });
  }
}

/**
 * A page load of /guided?set=trailhead-69: the screen and the store from one
 * fresh module graph, with `flags` switched on in it. Resolves once the set
 * has loaded and the flow is on `step`.
 */
async function renderGuided(step: number, flags: Flags = {}) {
  nav.params = new URLSearchParams(`set=${SET}`);
  // No flags: the real module, exactly as a default build reads it.
  if (Object.keys(flags).length) {
    vi.doMock("@/lib/features", async (importOriginal) => {
      const real = await importOriginal<typeof import("@/lib/features")>();
      return { FEATURES: { ...real.FEATURES, ...flags } };
    });
  }
  let loaded: [typeof import("../GuidedScreen"), typeof import("@/store/onstage")];
  try {
    loaded = [await import("../GuidedScreen"), await import("@/store/onstage")];
  } finally {
    vi.doUnmock("@/lib/features");
  }
  const [{ GuidedScreen }, store] = loaded;
  await act(async () => root.render(<GuidedScreen />));
  await settle();
  await vi.waitFor(() => expect(store.useOnstage.getState().loadedSetId).toBe(SET));
  await act(async () => store.useOnstage.setState({ gStep: step }));
  await settle();
  return store;
}

const text = () => host.textContent ?? "";
const buttonTexts = () => [...host.querySelectorAll("button")].map((b) => b.textContent?.trim() ?? "");
const urlField = () => host.querySelector('input[aria-label="Store listing URL"]');

/** The step's explanatory copy: the paragraph under its title. */
function body(title: string): string {
  const h1 = [...host.querySelectorAll("h1")].find((h) => h.textContent === title);
  if (!h1) throw new Error(`no step titled ${title}`);
  const p = h1.nextElementSibling;
  expect(p?.tagName).toBe("P");
  return p?.textContent ?? "";
}

const pushed = () => nav.router.push.mock.calls.map((c) => String(c[0]));

/** An href's path and query, so an escaped `:` reads the same as a bare one. */
const target = (href: string) => {
  const u = new URL(href, "http://x");
  return { path: u.pathname, query: Object.fromEntries(u.searchParams) };
};

function button(label: string): HTMLButtonElement {
  const b = [...host.querySelectorAll("button")].find((el) => el.textContent?.trim() === label);
  if (!b) throw new Error(`no button labelled ${label}`);
  return b;
}

describe("GuidedScreen — fixture-only surfaces (flags off)", () => {
  it("step 1 takes dropped screenshots but offers no store-link import", async () => {
    await renderGuided(0);

    expect(text()).toContain("Bring in your screenshots");
    expect(text()).toContain("Drop up to 10 screenshots");
    expect(text()).not.toContain("Or paste your App Store link");
    expect(urlField()).toBeNull();
    expect(buttonTexts()).not.toContain("Import");
  });

  it("step 3 edits the headline with no tone chips, no suggestions, and no promise of alternatives", async () => {
    const { useOnstage } = await renderGuided(2);

    const textarea = host.querySelector("textarea");
    expect(textarea).not.toBeNull();
    const st = useOnstage.getState();
    expect(textarea?.value).toBe(st.frames[st.active].caption);

    for (const tone of ["Direct", "Benefit-led", "Playful"]) {
      expect(buttonTexts()).not.toContain(tone);
    }
    expect(text()).not.toContain("SUGGESTIONS");
    expect(body("Write the headlines")).toBe("Short and specific beats clever.");
    expect(text()).not.toContain("suggests alternatives");
    // The frame stepper is not part of the assistant: it stays.
    expect(buttonTexts()).toContain("Next frame →");
  });

  it("step 4's export sends the canvas an export intent for this set and leaves the dialog closed", async () => {
    const { useOnstage } = await renderGuided(3);
    expect(text()).toContain("Check what you'll get");
    nav.router.push.mockClear();

    // The set's own defaults since S3.3: 6.9″ + 6.5″, English — 2 × its frames.
    const frames = useOnstage.getState().frames.length;
    await act(async () => button(`Export ${frames * 2} files`).click());
    await settle();

    expect(nav.router.push).toHaveBeenCalledTimes(1);
    // /editor?set=trailhead-69&apply=panel:export (the colon may be escaped).
    expect(pushed().map(target)).toEqual([{ path: "/editor", query: { set: SET, apply: "panel:export" } }]);
    // The editor opens the dialog from `?apply=` once it has loaded the set;
    // nothing is pre-set on the document in the store.
    expect(useOnstage.getState().overlay).toBeNull();
    expect(useOnstage.getState().gStep).toBe(3);
  });
});

// Last: fresh module graphs with the flags on, proving the selectors above
// would have found these surfaces had they mounted.
describe("GuidedScreen — fixture-only surfaces (flags on)", () => {
  it("under aiAssist, step 3 shows the tone chips and suggestions, and its copy promises alternatives", async () => {
    await renderGuided(2, { aiAssist: true });

    for (const tone of ["Direct", "Benefit-led", "Playful"]) {
      expect(buttonTexts()).toContain(tone);
    }
    expect(text()).toContain("SUGGESTIONS");
    expect(body("Write the headlines")).toContain("suggests alternatives");
  });

  it("aiAssist alone does not bring back the store-link import", async () => {
    const { useOnstage } = await renderGuided(2, { aiAssist: true });
    await act(async () => useOnstage.setState({ gStep: 0 }));
    await settle();

    expect(text()).toContain("Drop up to 10 screenshots");
    expect(text()).not.toContain("Or paste your App Store link");
    expect(urlField()).toBeNull();
  });

  it("under storeImport, step 1 offers the store link and its field", async () => {
    await renderGuided(0, { storeImport: true });

    expect(text()).toContain("Drop up to 10 screenshots");
    expect(text()).toContain("Or paste your App Store link");
    expect(urlField()).not.toBeNull();
    expect(buttonTexts()).toContain("Import");
  });
});
