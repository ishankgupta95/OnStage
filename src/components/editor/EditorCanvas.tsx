"use client";

import dynamic from "next/dynamic";

// Konva touches the DOM/canvas, so it must never render on the server.
// `ssr: false` is only allowed inside a Client Component — hence this wrapper.
const Canvas = dynamic(() => import("./Canvas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[620px] w-[286px] items-center justify-center rounded-2xl border border-dashed text-sm text-muted-foreground">
      Loading canvas…
    </div>
  ),
});

export default function EditorCanvas() {
  return <Canvas />;
}
