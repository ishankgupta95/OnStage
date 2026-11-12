import manifest from "./deviceRenders.json";
import { modelFor, type DeviceModelId } from "@/lib/deviceGeometry";
import type { DeviceFrame } from "@/lib/schema";
import { withBase } from "@/lib/routes";

// The photoreal device frames. scripts/blender/build_devices.py path-traces
// every device model, in every finish, at every preset angle, in both
// orientations, with the screen left as a transparent hole, into
// public/devices/renders/*.webp, and records each render here
// (deviceRenders.json). The editor warps the screenshot into the screen quad;
// the homepage lays live HTML into the front-on screen rect. Each render's box
// has the model's frame aspect (deviceGeometry.ts), so it fills a frame box.
//
// ── manifest contract (version 2) ────────────────────────────────────────────
// {
//   version: 2,
//   models: { [model]: { finishes: { [finishId]: "Display name" } } },
//   renders: { "<model>/<orientation>/<yaw>_<pitch>": {
//     w, h,                      // render size in px (= the frame box)
//     corners: [TL,TR,BR,BL],    // screen corners in render px (every angle is
//                                // screen-side; there are no back views)
//     radius, n,                 // screen corner extent ÷ screen width; superellipse exponent
//     files: { [finishId]: "x.webp" },   // the device, one image per finish
//     glare?: "x.webp",          // optional: reflections on the cover glass over
//                                // the screen only (premultiplied RGBA, same box),
//                                // drawn over the composite when glare is on
//     shadow?: { file, x, y, w, h }      // optional: soft contact/drop shadow,
//                                // drawn UNDER the device at (x, y, w, h) in
//                                // render px — may extend outside the box
//     thumb?: { w, h, files, shadow? }   // front-on only: small copies for the
//                                // marketing pages (scripts/make-render-thumbs.mjs)
//   } }
// }
// Finish ids are shared across models ("black", "silver", "natural", …) so a
// doc-wide choice applies to any device; a model lacking it falls back to its
// first finish.

type Corner = [number, number];

export type FinishId = string;

export type ShadowLayer = { file: string; x: number; y: number; w: number; h: number };

export type Thumb = { w: number; h: number; files: Record<FinishId, string>; shadow?: string };

export type DeviceRender = {
  w: number;
  h: number;
  corners: [Corner, Corner, Corner, Corner];
  radius: number;
  n: number;
  files: Record<FinishId, string>;
  glare?: string;
  shadow?: ShadowLayer;
  thumb?: Thumb;
};

type Manifest = {
  version: number;
  models: Record<string, { finishes: Record<FinishId, string> }>;
  renders: Record<string, DeviceRender>;
};

// JSON imports widen tuples to arrays; the script always writes 4 [x, y] corners.
const M = manifest as unknown as Manifest;

// A device angle (degrees). Front-on = yaw 0, pitch 0.
export type RenderAngle = { yaw: number; pitch: number };
export const FRONT_ON: RenderAngle = { yaw: 0, pitch: 0 };

export function renderKey(device: DeviceFrame, orientation: "portrait" | "landscape", angle: RenderAngle = FRONT_ON) {
  return `${modelFor(device)}/${orientation}/${angle.yaw}_${angle.pitch}`;
}

export function deviceRender(
  device: DeviceFrame,
  orientation: "portrait" | "landscape",
  angle: RenderAngle = FRONT_ON,
): DeviceRender | undefined {
  return M.renders[renderKey(device, orientation, angle)];
}

// The finishes a device comes in, in display order (first = default).
export function finishesFor(device: DeviceFrame): { id: FinishId; label: string }[] {
  const f = M.models[modelFor(device) as DeviceModelId]?.finishes ?? {};
  return Object.entries(f).map(([id, label]) => ({ id, label }));
}

// The finish actually drawn for a requested one (falls back to the default).
export function resolveFinish(r: DeviceRender, finish?: FinishId): FinishId {
  if (finish && r.files[finish]) return finish;
  return Object.keys(r.files)[0];
}

const url = (file: string) => withBase(`/devices/renders/${file}`);

export function renderUrl(r: DeviceRender, finish?: FinishId): string {
  return url(r.files[resolveFinish(r, finish)]);
}

// srcset offering the thumb (when there is one) and the full render, so a
// browser fetches only the size it displays.
export function renderSrcSet(r: DeviceRender, finish?: FinishId): string {
  const full = `${renderUrl(r, finish)} ${r.w}w`;
  const t = r.thumb?.files[resolveFinish(r, finish)];
  return t ? `${url(t)} ${r.thumb!.w}w, ${full}` : full;
}

export function shadowSrcSet(r: DeviceRender): string | null {
  if (!r.shadow) return null;
  const full = `${url(r.shadow.file)} ${r.w}w`; // described by the render's width: it scales with the box
  return r.thumb?.shadow ? `${url(r.thumb.shadow)} ${r.thumb.w}w, ${full}` : full;
}

export function glareUrl(r: DeviceRender): string | null {
  return r.glare ? url(r.glare) : null;
}

export function shadowUrl(r: DeviceRender): string | null {
  return r.shadow ? url(r.shadow.file) : null;
}

// The screen rect of a FRONT-ON render scaled into a box of the given size:
// position/size in box px, and a circular corner radius that stays inside the
// render's screen hole (a superellipse corner is fuller than a circle of the
// same extent, so the circle is shrunk to keep it covered).
export function frontScreenRect(r: DeviceRender, width: number, height: number) {
  const sx = width / r.w;
  const sy = height / r.h;
  const [tl, tr, , bl] = r.corners;
  const w = (tr[0] - tl[0]) * sx;
  const h = (bl[1] - tl[1]) * sy;
  const extent = r.radius * w;
  return { x: tl[0] * sx, y: tl[1] * sy, w, h, r: r.n > 2 ? extent * 0.55 : extent };
}
