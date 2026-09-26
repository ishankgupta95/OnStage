import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { localBackend } from "@/lib/data/local";
import { MAX_BYTES, MIN_SIDE, measureImage, readImageFiles, type MeasureImage } from "../readImageFile";

/** A small file of the given type; its bytes never matter, the injected
 *  measure decides what it "decodes" to. */
const file = (name: string, type = "image/png", bytes = 8) =>
  new File([new Uint8Array(bytes).fill(7)], name, { type });

/** A file that reports `size` bytes without allocating them. */
const sized = (name: string, size: number, type = "image/png") => {
  const f = file(name, type);
  Object.defineProperty(f, "size", { value: size });
  return f;
};

/** Measures every file as a real 6.9″ screenshot unless told otherwise, by name. */
function measureBy(sizes: Record<string, { w: number; h: number } | "undecodable"> = {}) {
  return vi.fn<MeasureImage>(async (blob) => {
    const size = sizes[(blob as File).name];
    if (size === "undecodable") throw new Error("undecodable");
    return size ?? { w: 1320, h: 2868 };
  });
}

/** No IndexedDB round-trip: each stored file becomes `id-<name>`. */
const spyPut = () =>
  vi.spyOn(localBackend, "putImage").mockImplementation(async (blob) => `id-${(blob as File).name}`);
let put: ReturnType<typeof spyPut>;

beforeEach(() => {
  put = spyPut();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("readImageFiles — what a screenshot must be (SCREENSB-9)", () => {
  it.each([
    ["an unknown type", ""],
    ["a text file", "text/plain"],
    ["a HEIC photo", "image/heic"],
    ["a TIFF", "image/tiff"],
    ["a GIF", "image/gif"],
    ["an SVG", "image/svg+xml"],
  ])("turns away %s without decoding or storing it", async (_, type) => {
    const measure = measureBy();
    const read = await readImageFiles([file("shot", type)], Infinity, measure);

    expect(read.rejected).toEqual([{ name: "shot", reason: "isn't a PNG, JPEG or WebP" }]);
    expect(read.stored).toEqual([]);
    expect(read.overflow).toBe(0);
    expect(measure).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
  });

  it.each([
    ["PNG", "image/png"],
    ["JPEG", "image/jpeg"],
    ["WebP", "image/webp"],
  ])("takes a %s", async (_, type) => {
    const read = await readImageFiles([file("shot", type)], Infinity, measureBy());
    expect(read.rejected).toEqual([]);
    expect(read.stored).toEqual([{ name: "shot", result: "img:id-shot" }]);
  });

  it("turns away a file over 20 MB, without decoding it", async () => {
    const measure = measureBy();
    const read = await readImageFiles([sized("huge.png", MAX_BYTES + 1)], Infinity, measure);

    expect(MAX_BYTES).toBe(20 * 1024 * 1024);
    expect(read.rejected).toEqual([{ name: "huge.png", reason: "is over 20 MB" }]);
    expect(read.stored).toEqual([]);
    expect(measure).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
  });

  it("takes a file of exactly 20 MB", async () => {
    const big = sized("big.png", MAX_BYTES);
    const read = await readImageFiles([big], Infinity, measureBy());
    expect(read.rejected).toEqual([]);
    expect(put).toHaveBeenCalledTimes(1);
    expect(put.mock.calls[0][0]).toBe(big);
  });

  it("turns away a file that can't be decoded", async () => {
    const read = await readImageFiles(
      [file("broken.png")],
      Infinity,
      measureBy({ "broken.png": "undecodable" }),
    );
    expect(read.rejected).toEqual([{ name: "broken.png", reason: "couldn't be read as an image" }]);
    expect(put).not.toHaveBeenCalled();
  });

  it("turns away an image under 600 px on its short side, and says its size", async () => {
    const read = await readImageFiles(
      [file("tiny.png"), file("wide.png")],
      Infinity,
      measureBy({ "tiny.png": { w: 400, h: 800 }, "wide.png": { w: 1600, h: 599 } }),
    );
    expect(MIN_SIDE).toBe(600);
    expect(read.rejected).toEqual([
      { name: "tiny.png", reason: "is 400 × 800 — screenshots need at least 600 px on the short side" },
      { name: "wide.png", reason: "is 1600 × 599 — screenshots need at least 600 px on the short side" },
    ]);
    expect(read.stored).toEqual([]);
    expect(put).not.toHaveBeenCalled();
  });

  it("takes an image exactly 600 px on its short side, portrait or landscape", async () => {
    const read = await readImageFiles(
      [file("tall.png"), file("wide.png")],
      Infinity,
      measureBy({ "tall.png": { w: 600, h: 1200 }, "wide.png": { w: 1200, h: 600 } }),
    );
    expect(read.rejected).toEqual([]);
    expect(read.stored.map((s) => s.name)).toEqual(["tall.png", "wide.png"]);
  });

  it("names the first problem it meets: type before size before decoding", async () => {
    const measure = measureBy({ "gif-huge": "undecodable", "png-huge": "undecodable" });
    const read = await readImageFiles(
      [sized("gif-huge", MAX_BYTES * 2, "image/gif"), sized("png-huge", MAX_BYTES * 2)],
      Infinity,
      measure,
    );
    expect(read.rejected).toEqual([
      { name: "gif-huge", reason: "isn't a PNG, JPEG or WebP" },
      { name: "png-huge", reason: "is over 20 MB" },
    ]);
    expect(measure).not.toHaveBeenCalled();
  });
});

describe("readImageFiles — what gets stored", () => {
  it("never stores a rejected file; the good ones keep their order", async () => {
    const files = [
      file("a.png"),
      file("photo.heic", "image/heic"),
      file("b.jpg", "image/jpeg"),
      file("small.png"),
      sized("huge.png", MAX_BYTES + 1),
      file("c.webp", "image/webp"),
      file("broken.png"),
    ];
    const read = await readImageFiles(
      files,
      Infinity,
      measureBy({ "small.png": { w: 400, h: 800 }, "broken.png": "undecodable" }),
    );

    expect(put.mock.calls.map(([blob]) => blob)).toEqual([files[0], files[2], files[5]]);
    for (const [blob] of put.mock.calls) expect(blob).toBeInstanceOf(File);
    expect(read.stored).toEqual([
      { name: "a.png", result: "img:id-a.png" },
      { name: "b.jpg", result: "img:id-b.jpg" },
      { name: "c.webp", result: "img:id-c.webp" },
    ]);
    expect(read.rejected.map((r) => r.name)).toEqual(["photo.heic", "small.png", "huge.png", "broken.png"]);
    expect(read.overflow).toBe(0);
  });

  it("stores the File itself — no re-encode, no copy", async () => {
    const f = file("a.png");
    await readImageFiles([f], Infinity, measureBy());
    expect(put).toHaveBeenCalledTimes(1);
    expect(put.mock.calls[0][0]).toBe(f);
  });

  it("stores at most `limit` good files, in order, and counts the rest as overflow", async () => {
    const files = [
      file("bad.gif", "image/gif"),
      file("1.png"),
      file("2.png"),
      file("tiny.png"),
      file("3.png"),
      file("4.png"),
      file("5.png"),
    ];
    const read = await readImageFiles(files, 2, measureBy({ "tiny.png": { w: 300, h: 300 } }));

    expect(read.stored.map((s) => s.name)).toEqual(["1.png", "2.png"]);
    expect(put.mock.calls.map(([blob]) => (blob as File).name)).toEqual(["1.png", "2.png"]);
    // Rejected files are not overflow: they were never going to be stored.
    expect(read.overflow).toBe(3);
    expect(read.rejected.map((r) => r.name)).toEqual(["bad.gif", "tiny.png"]);
  });

  it("with no room stores nothing and counts every good file as overflow", async () => {
    const read = await readImageFiles(
      [file("1.png"), file("2.png"), file("x.tiff", "image/tiff")],
      0,
      measureBy(),
    );
    expect(put).not.toHaveBeenCalled();
    expect(read.stored).toEqual([]);
    expect(read.overflow).toBe(2);
    expect(read.rejected).toHaveLength(1);
  });

  it("with no limit stores every good file", async () => {
    const files = Array.from({ length: 14 }, (_, i) => file(`${i}.png`));
    const read = await readImageFiles(files, undefined, measureBy());
    expect(read.stored).toHaveLength(14);
    expect(read.overflow).toBe(0);
  });

  it("accepts a FileList-like input as well as an array", async () => {
    const files = [file("a.png"), file("b.png")];
    const list = Object.assign(Object.create(null) as object, {
      length: files.length,
      0: files[0],
      1: files[1],
      item: (i: number) => files[i] ?? null,
      [Symbol.iterator]: () => files[Symbol.iterator](),
    }) as unknown as FileList;
    const read = await readImageFiles(list, Infinity, measureBy());
    expect(read.stored.map((s) => s.name)).toEqual(["a.png", "b.png"]);
  });

  it("a failed store is an Error in its own slot; the others still land", async () => {
    put.mockImplementation(async (blob) => {
      if ((blob as File).name === "b.png") throw new Error("This browser is out of storage space.");
      return `id-${(blob as File).name}`;
    });
    const read = await readImageFiles([file("a.png"), file("b.png"), file("c.png")], Infinity, measureBy());

    expect(read.stored.map((s) => s.name)).toEqual(["a.png", "b.png", "c.png"]);
    expect(read.stored[0].result).toBe("img:id-a.png");
    expect(read.stored[1].result).toBeInstanceOf(Error);
    expect((read.stored[1].result as Error).message).toBe("This browser is out of storage space.");
    expect(read.stored[2].result).toBe("img:id-c.png");
    expect(read.rejected).toEqual([]);
  });

  it("a store that rejects with a non-Error still comes back as an Error", async () => {
    put.mockImplementation(async () => {
      throw "quota";
    });
    const read = await readImageFiles([file("a.png")], Infinity, measureBy());
    expect(read.stored[0].result).toBeInstanceOf(Error);
    expect((read.stored[0].result as Error).message).toBe("Couldn't store the screenshot.");
  });
});

describe("measureImage", () => {
  it("reads the size with createImageBitmap when there is one, and closes the bitmap", async () => {
    const close = vi.fn();
    const decode = vi.fn(async () => ({ width: 1242, height: 2688, close }));
    vi.stubGlobal("createImageBitmap", decode);
    const f = file("a.png");

    await expect(measureImage(f)).resolves.toEqual({ w: 1242, h: 2688 });
    expect(decode).toHaveBeenCalledTimes(1);
    expect(decode.mock.calls[0]).toEqual([f]);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("rejects when createImageBitmap can't decode the file", async () => {
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => {
        throw new DOMException("The source image could not be decoded.", "InvalidStateError");
      }),
    );
    await expect(measureImage(file("a.png"))).rejects.toBeTruthy();
  });

  it("is the default measure: an undecodable file is turned away", async () => {
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => {
        throw new DOMException("The source image could not be decoded.", "InvalidStateError");
      }),
    );
    const read = await readImageFiles([file("a.png")]);
    expect(read.rejected).toEqual([{ name: "a.png", reason: "couldn't be read as an image" }]);
    expect(put).not.toHaveBeenCalled();
  });

  it("is the default measure: a too-small bitmap is turned away, a big one stored", async () => {
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async (blob: File) =>
        blob.name === "small.png"
          ? { width: 320, height: 568, close() {} }
          : { width: 1290, height: 2796, close() {} },
      ),
    );
    const read = await readImageFiles([file("small.png"), file("big.png")]);
    expect(read.rejected).toEqual([
      { name: "small.png", reason: "is 320 × 568 — screenshots need at least 600 px on the short side" },
    ]);
    expect(read.stored).toEqual([{ name: "big.png", result: "img:id-big.png" }]);
  });

  describe("without createImageBitmap", () => {
    /** An <img> that "loads" to `size` (or fails) once its src is set. */
    function fakeImage(size: { w: number; h: number } | "error") {
      const srcs: string[] = [];
      class FakeImage {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        naturalWidth = 0;
        naturalHeight = 0;
        set src(url: string) {
          srcs.push(url);
          queueMicrotask(() => {
            if (size === "error") {
              this.onerror?.();
            } else {
              this.naturalWidth = size.w;
              this.naturalHeight = size.h;
              this.onload?.();
            }
          });
        }
      }
      vi.stubGlobal("createImageBitmap", undefined);
      vi.stubGlobal("Image", FakeImage);
      const create = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:onstage/fake");
      const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
      return { srcs, create, revoke };
    }

    it("falls back to an <img>, and revokes the object URL", async () => {
      const { srcs, create, revoke } = fakeImage({ w: 1080, h: 1920 });
      const f = file("a.png");

      await expect(measureImage(f)).resolves.toEqual({ w: 1080, h: 1920 });
      expect(create).toHaveBeenCalledWith(f);
      expect(srcs).toEqual(["blob:onstage/fake"]);
      expect(revoke).toHaveBeenCalledWith("blob:onstage/fake");
    });

    it("rejects an image the <img> can't load, and still revokes the URL", async () => {
      const { revoke } = fakeImage("error");
      await expect(measureImage(file("a.png"))).rejects.toThrow("undecodable");
      expect(revoke).toHaveBeenCalledWith("blob:onstage/fake");
    });
  });
});

describe("readImageFiles — a failed store doesn't take a place (S3.3 review)", () => {
  it("the next good file is stored in place of one that failed", async () => {
    put.mockImplementation(async (blob) => {
      if ((blob as File).name === "fails.png") throw new Error("Out of space.");
      return `id-${(blob as File).name}`;
    });
    const read = await readImageFiles([file("a.png"), file("fails.png"), file("b.png"), file("c.png")], 3, measureBy());
    expect(read.stored.map((s) => [s.name, typeof s.result === "string" ? s.result : "error"])).toEqual([
      ["a.png", "img:id-a.png"],
      ["fails.png", "error"],
      ["b.png", "img:id-b.png"],
      ["c.png", "img:id-c.png"],
    ]);
    expect(read.overflow).toBe(0);
  });

  it("stops at the limit once that many are stored, counting the rest as overflow", async () => {
    const read = await readImageFiles([file("a.png"), file("b.png"), file("c.png")], 2, measureBy());
    expect(read.stored.map((s) => s.name)).toEqual(["a.png", "b.png"]);
    expect(read.overflow).toBe(1);
  });
});
