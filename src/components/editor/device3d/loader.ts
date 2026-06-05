// CLIENT-ONLY. Lazy loader for the Three.js device renderer. `renderDevice`
// pulls in `three` (~150KB gzip); importing it only through the dynamic
// `import()` here keeps it OUT of the editor's main chunk, so the ~majority of
// users who never use a 3D angle don't download it. The chunk loads on demand:
// the editor triggers it when a frame needs 3D (DeviceFrame3D), and the export
// awaits it before its synchronous harvest (ExportController).
//
// `import type` below is erased at build time, so it does NOT create a static
// dependency on `three` — only the dynamic import() does.
import type { Device3DOpts } from "./renderDevice";

type RenderFn = (o: Device3DOpts) => HTMLCanvasElement;

let _fn: RenderFn | null = null;
let _promise: Promise<void> | null = null;
const _subs = new Set<() => void>();

// Synchronous accessor: the render fn once the chunk is loaded, else null.
export function get3DRenderer(): RenderFn | null {
  return _fn;
}

// Kick off (or await) the one-time chunk load. Resolves once the renderer is
// available; notifies subscribers so any mounted DeviceFrame3D re-renders.
export function ensure3DLoaded(): Promise<void> {
  if (_fn) return Promise.resolve();
  if (!_promise) {
    _promise = import("./renderDevice").then((m) => {
      _fn = m.renderDeviceCached;
      _subs.forEach((cb) => cb());
    });
  }
  return _promise;
}

export function subscribe3DLoad(cb: () => void): () => void {
  _subs.add(cb);
  return () => {
    _subs.delete(cb);
  };
}
