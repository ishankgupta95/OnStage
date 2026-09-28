import { test } from "node:test";
import assert from "node:assert/strict";
import { TEMPLATES, buildTemplateDocs, templateById } from "./templates";
import { computeLayout, fitFrame } from "./layout";
import { geometryFor } from "./deviceGeometry";

const chosen = { kind: "gradient", id: "ocean" } as const;

test("every template builds one doc per screen", () => {
  for (const t of TEMPLATES) assert.equal(buildTemplateDocs(t, "ios", chosen).length, Math.max(1, t.screens.length), t.id);
});

test("Editorial uses serif captions with a subheading under each", () => {
  const docs = buildTemplateDocs(templateById("editorial"), "ios", chosen);
  for (const d of docs) {
    const [cap, sub] = d.textLayers;
    assert.equal(cap.font, "fraunces");
    assert.equal(cap.weight, "600");
    assert.ok(sub && sub.font === "inter" && sub.size < cap.size);
    const capLines = cap.content.split("\n").length;
    assert.ok(sub.y >= cap.y + capLines * cap.size * cap.lineHeight, "subheading sits below the caption");
  }
});

test("Angled Hero sets a 3D angle on every screen", () => {
  const docs = buildTemplateDocs(templateById("angled-hero"), "ios", chosen);
  assert.ok(docs.every((d) => d.perspective && d.perspective.yaw !== 0));
});

test("Dev Tool brings its own grid background and mono type", () => {
  const docs = buildTemplateDocs(templateById("dev-tool"), "android", chosen);
  assert.ok(docs.every((d) => d.background.kind === "pattern" && d.background.id === "grid-dark"));
  assert.ok(docs.every((d) => d.textLayers.every((l) => l.font === "jetbrains-mono")));
  assert.ok(docs.every((d) => d.textLayers[0].color === "#FFFFFF"));
});

test("template text doesn't run into a device (estimated text box)", () => {
  // Master's own templates predate this check; it guards the ones added since.
  const checked = ["editorial", "angled-hero", "stat-proof", "dev-tool"];
  for (const t of TEMPLATES.filter((x) => checked.includes(x.id))) {
    for (const d of buildTemplateDocs(t, "ios", chosen)) {
      const layout = computeLayout(d.layout, 1290, 2796);
      if (layout.captionOnTop) continue;
      const aspect = geometryFor(d.device).aspect;
      for (const l of d.textLayers) {
        // Explicit lines, each wrapped at a generous average glyph width.
        const em = l.font === "jetbrains-mono" ? 0.6 : 0.56;
        const widths = l.content.split("\n").map((line) => line.length * l.size * em);
        const lines = widths.reduce((n, w) => n + Math.max(1, Math.ceil(w / l.width)), 0);
        const w = Math.min(l.width, Math.max(...widths));
        const x = l.align === "left" ? l.x : l.align === "right" ? l.x + l.width - w : l.x + (l.width - w) / 2;
        const bottom = l.y + lines * l.size * l.lineHeight;
        for (const fp of layout.frames) {
          const f = fitFrame(fp.box, aspect);
          const apart = x + w <= f.x || f.x + f.width <= x || bottom <= f.y || l.y >= f.y + f.height;
          assert.ok(apart, `${t.id}/${d.layout}: "${l.content}" overlaps the device`);
        }
      }
    }
  }
});

test("custom backgrounds feed caption colour and previews", async () => {
  const { backgroundCssFor, captionColorFor } = await import("./templates");
  const light = { kind: "custom-gradient", from: "#ffffff", to: "#f5f5f5", angle: 160 } as const;
  assert.equal(captionColorFor(light), "#0A0A0A");
  assert.equal(backgroundCssFor(light), "linear-gradient(160deg, #ffffff, #f5f5f5)");
  assert.equal(captionColorFor({ kind: "image", src: "data:image/png;base64,x" }), "#FFFFFF");
});

test("side captions are sized to fit their column", async () => {
  const { fitCaptionSize } = await import("./templates");
  assert.equal(fitCaptionSize("Stay in sync across devices", 508, 88), 88);
  assert.equal(fitCaptionSize("Organize everything effortlessly", 508, 88), 70); // "effortlessly" must fit
  assert.equal(fitCaptionSize("10× faster", 774, 220), 215);
  const stat = buildTemplateDocs(templateById("bold"), "ios", chosen).find((d) => d.layout === "stat-callout")!;
  assert.ok(stat.textLayers[0].size >= 200, "the stat reads as a big number");
});
