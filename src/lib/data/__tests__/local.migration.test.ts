import { beforeEach, describe, expect, it } from "vitest";
import { localBackend } from "../local";
import { SET_DOCS_KEY } from "../migrateImages";
import { imageIdFromRef } from "../imageRefs";
import { blobBytes, doc, frame, pngDataUrl, resetImageDb } from "./helpers";
import { dataUrlToBlob } from "../migrateImages";

// Its own file: the backend runs the migration once per page load (module
// instance), before the first document read — this is that first read.
beforeEach(resetImageDb);

describe("local backend — first boot after the image-store change", () => {
  it("migrates every stored doc before the first load returns", async () => {
    const shot = pngDataUrl(5, 2048);
    localStorage.setItem(
      SET_DOCS_KEY,
      JSON.stringify({
        open: doc([frame({ screenshot: shot })]),
        other: doc([frame({ screenshot: pngDataUrl(6) })]),
      }),
    );

    const loaded = await localBackend.loadSetDoc("open");

    const id = imageIdFromRef(loaded!.frames[0].screenshot);
    expect(id).not.toBeNull();
    const blob = await localBackend.getImage(id!);
    expect(await blobBytes(blob!)).toEqual(await blobBytes(dataUrlToBlob(shot)));
    // Not just the open one.
    expect(localStorage.getItem(SET_DOCS_KEY)).not.toContain("data:");
  });
});
