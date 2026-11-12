import test from "node:test";
import assert from "node:assert/strict";
import { deviceRender, finishesFor, frontScreenRect, resolveFinish, type DeviceRender } from "./deviceRenders";
import { PERSPECTIVE_PRESETS, perspectivePresetId } from "./editorDoc";

const base: DeviceRender = {
  w: 1000,
  h: 2000,
  corners: [[100, 100], [900, 100], [900, 1900], [100, 1900]],
  radius: 0.1,
  n: 2,
  files: { black: "b.webp", silver: "s.webp" },
};

test("resolveFinish returns a known finish and falls back to the first", () => {
  assert.equal(resolveFinish(base, "silver"), "silver");
  assert.equal(resolveFinish(base, "natural"), "black");
  assert.equal(resolveFinish(base, undefined), "black");
});

test("finishesFor lists at least one finish per device", () => {
  assert.ok(finishesFor("iphone-17-pro").length >= 1);
});

test("frontScreenRect scales the screen rect into the box", () => {
  const r = frontScreenRect(base, 500, 1000);
  assert.equal(r.x, 50);
  assert.equal(r.w, 400);
  assert.equal(r.h, 900);
});

test("hero preset exists and every preset angle has a render", () => {
  const hero = PERSPECTIVE_PRESETS.find((p) => p.id === "hero");
  assert.deepEqual(hero, { id: "hero", label: "Hero tilt", value: { yaw: -34, pitch: -12 } });
  assert.equal(perspectivePresetId({ yaw: -34, pitch: -12 }), "hero");
  for (const p of PERSPECTIVE_PRESETS) {
    for (const o of ["portrait", "landscape"] as const) {
      for (const d of ["iphone-17-pro", "ipad-pro-13", "pixel-10", "galaxy-tab-s9", "galaxy-z-fold-6"] as const) {
        assert.ok(deviceRender(d, o, p.value ?? undefined), `${d} ${o} ${p.id}`);
      }
    }
  }
});
