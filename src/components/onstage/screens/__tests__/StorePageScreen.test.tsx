import { act, Suspense } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { doc, frame } from "@/lib/data/__tests__/helpers";

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

let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  // A returning user's library: the sample apps and sets as stored records.
  seedLibrary();
  useOnstage.setState({ workMode: "canvas" });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

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

const href = (label: string) =>
  [...host.querySelectorAll("a")].find((a) => a.textContent?.includes(label) || a.getAttribute("aria-label") === label)
    ?.getAttribute("href");

describe("StorePageScreen — ?set=", () => {
  it("previews the named set, opens it by id, and goes back to its own app's board", async () => {
    localStorage.setItem(
      "onstage:set-docs:v1",
      JSON.stringify({
        "trailhead-69": doc([frame({ caption: "Not this one" })]),
        "trailhead-play": doc([frame({ caption: "Play first" }), frame({ caption: "Play second" })], { store: "play" }),
      }),
    );
    localStorage.setItem("onstage:last-set:v1", JSON.stringify("trailhead-69"));
    await mount("set=trailhead-play");

    const text = host.textContent ?? "";
    expect(text).toContain("Play first");
    expect(text).not.toContain("Not this one");
    expect(href("Open in canvas")).toBe("/editor?set=trailhead-play");
    expect(href("Back")).toBe("/project?app=trailhead");
    // "Open in canvas" means the canvas even for someone who works guided.
    act(() => useOnstage.setState({ workMode: "guided" }));
    await mount("set=trailhead-play");
    expect(href("Open in canvas")).toBe("/editor?set=trailhead-play");
    // Read, never opened (D10).
    expect(useOnstage.getState().loadedSetId).toBeNull();
  });

  it("a set this browser doesn't have gets the in-page 'not here' state", async () => {
    await mount("set=nope");
    expect(host.querySelector("h1")?.textContent).toBe("This set isn't in this browser");
    expect(href("Back to your apps")).toBe("/dashboard");
  });

  it("without ?set= it previews the set a bare /editor would open", async () => {
    localStorage.setItem(
      "onstage:set-docs:v1",
      JSON.stringify({ "ferry-69": doc([frame({ caption: "Ferry frame" })]) }),
    );
    localStorage.setItem("onstage:last-set:v1", JSON.stringify("ferry-69"));
    await mount("");
    expect(host.textContent).toContain("Ferry frame");
    expect(href("Open in canvas")).toBe("/editor?set=ferry-69");
    expect(href("Back")).toBe("/project?app=ferry");
  });
});

describe("StorePageScreen — no fixture listing checks (S3.1)", () => {
  it("shows the search-result crop for the named set, but no Listing checks card and no PASS / FLAGS tally", async () => {
    localStorage.setItem(
      "onstage:set-docs:v1",
      JSON.stringify({
        "trailhead-69": doc([frame({ caption: "Crop frame A" }), frame({ caption: "Crop frame B" }), frame({ caption: "Crop frame C" })]),
      }),
    );
    await mount("set=trailhead-69");

    // The named set's preview rendered (not the 'not here' state)…
    expect(href("Open in canvas")).toBe("/editor?set=trailhead-69");
    const text = host.textContent ?? "";
    expect(text).toContain("Crop frame A");

    // …with its search-result crop: one tile per frame of the set.
    const heading = [...host.querySelectorAll("div")].find((el) => el.textContent === "Search result crop");
    expect(heading).toBeTruthy();
    const tiles = heading!.parentElement!.lastElementChild!;
    expect(tiles.children).toHaveLength(3);

    // …and none of the fixed, never-computed checks.
    expect(text).not.toContain("Listing checks");
    expect(text).not.toContain("PASS");
    expect(text).not.toContain("FLAGS");
    expect(text).not.toContain("Frame 01 tilt is flat");
    expect(text).not.toContain("Caption legible at thumbnail size");
  });
});
