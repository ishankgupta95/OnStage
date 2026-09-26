import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { usePreventFileDrop } from "../usePreventFileDrop";

/**
 * GAP-2 / S3.2: a file dropped anywhere that isn't a drop target stays in the
 * app instead of the browser navigating away to open it. `Providers` mounts
 * the hook on every page; this drives the hook itself (Providers brings in
 * next-themes).
 *
 * jsdom has no DataTransfer or DragEvent, so the events are plain cancelable
 * Events carrying a `dataTransfer` stand-in, dispatched on the body so they
 * bubble to window the way a real drag does.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function Probe() {
  usePreventFileDrop();
  return null;
}

let root: Root;
let host: HTMLDivElement;
let mounted = false;

beforeEach(async () => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => root.render(<Probe />));
  mounted = true;
});
afterEach(() => {
  if (mounted) act(() => root.unmount());
  mounted = false;
  host.remove();
});

type Transfer = { types: ArrayLike<string>; dropEffect: string };

function dragEvent(type: "dragover" | "drop", types: ArrayLike<string> | null, dropEffect = "move") {
  const e = new Event(type, { bubbles: true, cancelable: true });
  if (types) {
    const dataTransfer: Transfer = { types, dropEffect };
    Object.defineProperty(e, "dataTransfer", { value: dataTransfer });
  }
  return e as Event & { dataTransfer?: Transfer };
}

/** Dispatch on `target` (the body by default) and hand the event back. */
function fire<E extends Event>(e: E, target: EventTarget = document.body): E {
  target.dispatchEvent(e);
  return e;
}

describe("usePreventFileDrop — a file over the page but outside a drop target", () => {
  it("a file drag over the page is accepted by nobody: prevented, dropEffect none", () => {
    const e = fire(dragEvent("dragover", ["Files"]));
    expect(e.defaultPrevented).toBe(true);
    expect(e.dataTransfer?.dropEffect).toBe("none");
  });

  it("a file drag that also carries other types is still caught", () => {
    const e = fire(dragEvent("dragover", ["text/uri-list", "Files"]));
    expect(e.defaultPrevented).toBe(true);
    expect(e.dataTransfer?.dropEffect).toBe("none");
  });

  it("dropping the file is prevented, so the browser doesn't open it", () => {
    const e = fire(dragEvent("drop", ["Files"]));
    expect(e.defaultPrevented).toBe(true);
  });

  it("reads `types` as an array-like list too (a DOMStringList, not only an array)", () => {
    const list = { 0: "Files", length: 1 };
    const over = fire(dragEvent("dragover", list));
    expect(over.defaultPrevented).toBe(true);
    expect(over.dataTransfer?.dropEffect).toBe("none");
    expect(fire(dragEvent("drop", list)).defaultPrevented).toBe(true);
  });
});

describe("usePreventFileDrop — leaves real drop targets and other drags alone", () => {
  it("a drag a drop target already accepted keeps that target's dropEffect", () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    // A DropZone: it takes the drag first and says "copy".
    target.addEventListener("dragover", (ev) => {
      ev.preventDefault();
      (ev as Event & { dataTransfer: Transfer }).dataTransfer.dropEffect = "copy";
    });
    try {
      const e = fire(dragEvent("dragover", ["Files"]), target);
      expect(e.defaultPrevented).toBe(true);
      expect(e.dataTransfer?.dropEffect).toBe("copy");
    } finally {
      target.remove();
    }
  });

  it("a text drag is not prevented and its dropEffect is untouched", () => {
    const over = fire(dragEvent("dragover", ["text/plain"]));
    expect(over.defaultPrevented).toBe(false);
    expect(over.dataTransfer?.dropEffect).toBe("move");

    const drop = fire(dragEvent("drop", ["text/plain", "text/html"]));
    expect(drop.defaultPrevented).toBe(false);
  });

  it("an event with no dataTransfer at all passes through without throwing", () => {
    expect(fire(dragEvent("dragover", null)).defaultPrevented).toBe(false);
    expect(fire(dragEvent("drop", null)).defaultPrevented).toBe(false);
  });
});

describe("usePreventFileDrop — lifetime", () => {
  it("after unmount, file drags and drops are no longer touched", () => {
    act(() => root.unmount());
    mounted = false;

    const over = fire(dragEvent("dragover", ["Files"]));
    expect(over.defaultPrevented).toBe(false);
    expect(over.dataTransfer?.dropEffect).toBe("move");
    expect(fire(dragEvent("drop", ["Files"])).defaultPrevented).toBe(false);
  });

  it("listens on window: an event dispatched on window itself is caught too", () => {
    const e = fire(dragEvent("dragover", ["Files"]), window);
    expect(e.defaultPrevented).toBe(true);
    expect(e.dataTransfer?.dropEffect).toBe("none");
  });
});
