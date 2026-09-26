// CLIENT-ONLY. Procedural 3D device renderer (Three.js) → transparent canvas,
// composited into the export's Konva stage as an Image.
//
// Loaded only through ./loader's dynamic import(), so `three` (~150KB gzip)
// stays out of the editor's main chunk and never touches the server.
//
// Realism approach: an extruded rounded-rect body (big face corners + small
// edge bevel = the rail) in a PBR metal material, lit by a procedural studio
// environment + soft-box area lights, with ACES tone mapping. The screen is a
// UV-textured plane, and the notch/lens are UNLIT so they can't blow out to
// silver under the bright env.

import * as THREE from "three";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import { FRAME_FINISH, type DeviceGeometry } from "./geometry";

type DevicePerspective = {
  yaw: number;
  pitch: number;
  /** translateZ, in world units (device width = 1). */
  z?: number;
};

// Studio look, dialed in during the original spike; the body colour and
// roughness now come from the frame finish the user picked.
const ENV_INTENSITY = 1.1;
const EXPOSURE = 1.45;
const SCREEN_BASE = "#0b0b0f"; // dark base behind the screen content

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

// Compose the screen source into a canvas at the screen plane's aspect. The
// source is either the user's screenshot or the sample screen the canvas
// shows, cover-fitted so the 3D screen matches what the editor displays.
function composeScreen(
  img: CanvasImageSource | null,
  srcW: number,
  srcH: number,
  aspect: number,
): HTMLCanvasElement {
  const tw = 1024;
  const th = Math.max(1, Math.round(tw / aspect));
  const c = document.createElement("canvas");
  c.width = tw;
  c.height = th;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = SCREEN_BASE;
  ctx.fillRect(0, 0, tw, th);
  if (!img || srcW === 0 || srcH === 0) return c;

  const ia = srcW / srcH;
  let bw: number;
  let bh: number;
  if (ia > aspect) {
    bh = th;
    bw = th * ia;
  } else {
    bw = tw;
    bh = tw / ia;
  }
  ctx.drawImage(img, (tw - bw) / 2, (th - bh) / 2, bw, bh);
  return c;
}

export type Device3DOpts = {
  deviceKey: string; // device id + finish (cache key only)
  geom: DeviceGeometry;
  perspective: DevicePerspective;
  finish: string;
  /** Screen content: the user's screenshot, or the sample screen canvas. */
  screen: { source: CanvasImageSource; width: number; height: number } | null;
  screenKey: string; // cache key for the screen content
  width: number;
  height: number;
  /**
   * The canvas's own projection, so the render matches it exactly rather than
   * approximately: how many output pixels one world unit (the device's width)
   * covers, and the CSS `perspective` distance in the same world units.
   */
  pixelsPerWorld: number;
  perspectiveDistance: number;
};

function renderDevice(opts: Device3DOpts): HTMLCanvasElement {
  const { geom, perspective, width, height } = opts;
  const finish = FRAME_FINISH[opts.finish] ?? FRAME_FINISH.graphite;
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
    color: finish.color,
    metalness: 1,
    roughness: finish.roughness,
    clearcoat: 0.5,
    clearcoatRoughness: 0.22,
  });
  titanium.anisotropy = 0.35;
  titanium.anisotropyRotation = Math.PI / 2;
  if (!geom.frameless) group.add(new THREE.Mesh(bodyGeo, titanium));

  // black bezel on the front face (thin titanium sliver remains at the edge)
  const bezelMat = new THREE.MeshPhysicalMaterial({ color: 0x070708, metalness: 0, roughness: 0.4 });
  const bezel = new THREE.Mesh(
    flatRoundedRect(W - 2 * railInset, H - 2 * railInset, Math.max(cornerR - railInset, 0.001)),
    bezelMat,
  );
  bezel.position.z = front + 0.0015;
  if (!geom.frameless) group.add(bezel);

  // screen (screenshot texture, unlit/bright)
  const screenAspect = (W - 2 * screenInset) / (H - 2 * screenInset);
  const screenTex = new THREE.CanvasTexture(
    composeScreen(
      opts.screen?.source ?? null,
      opts.screen?.width ?? 0,
      opts.screen?.height ?? 0,
      screenAspect,
    ),
  );
  screenTex.colorSpace = THREE.SRGBColorSpace;
  screenTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const screen = new THREE.Mesh(
    flatRoundedRect(W - 2 * screenInset, H - 2 * screenInset, screenCornerR),
    // toneMapped:false — the screen is the user's own artwork, so it must come
    // out pixel-for-pixel rather than through the scene's ACES curve.
    new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false }),
  );
  screen.position.z = front + 0.003;
  group.add(screen);

  // camera cutout — UNLIT so it reads black + a subtle dark lens
  if (geom.cutout !== "none") {
    const islandMat = new THREE.MeshBasicMaterial({ color: 0x070708, toneMapped: false });
    const lensMat = new THREE.MeshBasicMaterial({ color: 0x14161e, toneMapped: false });
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
  if (geom.buttons && !geom.frameless) {
    const btn = new THREE.Mesh(new THREE.CapsuleGeometry(D * 0.17, H * 0.06, 8, 24), titanium);
    btn.scale.set(0.7, 1, 1);
    btn.position.set(W / 2 - D * 0.015, H * 0.15, 0);
    group.add(btn);
  }

  group.rotation.y = THREE.MathUtils.degToRad(perspective.yaw);
  group.rotation.x = THREE.MathUtils.degToRad(perspective.pitch);
  group.position.z = perspective.z ?? 0;
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

  // Match the editor canvas's projection exactly: a CSS `perspective: Ppx` on
  // a parent is a camera P away from the z=0 plane, and the visible extent at
  // that plane is the output size divided by the device's pixels-per-world.
  const dist = opts.perspectiveDistance;
  const visibleH = height / opts.pixelsPerWorld;
  const fov = 2 * THREE.MathUtils.radToDeg(Math.atan(visibleH / 2 / dist));
  const camera = new THREE.PerspectiveCamera(fov, width / height, 0.01, 100);
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
  return [
    o.deviceKey,
    o.finish,
    o.perspective.yaw,
    o.perspective.pitch,
    o.perspective.z ?? 0,
    Math.round(o.pixelsPerWorld),
    o.perspectiveDistance.toFixed(3),
    Math.round(o.width),
    Math.round(o.height),
    o.screenKey,
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
