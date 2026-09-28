import { test } from "node:test";
import assert from "node:assert/strict";
import { exportDocForSize, exportFileCount, sizeById } from "./sizes";
import { DEFAULT_DOC, frameAdjustFor, type EditorDoc } from "./editorDoc";

const ipad = sizeById("ipad-13")!;
const iphone = sizeById("iphone-6-9")!;
const phoneDoc: EditorDoc = { ...DEFAULT_DOC, device: "iphone-16-pro" };

test("a phone design letterboxes its screenshot in a tablet frame", () => {
  const doc = exportDocForSize(phoneDoc, ipad);
  assert.equal(doc.device, "ipad-pro-13");
  assert.equal(frameAdjustFor(doc, "ipad", 0).fit, "contain");
  assert.equal(frameAdjustFor(doc, "ipad", 2).fit, "contain"); // every slot
  assert.equal(phoneDoc.frameAdjust, undefined); // input untouched
});

test("a tablet crop the user set wins", () => {
  const doc = exportDocForSize(
    { ...phoneDoc, frameAdjust: { ipad: [{ fit: "cover", scale: 1.2, offsetX: 0, offsetY: 0 }] } },
    ipad,
  );
  assert.equal(frameAdjustFor(doc, "ipad", 0).scale, 1.2);
  assert.equal(frameAdjustFor(doc, "ipad", 0).fit, "cover");
});

test("same-family and freeform exports are unchanged", () => {
  assert.equal(exportDocForSize(phoneDoc, iphone).frameAdjust, undefined);
  const free: EditorDoc = { ...phoneDoc, layout: "freeform" };
  assert.equal(exportDocForSize(free, ipad), free);
});

test("export file count respects each store's screenshot limit", () => {
  assert.equal(exportFileCount(["iphone-6-9", "play-phone"], 5), 10);
  assert.equal(exportFileCount(["iphone-6-9", "play-phone"], 10), 18); // Play stops at 8
  assert.equal(exportFileCount(["iphone-6-9"], 12), 10);
});
