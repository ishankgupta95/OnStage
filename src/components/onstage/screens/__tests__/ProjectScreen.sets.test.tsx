import { act, Suspense } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// One router and one set of search params per test, stable across renders the
// way Next's are.
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
  usePathname: () => "/project",
  useSearchParams: () => nav.params,
}));

import { localBackend } from "@/lib/data/local";
import { SET_DOCS_KEY } from "@/lib/data/migrateImages";
import { summarizeDoc } from "@/lib/data/setSummary";
import type { ScreenshotSet, SetDoc } from "@/lib/data/types";
import { defaultDoc } from "@/lib/onstage/docOps";
import { useOnstage } from "@/store/onstage";
import { ProjectScreen } from "../ProjectScreen";
import { seedLibrary, storageSnapshot } from "@/lib/data/__tests__/library";
import { blobBytes, doc, frame, resetImageDb } from "@/lib/data/__tests__/helpers";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const SETS_KEY = "onstage:sets:v1";
const PLAY = "Trailhead — Play phone";
const SIX_NINE = "Trailhead — 6.9″ set";

let root: Root;
let host: HTMLDivElement;
let seeded: ScreenshotSet[];

beforeEach(() => {
  // A returning user's library: the sample apps and sets as stored records.
  seeded = seedLibrary().sets;
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

/** Let the backend reads resolve and the screen re-render. */
async function settle() {
  for (let i = 0; i < 3; i++) await act(() => new Promise((r) => setTimeout(r, 5)));
}

async function mount(query = "app=trailhead") {
  nav.params = new URLSearchParams(query);
  await act(async () =>
    root.render(
      <Suspense>
        <ProjectScreen />
      </Suspense>,
    ),
  );
  await settle();
}

/** Wait (inside act) until `check` holds, or fail naming `what`. */
async function until(check: () => boolean | Promise<boolean>, what: string, ms = 3000) {
  const start = Date.now();
  while (!(await check())) {
    if (Date.now() - start > ms) throw new Error(`timed out waiting for ${what}`);
    await act(() => new Promise((r) => setTimeout(r, 5)));
  }
}

/** Elements whose own text is exactly `text`. */
const byText = (t: string) =>
  [...host.querySelectorAll<HTMLElement>("*")].filter((el) => el.textContent === t);

const text = () => host.textContent ?? "";

/** The clickable line of the set row named `name` (it holds the row's buttons). */
function setRow(name: string): HTMLElement {
  const label = byText(name).at(-1);
  if (!label) throw new Error(`no set row named ${name}`);
  return rowAround(label);
}

function rowAround(inner: HTMLElement): HTMLElement {
  let el: HTMLElement | null = inner;
  while (el && !el.querySelector("button")) el = el.parentElement;
  if (!el) throw new Error("that row has no buttons");
  return el;
}

function button(within: ParentNode, label: string): HTMLButtonElement {
  const b = [...within.querySelectorAll("button")].find((x) => x.textContent?.trim() === label);
  if (!b) throw new Error(`no "${label}" button`);
  return b;
}

async function click(el: HTMLElement) {
  await act(async () => el.click());
}

async function type(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  await act(async () => {
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function press(input: HTMLElement, key: string) {
  await act(async () => {
    input.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
  });
}

const pushed = () => nav.router.push.mock.calls.map((c) => c[0] as string);
const storedSets = () => JSON.parse(localStorage.getItem(SETS_KEY) ?? "[]") as ScreenshotSet[];
const storedDocs = () => JSON.parse(localStorage.getItem(SET_DOCS_KEY) ?? "{}") as Record<string, SetDoc>;
const nameInput = () => host.querySelector<HTMLInputElement>('input[aria-label="Set name"]');
const deleteCard = (name: string) =>
  host.querySelector<HTMLElement>(`[role="group"][aria-label="Delete ${name}?"]`);
const alerts = (within: ParentNode = host) => [...within.querySelectorAll<HTMLElement>('[role="alert"]')];

function refuseWrites() {
  return vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
  });
}

/** Where "Export & upload" goes — the board's selected set. */
async function exportTarget(): Promise<string | null> {
  nav.router.push.mockReset();
  await click(button(host, "Export"));
  const calls = pushed();
  expect(calls).toHaveLength(1);
  return new URL(calls[0], "http://x").searchParams.get("set");
}

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

describe("ProjectScreen Sets tab — New set", () => {
  it("creates a blank set in this app, stores its default document, and opens the editor on it", async () => {
    await mount();
    await click(button(host, "New set"));
    await until(() => nav.router.push.mock.calls.length > 0, "the push to the new set");

    const url = new URL(pushed()[0], "http://x");
    expect(url.pathname).toBe("/editor");
    const id = url.searchParams.get("set")!;
    expect(pushed()).toEqual([`/editor?set=${id}`]);

    const sets = storedSets();
    expect(sets).toHaveLength(seeded.length + 1);
    expect(sets.slice(0, seeded.length)).toEqual(seeded);
    const created = sets.at(-1)!;
    expect(created).toEqual({
      id,
      appId: "trailhead",
      name: "Trailhead — new set",
      ...summarizeDoc(defaultDoc()),
      updatedAt: expect.stringMatching(ISO),
    });
    expect(seeded.some((x) => x.id === id)).toBe(false);
    expect(storedDocs()).toEqual({ [id]: defaultDoc() });
  });

  it("opens the guided flow on the new set when the work mode is guided", async () => {
    await mount();
    act(() => useOnstage.setState({ workMode: "guided" }));
    await click(button(host, "New set"));
    await until(() => nav.router.push.mock.calls.length > 0, "the push to the new set");

    const created = storedSets().at(-1)!;
    expect(created.appId).toBe("trailhead");
    expect(created.name).toBe("Trailhead — new set");
    expect(pushed()).toEqual([`/guided?set=${created.id}`]);
    expect(storedDocs()[created.id]).toBeTruthy();
    // The work mode is the person's preference (S3.2): the document doesn't
    // carry one, and opening the set can't switch the mode back.
    expect("workMode" in storedDocs()[created.id]).toBe(false);
  });

  it("makes the set in the board's own app (Ferry), not the first app", async () => {
    await mount("app=ferry");
    await click(button(host, "New set"));
    await until(() => nav.router.push.mock.calls.length > 0, "the push to the new set");
    const created = storedSets().at(-1)!;
    expect(created.appId).toBe("ferry");
    expect(created.name).toBe("Ferry — new set");
  });

  it("a refused write says why and stores and opens nothing", async () => {
    await mount();
    const before = storageSnapshot();
    const setItem = refuseWrites();
    await click(button(host, "New set"));
    await until(() => alerts().length > 0, "the refusal line");
    expect(alerts().map((a) => a.textContent)).toEqual([
      "Couldn't create the set — This browser's storage is full.",
    ]);
    expect(nav.router.push).not.toHaveBeenCalled();
    setItem.mockRestore();
    expect(storageSnapshot()).toEqual(before);
  });
});

describe("ProjectScreen Sets tab — Rename", () => {
  it("turns the name into a field prefilled with it, with Save and Cancel", async () => {
    await mount();
    expect(nameInput()).toBeNull();
    await click(button(setRow(PLAY), "Rename"));
    const input = nameInput();
    expect(input).not.toBeNull();
    expect(input!.value).toBe(PLAY);
    const row = rowAround(input!);
    expect(() => button(row, "Save")).not.toThrow();
    expect(() => button(row, "Cancel")).not.toThrow();
    // Only that row is being renamed.
    expect(host.querySelectorAll('input[aria-label="Set name"]')).toHaveLength(1);
    expect(byText(SIX_NINE).length).toBeGreaterThan(0);
  });

  it("Enter saves the trimmed name into the set's record, and the list shows it", async () => {
    await mount();
    await click(button(setRow(PLAY), "Rename"));
    const input = nameInput()!;
    await type(input, "  Play phone v2  ");
    await press(input, "Enter");
    await until(() => byText("Play phone v2").length > 0, "the renamed row");

    expect(nameInput()).toBeNull();
    expect(byText(PLAY)).toEqual([]);
    // Only the name of that one record changed.
    expect(storedSets()).toEqual(
      seeded.map((x) => (x.id === "trailhead-play" ? { ...x, name: "Play phone v2" } : x)),
    );
    expect(alerts()).toEqual([]);
  });

  it("Save saves the name too", async () => {
    await mount();
    await click(button(setRow(PLAY), "Rename"));
    const input = nameInput()!;
    await type(input, "Play phone v3");
    await click(button(rowAround(input), "Save"));
    await until(() => byText("Play phone v3").length > 0, "the renamed row");
    expect(storedSets().find((x) => x.id === "trailhead-play")!.name).toBe("Play phone v3");
  });

  it("Escape cancels without writing anything", async () => {
    await mount();
    const before = storageSnapshot();
    await click(button(setRow(PLAY), "Rename"));
    const input = nameInput()!;
    await type(input, "Something else");
    await press(input, "Escape");
    await settle();

    expect(nameInput()).toBeNull();
    expect(byText(PLAY).length).toBeGreaterThan(0);
    expect(text()).not.toContain("Something else");
    expect(storageSnapshot()).toEqual(before);
  });

  it("Cancel cancels without writing anything", async () => {
    await mount();
    const before = storageSnapshot();
    await click(button(setRow(PLAY), "Rename"));
    const input = nameInput()!;
    await type(input, "Something else");
    await click(button(rowAround(input), "Cancel"));
    await settle();
    expect(nameInput()).toBeNull();
    expect(byText(PLAY).length).toBeGreaterThan(0);
    expect(storageSnapshot()).toEqual(before);
  });

  it("Save is disabled for a blank name, and Enter on a blank name writes nothing", async () => {
    await mount();
    const before = storageSnapshot();
    await click(button(setRow(PLAY), "Rename"));
    const input = nameInput()!;
    const save = button(rowAround(input), "Save");
    expect(save.disabled).toBe(false);
    await type(input, "   ");
    expect(save.disabled).toBe(true);
    await press(input, "Enter");
    await settle();
    expect(nameInput()).toBe(input);
    expect(alerts()).toEqual([]);
    expect(storageSnapshot()).toEqual(before);
  });

  it("a refused write shows why and keeps the field with the typed name", async () => {
    await mount();
    const before = storageSnapshot();
    await click(button(setRow(PLAY), "Rename"));
    const input = nameInput()!;
    await type(input, "Play phone v2");
    const setItem = refuseWrites();
    await press(input, "Enter");
    await until(() => alerts().length > 0, "the refusal line");

    expect(alerts().map((a) => a.textContent)).toEqual([
      "Couldn't rename the set — This browser's storage is full.",
    ]);
    expect(nameInput()).toBe(input);
    expect(input.value).toBe("Play phone v2");
    expect(button(rowAround(input), "Save").disabled).toBe(false);
    setItem.mockRestore();
    expect(storageSnapshot()).toEqual(before);
  });
});

describe("ProjectScreen Sets tab — Delete", () => {
  const play = () => doc([frame({ caption: "Play one" }), frame({ caption: "Play two" })]);
  const sixNine = () => doc([frame({ caption: "Six-nine" })]);

  it("asks in the page, under the row — never with window.confirm", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    await mount();
    expect(deleteCard(PLAY)).toBeNull();
    await click(button(setRow(PLAY), "Delete"));

    const card = deleteCard(PLAY);
    expect(card).not.toBeNull();
    expect(card!.textContent).toContain(`Delete “${PLAY}”?`);
    expect(() => button(card!, "Delete set")).not.toThrow();
    expect(() => button(card!, "Keep it")).not.toThrow();
    // Only the one row asks.
    expect(host.querySelectorAll('[role="group"][aria-label^="Delete "]')).toHaveLength(1);
    expect(confirm).not.toHaveBeenCalled();
  });

  it("Keep it removes the card and changes nothing", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    localStorage.setItem(SET_DOCS_KEY, JSON.stringify({ "trailhead-play": play() }));
    await mount();
    const before = storageSnapshot();
    await click(button(setRow(PLAY), "Delete"));
    await click(button(deleteCard(PLAY)!, "Keep it"));
    await settle();

    expect(deleteCard(PLAY)).toBeNull();
    expect(byText(PLAY).length).toBeGreaterThan(0);
    expect(storageSnapshot()).toEqual(before);
    expect(confirm).not.toHaveBeenCalled();
  });

  it("Delete set removes the record and the document, and the row leaves the list", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    localStorage.setItem(
      SET_DOCS_KEY,
      JSON.stringify({ "trailhead-69": sixNine(), "trailhead-play": play() }),
    );
    await mount();
    expect(byText("2 SETS").length).toBeGreaterThan(0);
    await click(button(setRow(PLAY), "Delete"));
    await click(button(deleteCard(PLAY)!, "Delete set"));
    await until(() => byText(PLAY).length === 0, "the row to leave the list");

    expect(storedSets()).toEqual(seeded.filter((x) => x.id !== "trailhead-play"));
    expect(storedDocs()).toEqual({ "trailhead-69": sixNine() });
    expect(deleteCard(PLAY)).toBeNull();
    expect(byText(SIX_NINE).length).toBeGreaterThan(0);
    expect(byText("1 SET").length).toBeGreaterThan(0);
    expect(alerts()).toEqual([]);
    expect(confirm).not.toHaveBeenCalled();
    expect(nav.router.push).not.toHaveBeenCalled();
  });

  it("deletes a set that has a record but no stored document", async () => {
    await mount();
    await click(button(setRow(PLAY), "Delete"));
    await click(button(deleteCard(PLAY)!, "Delete set"));
    await until(() => byText(PLAY).length === 0, "the row to leave the list");
    expect(storedSets().map((x) => x.id)).toEqual(
      seeded.filter((x) => x.id !== "trailhead-play").map((x) => x.id),
    );
    expect(localStorage.getItem(SET_DOCS_KEY)).toBeNull();
  });

  describe("screenshots", () => {
    beforeEach(resetImageDb);

    it("removes a screenshot only the deleted set used, and keeps one trailhead-69 also uses", async () => {
      const only = await localBackend.putImage(new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" }));
      const shared = await localBackend.putImage(new Blob([new Uint8Array([7, 8, 9])], { type: "image/png" }));
      localStorage.setItem(
        SET_DOCS_KEY,
        JSON.stringify({
          "trailhead-69": doc([frame({ caption: "Six-nine", screenshot: `img:${shared}` })]),
          "trailhead-play": doc([
            frame({ caption: "Only here", screenshot: `img:${only}` }),
            frame({ caption: "Shared", screenshot: `img:${shared}` }),
          ]),
        }),
      );
      await mount();
      await click(button(setRow(PLAY), "Delete"));
      await click(button(deleteCard(PLAY)!, "Delete set"));
      await until(async () => (await localBackend.getImage(only)) === null, "the unshared screenshot to go");
      await until(() => byText(PLAY).length === 0, "the row to leave the list");

      expect(await localBackend.getImage(only)).toBeNull();
      const kept = await localBackend.getImage(shared);
      expect(kept).not.toBeNull();
      expect(await blobBytes(kept!)).toEqual([7, 8, 9]);
      expect(Object.keys(storedDocs())).toEqual(["trailhead-69"]);
      expect(storedSets().some((x) => x.id === "trailhead-play")).toBe(false);
      expect(alerts()).toEqual([]);
    });

    it("a delete that removed the set but not its screenshots still says so, though the row has gone", async () => {
      const images = await import("@/lib/data/imageStore");
      const only = await localBackend.putImage(new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" }));
      localStorage.setItem(
        SET_DOCS_KEY,
        JSON.stringify({ "trailhead-play": doc([frame({ caption: "Only here", screenshot: `img:${only}` })]) }),
      );
      vi.spyOn(images, "deleteImages").mockRejectedValue(new Error("IndexedDB refused"));
      await mount();
      await click(button(setRow(PLAY), "Delete"));
      await click(button(deleteCard(PLAY)!, "Delete set"));
      await until(() => byText(PLAY).length === 0, "the row to leave the list");
      await until(() => alerts().length > 0, "the error to show");

      expect(alerts().map((a) => a.textContent)).toEqual([
        "Couldn't delete the set — The set was deleted, but its screenshots couldn't be removed from this browser's storage.",
      ]);
    });
  });

  it("a refused delete says why inside the card, and the set stays listed and stored", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    localStorage.setItem(SET_DOCS_KEY, JSON.stringify({ "trailhead-play": play() }));
    await mount();
    const before = storageSnapshot();
    await click(button(setRow(PLAY), "Delete"));
    const setItem = refuseWrites();
    await click(button(deleteCard(PLAY)!, "Delete set"));
    await until(() => alerts().length > 0, "the refusal line");

    const card = deleteCard(PLAY);
    expect(card).not.toBeNull();
    expect(alerts(card!).map((a) => a.textContent)).toEqual([
      "Couldn't delete the set — This browser's storage is full.",
    ]);
    // It is the only refusal on the page — nothing duplicated under the row.
    expect(alerts()).toHaveLength(1);
    // The card is ready to try again.
    expect(button(card!, "Delete set").disabled).toBe(false);
    expect(byText(PLAY).length).toBeGreaterThan(0);
    expect(byText("2 SETS").length).toBeGreaterThan(0);

    setItem.mockRestore();
    expect(storageSnapshot()).toEqual(before);
    expect(storedSets().some((x) => x.id === "trailhead-play")).toBe(true);
    expect(storedDocs()["trailhead-play"]).toEqual(play());
    expect(confirm).not.toHaveBeenCalled();
  });

  it("after a refused delete, trying again once storage accepts it deletes the set", async () => {
    await mount();
    await click(button(setRow(PLAY), "Delete"));
    const setItem = refuseWrites();
    await click(button(deleteCard(PLAY)!, "Delete set"));
    await until(() => alerts().length > 0, "the refusal line");
    setItem.mockRestore();

    await click(button(deleteCard(PLAY)!, "Delete set"));
    await until(() => byText(PLAY).length === 0, "the row to leave the list");
    expect(storedSets().some((x) => x.id === "trailhead-play")).toBe(false);
    expect(alerts()).toEqual([]);
  });
});

describe("ProjectScreen Sets tab — row buttons act on their row without selecting it", () => {
  it("the default selection is the first listed set", async () => {
    await mount();
    expect(await exportTarget()).toBe("trailhead-69");
  });

  it("Rename on another row doesn't change the Export & upload target", async () => {
    await mount();
    await click(button(setRow(PLAY), "Rename"));
    expect(nameInput()).not.toBeNull();
    expect(await exportTarget()).toBe("trailhead-69");
  });

  it("Save, Cancel and a click in the name field don't select the row either", async () => {
    await mount();
    await click(button(setRow(PLAY), "Rename"));
    await click(nameInput()!);
    await click(button(rowAround(nameInput()!), "Cancel"));
    expect(await exportTarget()).toBe("trailhead-69");

    await click(button(setRow(PLAY), "Rename"));
    await type(nameInput()!, "Play phone v2");
    await click(button(rowAround(nameInput()!), "Save"));
    await until(() => byText("Play phone v2").length > 0, "the renamed row");
    expect(await exportTarget()).toBe("trailhead-69");
  });

  it("Delete and Keep it on another row don't change the target", async () => {
    await mount();
    await click(button(setRow(PLAY), "Delete"));
    await click(button(deleteCard(PLAY)!, "Keep it"));
    expect(await exportTarget()).toBe("trailhead-69");
  });

  it("clicking the row itself does select it (the control for the checks above)", async () => {
    await mount();
    await click(setRow(PLAY));
    expect(await exportTarget()).toBe("trailhead-play");
  });
});
