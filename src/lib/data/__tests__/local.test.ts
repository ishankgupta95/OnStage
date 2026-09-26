import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { localBackend } from "../local";
import { SET_DOCS_KEY } from "../migrateImages";
import { blobBytes, doc, frame, resetImageDb } from "./helpers";

beforeEach(resetImageDb);
afterEach(() => {
  vi.restoreAllMocks();
});

/** Make every localStorage write throw the way a full store does. */
function fullStorage() {
  return vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
  });
}

describe("local backend — set documents", () => {
  it("saves and loads a document", async () => {
    const d = doc([frame({ caption: "One", screenshot: "img:abc" })]);
    await localBackend.saveSetDoc("s1", d);
    expect(await localBackend.loadSetDoc("s1")).toEqual(d);
    expect(await localBackend.loadSetDoc("nope")).toBeNull();
  });

  it("a failed save rejects and leaves what was stored unchanged — no stripped copy", async () => {
    await localBackend.saveSetDoc("s1", doc([frame({ caption: "Stored", screenshot: "img:abc" })]));
    const before = localStorage.getItem(SET_DOCS_KEY);
    // Only the save's own write fails, the way a quota does for one big
    // value: a fallback that retried with a smaller, stripped copy would
    // succeed on its second write and change what is stored.
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => {
      throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
    });

    await expect(
      localBackend.saveSetDoc("s1", doc([frame({ caption: "Edited", screenshot: "img:abc" })])),
    ).rejects.toThrow(/storage is full/);

    expect(setItem).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(SET_DOCS_KEY)).toBe(before);
    expect(localStorage.getItem(SET_DOCS_KEY)).not.toContain('"screenshot":null');
  });

  it("rejects when storage refuses every write", async () => {
    fullStorage();
    await expect(localBackend.saveSetDoc("s1", doc([frame()]))).rejects.toThrow(/storage is full/);
    vi.restoreAllMocks();
    expect(localStorage.getItem(SET_DOCS_KEY)).toBeNull();
  });

  it("won't write over stored sets it can't read", async () => {
    localStorage.setItem(SET_DOCS_KEY, "{not json");
    await expect(localBackend.saveSetDoc("s1", doc([frame()]))).rejects.toThrow(/unreadable/);
    expect(localStorage.getItem(SET_DOCS_KEY)).toBe("{not json");
  });

  it("keeps a small document small once screenshots are refs", async () => {
    const frames = Array.from({ length: 10 }, (_, i) =>
      frame({ caption: `Frame ${i}`, screenshot: `img:${crypto.randomUUID()}` }),
    );
    await localBackend.saveSetDoc("s1", doc(frames));
    expect(localStorage.getItem(SET_DOCS_KEY)!.length).toBeLessThan(50_000);
  });
});

describe("local backend — screenshots", () => {
  it("puts, gets and deletes image Blobs", async () => {
    const id = await localBackend.putImage(new Blob([new Uint8Array([4, 5, 6])], { type: "image/png" }));
    expect(await blobBytes((await localBackend.getImage(id))!)).toEqual([4, 5, 6]);
    await localBackend.deleteImages([id]);
    expect(await localBackend.getImage(id)).toBeNull();
  });
});
