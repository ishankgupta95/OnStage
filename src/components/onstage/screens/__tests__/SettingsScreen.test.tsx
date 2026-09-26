import { act, Suspense, type ComponentType } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// One router and one set of search params per test, stable across renders the
// way Next's are; each test points `nav.params` at the URL it is testing.
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
  usePathname: () => "/settings",
  useSearchParams: () => nav.params,
}));

import { localBackend } from "@/lib/data/local";
import { loadPrefs, useOnstage } from "@/store/onstage";
import { createBlankSet } from "@/lib/onstage/sets";
import { storageSnapshot } from "@/lib/data/__tests__/library";
import { SettingsScreen } from "../SettingsScreen";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const PREFS_KEY = "onstage:notification-prefs:v1";
const CONNECTIONS_KEY = "onstage:connections:v1";

/** Every notification row, in the order the panel lists them. */
const ALL_ROWS = [
  "Export finished",
  "Store rejected an upload",
  "Comments and mentions",
  "Store token expiring",
  "Product news",
];

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

/** Let the backend reads resolve and the screen re-render. */
async function settle() {
  for (let i = 0; i < 3; i++) await act(() => new Promise((r) => setTimeout(r, 5)));
}

async function mount(query: string, Screen: ComponentType = SettingsScreen) {
  nav.params = new URLSearchParams(query);
  await act(async () =>
    root.render(
      <Suspense>
        <Screen />
      </Suspense>,
    ),
  );
  await settle();
}

/** Unmount and mount again, as a reload of the page would. */
async function remount(query: string, Screen: ComponentType) {
  act(() => root.unmount());
  root = createRoot(host);
  await mount(query, Screen);
}

const text = () => host.textContent ?? "";

function button(within: ParentNode, label: string): HTMLButtonElement {
  const b = [...within.querySelectorAll("button")].find((x) => x.textContent?.trim() === label);
  if (!b) throw new Error(`no "${label}" button`);
  return b;
}

async function click(el: HTMLElement) {
  await act(async () => el.click());
}

/** The labels of the nav rail's tabs; `first` is the rail's first tab. */
function navTabs(first: string): string[] {
  const rail = button(host, first).parentElement!;
  return [...rail.querySelectorAll("button")].map((b) => b.textContent ?? "");
}

const heading = () => host.querySelector("h1")?.textContent;

/** The largest element around `el` holding at most one element matching
 *  `selector` — the card or row that element belongs to. */
function ownBox(el: HTMLElement, selector: string): HTMLElement {
  let box = el;
  while (box.parentElement && box.parentElement.querySelectorAll(selector).length <= 1) {
    box = box.parentElement;
  }
  return box;
}

/** The Store connections card for the store called `name`. */
function card(name: string): HTMLElement {
  const label = [...host.querySelectorAll<HTMLElement>("span")].find((x) => x.textContent === name);
  if (!label) throw new Error(`no card named ${name}`);
  return ownBox(label, "button");
}

const switches = () => [...host.querySelectorAll<HTMLButtonElement>('[role="switch"]')];
const switchLabels = () => switches().map((b) => b.getAttribute("aria-label"));

function toggle(label: string): HTMLButtonElement {
  const sw = switches().find((b) => b.getAttribute("aria-label") === label);
  if (!sw) throw new Error(`no "${label}" switch`);
  return sw;
}

/** The notification row a switch sits in (its label, its switch and any
 *  line under it). */
const row = (label: string) => ownBox(toggle(label), '[role="switch"]');

const alerts = () => [...host.querySelectorAll('[role="alert"]')].map((a) => a.textContent);

type Flags = Partial<typeof import("@/lib/features").FEATURES>;

/**
 * Settings from a fresh module graph with `flags` on, with that graph's local
 * backend (the one its panels read and write through) and the notifications
 * panel on its own.
 */
async function flagged(flags: Flags) {
  vi.resetModules();
  vi.doMock("@/lib/features", async (importOriginal) => {
    const real = await importOriginal<typeof import("@/lib/features")>();
    return { FEATURES: { ...real.FEATURES, ...flags } };
  });
  try {
    const screen = await import("../SettingsScreen");
    const panel = await import("../settings/NotificationsPanel");
    const local = await import("@/lib/data/local");
    return {
      Screen: screen.SettingsScreen,
      Panel: panel.NotificationsPanel,
      backend: local.localBackend,
    };
  } finally {
    vi.doUnmock("@/lib/features");
  }
}

describe("SettingsScreen — every gated flag off", () => {
  it("offers only the Preferences tab", async () => {
    await mount("");
    expect(heading()).toBe("Preferences");
    expect(navTabs("Preferences")).toEqual(["Preferences"]);
    // The login-free part of the tab is there.
    expect(text()).toContain("How you want to work");
    expect(text()).toContain("Default store target");
  });

  it("a ?tab=Store+connections deep link lands on Preferences, with no store surface and no connections read", async () => {
    const connections = vi.spyOn(localBackend, "listConnections");
    await mount("tab=Store+connections");
    expect(heading()).toBe("Preferences");
    expect(navTabs("Preferences")).toEqual(["Preferences"]);
    for (const gone of ["Store connections", "Reconnect", "Disconnect", "App Store Connect", "Google Play Console"]) {
      expect(text()).not.toContain(gone);
    }
    expect(() => button(host, "Reconnect")).toThrow();
    expect(() => button(host, "Disconnect")).toThrow();
    expect(connections).not.toHaveBeenCalled();
  });

  it("a ?tab=Notifications deep link lands on Preferences and never reads notification choices", async () => {
    const prefs = vi.spyOn(localBackend, "getNotificationPrefs");
    await mount("tab=Notifications");
    expect(heading()).toBe("Preferences");
    expect(text()).not.toContain("Notifications");
    expect(switches()).toEqual([]);
    expect(prefs).not.toHaveBeenCalled();
  });
});

const USER_PREFS_KEY = "onstage:prefs:v1";

/** The card whose title line reads `title` (the title's own box's parent). */
function titledCard(title: string): HTMLElement {
  const t = [...host.querySelectorAll<HTMLElement>("div")].find(
    (d) => d.textContent === title && d.children.length === 0,
  );
  if (!t?.parentElement) throw new Error(`no card titled ${title}`);
  return t.parentElement;
}

/** A work-mode choice ("Guided steps" / "Full canvas"): the card clicked. */
function modeCard(label: string): HTMLElement {
  const span = [...titledCard("How you want to work").querySelectorAll<HTMLElement>("span")].find(
    (x) => x.textContent === label,
  );
  if (!span) throw new Error(`no work-mode choice ${label}`);
  return ownBox(span, "span[style*='border-radius: 50%']");
}

/** The work-mode choice drawn as picked (its radio dot is filled). */
function pickedMode(): string[] {
  return ["Guided steps", "Full canvas"].filter((label) => {
    const dot = modeCard(label).querySelector<HTMLElement>("span[style*='border-radius: 50%']");
    return !!dot && dot.style.boxShadow !== "none" && dot.style.boxShadow !== "";
  });
}

const radios = () => [...host.querySelectorAll<HTMLButtonElement>('[role="radio"]')];
const radioState = () => Object.fromEntries(radios().map((r) => [r.textContent, r.getAttribute("aria-checked")]));

function radio(label: string): HTMLButtonElement {
  const r = radios().find((x) => x.textContent === label);
  if (!r) throw new Error(`no "${label}" radio`);
  return r;
}

describe("SettingsScreen — Preferences (S3.2)", () => {
  it("shows how you want to work and one row, Default store target, with no language or units rows", async () => {
    await mount("");
    expect(text()).toContain("How you want to work");
    expect(modeCard("Guided steps")).not.toBe(modeCard("Full canvas"));

    const groups = [...host.querySelectorAll('[role="radiogroup"]')];
    expect(groups).toHaveLength(1);
    expect(groups[0].getAttribute("aria-label")).toBe("Default store target");
    expect(radios().map((r) => r.textContent)).toEqual(["App Store", "Google Play"]);
    expect(radios().every((r) => r.type === "button")).toBe(true);
    // The Preferences card holds that one row and nothing else.
    const prefs = titledCard("Preferences");
    expect(prefs.textContent).toContain("Default store target");
    expect(prefs.querySelectorAll("button")).toHaveLength(2);

    for (const gone of ["Interface language", "Units in size labels", "English (US)", "Points", "Pixels"]) {
      expect(text()).not.toContain(gone);
    }
  });

  it("with nothing stored, App Store is the default target, and only the defaults are stored", async () => {
    await mount("");
    expect(radioState()).toEqual({ "App Store": "true", "Google Play": "false" });
    expect(radios().every((r) => !r.disabled)).toBe(true);
    expect(pickedMode()).toEqual(["Full canvas"]);
    // The first read stores the defaults once (so a set opened later can't
    // decide the work mode); nothing else is written.
    expect(storageSnapshot()).toEqual({ [USER_PREFS_KEY]: JSON.stringify({ workMode: "canvas", defaultStore: "apple" }) });
    expect(alerts()).toEqual([]);
  });

  it("the default store shown is the stored one", async () => {
    localStorage.setItem(USER_PREFS_KEY, JSON.stringify({ workMode: "canvas", defaultStore: "play" }));
    const read = vi.spyOn(localBackend, "getPrefs");
    await mount("");
    expect(read).toHaveBeenCalled();
    expect(radioState()).toEqual({ "App Store": "false", "Google Play": "true" });
  });

  it("the store radios wait for the read: none is checked and both are disabled until it answers", async () => {
    vi.spyOn(localBackend, "getPrefs").mockReturnValue(new Promise(() => {}));
    await mount("");
    expect(radioState()).toEqual({ "App Store": "false", "Google Play": "false" });
    expect(radios().every((r) => r.disabled)).toBe(true);
  });

  it("the work mode shown is the store's (the preference loaded at boot)", async () => {
    useOnstage.setState({ workMode: "guided" });
    await mount("");
    expect(pickedMode()).toEqual(["Guided steps"]);
  });

  it("picking Guided steps stores the preference, and after a reload it is still the one picked", async () => {
    await mount("");
    expect(pickedMode()).toEqual(["Full canvas"]);

    await click(modeCard("Guided steps"));
    await settle();
    expect(pickedMode()).toEqual(["Guided steps"]);
    expect(useOnstage.getState().workMode).toBe("guided");
    expect(JSON.parse(localStorage.getItem(USER_PREFS_KEY)!)).toEqual({ workMode: "guided", defaultStore: "apple" });
    expect(alerts()).toEqual([]);
    // No set document is involved.
    expect(localStorage.getItem("onstage:set-docs:v1")).toBeNull();

    // A reload: the store starts on the default, then boot loads the prefs.
    useOnstage.setState({ workMode: "canvas" });
    await act(() => loadPrefs());
    await remount("", SettingsScreen);
    expect(pickedMode()).toEqual(["Guided steps"]);
  });

  it("picking Full canvas stores that too", async () => {
    localStorage.setItem(USER_PREFS_KEY, JSON.stringify({ workMode: "guided", defaultStore: "play" }));
    useOnstage.setState({ workMode: "guided" });
    await mount("");
    await click(modeCard("Full canvas"));
    await settle();
    expect(pickedMode()).toEqual(["Full canvas"]);
    expect(JSON.parse(localStorage.getItem(USER_PREFS_KEY)!)).toEqual({ workMode: "canvas", defaultStore: "play" });
    // The store radios still show the stored target.
    expect(radioState()).toEqual({ "App Store": "false", "Google Play": "true" });
  });

  it("picking Google Play stores it, and the next new set starts on Play", async () => {
    await mount("");
    await click(radio("Google Play"));
    await settle();
    expect(radioState()).toEqual({ "App Store": "false", "Google Play": "true" });
    expect(JSON.parse(localStorage.getItem(USER_PREFS_KEY)!)).toEqual({ workMode: "canvas", defaultStore: "play" });
    expect(alerts()).toEqual([]);

    const set = await createBlankSet();
    const saved = await localBackend.loadSetDoc(set.id);
    expect(saved?.store).toBe("play");

    // And it survives a reload.
    await remount("", SettingsScreen);
    expect(radioState()).toEqual({ "App Store": "false", "Google Play": "true" });
  });

  it("picking App Store again puts new sets back on the App Store", async () => {
    localStorage.setItem(USER_PREFS_KEY, JSON.stringify({ workMode: "guided", defaultStore: "play" }));
    await mount("");
    await click(radio("App Store"));
    await settle();
    expect(radioState()).toEqual({ "App Store": "true", "Google Play": "false" });
    expect(JSON.parse(localStorage.getItem(USER_PREFS_KEY)!)).toEqual({ workMode: "guided", defaultStore: "apple" });
    const set = await createBlankSet();
    expect((await localBackend.loadSetDoc(set.id))?.store).toBe("apple");
  });

  it("a store pick the browser refuses says why under the Preferences card, and nothing changes", async () => {
    await mount("");
    const before = storageSnapshot();
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("x", "QuotaExceededError");
    });

    await click(radio("Google Play"));
    await settle();
    const prefsCard = titledCard("Preferences");
    expect(prefsCard.querySelector('[role="alert"]')?.textContent).toBe("This browser's storage is full.");
    expect(alerts()).toEqual(["This browser's storage is full."]);
    expect(titledCard("How you want to work").querySelector('[role="alert"]')).toBeNull();
    expect(radioState()).toEqual({ "App Store": "true", "Google Play": "false" });
    expect(radios().every((r) => !r.disabled)).toBe(true);
    expect(storageSnapshot()).toEqual(before);

    // A retry the browser accepts clears the line.
    setItem.mockRestore();
    await click(radio("Google Play"));
    await settle();
    expect(alerts()).toEqual([]);
    expect(radioState()).toEqual({ "App Store": "false", "Google Play": "true" });
  });

  it("a work-mode pick the browser refuses says why under that card, and storage is unchanged", async () => {
    await mount("");
    const before = storageSnapshot();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("x", "QuotaExceededError");
    });

    await click(modeCard("Guided steps"));
    await settle();
    const card = titledCard("How you want to work");
    expect(card.querySelector('[role="alert"]')?.textContent).toBe("This browser's storage is full.");
    expect(alerts()).toEqual(["This browser's storage is full."]);
    expect(titledCard("Preferences").querySelector('[role="alert"]')).toBeNull();
    expect(storageSnapshot()).toEqual(before);
  });

  it("a stored value it can't read shows App Store and won't be written over", async () => {
    localStorage.setItem(USER_PREFS_KEY, "{broken");
    await mount("");
    expect(radioState()).toEqual({ "App Store": "true", "Google Play": "false" });
    await click(radio("Google Play"));
    await settle();
    expect(alerts()).toHaveLength(1);
    expect(alerts()[0]).toMatch(/unreadable/);
    expect(localStorage.getItem(USER_PREFS_KEY)).toBe("{broken");
    expect(radioState()).toEqual({ "App Store": "true", "Google Play": "false" });
  });
});

// Below here each test swaps in a fresh module graph with some flags on.
describe("SettingsScreen — Store connections (storeUpload on)", () => {
  it("adds the Store connections tab, and ?tab=Store+connections opens it with both stores", async () => {
    const { Screen } = await flagged({ storeUpload: true });
    await mount("tab=Store+connections", Screen);
    expect(navTabs("Preferences")).toEqual(["Preferences", "Store connections"]);
    expect(heading()).toBe("Store connections");
    await vi.waitFor(() => expect(() => card("App Store Connect")).not.toThrow());
    const apple = card("App Store Connect");
    const google = card("Google Play Console");
    expect(apple).not.toBe(google);
    expect(apple.textContent).toContain("CONNECTED");
    expect(button(apple, "Disconnect")).toBeTruthy();
    expect(google.textContent).toContain("ACTION NEEDED");
    expect(button(google, "Reconnect")).toBeTruthy();
    // The sample's standing warning is shown, but it is not an error.
    expect(google.textContent).toContain("Uploads to Play are paused until you reconnect.");
    expect(alerts()).toEqual([]);
  });

  it("the nav rail switches to the tab from Preferences", async () => {
    const { Screen } = await flagged({ storeUpload: true });
    await mount("", Screen);
    expect(heading()).toBe("Preferences");
    await click(button(host, "Store connections"));
    await settle();
    expect(heading()).toBe("Store connections");
    expect(() => card("App Store Connect")).not.toThrow();
  });

  it("Disconnect on the connected store disconnects it, and its card then offers Reconnect", async () => {
    const { Screen, backend } = await flagged({ storeUpload: true });
    const disconnect = vi.spyOn(backend, "disconnectStore");
    await mount("tab=Store+connections", Screen);
    await click(button(card("App Store Connect"), "Disconnect"));
    await settle();
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(disconnect).toHaveBeenCalledWith("apple");
    expect(JSON.parse(localStorage.getItem(CONNECTIONS_KEY)!)).toEqual({ apple: false });
    const apple = card("App Store Connect");
    expect(() => button(apple, "Disconnect")).toThrow();
    expect(button(apple, "Reconnect").disabled).toBe(false);
    expect(apple.textContent).toContain("ACTION NEEDED");
    expect(apple.textContent).toContain("Not connected");
    expect(alerts()).toEqual([]);
  });

  it("Reconnect through the local backend marks the store connected", async () => {
    const { Screen, backend } = await flagged({ storeUpload: true });
    const connect = vi.spyOn(backend, "connectStore");
    await mount("tab=Store+connections", Screen);
    await click(button(card("Google Play Console"), "Reconnect"));
    await settle();
    expect(connect).toHaveBeenCalledWith("google");
    const google = card("Google Play Console");
    expect(button(google, "Disconnect")).toBeTruthy();
    expect(google.textContent).toContain("CONNECTED");
    expect(google.textContent).not.toContain("Uploads to Play are paused");
    expect(nav.router.push).not.toHaveBeenCalled();
  });

  it("a refused connect shows why on that store's card", async () => {
    const { Screen, backend } = await flagged({ storeUpload: true });
    vi.spyOn(backend, "connectStore").mockResolvedValue({ error: "nope" });
    await mount("tab=Store+connections", Screen);
    await click(button(card("Google Play Console"), "Reconnect"));
    await settle();
    const google = card("Google Play Console");
    const alert = google.querySelector('[role="alert"]');
    expect(alert?.textContent).toBe("nope");
    // Only on that card, and the card still offers Reconnect.
    expect(alerts()).toEqual(["nope"]);
    expect(card("App Store Connect").querySelector('[role="alert"]')).toBeNull();
    expect(button(google, "Reconnect").disabled).toBe(false);
  });
});

describe("SettingsScreen — Notifications (accounts on)", () => {
  it("with only accounts on, the tab lists just Product news", async () => {
    const { Screen } = await flagged({ accounts: true });
    await mount("tab=Notifications", Screen);
    expect(navTabs("Account")).toEqual(["Account", "Notifications"]);
    expect(heading()).toBe("Notifications");
    expect(switchLabels()).toEqual(["Product news"]);
    for (const other of ALL_ROWS.slice(0, 4)) expect(text()).not.toContain(other);
  });

  it("with jobQueue, storeUpload and teams on too, it lists all five rows", async () => {
    const { Screen } = await flagged({ accounts: true, jobQueue: true, storeUpload: true, teams: true });
    await mount("tab=Notifications", Screen);
    expect(heading()).toBe("Notifications");
    expect(switchLabels()).toEqual(ALL_ROWS);
  });

  it("each row belongs to its own surface's flag", async () => {
    const { Panel } = await flagged({ accounts: true, storeUpload: true });
    await mount("", Panel);
    expect(switchLabels()).toEqual(["Store rejected an upload", "Store token expiring", "Product news"]);
  });

  it("comments and mentions come with teams alone", async () => {
    const { Panel } = await flagged({ accounts: true, teams: true });
    await mount("", Panel);
    expect(switchLabels()).toEqual(["Comments and mentions", "Product news"]);
  });

  it("starts with Product news off and everything else on", async () => {
    const { Screen } = await flagged({ accounts: true, jobQueue: true, storeUpload: true, teams: true });
    await mount("tab=Notifications", Screen);
    expect(Object.fromEntries(switches().map((b) => [b.getAttribute("aria-label"), b.getAttribute("aria-checked")]))).toEqual({
      "Export finished": "true",
      "Store rejected an upload": "true",
      "Comments and mentions": "true",
      "Store token expiring": "true",
      "Product news": "false",
    });
    expect(switches().every((b) => !b.disabled)).toBe(true);
    // Showing the defaults writes nothing.
    expect(localStorage.getItem(PREFS_KEY)).toBeNull();
  });

  it("shows the choices this browser already kept over the defaults", async () => {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ news: true, export: false }));
    const { Panel } = await flagged({ accounts: true, jobQueue: true, storeUpload: true, teams: true });
    await mount("", Panel);
    expect(toggle("Product news").getAttribute("aria-checked")).toBe("true");
    expect(toggle("Export finished").getAttribute("aria-checked")).toBe("false");
    expect(toggle("Store token expiring").getAttribute("aria-checked")).toBe("true");
  });

  it("turning Product news on keeps it, and it is still on after a reload", async () => {
    const { Screen, backend } = await flagged({ accounts: true });
    const write = vi.spyOn(backend, "setNotificationPref");
    await mount("tab=Notifications", Screen);
    expect(toggle("Product news").getAttribute("aria-checked")).toBe("false");

    await click(toggle("Product news"));
    await settle();
    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith("news", true);
    expect(toggle("Product news").getAttribute("aria-checked")).toBe("true");
    expect(JSON.parse(localStorage.getItem(PREFS_KEY)!)).toEqual({ news: true });
    expect(alerts()).toEqual([]);

    const read = vi.spyOn(backend, "getNotificationPrefs");
    await remount("tab=Notifications", Screen);
    expect(read).toHaveBeenCalled();
    expect(toggle("Product news").getAttribute("aria-checked")).toBe("true");
  });

  it("turning a default-on row off stores false for it", async () => {
    const { Screen } = await flagged({ accounts: true, jobQueue: true });
    await mount("tab=Notifications", Screen);
    // jobQueue alone brings back just the render-queue row.
    expect(switchLabels()).toEqual(["Export finished", "Product news"]);
    await click(toggle("Export finished"));
    await settle();
    expect(toggle("Export finished").getAttribute("aria-checked")).toBe("false");
    expect(JSON.parse(localStorage.getItem(PREFS_KEY)!)).toEqual({ export: false });
  });

  it("a write the browser refuses says why under that row and leaves the switch where it was", async () => {
    const { Screen } = await flagged({ accounts: true, jobQueue: true, storeUpload: true, teams: true });
    await mount("tab=Notifications", Screen);
    const before = storageSnapshot();
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("x", "QuotaExceededError");
    });

    await click(toggle("Product news"));
    await settle();
    expect(row("Product news").querySelector('[role="alert"]')?.textContent).toBe(
      "This browser's storage is full.",
    );
    // Only under that row.
    expect(alerts()).toEqual(["This browser's storage is full."]);
    expect(row("Export finished").querySelector('[role="alert"]')).toBeNull();
    expect(toggle("Product news").getAttribute("aria-checked")).toBe("false");
    expect(storageSnapshot()).toEqual(before);
    // Nothing is left pending: the switches work again.
    expect(switches().every((b) => !b.disabled)).toBe(true);

    // A retry the browser accepts clears the line and moves the switch.
    setItem.mockRestore();
    await click(toggle("Product news"));
    await settle();
    expect(alerts()).toEqual([]);
    expect(toggle("Product news").getAttribute("aria-checked")).toBe("true");
    expect(JSON.parse(localStorage.getItem(PREFS_KEY)!)).toEqual({ news: true });
  });

  it("while a change is being kept, every switch is disabled and the clicked one hasn't moved", async () => {
    const { Screen, backend } = await flagged({ accounts: true, jobQueue: true, storeUpload: true, teams: true });
    const write = vi.spyOn(backend, "setNotificationPref").mockReturnValue(new Promise<void>(() => {}));
    await mount("tab=Notifications", Screen);
    expect(switches().every((b) => !b.disabled)).toBe(true);

    await click(toggle("Product news"));
    await settle();
    expect(write).toHaveBeenCalledWith("news", true);
    expect(switches()).toHaveLength(5);
    expect(switches().every((b) => b.disabled)).toBe(true);
    expect(toggle("Product news").getAttribute("aria-checked")).toBe("false");
    expect(localStorage.getItem(PREFS_KEY)).toBeNull();

    // A second click while pending starts no second write.
    await click(toggle("Export finished"));
    expect(write).toHaveBeenCalledTimes(1);
  });
});
