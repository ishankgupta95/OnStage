import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as imageStore from "../imageStore";
import { imageIdFromRef } from "../imageRefs";
import { SET_DOCS_KEY, dataUrlToBlob, migrateScreenshotsToImages } from "../migrateImages";
import type { SetDoc } from "../types";
import { blobBytes, doc, frame, pngDataUrl, resetImageDb } from "./helpers";

beforeEach(resetImageDb);
afterEach(() => {
  vi.restoreAllMocks();
});

const quiet = { log: () => {} };

function store(docs: Record<string, SetDoc>): string {
  const raw = JSON.stringify(docs);
  localStorage.setItem(SET_DOCS_KEY, raw);
  return raw;
}

const stored = (): Record<string, SetDoc> => JSON.parse(localStorage.getItem(SET_DOCS_KEY)!);

/** The real image store, with `putImage` failing on its nth call. */
function failingPut(n: number) {
  let calls = 0;
  const store = {
    ...imageStore,
    putImage: vi.fn(async (blob: Blob) => {
      calls++;
      if (calls === n) throw new Error("QuotaExceededError: simulated");
      return imageStore.putImage(blob);
    }),
    deleteImages: vi.fn(imageStore.deleteImages),
  };
  return store;
}

describe("dataUrlToBlob", () => {
  it("decodes base64 with its MIME type", async () => {
    const blob = dataUrlToBlob("data:image/png;base64,AAEC/w==");
    expect(blob.type).toBe("image/png");
    expect(await blobBytes(blob)).toEqual([0, 1, 2, 255]);
  });

  it("decodes percent-encoded text", async () => {
    const blob = dataUrlToBlob("data:image/svg+xml,%3Csvg%2F%3E");
    expect(blob.type).toBe("image/svg+xml");
    expect(await blob.text()).toBe("<svg/>");
  });

  it("rejects things that aren't data URLs", () => {
    expect(() => dataUrlToBlob("img:abc")).toThrow();
    expect(() => dataUrlToBlob("data:image/png;base64")).toThrow();
  });
});

describe("screenshot migration", () => {
  it("moves every doc's data URLs into the image store, verified, after a backup", async () => {
    const a1 = pngDataUrl(1, 3000);
    const a2 = pngDataUrl(2, 2000);
    const b1 = pngDataUrl(3, 1000);
    const raw = store({
      "set-a": doc([frame({ screenshot: a1 }), frame({ caption: "no shot" }), frame({ screenshot: a2 })]),
      "set-b": doc([frame({ screenshot: b1, caption: "B" })], { device: "px9" }),
      "set-c": doc([frame({ caption: "untouched" })]),
    });

    const report = await migrateScreenshotsToImages(quiet);

    expect(report.migrated.sort()).toEqual(["set-a", "set-b"]);
    expect(report.failed).toEqual([]);
    expect(report.images).toBe(3);

    // The raw value was backed up first, intact.
    const backups = await imageStore.listBackups();
    expect(backups).toHaveLength(1);
    expect(backups[0].source).toBe(SET_DOCS_KEY);
    expect(backups[0].raw).toBe(raw);

    // Every screenshot is now a ref whose Blob holds the original bytes.
    const after = stored();
    const expectShot = async (ref: string | null, url: string) => {
      const id = imageIdFromRef(ref);
      expect(id).not.toBeNull();
      const blob = await imageStore.getImage(id!);
      expect(await blobBytes(blob!)).toEqual(await blobBytes(dataUrlToBlob(url)));
      expect(blob!.type).toBe("image/png");
    };
    await expectShot(after["set-a"].frames[0].screenshot, a1);
    await expectShot(after["set-a"].frames[2].screenshot, a2);
    await expectShot(after["set-b"].frames[0].screenshot, b1);

    // Everything else is exactly as it was.
    expect(after["set-a"].frames[1]).toEqual(frame({ caption: "no shot" }));
    expect(after["set-b"].device).toBe("px9");
    expect(after["set-b"].frames[0].caption).toBe("B");
    expect(after["set-c"]).toEqual(doc([frame({ caption: "untouched" })]));
    expect(localStorage.getItem(SET_DOCS_KEY)!.length).toBeLessThan(raw.length);
    expect(localStorage.getItem(SET_DOCS_KEY)).not.toContain("data:");
  });

  it("is a no-op the second time", async () => {
    store({ s: doc([frame({ screenshot: pngDataUrl(1) })]) });
    await migrateScreenshotsToImages(quiet);
    const once = localStorage.getItem(SET_DOCS_KEY);
    const putSpy = vi.spyOn(imageStore, "putImage");

    const report = await migrateScreenshotsToImages(quiet);

    expect(report.skipped).toBe("no data: screenshots");
    expect(report.migrated).toEqual([]);
    expect(localStorage.getItem(SET_DOCS_KEY)).toBe(once);
    expect(await imageStore.listBackups()).toHaveLength(1);
    expect(putSpy).not.toHaveBeenCalled();
  });

  it("does nothing when there is nothing to migrate", async () => {
    const raw = store({ s: doc([frame({ screenshot: "img:already" })]) });
    const report = await migrateScreenshotsToImages(quiet);
    expect(report.skipped).toBe("no data: screenshots");
    expect(localStorage.getItem(SET_DOCS_KEY)).toBe(raw);
    expect(await imageStore.listBackups()).toHaveLength(0);
  });

  it("an IndexedDB failure mid-migration leaves the stored doc byte-identical", async () => {
    const raw = store({
      s: doc([frame({ screenshot: pngDataUrl(1) }), frame({ screenshot: pngDataUrl(2) })]),
    });
    const failing = failingPut(2);

    const report = await migrateScreenshotsToImages({ ...quiet, store: failing });

    expect(localStorage.getItem(SET_DOCS_KEY)).toBe(raw);
    expect(report.migrated).toEqual([]);
    expect(report.failed).toEqual([{ setId: "s", reason: expect.stringContaining("simulated") }]);
    // The Blob stored before the failure is referenced by nothing: removed.
    const orphan = await failing.putImage.mock.results[0].value;
    expect(await imageStore.getImage(orphan)).toBeNull();
  });

  it("converts the other docs when one fails, and keeps the failed one exactly", async () => {
    const good = doc([frame({ screenshot: pngDataUrl(1) })]);
    const bad = doc([frame({ screenshot: pngDataUrl(2) }), frame({ screenshot: pngDataUrl(3) })]);
    store({ good, bad });
    // good → put #1, bad → put #2 ok, put #3 fails.
    const report = await migrateScreenshotsToImages({ ...quiet, store: failingPut(3) });

    expect(report.migrated).toEqual(["good"]);
    expect(report.failed.map((f) => f.setId)).toEqual(["bad"]);
    const after = stored();
    expect(after.bad).toEqual(bad);
    expect(imageIdFromRef(after.good.frames[0].screenshot)).not.toBeNull();

    // A later boot with working storage finishes the job.
    const retry = await migrateScreenshotsToImages(quiet);
    expect(retry.migrated).toEqual(["bad"]);
    expect(localStorage.getItem(SET_DOCS_KEY)).not.toContain("data:");
  });

  it("keeps the doc when a stored screenshot doesn't read back intact", async () => {
    const raw = store({ s: doc([frame({ screenshot: pngDataUrl(1) })]) });
    const lying = {
      ...imageStore,
      getImage: async () => new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" }),
    };
    const report = await migrateScreenshotsToImages({ ...quiet, store: lying });
    expect(report.failed[0].reason).toMatch(/read back intact/);
    expect(localStorage.getItem(SET_DOCS_KEY)).toBe(raw);
  });

  it("drops the Blob when the read-back itself fails, and keeps the doc", async () => {
    const raw = store({ s: doc([frame({ screenshot: pngDataUrl(1) })]) });
    const put = vi.fn(imageStore.putImage);
    const unreadable = {
      ...imageStore,
      putImage: put,
      getImage: async () => {
        throw new Error("read failed");
      },
    };
    const report = await migrateScreenshotsToImages({ ...quiet, store: unreadable });
    expect(report.failed[0].reason).toMatch(/read failed/);
    expect(localStorage.getItem(SET_DOCS_KEY)).toBe(raw);
    const id = await put.mock.results[0].value;
    expect(await imageStore.getImage(id)).toBeNull();
  });

  it("takes one backup for a value it keeps failing on, not one per boot", async () => {
    const raw = store({ s: doc([frame({ screenshot: pngDataUrl(1) })]) });
    const broken = {
      ...imageStore,
      putImage: async () => {
        throw new Error("Blob writes refused");
      },
    };
    for (let boot = 0; boot < 4; boot++) {
      const report = await migrateScreenshotsToImages({ ...quiet, store: broken });
      expect(report.failed).toHaveLength(1);
      expect(report.backupKey).not.toBeNull();
    }
    const backups = await imageStore.listBackups();
    expect(backups).toHaveLength(1);
    expect(backups[0].raw).toBe(raw);
    expect(localStorage.getItem(SET_DOCS_KEY)).toBe(raw);
  });

  it("changes nothing if the backup doesn't read back intact", async () => {
    const raw = store({ s: doc([frame({ screenshot: pngDataUrl(1) })]) });
    const putImage = vi.fn(imageStore.putImage);
    const corrupt = {
      ...imageStore,
      putImage,
      getBackup: async () => ({ source: SET_DOCS_KEY, savedAt: 0, raw: "truncated" }),
    };
    const report = await migrateScreenshotsToImages({ ...quiet, store: corrupt });
    expect(report.skipped).toMatch(/couldn't back up/);
    expect(putImage).not.toHaveBeenCalled();
    expect(localStorage.getItem(SET_DOCS_KEY)).toBe(raw);
  });

  it("leaves the stored value and no Blobs behind when the rewrite can't be saved", async () => {
    const raw = store({ s: doc([frame({ screenshot: pngDataUrl(1) }), frame({ screenshot: pngDataUrl(2) })]) });
    const put = vi.fn(imageStore.putImage);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
    });

    const report = await migrateScreenshotsToImages({ ...quiet, store: { ...imageStore, putImage: put } });

    vi.restoreAllMocks();
    expect(report.migrated).toEqual([]);
    expect(report.failed.map((f) => f.setId)).toEqual(["s"]);
    expect(localStorage.getItem(SET_DOCS_KEY)).toBe(raw);
    for (const result of put.mock.results) expect(await imageStore.getImage(await result.value)).toBeNull();
  });

  it("changes nothing if the backup can't be written", async () => {
    const raw = store({ s: doc([frame({ screenshot: pngDataUrl(1) })]) });
    const putImage = vi.fn(imageStore.putImage);
    const noBackup = {
      ...imageStore,
      putImage,
      putBackup: async () => {
        throw new Error("backups store is full");
      },
    };
    const report = await migrateScreenshotsToImages({ ...quiet, store: noBackup });
    expect(report.skipped).toMatch(/couldn't back up/);
    expect(putImage).not.toHaveBeenCalled();
    expect(localStorage.getItem(SET_DOCS_KEY)).toBe(raw);
  });

  it("leaves an unreadable stored value alone", async () => {
    localStorage.setItem(SET_DOCS_KEY, '{"s": {"frames": [{"screenshot": "data:image/png;base64,AA');
    const before = localStorage.getItem(SET_DOCS_KEY);
    const report = await migrateScreenshotsToImages(quiet);
    expect(report.skipped).toMatch(/unreadable/);
    expect(localStorage.getItem(SET_DOCS_KEY)).toBe(before);
  });

  it("stores a picture used by several frames once", async () => {
    const shot = pngDataUrl(9);
    store({
      a: doc([frame({ screenshot: shot }), frame({ screenshot: shot })]),
      b: doc([frame({ screenshot: shot })]),
    });
    const report = await migrateScreenshotsToImages(quiet);
    expect(report.images).toBe(1);
    const after = stored();
    const refs = [after.a.frames[0], after.a.frames[1], after.b.frames[0]].map((f) => f.screenshot);
    expect(new Set(refs).size).toBe(1);
  });

  it("starts over if another tab rewrites the sets mid-migration, leaving no orphans", async () => {
    store({ s: doc([frame({ screenshot: pngDataUrl(1) })]) });
    const created: string[] = [];
    let interfered = false;
    const racing = {
      ...imageStore,
      putImage: async (blob: Blob) => {
        const id = await imageStore.putImage(blob);
        created.push(id);
        if (!interfered) {
          interfered = true;
          // Another tab saves an edit (still carrying the data URL).
          const other = stored();
          other.s.frames[0].caption = "edited elsewhere";
          localStorage.setItem(SET_DOCS_KEY, JSON.stringify(other));
        }
        return id;
      },
    };
    const report = await migrateScreenshotsToImages({ ...quiet, store: racing });

    expect(report.migrated).toEqual(["s"]);
    const after = stored();
    expect(after.s.frames[0].caption).toBe("edited elsewhere");
    expect(created).toHaveLength(2);
    expect(await imageStore.getImage(created[0])).toBeNull(); // first attempt's Blob dropped
    expect(imageIdFromRef(after.s.frames[0].screenshot)).toBe(created[1]);
    expect(await imageStore.listBackups()).toHaveLength(2); // one per attempt, both kept
  });
});
