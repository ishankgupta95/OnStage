"use client";

import { useEffect, useState } from "react";
import { Image as KonvaImage } from "react-konva";
import type { Box } from "@/lib/layout";
import type { DeviceGeometry } from "@/lib/deviceGeometry";
import type { DeviceFrame } from "@/lib/schema";
import { DEFAULT_FRAME_ADJUST, type DevicePerspective, type FrameAdjust } from "@/lib/editorDoc";
import DeviceFrameFlat from "./DeviceFrame";
import { get3DRenderer, ensure3DLoaded, subscribe3DLoad } from "./device3d/loader";

// The 3D-angled device: a single Konva.Image of a Three.js render filling the
// same box the flat DeviceFrame would. The render (incl. the screenshot, baked
// into the screen texture via adjust) is cached, so this is cheap on repeated
// React ticks and harvests synchronously into the export stage.
//
// The Three.js chunk is lazy-loaded; until it's ready we render the flat frame
// as a graceful fallback (the editor; export preloads the chunk first).
export default function DeviceFrame3D({
  f,
  geo,
  device,
  perspective,
  orientation,
  screenImage,
  adjust = DEFAULT_FRAME_ADJUST,
}: {
  f: Box;
  geo: DeviceGeometry;
  device: DeviceFrame;
  perspective: DevicePerspective;
  orientation: "portrait" | "landscape";
  screenImage: HTMLImageElement | null;
  adjust?: FrameAdjust;
}) {
  const render = get3DRenderer();
  const [, bump] = useState(0);
  useEffect(() => {
    if (render) return;
    ensure3DLoaded().catch(() => {}); // stays flat; a later mount retries
    return subscribe3DLoad(() => bump((n) => n + 1));
  }, [render]);

  const w = Math.max(1, Math.round(f.width));
  const h = Math.max(1, Math.round(f.height));
  const canvas = render?.({
    deviceKey: device,
    geom: geo,
    perspective,
    screenImage,
    adjust,
    width: w,
    height: h,
  });

  // Chunk not loaded yet, or the 3D draw failed: show the flat frame.
  if (!canvas) {
    return (
      <DeviceFrameFlat
        f={f}
        geo={geo}
        orientation={orientation}
        screenImage={screenImage}
        adjust={adjust}
        editable={false}
      />
    );
  }

  return (
    <KonvaImage
      image={canvas}
      x={f.x}
      y={f.y}
      width={f.width}
      height={f.height}
      listening={false}
      shadowColor="#000000"
      shadowBlur={Math.max(8, f.width * 0.06)}
      shadowOpacity={0.3}
      shadowOffsetY={f.height * 0.02}
    />
  );
}
