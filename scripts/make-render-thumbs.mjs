// Small copies of the FRONT-ON device renders for the marketing pages.
//
// The homepage shows ~20 device mockups, most at thumbnail size; decoding each
// full render (1300×2731 px ≈ 14 MB of bitmap) would waste memory and
// bandwidth. This writes a THUMB_W-wide copy of every front-on finish image
// and shadow next to the originals and records them in the manifest as
// `thumb` (see src/lib/deviceRenders.ts); DeviceMock offers both through
// srcset so the browser fetches only the size it shows. The editor and exports
// always use the full renders.
//
// Run after scripts/blender/build_devices.py (which rewrites entries without
// `thumb`):  node scripts/make-render-thumbs.mjs
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const MANIFEST = path.join(ROOT, "src/lib/deviceRenders.json");
const DIR = path.join(ROOT, "public/devices/renders");
const THUMB_W = 640;

const m = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
const thumbName = (f) => f.replace(/\.webp$/, `@${THUMB_W}.webp`);

async function shrink(file, scale) {
  const src = path.join(DIR, file);
  const meta = await sharp(src).metadata();
  const out = thumbName(file);
  await sharp(src)
    .resize({ width: Math.max(1, Math.round(meta.width * scale)), kernel: "lanczos3" })
    .webp({ quality: 82, alphaQuality: 90, effort: 6 })
    .toFile(path.join(DIR, out));
  return out;
}

let n = 0;
for (const [key, r] of Object.entries(m.renders)) {
  if (!key.endsWith("/0_0")) continue;
  const scale = THUMB_W / r.w; // render px → thumb px
  const files = {};
  for (const [fid, f] of Object.entries(r.files)) files[fid] = await shrink(f, scale);
  const thumb = { w: THUMB_W, h: Math.round(r.h * scale), files };
  // Shadows are stored at their own (lower) resolution; scale them alike.
  if (r.shadow) thumb.shadow = await shrink(r.shadow.file, scale);
  r.thumb = thumb;
  n++;
}

fs.writeFileSync(MANIFEST, JSON.stringify(m, null, 2) + "\n");
console.log(`thumbs: ${n} front-on renders → ${THUMB_W}px`);
