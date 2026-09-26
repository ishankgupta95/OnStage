import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openSet, useOnstage } from "@/store/onstage";
import { PerspectivePopover } from "../ContextBar";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let host: HTMLDivElement;
let n = 0;

beforeEach(async () => {
  await openSet(`perspective-${++n}`);
  useOnstage.setState({ active: 0, sel: "device" });
  useOnstage.temporal.getState().clear();
  // jsdom lays nothing out; give every box a size so the pad maps pointer
  // positions to angles.
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
    left: 0, top: 0, right: 300, bottom: 112, width: 300, height: 112, x: 0, y: 0, toJSON: () => ({}),
  } as DOMRect);
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => root.render(<PerspectivePopover />));
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
});

const pad = () => [...host.querySelectorAll("div")].find((d) => d.style.cursor === "grab")!;
const fire = (target: EventTarget, type: string, x: number, y = 56) =>
  act(() => {
    target.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: x, clientY: y }));
  });

describe("the tilt pad", () => {
  it("records one history entry per drag", () => {
    const start = useOnstage.getState().frames[0];
    fire(pad(), "pointerdown", 150);
    for (let x = 160; x <= 290; x += 10) fire(window, "pointermove", x, 20);
    fire(window, "pointerup", 290, 20);

    expect(useOnstage.temporal.getState().pastStates).toHaveLength(1);
    expect(useOnstage.getState().frames[0].tiltY).not.toBe(start.tiltY);
    useOnstage.getState().undo();
    expect(useOnstage.getState().frames[0]).toEqual(start);
  });

  it("ends the drag when the pointer is cancelled", () => {
    fire(pad(), "pointerdown", 150);
    fire(window, "pointermove", 250, 30);
    fire(window, "pointercancel", 250, 30);
    fire(window, "pointermove", 20, 90); // no longer listening
    expect(useOnstage.temporal.getState().pastStates).toHaveLength(1);
    expect(useOnstage.temporal.getState().isTracking).toBe(true);
    const tiltY = useOnstage.getState().frames[0].tiltY;
    expect(tiltY).toBe(Math.round(((250 / 300 - 0.5) * 2) * -34));
  });
});
