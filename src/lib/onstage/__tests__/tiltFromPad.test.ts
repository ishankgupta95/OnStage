import { describe, expect, it } from "vitest";
import { TILT_PRESETS, tiltFromPad } from "../data";

/**
 * S3.2: the landing demo and the editor's Perspective pad turn the phone the
 * same way. `tiltFromPad` is that one mapping — a pad point (-1…1 on both
 * axes, centre 0) to a tilt, with the editor's range (±34° yaw, ±22° pitch)
 * unless another is given.
 */

const preset = (id: string) => {
  const p = TILT_PRESETS.find((t) => t.id === id);
  if (!p) throw new Error(`no ${id} preset`);
  return p;
};

describe("tiltFromPad — the editor's range", () => {
  it("the pad's centre leaves the phone flat", () => {
    const t = tiltFromPad(0, 0);
    // Math.round(0 * -34) is -0. That is harmless — every consumer compares
    // with === (the Flat preset match) or prints it (`${-0}` and JSON both
    // give "0") — so the honest claim is "numerically zero and reads as 0",
    // not "is +0".
    expect(t.tiltY === 0 && t.tiltX === 0).toBe(true);
    expect(`${t.tiltY}° / ${t.tiltX}°`).toBe("0° / 0°");
    expect(JSON.parse(JSON.stringify(t))).toEqual({ tiltX: 0, tiltY: 0 });
    // …and it is the Flat preset, by the same comparison the Inspector uses.
    const flat = preset("flat");
    expect(t.tiltX === flat.x && t.tiltY === flat.y).toBe(true);
  });

  it("dragging to the right edge turns the phone right: -34° yaw, the Right preset's sign", () => {
    const t = tiltFromPad(1, 0);
    expect(t.tiltY).toBe(-34);
    expect(t.tiltX === 0).toBe(true);
    expect(Math.sign(t.tiltY)).toBe(Math.sign(preset("right").y));
  });

  it("dragging to the left edge turns it left: +34° yaw, the Left preset's sign", () => {
    const t = tiltFromPad(-1, 0);
    expect(t.tiltY).toBe(34);
    expect(t.tiltX === 0).toBe(true);
    expect(Math.sign(t.tiltY)).toBe(Math.sign(preset("left").y));
  });

  it("dragging down tips the top back: -22° pitch at the bottom edge", () => {
    const t = tiltFromPad(0, 1);
    expect(t.tiltX).toBe(-22);
    expect(t.tiltY === 0).toBe(true);
  });

  it("dragging up tips it forward: +22° pitch at the top edge", () => {
    expect(tiltFromPad(0, -1).tiltX).toBe(22);
  });

  it("the corners combine both axes", () => {
    expect(tiltFromPad(1, 1)).toEqual({ tiltY: -34, tiltX: -22 });
    expect(tiltFromPad(-1, -1)).toEqual({ tiltY: 34, tiltX: 22 });
  });

  it("points between scale linearly and round to whole degrees", () => {
    expect(tiltFromPad(0.5, -0.5)).toEqual({ tiltY: -17, tiltX: 11 });
    // 0.3 * -34 = -10.2 and 0.7 * -22 = -15.4
    expect(tiltFromPad(0.3, 0.7)).toEqual({ tiltY: -10, tiltX: -15 });
    for (const [nx, ny] of [
      [0.13, -0.77],
      [-0.41, 0.29],
      [0.999, 0.001],
    ]) {
      const t = tiltFromPad(nx, ny);
      expect(Number.isInteger(t.tiltY)).toBe(true);
      expect(Number.isInteger(t.tiltX)).toBe(true);
    }
  });

  it("the right half of the pad always turns right and the lower half always tips back", () => {
    for (let i = 1; i <= 20; i++) {
      const n = i / 20;
      expect(tiltFromPad(n, 0).tiltY).toBeLessThanOrEqual(0);
      expect(tiltFromPad(-n, 0).tiltY).toBeGreaterThanOrEqual(0);
      expect(tiltFromPad(0, n).tiltX).toBeLessThanOrEqual(0);
      expect(tiltFromPad(0, -n).tiltX).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("tiltFromPad — a custom range (the landing demo's)", () => {
  const demo = { yaw: 26, pitch: 14 };

  it("reaches the range at the edges, with the editor's signs", () => {
    expect(tiltFromPad(1, 1, demo)).toEqual({ tiltY: -26, tiltX: -14 });
    expect(tiltFromPad(-1, -1, demo)).toEqual({ tiltY: 26, tiltX: 14 });
    expect(Math.sign(tiltFromPad(1, 0, demo).tiltY)).toBe(Math.sign(tiltFromPad(1, 0).tiltY));
    expect(Math.sign(tiltFromPad(0, 1, demo).tiltX)).toBe(Math.sign(tiltFromPad(0, 1).tiltX));
  });

  it("scales in between", () => {
    // 0.9 * -26 = -23.4 and 0.5 * -14 = -7
    expect(tiltFromPad(0.9, 0.5, demo)).toEqual({ tiltY: -23, tiltX: -7 });
  });

  it("each axis uses its own range", () => {
    expect(tiltFromPad(1, 1, { yaw: 10, pitch: 40 })).toEqual({ tiltY: -10, tiltX: -40 });
  });
});
