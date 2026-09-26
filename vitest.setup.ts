import { Blob as NodeBlob, File as NodeFile } from "node:buffer";
import { beforeEach } from "vitest";

// jsdom's Blob can't be structured-cloned, so fake-indexeddb would store it as
// a plain object and hand back something without bytes. Node's own Blob and
// File clone the way a browser's do (and work with URL.createObjectURL), so
// the test DOM uses them.
Object.assign(globalThis, { Blob: NodeBlob, File: NodeFile });

// Every test starts from an empty browser store; nothing leaks between tests.
beforeEach(() => {
  localStorage.clear();
});
