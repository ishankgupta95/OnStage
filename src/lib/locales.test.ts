import { test } from "node:test";
import assert from "node:assert/strict";
import { docLocales, localizeDoc, textFor, withText } from "./locales";
import { DEFAULT_DOC, makeTextLayer, type EditorDoc } from "./editorDoc";

const layer = makeTextLayer({ content: "Hello", translations: { "de-DE": "Hallo" } });
const doc: EditorDoc = { ...DEFAULT_DOC, textLayers: [layer, makeTextLayer({ content: "Only default" })] };

test("a missing translation falls back to the default text", () => {
  assert.equal(textFor(layer, "de-DE"), "Hallo");
  assert.equal(textFor(layer, "fr-FR"), "Hello");
  assert.equal(textFor(layer, null), "Hello");
});

test("withText writes the default or a translation, and clearing removes it", () => {
  assert.deepEqual(withText(layer, null, "Hi"), { content: "Hi" });
  assert.deepEqual(withText(layer, "fr-FR", "Salut"), { translations: { "de-DE": "Hallo", "fr-FR": "Salut" } });
  assert.deepEqual(withText(layer, "de-DE", ""), { translations: {} });
  assert.deepEqual(layer.translations, { "de-DE": "Hallo" }); // input untouched
});

test("localizeDoc swaps captions and leaves the source doc alone", () => {
  const de = localizeDoc(doc, "de-DE");
  assert.deepEqual(de.textLayers.map((l) => l.content), ["Hallo", "Only default"]);
  assert.equal(doc.textLayers[0].content, "Hello");
  assert.equal(localizeDoc(doc, null), doc);
});

test("docLocales lists written languages in store order", () => {
  const ja = { ...doc, textLayers: [makeTextLayer({ content: "x", translations: { ja: "エックス", "fr-FR": "", xx: "?" } })] };
  assert.deepEqual(docLocales([doc, ja]), ["de-DE", "ja", "xx"]);
});
