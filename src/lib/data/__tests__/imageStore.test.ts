import { beforeEach, describe, expect, it } from "vitest";
import {
  deleteImages,
  getBackup,
  getImage,
  listBackups,
  putBackup,
  putImage,
} from "../imageStore";
import { docImageIds, imageIdFromRef, toImageRef } from "../imageRefs";
import { blobBytes, doc, frame, resetImageDb } from "./helpers";

beforeEach(resetImageDb);

describe("image store", () => {
  it("round-trips a Blob byte-for-byte with its type", async () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 1, 2, 250, 255]);
    const id = await putImage(new Blob([bytes], { type: "image/png" }));
    const back = await getImage(id);
    expect(back).toBeInstanceOf(Blob);
    expect(back!.type).toBe("image/png");
    expect(await blobBytes(back!)).toEqual(Array.from(bytes));
  });

  it("stores a dropped File as-is", async () => {
    const file = new File([new Uint8Array(4096).fill(7)], "01-today.png", { type: "image/png" });
    const id = await putImage(file);
    const back = await getImage(id);
    expect(back!.size).toBe(4096);
    expect(back!.type).toBe("image/png");
  });

  it("gives identical content a fresh random id every time (never a content hash)", async () => {
    const make = () => new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" });
    const a = await putImage(make());
    const b = await putImage(make());
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    // Deleting one copy leaves the other.
    await deleteImages([a]);
    expect(await getImage(a)).toBeNull();
    expect(await getImage(b)).not.toBeNull();
  });

  it("returns null for an id it doesn't have", async () => {
    expect(await getImage("nope")).toBeNull();
  });

  it("deletes only the ids it is given", async () => {
    const ids = await Promise.all([1, 2, 3].map((n) => putImage(new Blob([new Uint8Array([n])]))));
    await deleteImages([ids[0], ids[2]]);
    expect(await getImage(ids[0])).toBeNull();
    expect(await getImage(ids[1])).not.toBeNull();
    expect(await getImage(ids[2])).toBeNull();
    await deleteImages([]); // a no-op, not an error
  });

  it("keeps backups side by side, never overwriting one", async () => {
    const k1 = await putBackup("onstage:set-docs:v1", "first");
    const k2 = await putBackup("onstage:set-docs:v1", "second");
    expect(k1).not.toEqual(k2);
    expect((await getBackup(k1))!.raw).toBe("first");
    expect((await getBackup(k2))!.raw).toBe("second");
    expect((await listBackups()).map((b) => b.raw)).toEqual(["first", "second"]);
  });

  it("rejects with a readable message when IndexedDB is unavailable", async () => {
    const real = globalThis.indexedDB;
    await resetImageDb();
    // @ts-expect-error — simulating a browser without IndexedDB
    delete globalThis.indexedDB;
    try {
      await expect(putImage(new Blob(["x"]))).rejects.toThrow(/IndexedDB is unavailable/);
    } finally {
      globalThis.indexedDB = real;
    }
    // And it recovers once storage is back (a failed open isn't cached).
    const id = await putImage(new Blob(["x"]));
    expect(await getImage(id)).not.toBeNull();
  });
});

describe("image refs", () => {
  it("wraps and unwraps ids", () => {
    expect(toImageRef("abc")).toBe("img:abc");
    expect(imageIdFromRef("img:abc")).toBe("abc");
    expect(imageIdFromRef("img:")).toBeNull();
    expect(imageIdFromRef("data:image/png;base64,AAAA")).toBeNull();
    expect(imageIdFromRef(null)).toBeNull();
  });

  it("collects every id a document references", () => {
    const d = doc([
      frame({ screenshot: "img:a" }),
      frame({ screenshot: "data:image/png;base64,AAAA" }),
      frame({ screenshot: null }),
      frame({ screenshot: "img:a" }),
      frame({ screenshot: "img:b" }),
    ]);
    expect([...docImageIds(d)].sort()).toEqual(["a", "b"]);
    expect(docImageIds(null).size).toBe(0);
  });
});
