// CLIENT-ONLY. Lazy loader for the Three.js device renderer. `renderDevice`
// pulls in `three` (~150KB gzip); importing it only through the dynamic
// import() here keeps it out of the app's main chunks — it downloads the first
// time someone actually exports.
//
// `import type` below is erased at build time, so it does NOT create a static
// dependency on `three` — only the dynamic import() does.
import type { Device3DOpts } from "./renderDevice";

type RenderFn = (o: Device3DOpts) => HTMLCanvasElement;

let _fn: RenderFn | null = null;
let _promise: Promise<void> | null = null;

/** Kick off (or await) the one-time chunk load. */
export async function ensure3DLoaded(): Promise<RenderFn> {
  if (_fn) return _fn;
  if (!_promise) {
    _promise = import("./renderDevice").then((m) => {
      _fn = m.renderDeviceCached;
    });
  }
  await _promise;
  if (!_fn) throw new Error("3D renderer failed to load");
  return _fn;
}
