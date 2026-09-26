import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { localBackend } from "../local";
import { doc, frame, resetImageDb } from "./helpers";

beforeEach(resetImageDb);
afterEach(() => {
  vi.restoreAllMocks();
});

/** Every localStorage key and value, to prove nothing changed. */
const snapshot = () => Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)]));

function refuse(name: "QuotaExceededError" | "SecurityError") {
  const fail = () => {
    throw new DOMException("refused", name);
  };
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(fail);
  vi.spyOn(Storage.prototype, "removeItem").mockImplementation(fail);
}

/** Every Backend method that writes to localStorage (DATA-5). */
const WRITES: [string, () => Promise<unknown>][] = [
  ["signInWithEmail", () => localBackend.signInWithEmail("a@b.co")],
  ["signInWithProvider", () => localBackend.signInWithProvider("apple")],
  ["signOut", () => localBackend.signOut()],
  ["createApp", () => localBackend.createApp({ name: "Ferry" })],
  ["createSet", () => localBackend.createSet({ appId: "trailhead", name: "New", doc: doc([frame()]) })],
  ["createSet (no doc)", () => localBackend.createSet({ appId: "trailhead", name: "New" })],
  ["renameSet", () => localBackend.renameSet("trailhead-69", "Renamed")],
  ["deleteSet", () => localBackend.deleteSet("trailhead-69")],
  ["saveSetDoc", () => localBackend.saveSetDoc("trailhead-69", doc([frame()]))],
  ["rememberLastSet", () => localBackend.rememberLastSet("trailhead-69")],
  ["connectStore", () => localBackend.connectStore("apple")],
  ["disconnectStore", () => localBackend.disconnectStore("google")],
  ["resolveComment", () => localBackend.resolveComment("c1", true)],
  ["replyToComment", () => localBackend.replyToComment("c1", "Thanks")],
  ["inviteMember", () => localBackend.inviteMember("new@b.co", "Editor")],
  ["setMemberRole", () => localBackend.setMemberRole("m1", "Reviewer")],
  ["cancelSubscription", () => localBackend.cancelSubscription()],
  ["createBrandKit", () => localBackend.createBrandKit("Night")],
];

describe("local backend — a refused write is reported, never swallowed (DATA-5)", () => {
  // Something already stored, so "unchanged" means more than "still empty".
  beforeEach(async () => {
    await localBackend.saveSetDoc("trailhead-69", doc([frame({ caption: "Kept" })]));
    await localBackend.createBrandKit("Existing");
    await localBackend.resolveComment("c0", true);
  });

  for (const [name, call] of WRITES) {
    it(`${name} rejects with a readable reason and leaves storage as it was`, async () => {
      const before = snapshot();
      refuse("QuotaExceededError");
      await expect(call()).rejects.toThrow("This browser's storage is full.");
      vi.restoreAllMocks();
      expect(snapshot()).toEqual(before);
    });
  }

  it("names blocked storage differently from full storage", async () => {
    refuse("SecurityError");
    await expect(localBackend.createBrandKit("Night")).rejects.toThrow(
      "This browser is blocking storage for this site.",
    );
  });

  it("won't update a stored value it can't read", async () => {
    localStorage.setItem("onstage:brand-kits:v1", "[{broken");
    await expect(localBackend.createBrandKit("Night")).rejects.toThrow(/unreadable/);
    expect(localStorage.getItem("onstage:brand-kits:v1")).toBe("[{broken");
  });

  it("createSet stores no document when its library record can't be written", async () => {
    const before = snapshot();
    const real = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key: string, value: string) {
      if (key === "onstage:sets:v1") throw new DOMException("refused", "QuotaExceededError");
      return real.call(this, key, value);
    });
    await expect(
      localBackend.createSet({ appId: "trailhead", name: "New", doc: doc([frame({ caption: "orphan?" })]) }),
    ).rejects.toThrow("This browser's storage is full.");
    vi.restoreAllMocks();
    expect(snapshot()).toEqual(before);
  });
});

describe("local backend — ids and shapes", () => {
  it("two sets created in the same millisecond get their own ids and documents", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1_750_000_000_000);
    const [a, b] = await Promise.all([
      localBackend.createSet({ appId: "trailhead", name: "A", doc: doc([frame({ caption: "A" })]) }),
      localBackend.createSet({ appId: "trailhead", name: "B", doc: doc([frame({ caption: "B" })]) }),
    ]);
    expect(a.id).not.toBe(b.id);
    expect((await localBackend.loadSetDoc(a.id))!.frames[0].caption).toBe("A");
    expect((await localBackend.loadSetDoc(b.id))!.frames[0].caption).toBe("B");
  });

  it("a failed createSet puts the documents back exactly, even when there were none", async () => {
    // The first library call seeds the sample app and set (S2.2); do that
    // before the refusal, so what follows is only createSet's own writes.
    await localBackend.listSets();
    const before = snapshot();
    expect(before["onstage:sets:v1"]).toBeTruthy();
    expect(localStorage.getItem("onstage:set-docs:v1")).toBeNull();
    const real = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key: string, value: string) {
      if (key === "onstage:sets:v1") throw new DOMException("refused", "QuotaExceededError");
      return real.call(this, key, value);
    });
    await expect(localBackend.createSet({ appId: "trailhead", name: "B", doc: doc([frame()]) })).rejects.toThrow(
      "This browser's storage is full.",
    );
    vi.restoreAllMocks();
    expect(localStorage.getItem("onstage:set-docs:v1")).toBeNull();
    expect(snapshot()).toEqual(before);
  });

  it("won't coerce a stored value of the wrong kind into the one it expects", async () => {
    // Since S2.2 a rename is stored on the set's own record in the library
    // list (no separate names map), so the list is what must not be coerced
    // — by the call, or by the seeding that runs before it.
    vi.spyOn(console, "warn").mockImplementation(() => {});
    for (const [key, value, call] of [
      ["onstage:brand-kits:v1", "{}", () => localBackend.createBrandKit("Night")],
      ["onstage:sets:v1", '{"trailhead-69":"a"}', () => localBackend.renameSet("trailhead-69", "X")],
      ["onstage:sets:v1", "{}", () => localBackend.createSet({ appId: "trailhead", name: "New", doc: doc([frame()]) })],
      ["onstage:sets:v1", "{}", () => localBackend.saveSetDoc("trailhead-69", doc([frame()]))],
      ["onstage:sets:v1", "{}", () => localBackend.deleteSet("trailhead-69")],
      ["onstage:apps:v1", "{}", () => localBackend.createApp({ name: "Ferry" })],
      ["onstage:resolved-comments:v1", "5", () => localBackend.resolveComment("c1", true)],
    ] as const) {
      localStorage.setItem(key, value);
      await expect(call()).rejects.toThrow(/unreadable/);
      expect(localStorage.getItem(key)).toBe(value);
      expect(localStorage.getItem("onstage:set-docs:v1")).toBeNull();
      localStorage.clear();
    }
  });
});
