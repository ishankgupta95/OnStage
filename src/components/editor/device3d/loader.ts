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

// Returns null when the device couldn't be drawn; the error is kept for
// take3DRenderError so an export can fail instead of shipping a PNG without it.
type RenderFn = (o: Device3DOpts) => HTMLCanvasElement | null;

let _fn: RenderFn | null = null;
let _release: (() => void) | null = null;
let _promise: Promise<void> | null = null;
let _error: Error | null = null;
const _subs = new Set<() => void>();

// Synchronous accessor: the render fn once the chunk is loaded, else null.
export function get3DRenderer(): RenderFn | null {
  return _fn;
}

// Kick off (or await) the one-time chunk load. Resolves once the renderer is
// available; notifies subscribers so any mounted DeviceFrame3D re-renders. A
// failed load isn't cached, so the next call tries again.
export function ensure3DLoaded(): Promise<void> {
  if (_fn) return Promise.resolve();
  if (!_promise) {
    _promise = import("./renderDevice").then(
      (m) => {
        _fn = (o) => {
          try {
            return m.renderDeviceCached(o);
          } catch (e) {
            _error = e instanceof Error ? e : new Error("The 3D device couldn't be drawn.");
            return null;
          }
        };
        _release = m.releaseRenderMemory;
        _subs.forEach((cb) => cb());
      },
      () => {
        _promise = null;
        throw new Error("Couldn't load the 3D renderer. Check your connection and try again.");
      },
    );
  }
  return _promise;
}

// The last 3D draw failure since the previous call (then cleared).
export function take3DRenderError(): Error | null {
  const e = _error;
  _error = null;
  return e;
}

// Free cached 3D renders (no-op if the renderer never loaded).
export function release3DMemory() {
  _release?.();
}

export function subscribe3DLoad(cb: () => void): () => void {
  _subs.add(cb);
  return () => {
    _subs.delete(cb);
  };
}
