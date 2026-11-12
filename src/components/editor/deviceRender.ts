// CLIENT-ONLY. Draws a device frame: the photoreal render (src/lib/deviceRenders.ts)
// with the user's screenshot warped into its screen.
//
// The screen is planar, so mapping the screenshot onto it under perspective
// is a homography of its four projected corners — exact, and the same
// technique pro mockup tools use. A tiny WebGL pass does the warp (inverse
// homography per pixel, masked to the screen's exact corner shape); the
// render, whose screen is a transparent hole, is drawn over it.

import { DEFAULT_FRAME_ADJUST, type FrameAdjust } from "@/lib/editorDoc";
import { deviceRender, glareUrl, renderUrl, shadowUrl, type DeviceRender, type FinishId, type RenderAngle } from "@/lib/deviceRenders";
import type { DeviceFrame } from "@/lib/schema";

const SCREEN_BASE = "#0b0b0f"; // dark screen behind a "contain"-fitted image

// ── render images (load on demand) ───────────────────────────────────────────
// Decoded renders are big (≈14 MB a phone, ≈30 MB a tablet), so keep only the
// IMAGE_MAX most recently used. An image used in the last IMAGE_KEEP_MS is never
// dropped (so a doc showing many devices can't thrash: evict → reload → evict);
// a dropped one reloads from the HTTP cache when next needed.
const IMAGE_MAX = 16;
const IMAGE_KEEP_MS = 5000;
const _images = new Map<string, HTMLImageElement>(); // insertion order = LRU order
const _used = new Map<string, number>();
const _loading = new Map<string, Promise<void>>();
const _failed = new Set<string>();
const _pending = new Set<Promise<void>>();
const _subs = new Set<() => void>();
let _error: Error | null = null;

function getImage(src: string): HTMLImageElement | undefined {
  const img = _images.get(src);
  if (img) {
    _images.delete(src); // move to the most-recent end
    _images.set(src, img);
    _used.set(src, performance.now());
  }
  return img;
}

function evictImages() {
  const now = performance.now();
  for (const src of _images.keys()) {
    if (_images.size <= IMAGE_MAX) break;
    if (now - (_used.get(src) ?? 0) < IMAGE_KEEP_MS) continue;
    _images.delete(src);
    _used.delete(src);
    _loading.delete(src); // so it loads again on demand
  }
}

// Re-render subscribers (mounted frames) when a render finishes loading.
export function subscribeDeviceRenders(cb: () => void): () => void {
  _subs.add(cb);
  return () => {
    _subs.delete(cb);
  };
}

// Loads started since the last call. Export awaits these and redraws, so no
// frame is captured mid-download.
export function takeDeviceRenderPending(): Promise<void> | null {
  if (!_pending.size) return null;
  const all = Promise.allSettled([..._pending]).then(() => undefined);
  _pending.clear();
  return all;
}

// The last draw failure since the previous call (then cleared). Export fails
// on it rather than shipping a PNG without its device.
export function takeDeviceRenderError(): Error | null {
  const e = _error;
  _error = null;
  return e;
}

function loadImage(src: string) {
  if (_loading.has(src)) return;
  const img = new Image();
  img.crossOrigin = "anonymous";
  // onload, not decode(): decode() can stall in a background tab.
  const p = new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(`Couldn't load the device frame (${src}). Check your connection and try again.`));
    img.src = src;
  }).then(
    () => {
      _images.set(src, img);
      _used.set(src, performance.now());
      evictImages();
      _subs.forEach((cb) => cb());
    },
    (e: Error) => {
      _failed.add(src); // reported (not retried) until the page reloads
      _error = e;
      _subs.forEach((cb) => cb());
    },
  );
  _loading.set(src, p);
  _pending.add(p);
}

// ── screenshot composition ───────────────────────────────────────────────────
const clamp1 = (v: number) => Math.max(-1, Math.min(1, v));

// The screenshot fitted into a canvas at the screen's aspect with the frame's
// cover/contain/scale/pan — the same math as the editor's drag overlay.
function composeScreen(img: HTMLImageElement | null, aspect: number, adjust: FrameAdjust, tw: number) {
  const th = Math.max(1, Math.round(tw / aspect));
  const c = document.createElement("canvas");
  c.width = tw;
  c.height = th;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = SCREEN_BASE;
  ctx.fillRect(0, 0, tw, th);
  if (!img || img.width === 0) return c;
  const ia = img.width / img.height;
  const coverWide = adjust.fit === "contain" ? ia <= aspect : ia > aspect;
  let bw = coverWide ? th * ia : tw;
  let bh = coverWide ? th : tw / ia;
  bw *= adjust.scale;
  bh *= adjust.scale;
  const ox = (tw - bw) / 2 + (bw > tw ? (clamp1(adjust.offsetX) * (bw - tw)) / 2 : 0);
  const oy = (th - bh) / 2 + (bh > th ? (clamp1(adjust.offsetY) * (bh - th)) / 2 : 0);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, ox, oy, bw, bh);
  return c;
}

// ── homography ───────────────────────────────────────────────────────────────
type Quad = [[number, number], [number, number], [number, number], [number, number]];

// Unit square (0,0),(1,0),(1,1),(0,1) → quad, as a row-major 3×3
// (Heckbert's closed form).
function squareToQuad(q: Quad): number[] {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q;
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
  let g = 0;
  let h = 0;
  if (Math.abs(dx3) > 1e-9 || Math.abs(dy3) > 1e-9) {
    const det = dx1 * dy2 - dx2 * dy1;
    g = (dx3 * dy2 - dx2 * dy3) / det;
    h = (dx1 * dy3 - dx3 * dy1) / det;
  }
  return [x1 - x0 + g * x1, x3 - x0 + h * x3, x0, y1 - y0 + g * y1, y3 - y0 + h * y3, y0, g, h, 1];
}

function invert3(m: number[]): number[] {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const det = a * A + b * B + c * C;
  return [
    A / det, -(b * i - c * h) / det, (b * f - c * e) / det,
    B / det, (a * i - c * g) / det, -(a * f - c * d) / det,
    C / det, -(a * h - b * g) / det, (a * e - b * d) / det,
  ];
}

// ── WebGL warp ───────────────────────────────────────────────────────────────
const VERT = `
  attribute vec2 pos;
  varying vec2 vUv;
  void main() { vUv = pos * 0.5 + 0.5; gl_Position = vec4(pos, 0.0, 1.0); }
`;
// Output pixel → screen UV via the inverse homography, masked to the screen's
// rounded corner (superellipse for Apple devices — it must match the render's
// hole exactly), with ~1.5px of bleed under the bezel so the hole's
// anti-aliased edge never shows a seam. Output is premultiplied.
const FRAG = `
  precision highp float;
  uniform sampler2D map;
  uniform mat3 hinv;
  uniform vec2 size;
  uniform vec2 quad;
  uniform float radius;
  uniform float expo;
  varying vec2 vUv;
  void main() {
    vec2 p = vec2(vUv.x, 1.0 - vUv.y) * size;
    vec3 q = hinv * vec3(p, 1.0);
    if (q.z <= 0.0) discard;
    vec2 uv = q.xy / q.z;
    vec2 h = quad * 0.5;
    vec2 d = abs(uv * quad - h) - (h - vec2(radius));
    vec2 o = max(d, 0.0) / radius;
    float corner = (pow(pow(o.x, expo) + pow(o.y, expo), 1.0 / expo) - 1.0) * radius;
    float dist = (d.x > 0.0 && d.y > 0.0) ? corner : max(d.x, d.y) - radius;
    float a = clamp(2.0 - dist, 0.0, 1.0);
    if (a <= 0.0) discard;
    vec4 c = texture2D(map, clamp(uv, 0.0, 1.0));
    gl_FragColor = vec4(c.rgb * a, a);
  }
`;

type Warp = {
  canvas: HTMLCanvasElement;
  gl: WebGLRenderingContext;
  tex: WebGLTexture;
  loc: Record<"hinv" | "size" | "quad" | "radius" | "expo", WebGLUniformLocation | null>;
};
let _warp: Warp | null = null;

function getWarp(): Warp {
  if (_warp && !_warp.gl.isContextLost()) return _warp;
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl", { premultipliedAlpha: true, alpha: true, preserveDrawingBuffer: true, antialias: false });
  if (!gl) throw new Error("This browser can't draw the device frame (WebGL is unavailable).");
  const shader = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(`Device frame shader: ${gl.getShaderInfoLog(s)}`);
    return s;
  };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, shader(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(`Device frame shader: ${gl.getProgramInfoLog(prog)}`);
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const pos = gl.getAttribLocation(prog, "pos");
  gl.enableVertexAttribArray(pos);
  gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const u = (n: string) => gl.getUniformLocation(prog, n);
  _warp = { canvas, gl, tex, loc: { hinv: u("hinv"), size: u("size"), quad: u("quad"), radius: u("radius"), expo: u("expo") } };
  return _warp;
}

// ── drawing ──────────────────────────────────────────────────────────────────
export type DeviceRenderOpts = {
  device: DeviceFrame;
  orientation: "portrait" | "landscape";
  angle: RenderAngle;
  finish?: FinishId;
  glare?: boolean; // draw the render's glare layer over the screen, if it has one
  screenImage: HTMLImageElement | null;
  adjust?: FrameAdjust;
  width: number;
  height: number;
};

function draw(o: DeviceRenderOpts, r: DeviceRender, img: HTMLImageElement, glare: HTMLImageElement | null): HTMLCanvasElement {
  const { width, height } = o;
  const sx = width / r.w;
  const sy = height / r.h;
  const quad = r.corners.map(([x, y]) => [x * sx, y * sy]) as Quad;
  const qw = Math.max(1, Math.hypot(quad[1][0] - quad[0][0], quad[1][1] - quad[0][1]));
  const qh = Math.max(1, Math.hypot(quad[3][0] - quad[0][0], quad[3][1] - quad[0][1]));
  const qw2 = Math.hypot(quad[2][0] - quad[3][0], quad[2][1] - quad[3][1]);
  const qh2 = Math.hypot(quad[2][0] - quad[1][0], quad[2][1] - quad[1][1]);
  const aspect = (qw + qw2) / (qh + qh2);

  const w = getWarp();
  const { gl } = w;
  const maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
  // Composed at ~1.25× the on-screen size (perspective makes the near edge
  // larger), so the warp only ever samples near 1:1 — no mipmaps needed.
  const texW = Math.min(maxTex, 2048, Math.max(64, Math.round(Math.max(qw, qw2) * 1.25)));
  const screen = composeScreen(o.screenImage, aspect, o.adjust ?? DEFAULT_FRAME_ADJUST, texW);

  w.canvas.width = width;
  w.canvas.height = height;
  gl.viewport(0, 0, width, height);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.bindTexture(gl.TEXTURE_2D, w.tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, screen);
  const inv = invert3(squareToQuad(quad));
  // GLSL mat3 is column-major: transpose the row-major inverse.
  gl.uniformMatrix3fv(w.loc.hinv, false, [inv[0], inv[3], inv[6], inv[1], inv[4], inv[7], inv[2], inv[5], inv[8]]);
  gl.uniform2f(w.loc.size, width, height);
  gl.uniform2f(w.loc.quad, qw, qh);
  gl.uniform1f(w.loc.radius, Math.min(r.radius * qw, qw / 2, qh / 2));
  gl.uniform1f(w.loc.expo, r.n);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  if (gl.isContextLost()) {
    throw new Error("The device couldn't be drawn (the graphics context was lost). Reload the page and try again.");
  }

  const out = document.createElement("canvas");
  out.width = width;
  out.height = height;
  const ctx = out.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(w.canvas, 0, 0);
  ctx.drawImage(img, 0, 0, width, height);
  if (glare) ctx.drawImage(glare, 0, 0, width, height); // over the screenshot, like glass
  return out;
}

// ── cache ────────────────────────────────────────────────────────────────────
// Frames re-render on every React tick; cache by everything that affects them.
const _cache = new Map<string, HTMLCanvasElement>();
const CACHE_MAX = 64;

function cacheKey(o: DeviceRenderOpts, file: string, glare: string) {
  const a = o.adjust ?? DEFAULT_FRAME_ADJUST;
  return [file, glare, o.width, o.height, o.screenImage?.src ?? "none", a.fit, a.scale, a.offsetX, a.offsetY].join("|");
}

// The device with its screenshot, or null while its render is downloading (or
// failed to — see takeDeviceRenderError). Subscribers are told when it lands.
export function renderDeviceFrame(o: DeviceRenderOpts): HTMLCanvasElement | null {
  // An angle with no render (only possible from a hand-edited doc) shows front-on.
  const r = deviceRender(o.device, o.orientation, o.angle) ?? deviceRender(o.device, o.orientation);
  if (!r) {
    _error = new Error(`No device frame for ${o.device} at this angle.`);
    return null;
  }
  const src = renderUrl(r, o.finish);
  const img = getImage(src);
  if (!img) {
    if (!_failed.has(src)) loadImage(src);
    else _error = new Error(`Couldn't load the device frame (${src}). Check your connection and try again.`);
    return null;
  }
  // Glare is optional polish: draw without it until its image lands (the
  // subscribers redraw then, and export waits on the pending load).
  let glare: HTMLImageElement | null = null;
  const gsrc = o.glare ? glareUrl(r) : null;
  if (gsrc) {
    glare = getImage(gsrc) ?? null;
    if (!glare && !_failed.has(gsrc)) loadImage(gsrc);
    else if (!glare) _error = new Error(`Couldn't load the device frame (${gsrc}). Check your connection and try again.`);
  }
  const width = Math.max(1, Math.round(o.width));
  const height = Math.max(1, Math.round(o.height));
  const opts = { ...o, width, height };
  const key = cacheKey(opts, src, glare ? gsrc! : "");
  const hit = _cache.get(key);
  if (hit) return hit;
  try {
    const canvas = draw(opts, r, img, glare);
    _cache.set(key, canvas);
    if (_cache.size > CACHE_MAX) {
      const oldest = _cache.keys().next().value;
      if (oldest !== undefined) _cache.delete(oldest);
    }
    return canvas;
  } catch (e) {
    _error = e instanceof Error ? e : new Error("The device couldn't be drawn.");
    return null;
  }
}

// The soft shadow under a device, if its render has one: the image plus its
// rect in the render's pixels (it may extend past the render box). Null while
// loading or when there is none — the caller falls back to a Konva shadow.
export function deviceShadow(
  device: DeviceFrame,
  orientation: "portrait" | "landscape",
  angle: RenderAngle,
): { image: HTMLImageElement; x: number; y: number; w: number; h: number; renderW: number; renderH: number } | null {
  const r = deviceRender(device, orientation, angle) ?? deviceRender(device, orientation);
  const src = r && shadowUrl(r);
  if (!r || !r.shadow || !src) return null;
  const image = getImage(src);
  if (!image) {
    if (!_failed.has(src)) loadImage(src);
    return null;
  }
  const { x, y, w, h } = r.shadow;
  return { image, x, y, w, h, renderW: r.w, renderH: r.h };
}

// Drop cached frames and shrink the GL buffer (after an export's full-size draws).
export function releaseDeviceRenderMemory() {
  _cache.clear();
  if (_warp && !_warp.gl.isContextLost()) {
    _warp.canvas.width = 1;
    _warp.canvas.height = 1;
  }
}
