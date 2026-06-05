// CLIENT-ONLY. Procedural 3D device renderer (Three.js) → transparent canvas,
// cached and composited into the Konva stage as an Image by DeviceFrame3D.
//
// Imported only through ScreenshotContent — a Client Component reached via
// EditorCanvas's `ssr:false` dynamic import (the board) and ExportController
// (also client) — so `three` never loads on the server.
//
// Realism approach (validated in the Phase 0 spike): an extruded rounded-rect
// body (big face corners + small edge bevel = the rail) in a PBR "black
// titanium" material, lit by a procedural studio environment + soft-box area
// lights, with ACES tone mapping. The screen is a UV-textured plane (no
// homography warp needed) and the notch/lens are UNLIT so they can't blow out
// to silver under the bright env.

import * as THREE from "three";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import type { DeviceGeometry } from "@/lib/deviceGeometry";
import { DEFAULT_FRAME_ADJUST, type DevicePerspective, type FrameAdjust } from "@/lib/editorDoc";

// Baked "black titanium" studio look, dialed in during the spike.
const METAL_COLOR = 0x2c2c30;
const ROUGHNESS = 0.34;
const ENV_INTENSITY = 1.1;
const EXPOSURE = 1.45;
const SCREEN_BASE = "#0b0b0f"; // dark screen base behind a contained image

let _renderer: THREE.WebGLRenderer | null = null;
let _envTex: THREE.Texture | null = null;
let _rectInit = false;

function getRenderer(): THREE.WebGLRenderer {
  if (_renderer) return _renderer;
  const r = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    preserveDrawingBuffer: true,
    premultipliedAlpha: true,
  });
  r.setPixelRatio(1);
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.ACESFilmicToneMapping;
  _renderer = r;
  return r;
}

function ensureRectLights() {
  if (_rectInit) return;
  RectAreaLightUniformsLib.init();
  _rectInit = true;
}

// Procedural "studio": bright-top → dark-bottom gradient + blurred soft-boxes.
// Reflected in the metal it gives the graded rail highlights of a product shot.
function getEnv(renderer: THREE.WebGLRenderer): THREE.Texture {
  if (_envTex) return _envTex;
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 512;
  const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0.0, "#ffffff");
  g.addColorStop(0.45, "#f2f4f7");
  g.addColorStop(0.52, "#e3e6eb");
  g.addColorStop(0.66, "#c3c7ce");
  g.addColorStop(1.0, "#94989f");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.filter = "blur(14px)";
  ctx.fillStyle = "rgba(255,255,255,1)";
  ctx.fillRect(60, 150, 280, 120);
  ctx.fillRect(700, 170, 230, 110);
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillRect(380, 40, 260, 130);
  ctx.filter = "none";

  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  const pmrem = new THREE.PMREMGenerator(renderer);
  _envTex = pmrem.fromEquirectangular(tex).texture;
  pmrem.dispose();
  tex.dispose();
  return _envTex;
}

function roundedRectShape(w: number, h: number, r: number): THREE.Shape {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  r = Math.max(0.0001, Math.min(r, Math.min(w, h) / 2));
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

function flatRoundedRect(w: number, h: number, r: number): THREE.ShapeGeometry {
  const geo = new THREE.ShapeGeometry(roundedRectShape(w, h, r), 24);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, (uv.getX(i) + w / 2) / w, (uv.getY(i) + h / 2) / h);
  }
  uv.needsUpdate = true;
  return geo;
}

function disposeScene(scene: THREE.Scene) {
  scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
    else if (mat) {
      const withMap = mat as THREE.MeshBasicMaterial;
      if (withMap.map) withMap.map.dispose();
      mat.dispose();
    }
  });
}

const clamp1 = (v: number) => Math.max(-1, Math.min(1, v));

// Compose the user's screenshot into a canvas at the screen plane's aspect,
// applying the same cover/contain/scale/pan as the flat DeviceFrame so the 3D
// screen matches. Null image → a plain dark screen.
function composeScreen(
  img: HTMLImageElement | null,
  aspect: number,
  adjust: FrameAdjust,
): HTMLCanvasElement {
  const tw = 1024;
  const th = Math.max(1, Math.round(tw / aspect));
  const c = document.createElement("canvas");
  c.width = tw;
  c.height = th;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = SCREEN_BASE;
  ctx.fillRect(0, 0, tw, th);
  if (!img || img.width === 0) return c;

  const ia = img.width / img.height;
  let bw: number;
  let bh: number;
  if (adjust.fit === "contain") {
    if (ia > aspect) {
      bw = tw;
      bh = tw / ia;
    } else {
      bh = th;
      bw = th * ia;
    }
  } else {
    if (ia > aspect) {
      bh = th;
      bw = th * ia;
    } else {
      bw = tw;
      bh = tw / ia;
    }
  }
  bw *= adjust.scale;
  bh *= adjust.scale;
  const overflowX = bw - tw;
  const overflowY = bh - th;
  const ox = (tw - bw) / 2 + (overflowX > 0 ? (clamp1(adjust.offsetX) * overflowX) / 2 : 0);
  const oy = (th - bh) / 2 + (overflowY > 0 ? (clamp1(adjust.offsetY) * overflowY) / 2 : 0);
  ctx.drawImage(img, ox, oy, bw, bh);
  return c;
}

export type Device3DOpts = {
  deviceKey: string; // device id (cache key only)
  geom: DeviceGeometry;
  perspective: DevicePerspective;
  screenImage: HTMLImageElement | null;
  adjust?: FrameAdjust;
  width: number;
  height: number;
};

function renderDevice(opts: Device3DOpts): HTMLCanvasElement {
  const { geom, perspective, width, height } = opts;
  const adjust = opts.adjust ?? DEFAULT_FRAME_ADJUST;
  const renderer = getRenderer();

  // Supersample for crisp edges, capped against the GPU's max texture size and a
  // conservative total-area limit so large iPad exports never exceed the buffer.
  const maxTex = renderer.capabilities.maxTextureSize;
  let ss = 2;
  while (
    ss > 1 &&
    (width * ss > maxTex || height * ss > maxTex || width * ss * height * ss > 16_000_000)
  ) {
    ss -= 1;
  }
  renderer.setSize(width * ss, height * ss, false);
  renderer.toneMappingExposure = EXPOSURE;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  scene.environment = getEnv(renderer);
  scene.environmentIntensity = ENV_INTENSITY;

  const W = 1;
  const H = W / geom.aspect;
  const D = geom.thickness * W;
  const bevel = Math.min(Math.max(geom.railRatio * W * 0.8, 0.004), D * 0.32);
  const cornerR = geom.cornerRatio * W;
  const front = D / 2;
  const railInset = 0.006 * W;
  const screenInset = Math.max(geom.insetRatio * W * 0.45, railInset + 0.008);
  const screenCornerR = geom.screenCornerRatio * W;

  const group = new THREE.Group();

  // body (titanium slab)
  const bodyShape = roundedRectShape(W - 2 * bevel, H - 2 * bevel, Math.max(cornerR - bevel, 0.001));
  const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, {
    depth: D - 2 * bevel,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 8,
    curveSegments: 40,
  });
  bodyGeo.center();
  const titanium = new THREE.MeshPhysicalMaterial({
    color: METAL_COLOR,
    metalness: 1,
    roughness: ROUGHNESS,
    clearcoat: 0.5,
    clearcoatRoughness: 0.22,
  });
  titanium.anisotropy = 0.35;
  titanium.anisotropyRotation = Math.PI / 2;
  group.add(new THREE.Mesh(bodyGeo, titanium));

  // black bezel on the front face (thin titanium sliver remains at the edge)
  const bezelMat = new THREE.MeshPhysicalMaterial({ color: 0x070708, metalness: 0, roughness: 0.4 });
  const bezel = new THREE.Mesh(
    flatRoundedRect(W - 2 * railInset, H - 2 * railInset, Math.max(cornerR - railInset, 0.001)),
    bezelMat,
  );
  bezel.position.z = front + 0.0015;
  group.add(bezel);

  // screen (screenshot texture, unlit/bright)
  const screenAspect = (W - 2 * screenInset) / (H - 2 * screenInset);
  const screenTex = new THREE.CanvasTexture(composeScreen(opts.screenImage, screenAspect, adjust));
  screenTex.colorSpace = THREE.SRGBColorSpace;
  screenTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const screen = new THREE.Mesh(
    flatRoundedRect(W - 2 * screenInset, H - 2 * screenInset, screenCornerR),
    new THREE.MeshBasicMaterial({ map: screenTex }),
  );
  screen.position.z = front + 0.003;
  group.add(screen);

  // camera cutout — UNLIT so it reads black + a subtle dark lens
  if (geom.cutout !== "none") {
    const islandMat = new THREE.MeshBasicMaterial({ color: 0x070708 });
    const lensMat = new THREE.MeshBasicMaterial({ color: 0x14161e });
    if (geom.cutout === "island") {
      const iw = W * 0.3;
      const ih = H * 0.019;
      const iy = H / 2 - screenInset - ih * 1.7;
      const island = new THREE.Mesh(flatRoundedRect(iw, ih, ih / 2), islandMat);
      island.position.set(0, iy, front + 0.0045);
      group.add(island);
      const lens = new THREE.Mesh(new THREE.CircleGeometry(ih * 0.42, 24), lensMat);
      lens.position.set(iw * 0.32, iy, front + 0.0052);
      group.add(lens);
    } else {
      const r = W * 0.016;
      const cy = H / 2 - screenInset - W * 0.04;
      const punch = new THREE.Mesh(new THREE.CircleGeometry(r, 32), islandMat);
      punch.position.set(0, cy, front + 0.0045);
      group.add(punch);
      const lens = new THREE.Mesh(new THREE.CircleGeometry(r * 0.55, 24), lensMat);
      lens.position.set(0, cy, front + 0.0052);
      group.add(lens);
    }
  }

  // side button (flattened capsule, sits proud of the rail)
  if (geom.buttons) {
    const btn = new THREE.Mesh(new THREE.CapsuleGeometry(D * 0.17, H * 0.06, 8, 24), titanium);
    btn.scale.set(0.7, 1, 1);
    btn.position.set(W / 2 - D * 0.015, H * 0.15, 0);
    group.add(btn);
  }

  group.rotation.y = THREE.MathUtils.degToRad(perspective.yaw);
  group.rotation.x = THREE.MathUtils.degToRad(perspective.pitch);
  scene.add(group);

  ensureRectLights();
  const keyLight = new THREE.RectAreaLight(0xffffff, 7, W * 2.6, H * 1.6);
  keyLight.position.set(-W * 1.5, H * 0.7, W * 1.4);
  keyLight.lookAt(0, 0, 0);
  scene.add(keyLight);
  const rimLight = new THREE.RectAreaLight(0xf2f6ff, 7, W * 1.4, H * 1.4);
  rimLight.position.set(W * 2.0, H * 0.25, W * 1.0);
  rimLight.lookAt(0, 0, 0);
  scene.add(rimLight);
  const fill = new THREE.DirectionalLight(0xffffff, 0.4);
  fill.position.set(0, -2, 5);
  scene.add(fill);

  const fov = 20;
  const camera = new THREE.PerspectiveCamera(fov, width / height, 0.1, 100);
  const fitH = H * 1.08;
  const dist = fitH / 2 / Math.tan(THREE.MathUtils.degToRad(fov) / 2);
  camera.position.set(0, 0, dist);
  camera.lookAt(0, 0, 0);

  renderer.render(scene, camera);

  const out = document.createElement("canvas");
  out.width = width;
  out.height = height;
  const octx = out.getContext("2d")!;
  octx.imageSmoothingEnabled = true;
  octx.imageSmoothingQuality = "high";
  octx.drawImage(renderer.domElement, 0, 0, width, height);

  disposeScene(scene);
  return out;
}

// ── render cache ─────────────────────────────────────────────────────────────
// WebGL renders are relatively expensive, and ScreenshotContent re-renders on
// every React tick, so cache the canvas keyed on everything that affects it.
const _cache = new Map<string, HTMLCanvasElement>();
const CACHE_MAX = 32;

function cacheKey(o: Device3DOpts): string {
  const a = o.adjust ?? DEFAULT_FRAME_ADJUST;
  return [
    o.deviceKey,
    o.perspective.yaw,
    o.perspective.pitch,
    Math.round(o.width),
    Math.round(o.height),
    o.screenImage?.src ?? "none",
    a.fit,
    a.scale,
    a.offsetX,
    a.offsetY,
  ].join("|");
}

export function renderDeviceCached(o: Device3DOpts): HTMLCanvasElement {
  const key = cacheKey(o);
  const hit = _cache.get(key);
  if (hit) return hit;
  const canvas = renderDevice(o);
  _cache.set(key, canvas);
  if (_cache.size > CACHE_MAX) {
    const oldest = _cache.keys().next().value;
    if (oldest !== undefined) _cache.delete(oldest);
  }
  return canvas;
}
