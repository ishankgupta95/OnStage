import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { useEditorStore, stepHistory } from "./editor";
import { DEFAULT_DOC, makeTextLayer, type EditorDoc } from "@/lib/editorDoc";

const docWith = (content: string): EditorDoc => ({ ...DEFAULT_DOC, textLayers: [makeTextLayer({ content })] });
const text = () => useEditorStore.getState().doc.textLayers[0].content;
const history = () => useEditorStore.temporal.getState();

beforeEach(() => {
  const a = docWith("start");
  useEditorStore.setState({ docs: { a }, order: ["a"], doc: a, screenshotId: "a", selectedLayerId: null, selectedFrameIndex: 0 });
  history().clear();
});

test("a typing burst is one undo step; selection and save badge add none", () => {
  const { updateTextLayer, selectLayer, setSaveState } = useEditorStore.getState();
  const id = useEditorStore.getState().doc.textLayers[0].id;
  for (const c of ["h", "he", "hel", "hell", "hello"]) {
    updateTextLayer(id, { content: c });
    setSaveState("saving");
  }
  selectLayer(id);
  setSaveState("saved");
  assert.equal(history().pastStates.length, 1);
  stepHistory("undo");
  assert.equal(text(), "start");
  stepHistory("redo");
  assert.equal(text(), "hello");
});

test("undo across Add screenshot keeps the new screenshot", () => {
  const s = useEditorStore.getState();
  s.updateTextLayer(s.doc.textLayers[0].id, { content: "edited" });
  s.upsertDoc("b", docWith("b"));
  useEditorStore.getState().setActive("b");
  stepHistory("undo");
  const after = useEditorStore.getState();
  assert.deepEqual(Object.keys(after.docs), ["a", "b"]);
  assert.equal(after.docs.a.textLayers[0].content, "start");
  assert.equal(after.doc, after.docs.b); // the active screenshot is still there
});

test("undo after deleting a screenshot doesn't bring it back", () => {
  useEditorStore.getState().upsertDoc("b", docWith("b"));
  const s = useEditorStore.getState();
  s.updateTextLayer(s.doc.textLayers[0].id, { content: "edited" });
  useEditorStore.getState().removeDoc("b");
  stepHistory("undo");
  assert.deepEqual(Object.keys(useEditorStore.getState().docs), ["a"]);
});

test("undo clears a selection whose layer no longer exists", () => {
  useEditorStore.getState().addTextLayer();
  const added = useEditorStore.getState().selectedLayerId;
  assert.ok(added);
  stepHistory("undo");
  const s = useEditorStore.getState();
  assert.equal(s.doc.textLayers.length, 1);
  assert.equal(s.selectedLayerId, null);
});

test("an edit whose active screenshot is missing does nothing", () => {
  useEditorStore.setState({ screenshotId: "missing" });
  const before = useEditorStore.getState().docs;
  useEditorStore.getState().addTextLayer();
  assert.equal(useEditorStore.getState().docs, before);
  assert.equal(Object.keys(useEditorStore.getState().docs).length, 1);
});
