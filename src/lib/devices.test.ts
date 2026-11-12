import { test } from "node:test";
import assert from "node:assert/strict";
import { DEVICE_PICKER, devicePickerFor } from "./devices";
import { modelFor } from "./deviceGeometry";

test("the picker offers the current iPhone and Pixel", () => {
  const ids = DEVICE_PICKER.map((d) => d.id);
  assert.ok(ids.includes("iphone-17-pro") && ids.includes("pixel-10"));
  assert.equal(modelFor("iphone-17-pro"), modelFor("iphone-16-pro")); // same frame
});

test("an older project keeps showing its saved model in the picker", () => {
  const ids = devicePickerFor("iphone-16-pro").map((d) => d.id);
  assert.ok(ids.includes("iphone-16-pro") && !ids.includes("iphone-17-pro"));
  assert.equal(ids.length, DEVICE_PICKER.length);
  assert.deepEqual(devicePickerFor("iphone-17-pro"), DEVICE_PICKER);
  assert.ok(devicePickerFor("pixel-8").some((d) => d.id === "pixel-8"));
});
