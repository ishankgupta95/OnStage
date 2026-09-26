import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { localBackend } from "../local";
import type { Prefs, SetDoc } from "../types";
import { doc, frame, resetImageDb } from "./helpers";
import { storageSnapshot } from "./library";

const PREFS_KEY = "onstage:notification-prefs:v1";
const CONNECTIONS_KEY = "onstage:connections:v1";
const USER_PREFS_KEY = "onstage:prefs:v1";
const LAST_SET_KEY = "onstage:last-set:v1";
const DOCS_KEY = "onstage:set-docs:v1";

const DEFAULTS: Prefs = { workMode: "canvas", defaultStore: "apple" };

/** A set document as saved before S3.2, with the work mode on it. */
const legacyDoc = (workMode?: "guided" | "canvas"): SetDoc =>
  doc([frame({ caption: "Old one" })], workMode ? { workMode } : {});

/** Documents saved in this browser, and the set opened last (by id). */
function seedLegacy(docs: Record<string, SetDoc>, lastSet: string | null) {
  localStorage.setItem(DOCS_KEY, JSON.stringify(docs));
  if (lastSet !== null) localStorage.setItem(LAST_SET_KEY, JSON.stringify(lastSet));
}

const quotaFull = () =>
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new DOMException("x", "QuotaExceededError");
  });

beforeEach(resetImageDb);
afterEach(() => {
  vi.restoreAllMocks();
});

describe("local backend — notification preferences (SCREENSB-10)", () => {
  it("start with no choices, so every switch shows its default", async () => {
    expect(await localBackend.getNotificationPrefs()).toEqual({});
    expect(localStorage.getItem(PREFS_KEY)).toBeNull();
  });

  it("keep each switch as it was set, across reads", async () => {
    await localBackend.setNotificationPref("news", true);
    await localBackend.setNotificationPref("export", false);
    await localBackend.setNotificationPref("news", false);
    expect(await localBackend.getNotificationPrefs()).toEqual({ news: false, export: false });
    expect(JSON.parse(localStorage.getItem(PREFS_KEY)!)).toEqual({ news: false, export: false });
  });

  it("read a damaged value as no choices, and only report booleans", async () => {
    localStorage.setItem(PREFS_KEY, "{broken");
    expect(await localBackend.getNotificationPrefs()).toEqual({});
    localStorage.setItem(PREFS_KEY, "[true]");
    expect(await localBackend.getNotificationPrefs()).toEqual({});
    localStorage.setItem(PREFS_KEY, JSON.stringify({ news: true, export: "yes", reject: null }));
    expect(await localBackend.getNotificationPrefs()).toEqual({ news: true });
  });

  it("won't write over a stored value it can't read", async () => {
    localStorage.setItem(PREFS_KEY, "{broken");
    await expect(localBackend.setNotificationPref("news", true)).rejects.toThrow(/unreadable/);
    expect(localStorage.getItem(PREFS_KEY)).toBe("{broken");
  });
});

describe("local backend — uploads see the same connections as the dialog (EDITOR-14)", () => {
  it("a store disconnected in this browser refuses as not connected", async () => {
    // The sample has App Store Connect connected; this browser disconnected it.
    await localBackend.disconnectStore("apple");
    expect((await localBackend.listConnections()).find((c) => c.id === "apple")?.connected).toBe(false);
    const result = await localBackend.uploadToStore({ appId: "x", destination: "apple", files: [] });
    expect(result).toMatchObject({ ok: false, reason: "not-connected" });
    expect(result.ok ? "" : result.message).toMatch(/^Connect App Store Connect/);
  });

  it("a store connected in this browser gets as far as the missing store backend", async () => {
    // The sample's Play connection is expired; this browser reconnected it.
    await localBackend.connectStore("google");
    expect(JSON.parse(localStorage.getItem(CONNECTIONS_KEY)!)).toEqual({ google: true });
    const result = await localBackend.uploadToStore({ appId: "x", destination: "google", files: [] });
    expect(result.ok).toBe(false);
    expect(result.ok ? "" : result.message).toMatch(/need the store backend/);
  });
});

describe("local backend — the person's preferences (S3.2)", () => {
  it("empty storage reads as the defaults, and the first read stores them — once", async () => {
    expect(await localBackend.getPrefs()).toEqual(DEFAULTS);
    expect(storageSnapshot()).toEqual({ [USER_PREFS_KEY]: JSON.stringify(DEFAULTS) });
    // Later reads read what is stored; nothing else is written.
    expect(await localBackend.getPrefs()).toEqual(DEFAULTS);
    expect(storageSnapshot()).toEqual({ [USER_PREFS_KEY]: JSON.stringify(DEFAULTS) });
  });

  it("each read hands back its own object, so a caller's change can't leak into the defaults", async () => {
    const first = await localBackend.getPrefs();
    first.workMode = "guided";
    first.defaultStore = "play";
    expect(await localBackend.getPrefs()).toEqual(DEFAULTS);
  });

  it("shows what is stored", async () => {
    localStorage.setItem(USER_PREFS_KEY, JSON.stringify({ workMode: "guided", defaultStore: "play" }));
    expect(await localBackend.getPrefs()).toEqual({ workMode: "guided", defaultStore: "play" });
  });

  it("carries the last-opened set's old work mode over once, and stores it as the preference", async () => {
    seedLegacy({ A: legacyDoc("guided") }, "A");
    const docsBefore = localStorage.getItem(DOCS_KEY);

    expect(await localBackend.getPrefs()).toEqual({ workMode: "guided", defaultStore: "apple" });
    expect(localStorage.getItem(USER_PREFS_KEY)).toBe('{"workMode":"guided","defaultStore":"apple"}');
    // The documents keep their old field; the carry-over only reads them.
    expect(localStorage.getItem(DOCS_KEY)).toBe(docsBefore);
  });

  it("once carried over, the preference is read from prefs — the document losing its field changes nothing", async () => {
    seedLegacy({ A: legacyDoc("guided") }, "A");
    await localBackend.getPrefs();
    const stored = localStorage.getItem(USER_PREFS_KEY);

    // The set is edited and autosaved without the field (S3.2's readDoc).
    localStorage.setItem(DOCS_KEY, JSON.stringify({ A: legacyDoc() }));
    expect(await localBackend.getPrefs()).toEqual({ workMode: "guided", defaultStore: "apple" });
    expect(localStorage.getItem(USER_PREFS_KEY)).toBe(stored);

    // And the document's field no longer decides anything either way.
    localStorage.setItem(DOCS_KEY, JSON.stringify({ A: legacyDoc("canvas") }));
    expect((await localBackend.getPrefs()).workMode).toBe("guided");
  });

  it("a last set with no old field reads as the defaults and stores them, so a set opened later can't decide", async () => {
    seedLegacy({ A: legacyDoc(), B: legacyDoc("guided") }, "A");
    const docsBefore = localStorage.getItem(DOCS_KEY);
    expect(await localBackend.getPrefs()).toEqual(DEFAULTS);
    expect(JSON.parse(localStorage.getItem(USER_PREFS_KEY)!)).toEqual(DEFAULTS);
    expect(localStorage.getItem(DOCS_KEY)).toBe(docsBefore);
    // The older 'guided' set is opened later: the preference stays.
    await localBackend.rememberLastSet("B");
    expect(await localBackend.getPrefs()).toEqual(DEFAULTS);
  });

  it("an old 'canvas' is carried over too, so opening an older 'guided' set later can't flip the preference", async () => {
    // Every pre-S3.2 document carried workMode: "canvas" from defaultDoc(),
    // so this is what most existing browsers hold. It is kept, once, like
    // 'guided' — the set opened last decided it, and opening another set no
    // longer changes it.
    seedLegacy({ A: legacyDoc("canvas"), B: legacyDoc("guided") }, "A");
    const docsBefore = localStorage.getItem(DOCS_KEY);
    expect(await localBackend.getPrefs()).toEqual(DEFAULTS);
    expect(JSON.parse(localStorage.getItem(USER_PREFS_KEY)!)).toEqual(DEFAULTS);
    expect(localStorage.getItem(DOCS_KEY)).toBe(docsBefore);

    // Later the older 'guided' set B is opened (it becomes the last set).
    await localBackend.rememberLastSet("B");
    expect(await localBackend.getPrefs()).toEqual(DEFAULTS);
  });

  it("only the set opened last decides: another set's old 'guided' is not carried over", async () => {
    seedLegacy({ A: legacyDoc("canvas"), B: legacyDoc("guided") }, "A");
    expect((await localBackend.getPrefs()).workMode).toBe("canvas");
    expect(localStorage.getItem(USER_PREFS_KEY) ?? "").not.toContain("guided");

    localStorage.clear();
    seedLegacy({ A: legacyDoc(), B: legacyDoc("guided") }, "A");
    expect((await localBackend.getPrefs()).workMode).toBe("canvas");
    expect(localStorage.getItem(USER_PREFS_KEY) ?? "").not.toContain("guided");
  });

  it("no set opened last, a last set with no document, or an unusable old value carries nothing over", async () => {
    for (const [docs, last] of [
      [{ A: legacyDoc("guided") }, null],
      [{ A: legacyDoc("guided") }, "gone"],
      [{ A: { ...legacyDoc(), workMode: "sideways" } as unknown as SetDoc }, "A"],
    ] as const) {
      localStorage.clear();
      seedLegacy(docs, last);
      const docsBefore = localStorage.getItem(DOCS_KEY);
      expect(await localBackend.getPrefs()).toEqual(DEFAULTS);
      // The defaults are stored; the documents are untouched.
      expect(JSON.parse(localStorage.getItem(USER_PREFS_KEY)!)).toEqual(DEFAULTS);
      expect(localStorage.getItem(DOCS_KEY)).toBe(docsBefore);
    }
  });

  it("damaged saved sets carry nothing over and are left as they were", async () => {
    localStorage.setItem(DOCS_KEY, "{broken");
    localStorage.setItem(LAST_SET_KEY, JSON.stringify("A"));
    expect(await localBackend.getPrefs()).toEqual(DEFAULTS);
    expect(localStorage.getItem(DOCS_KEY)).toBe("{broken");
    expect(JSON.parse(localStorage.getItem(USER_PREFS_KEY)!)).toEqual(DEFAULTS);
  });

  it("if storage refuses the carry-over, the read still says 'guided' and the next read carries it over again", async () => {
    seedLegacy({ A: legacyDoc("guided") }, "A");
    const before = storageSnapshot();
    const setItem = quotaFull();
    expect(await localBackend.getPrefs()).toEqual({ workMode: "guided", defaultStore: "apple" });
    expect(storageSnapshot()).toEqual(before);

    setItem.mockRestore();
    expect((await localBackend.getPrefs()).workMode).toBe("guided");
    expect(JSON.parse(localStorage.getItem(USER_PREFS_KEY)!)).toEqual({ workMode: "guided", defaultStore: "apple" });
  });

  it("a stored value it can't read shows the defaults, and setPrefs won't write over it", async () => {
    localStorage.setItem(USER_PREFS_KEY, "{broken");
    expect(await localBackend.getPrefs()).toEqual(DEFAULTS);
    await expect(localBackend.setPrefs({ defaultStore: "play" })).rejects.toThrow(/unreadable/);
    await expect(localBackend.setPrefs({ workMode: "guided" })).rejects.toThrow(/unreadable/);
    expect(localStorage.getItem(USER_PREFS_KEY)).toBe("{broken");
  });

  it("an unreadable prefs value is not replaced by a carry-over either", async () => {
    seedLegacy({ A: legacyDoc("guided") }, "A");
    localStorage.setItem(USER_PREFS_KEY, "{broken");
    const before = storageSnapshot();
    await localBackend.getPrefs();
    expect(storageSnapshot()).toEqual(before);
  });

  it("stored values that aren't allowed read as the default, field by field", async () => {
    localStorage.setItem(USER_PREFS_KEY, JSON.stringify({ workMode: "x", defaultStore: 7 }));
    expect(await localBackend.getPrefs()).toEqual(DEFAULTS);

    localStorage.setItem(USER_PREFS_KEY, JSON.stringify({ workMode: "guided", defaultStore: 7 }));
    expect(await localBackend.getPrefs()).toEqual({ workMode: "guided", defaultStore: "apple" });

    localStorage.setItem(USER_PREFS_KEY, JSON.stringify({ workMode: "Guided", defaultStore: "play" }));
    expect(await localBackend.getPrefs()).toEqual({ workMode: "canvas", defaultStore: "play" });

    for (const odd of ["[]", '["guided"]', "42", "null", '"guided"']) {
      localStorage.setItem(USER_PREFS_KEY, odd);
      expect(await localBackend.getPrefs()).toEqual(DEFAULTS);
    }
  });

  it("setPrefs changes only what it is given and resolves with everything as now stored", async () => {
    const after = await localBackend.setPrefs({ defaultStore: "play" });
    expect(after).toEqual({ workMode: "canvas", defaultStore: "play" });
    expect(JSON.parse(localStorage.getItem(USER_PREFS_KEY)!)).toEqual(after);

    const again = await localBackend.setPrefs({ workMode: "guided" });
    expect(again).toEqual({ workMode: "guided", defaultStore: "play" });
    expect(JSON.parse(localStorage.getItem(USER_PREFS_KEY)!)).toEqual(again);
    expect(await localBackend.getPrefs()).toEqual(again);

    // Both at once.
    expect(await localBackend.setPrefs({ workMode: "canvas", defaultStore: "apple" })).toEqual(DEFAULTS);
    expect(await localBackend.getPrefs()).toEqual(DEFAULTS);
  });

  it("setPrefs ignores fields it doesn't know and values a field doesn't allow", async () => {
    await localBackend.setPrefs({ workMode: "guided", defaultStore: "play" });
    const stored = localStorage.getItem(USER_PREFS_KEY);

    const patch = { workMode: "sideways", defaultStore: 7, theme: "light" } as unknown as Partial<Prefs>;
    expect(await localBackend.setPrefs(patch)).toEqual({ workMode: "guided", defaultStore: "play" });
    expect(JSON.parse(localStorage.getItem(USER_PREFS_KEY)!)).toEqual(JSON.parse(stored!));
    expect(localStorage.getItem(USER_PREFS_KEY)).not.toContain("theme");

    // A valid field alongside an invalid one still lands.
    const mixed = { workMode: "canvas", defaultStore: "windows" } as unknown as Partial<Prefs>;
    expect(await localBackend.setPrefs(mixed)).toEqual({ workMode: "canvas", defaultStore: "play" });
  });

  it("setPrefs keeps stored fields it can read and drops the ones it can't", async () => {
    localStorage.setItem(USER_PREFS_KEY, JSON.stringify({ workMode: "guided", defaultStore: 7, junk: true }));
    expect(await localBackend.setPrefs({ defaultStore: "play" })).toEqual({ workMode: "guided", defaultStore: "play" });
    expect(JSON.parse(localStorage.getItem(USER_PREFS_KEY)!)).toEqual({ workMode: "guided", defaultStore: "play" });
  });

  it("picking a default store while the carry-over is still unstored keeps the carried-over work mode", async () => {
    // The read said 'guided' but storage refused to keep it; then storage
    // recovers and the person picks a default store. That is not a choice
    // about the work mode, so it must not turn 'guided' back into 'canvas'.
    seedLegacy({ A: legacyDoc("guided") }, "A");
    const setItem = quotaFull();
    expect((await localBackend.getPrefs()).workMode).toBe("guided");
    setItem.mockRestore();

    expect(await localBackend.setPrefs({ defaultStore: "play" })).toEqual({ workMode: "guided", defaultStore: "play" });
    expect(await localBackend.getPrefs()).toEqual({ workMode: "guided", defaultStore: "play" });
  });

  it("a write the browser refuses rejects with why, and storage is left exactly as it was", async () => {
    await localBackend.setPrefs({ defaultStore: "play" });
    const before = storageSnapshot();
    quotaFull();
    await expect(localBackend.setPrefs({ workMode: "guided" })).rejects.toThrow("This browser's storage is full.");
    expect(storageSnapshot()).toEqual(before);
  });

  it("a refused first write leaves no prefs key behind", async () => {
    quotaFull();
    await expect(localBackend.setPrefs({ defaultStore: "play" })).rejects.toThrow("This browser's storage is full.");
    expect(storageSnapshot()).toEqual({});
  });

  it("storage blocked on read: getPrefs resolves with the defaults instead of rejecting", async () => {
    seedLegacy({ A: legacyDoc("guided") }, "A");
    localStorage.setItem(USER_PREFS_KEY, JSON.stringify({ workMode: "guided", defaultStore: "play" }));
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    await expect(localBackend.getPrefs()).resolves.toEqual(DEFAULTS);
    expect(setItem).not.toHaveBeenCalled();
  });

  it("storage blocked on read: setPrefs rejects saying storage is blocked, and writes nothing", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    await expect(localBackend.setPrefs({ workMode: "guided" })).rejects.toThrow(
      "This browser is blocking storage for this site.",
    );
    expect(setItem).not.toHaveBeenCalled();
  });
});
