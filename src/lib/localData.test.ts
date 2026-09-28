import { test } from "node:test";
import assert from "node:assert/strict";
import { parseProjectFile, PROJECT_FILE_FORMAT } from "./localData";
import { DEFAULT_DOC } from "./editorDoc";

const valid = {
  format: PROJECT_FILE_FORMAT,
  version: 1,
  name: "  Habit Tracker ",
  screenshots: [{ doc: DEFAULT_DOC, thumbnailUrl: "data:image/jpeg;base64,x" }, { doc: DEFAULT_DOC }],
};

test("a project file round-trips through JSON", () => {
  const f = parseProjectFile(JSON.parse(JSON.stringify(valid)));
  assert.equal(f.name, "Habit Tracker");
  assert.equal(f.screenshots.length, 2);
  assert.deepEqual(f.screenshots[0].doc, DEFAULT_DOC);
  assert.equal(f.screenshots[1].thumbnailUrl, null);
});

test("other files are refused with a clear message", () => {
  assert.throws(() => parseProjectFile({ hello: 1 }), /isn't an Onstage project file/);
  assert.throws(() => parseProjectFile([]), /isn't an Onstage project file/);
  assert.throws(() => parseProjectFile({ ...valid, version: 2 }), /newer version/);
  assert.throws(() => parseProjectFile({ ...valid, screenshots: [] }), /no screenshots/);
  assert.throws(
    () => parseProjectFile({ ...valid, screenshots: [{ doc: { ...DEFAULT_DOC, textLayers: "x" } }] }),
    /Screenshot 1 .* damaged/,
  );
});
