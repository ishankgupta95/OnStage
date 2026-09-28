import { test } from "node:test";
import assert from "node:assert/strict";
import { coalesceBursts, reconcileDocs, selectableIds } from "./history";
import { DEFAULT_DOC, freeformSelId, type EditorDoc } from "./editorDoc";

test("coalesceBursts records the first change of a burst only", () => {
  let t = 0;
  const recorded: number[] = [];
  const record = coalesceBursts((n: number) => recorded.push(n), { windowMs: 500, now: () => t });
  for (const at of [0, 100, 200, 650, 1100]) {
    t = at;
    record(at);
  }
  // 0..650 are each <500ms apart → one burst; 1100 is 450ms after 650 → same burst.
  assert.deepEqual(recorded, [0]);
  t = 1700; // 600ms idle → new burst
  record(t);
  assert.deepEqual(recorded, [0, 1700]);
});

test("coalesceBursts records inside a burst when forced", () => {
  let t = 0;
  let forced = false;
  const recorded: number[] = [];
  const record = coalesceBursts((n: number) => recorded.push(n), { windowMs: 500, now: () => t, force: () => forced });
  record(0);
  t = 50;
  forced = true;
  record(50);
  assert.deepEqual(recorded, [0, 50]);
});

const doc = (content: string): EditorDoc => ({ ...DEFAULT_DOC, textLayers: [{ ...DEFAULT_DOC.textLayers[0], content }] });

test("reconcileDocs keeps a screenshot added after the snapshot", () => {
  const a0 = doc("a0");
  const a1 = doc("a1");
  const b = doc("b");
  const out = reconcileDocs({ a: a0 }, { a: a1, b }, ["a", "b"]);
  assert.equal(out.a, a0); // restored
  assert.equal(out.b, b); // kept (not in the snapshot)
  assert.deepEqual(Object.keys(out), ["a", "b"]);
});

test("reconcileDocs drops a screenshot deleted after the snapshot", () => {
  const out = reconcileDocs({ a: doc("a"), gone: doc("gone") }, { a: doc("a1") }, ["a"]);
  assert.deepEqual(Object.keys(out), ["a"]);
});

test("selectableIds covers text, image and freeform selections", () => {
  const d: EditorDoc = {
    ...DEFAULT_DOC,
    imageLayers: [{ id: "img", src: "x", x: 0, y: 0, width: 1, height: 1, rotation: 0 }],
    freeformFrames: [{ id: "ff", device: "iphone-16-pro", src: null, x: 0, y: 0, width: 1, rotation: 0 }],
  };
  const ids = selectableIds(d);
  assert.ok(ids.has(DEFAULT_DOC.textLayers[0].id));
  assert.ok(ids.has("img"));
  assert.ok(ids.has(freeformSelId("ff")));
});
