"use client";

import { useEffect, useState } from "react";
import { Group, Rect, Text, Image as KonvaImage } from "react-konva";
import type { Box } from "@/lib/layout";
import type { DeviceFrame as DeviceId } from "@/lib/schema";
import { DEFAULT_FRAME_ADJUST, type DevicePerspective, type FrameAdjust } from "@/lib/editorDoc";
import { FRONT_ON, deviceRender, frontScreenRect } from "@/lib/deviceRenders";
import { deviceShadow, renderDeviceFrame, subscribeDeviceRenders } from "./deviceRender";

// A device frame on the canvas: the photoreal render of the device (front-on
// or at a preset angle) with the screenshot in its screen, as one Konva.Image
// filling the frame box. Front-on frames add an invisible screenshot layer
// over the screen so the screenshot can be dragged to pan (it shows while
// dragging). While the render downloads, an invisible hit area keeps the
// frame selectable.
export default function DeviceFrame({
  f,
  device,
  perspective,
  finish,
  glare = false,
  orientation,
  screenImage,
  adjust = DEFAULT_FRAME_ADJUST,
  editable = false,
  onAdjust,
}: {
  f: Box;
  device: DeviceId;
  perspective?: DevicePerspective; // absent = front-on
  finish?: string; // absent/unknown = the model's default
  glare?: boolean;
  orientation: "portrait" | "landscape";
  screenImage: HTMLImageElement | null;
  adjust?: FrameAdjust;
  editable?: boolean;
  onAdjust?: (offset: { offsetX: number; offsetY: number }) => void;
}) {
  const [, bump] = useState(0);
  useEffect(() => subscribeDeviceRenders(() => bump((n) => n + 1)), []);

  const angle = perspective ?? FRONT_ON;
  const front = angle.yaw === 0 && angle.pitch === 0;
  const canvas = renderDeviceFrame({
    device,
    orientation,
    angle,
    finish,
    glare,
    screenImage,
    adjust,
    width: f.width,
    height: f.height,
  });

  if (!canvas) {
    return <Rect x={f.x} y={f.y} width={f.width} height={f.height} fill="#000000" opacity={0} />;
  }

  const refDim = Math.min(f.width, f.height);
  const r = front ? deviceRender(device, orientation) : undefined;
  const rect = r ? frontScreenRect(r, f.width, f.height) : null;
  // The render's own soft shadow, under the device. Without one, fall back to
  // Konva's blur shadow.
  const shadow = deviceShadow(device, orientation, angle);

  return (
    <Group>
      {shadow && (
        <KonvaImage
          image={shadow.image}
          x={f.x + shadow.x * (f.width / shadow.renderW)}
          y={f.y + shadow.y * (f.height / shadow.renderH)}
          width={shadow.w * (f.width / shadow.renderW)}
          height={shadow.h * (f.height / shadow.renderH)}
          listening={false}
        />
      )}
      <KonvaImage
        image={canvas}
        x={f.x}
        y={f.y}
        width={f.width}
        height={f.height}
        // Catches clicks/drags on the device (select, move).
        {...(shadow
          ? {}
          : {
              shadowColor: "#000000",
              shadowBlur: front ? refDim * 0.13 : Math.max(8, f.width * 0.06),
              shadowOpacity: front ? 0.45 : 0.3,
              shadowOffsetY: front ? refDim * 0.07 : f.height * 0.02,
            })}
      />
      {rect && (
        <ScreenshotLayer
          rect={{ x: f.x + rect.x, y: f.y + rect.y, w: rect.w, h: rect.h, r: rect.r }}
          screenImage={screenImage}
          adjust={adjust}
          editable={editable}
          onAdjust={onAdjust}
          ghost={!!screenImage}
          placeholderSize={Math.max(20, refDim * 0.05)}
        />
      )}
    </Group>
  );
}

type CtxLike = {
  beginPath: () => void;
  moveTo: (x: number, y: number) => void;
  arcTo: (x1: number, y1: number, x2: number, y2: number, r: number) => void;
  closePath: () => void;
};

function roundedRect(ctx: CtxLike, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// The screenshot inside a rounded screen rect, fitted per the frame's
// adjustment (cover/contain, scale, pan) and — when editable and overflowing —
// draggable to pan. With `ghost` it's invisible (the render shows the
// screenshot) except while dragging, when it previews the pan live.
function ScreenshotLayer({
  rect,
  screenImage,
  adjust,
  editable = false,
  onAdjust,
  ghost = false,
  placeholderSize,
}: {
  rect: { x: number; y: number; w: number; h: number; r: number };
  screenImage: HTMLImageElement | null;
  adjust: FrameAdjust;
  editable?: boolean;
  onAdjust?: (offset: { offsetX: number; offsetY: number }) => void;
  ghost?: boolean;
  placeholderSize: number;
}) {
  const [dragging, setDragging] = useState(false);
  const { x: sx, y: sy, w: sw, h: sh, r: sr } = rect;

  let img: { x: number; y: number; w: number; h: number } | null = null;
  // Pan geometry, shared by the render and the drag handlers.
  let pan: { centerX: number; centerY: number; overflowX: number; overflowY: number } | null = null;
  if (screenImage && screenImage.width > 0) {
    const ia = screenImage.width / screenImage.height;
    const sa = sw / sh;
    let baseW: number;
    let baseH: number;
    if (adjust.fit === "contain") {
      // whole image visible inside the screen
      if (ia > sa) {
        baseW = sw;
        baseH = sw / ia;
      } else {
        baseH = sh;
        baseW = sh * ia;
      }
    } else {
      // cover: fill the screen, crop the overflow
      if (ia > sa) {
        baseH = sh;
        baseW = sh * ia;
      } else {
        baseW = sw;
        baseH = sw / ia;
      }
    }
    const dw = baseW * adjust.scale;
    const dh = baseH * adjust.scale;
    // Pan within the overflow only, so cover never reveals a gap.
    const overflowX = dw - sw;
    const overflowY = dh - sh;
    const centerX = sx + (sw - dw) / 2;
    const centerY = sy + (sh - dh) / 2;
    const clamp = (v: number) => Math.max(-1, Math.min(1, v));
    const panX = overflowX > 0 ? (clamp(adjust.offsetX) * overflowX) / 2 : 0;
    const panY = overflowY > 0 ? (clamp(adjust.offsetY) * overflowY) / 2 : 0;
    img = { x: centerX + panX, y: centerY + panY, w: dw, h: dh };
    pan = { centerX, centerY, overflowX, overflowY };
  }

  const canDrag = editable && !!pan && (pan.overflowX > 0 || pan.overflowY > 0);
  // A ghost layer with nothing to drag has no job: let clicks through.
  if (ghost && !canDrag && img) return null;
  const setCursor = (stage: { container: () => HTMLElement } | null | undefined, cursor: string) => {
    if (stage) stage.container().style.cursor = cursor;
  };

  return (
    <Group clipFunc={(ctx) => roundedRect(ctx, sx, sy, sw, sh, sr)}>
      {img ? (
        <KonvaImage
          image={screenImage!}
          x={img.x}
          y={img.y}
          width={img.w}
          height={img.h}
          opacity={ghost && !dragging ? 0 : 1}
          draggable={canDrag}
          onMouseEnter={(e) => canDrag && setCursor(e.target.getStage(), "grab")}
          onMouseLeave={(e) => setCursor(e.target.getStage(), "default")}
          onDragStart={(e) => {
            setDragging(true);
            setCursor(e.target.getStage(), "grabbing");
          }}
          onDragMove={(e) => {
            if (!pan) return;
            const node = e.target;
            const { centerX, centerY, overflowX, overflowY } = pan;
            node.x(overflowX > 0 ? Math.max(centerX - overflowX / 2, Math.min(centerX + overflowX / 2, node.x())) : centerX);
            node.y(overflowY > 0 ? Math.max(centerY - overflowY / 2, Math.min(centerY + overflowY / 2, node.y())) : centerY);
          }}
          onDragEnd={(e) => {
            setDragging(false);
            setCursor(e.target.getStage(), "grab");
            if (!pan || !onAdjust) return;
            const node = e.target;
            const { centerX, centerY, overflowX, overflowY } = pan;
            onAdjust({
              offsetX: overflowX > 0 ? Math.max(-1, Math.min(1, (node.x() - centerX) / (overflowX / 2))) : 0,
              offsetY: overflowY > 0 ? Math.max(-1, Math.min(1, (node.y() - centerY) / (overflowY / 2))) : 0,
            });
          }}
        />
      ) : (
        <Text text="Drop a screenshot" x={sx} y={sy + sh / 2 - placeholderSize * 0.4} width={sw} align="center" fontFamily="Inter" fontSize={placeholderSize} fill="#B8B8BE" listening={false} />
      )}
    </Group>
  );
}
