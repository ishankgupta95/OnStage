import { test } from "node:test";
import assert from "node:assert/strict";
import { clearCaptions, computeLayout, fitFrame, keepCaptionOnCanvas } from "./layout";
import { LAYOUT_PRESETS } from "./schema";

const DESIGN = { w: 1290, h: 2796 };
const IPAD = { w: 2064, h: 2752 };
const sx = IPAD.w / DESIGN.w;
const sy = IPAD.h / DESIGN.h;

// A 2-line, 110px caption at the text-above slot (what buildTemplateDocs makes).
const capDesign = { x: 110, y: 126, width: 1070, height: 2 * 110 * 1.1 };
const capRender = { x: capDesign.x * sx, y: capDesign.y * sy, width: capDesign.width * sx, height: capDesign.height * sx };

const device = (W: number, H: number, aspect: number) => fitFrame(computeLayout("text-above", W, H).frames[0].box, aspect);

test("a caption that clears the device in the design clears it on iPad", () => {
  const design = device(DESIGN.w, DESIGN.h, 0.476);
  const render = device(IPAD.w, IPAD.h, 0.75);
  assert.ok(capRender.y + capRender.height > render.y, "precondition: the iPad caption overlaps the device");
  const out = clearCaptions({ design, render }, [{ design: capDesign, render: capRender }], DESIGN.h, IPAD.h);
  assert.ok(out.y >= capRender.y + capRender.height, "device starts below the caption");
  assert.ok(out.y <= capRender.y + capRender.height + IPAD.h * 0.03 + 1e-9, "…with at most a 3% gap");
  assert.equal(out.y + out.height, render.y + render.height, "device bottom stays put");
  assert.ok(Math.abs(out.width / out.height - render.width / render.height) < 1e-9, "aspect kept");
  assert.ok(Math.abs(out.x + out.width / 2 - (render.x + render.width / 2)) < 1e-9, "stays centred");
});

test("an overlap that exists in the design is left alone", () => {
  const design = device(DESIGN.w, DESIGN.h, 0.476);
  const render = device(IPAD.w, IPAD.h, 0.75);
  const onDevice = { x: design.x, y: design.y + 50, width: design.width, height: 200 };
  const out = clearCaptions(
    { design, render },
    [{ design: onDevice, render: { ...onDevice, y: onDevice.y * sy } }],
    DESIGN.h,
    IPAD.h,
  );
  assert.equal(out, render);
});

test("clearCaptions won't shrink a device below minScale", () => {
  const design = { x: 0, y: 1000, width: 500, height: 1000 };
  const render = { x: 0, y: 1000, width: 500, height: 1000 };
  const cap = { x: 0, y: 800, width: 500, height: 150 };
  const huge = { x: 0, y: 800, width: 500, height: 900 };
  const out = clearCaptions({ design, render }, [{ design: cap, render: huge }], 2000, 2000);
  assert.equal(out, render);
});

test("a caption pushed off the bottom moves back up, keeping its margin", () => {
  const design = { x: 100, y: 2400, width: 1000, height: 250 }; // bottom margin 146
  const render = { x: 160, y: 2400 * sy, width: 1600, height: 400 };
  const y = keepCaptionOnCanvas(design, render, DESIGN.h, IPAD.h);
  assert.ok(Math.abs(y + render.height + 146 * sy - IPAD.h) < 1e-9);
});

test("a caption that already fits, or never fit, is not moved", () => {
  assert.equal(keepCaptionOnCanvas({ x: 0, y: 100, width: 1, height: 100 }, { x: 0, y: 98, width: 1, height: 160 }, DESIGN.h, IPAD.h), 98);
  const offDesign = { x: 0, y: 2700, width: 1, height: 200 }; // ran off in the design too
  assert.equal(keepCaptionOnCanvas(offDesign, { x: 0, y: 2657, width: 1, height: 320 }, DESIGN.h, IPAD.h), 2657);
});

test("portrait side captions sit clear of the device", () => {
  for (const id of LAYOUT_PRESETS) {
    const l = computeLayout(id, DESIGN.w, DESIGN.h);
    if (!l.caption || l.captionOnTop) continue;
    const c = l.caption;
    for (const aspect of [0.476, 0.47, 0.49, 0.75]) {
      for (const fp of l.frames) {
        const d = fitFrame(fp.box, aspect);
        const side = c.x + c.width <= d.x || d.x + d.width <= c.x;
        const stacked = c.y + c.height <= d.y + 60 || d.y + d.height <= c.y; // slot padding may touch the top
        assert.ok(side || stacked, `${id} caption slot runs under the device (aspect ${aspect})`);
      }
    }
  }
});
