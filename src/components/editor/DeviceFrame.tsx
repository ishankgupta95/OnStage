"use client";

import { Group, Rect, Text, Circle, Image as KonvaImage } from "react-konva";
import type { Box } from "@/lib/layout";
import type { DeviceGeometry } from "@/lib/deviceGeometry";
import { DEFAULT_FRAME_ADJUST, type FrameAdjust } from "@/lib/editorDoc";

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

export default function DeviceFrame({
  f,
  geo,
  screenImage,
  orientation = "portrait",
  rotation = 0,
  adjust = DEFAULT_FRAME_ADJUST,
  editable = false,
  onAdjust,
}: {
  f: Box;
  geo: DeviceGeometry;
  screenImage: HTMLImageElement | null;
  orientation?: "portrait" | "landscape";
  rotation?: number;
  adjust?: FrameAdjust;
  editable?: boolean;
  onAdjust?: (offset: { offsetX: number; offsetY: number }) => void;
}) {
  const landscape = orientation === "landscape";
  // All proportions are relative to the device's SHORT edge, so a landscape
  // (wide) frame keeps the same physical corner/bezel/cutout sizing.
  const refDim = landscape ? f.height : f.width;
  const cornerR = geo.cornerRatio * refDim;
  const inset = geo.insetRatio * refDim;
  const rail = geo.railRatio * refDim;
  const sx = f.x + inset;
  const sy = f.y + inset;
  const sw = f.width - inset * 2;
  const sh = f.height - inset * 2;
  const sr = geo.screenCornerRatio * refDim;

  // Fit the screenshot into the screen rect per the frame's adjustment.
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
  const setCursor = (stage: { container: () => HTMLElement } | null | undefined, cursor: string) => {
    if (stage) stage.container().style.cursor = cursor;
  };

  const btnW = refDim * 0.012;
  const btnOut = refDim * 0.008;

  // rotate around the frame center when angled
  const cx = f.x + f.width / 2;
  const cy = f.y + f.height / 2;
  const groupProps = rotation
    ? { x: cx, y: cy, offsetX: cx, offsetY: cy, rotation }
    : {};

  return (
    <Group {...groupProps}>
      {/* side buttons (portrait only; landscape keeps the frame clean) */}
      {geo.buttons && !landscape && (
        <>
          <Rect x={f.x + f.width - btnW} y={f.y + f.height * 0.22} width={btnW + btnOut} height={f.height * 0.12} cornerRadius={btnW / 2} fill="#565660" />
          <Rect x={f.x + f.width - btnW} y={f.y + f.height * 0.12} width={btnW + btnOut} height={f.height * 0.055} cornerRadius={btnW / 2} fill="#565660" />
          {geo.cutout === "island" && (
            <>
              <Rect x={f.x - btnOut} y={f.y + f.height * 0.19} width={btnW + btnOut} height={f.height * 0.075} cornerRadius={btnW / 2} fill="#565660" />
              <Rect x={f.x - btnOut} y={f.y + f.height * 0.28} width={btnW + btnOut} height={f.height * 0.075} cornerRadius={btnW / 2} fill="#565660" />
            </>
          )}
        </>
      )}

      {/* titanium body */}
      <Rect
        x={f.x}
        y={f.y}
        width={f.width}
        height={f.height}
        cornerRadius={cornerR}
        fillLinearGradientStartPoint={{ x: f.x, y: f.y }}
        // Run the titanium sheen along the long edge — horizontal when the
        // device is laid on its side — so landscape doesn't compress the bands.
        fillLinearGradientEndPoint={landscape ? { x: f.x + f.width, y: f.y } : { x: f.x, y: f.y + f.height }}
        fillLinearGradientColorStops={[0, "#7c7c85", 0.18, "#4a4a52", 0.5, "#34343b", 0.82, "#4a4a52", 1, "#6a6a72"]}
        shadowColor="#000000"
        shadowBlur={refDim * 0.13}
        shadowOpacity={0.5}
        shadowOffsetY={refDim * 0.07}
      />

      {/* black bezel */}
      <Rect x={f.x + rail} y={f.y + rail} width={f.width - rail * 2} height={f.height - rail * 2} cornerRadius={cornerR - rail} fill="#050505" />

      {/* screen base — dark so "contain" letterboxing reads as an off display */}
      <Rect x={sx} y={sy} width={sw} height={sh} cornerRadius={sr} fill="#0B0B0F" />

      {/* screenshot, clipped to the rounded screen */}
      <Group clipFunc={(ctx) => roundedRect(ctx, sx, sy, sw, sh, sr)}>
        {img ? (
          <KonvaImage
            image={screenImage!}
            x={img.x}
            y={img.y}
            width={img.w}
            height={img.h}
            draggable={canDrag}
            onMouseEnter={(e) => canDrag && setCursor(e.target.getStage(), "grab")}
            onMouseLeave={(e) => setCursor(e.target.getStage(), "default")}
            onDragStart={(e) => setCursor(e.target.getStage(), "grabbing")}
            onDragMove={(e) => {
              if (!pan) return;
              const node = e.target;
              const { centerX, centerY, overflowX, overflowY } = pan;
              node.x(overflowX > 0 ? Math.max(centerX - overflowX / 2, Math.min(centerX + overflowX / 2, node.x())) : centerX);
              node.y(overflowY > 0 ? Math.max(centerY - overflowY / 2, Math.min(centerY + overflowY / 2, node.y())) : centerY);
            }}
            onDragEnd={(e) => {
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
          <Text text="Drop a screenshot" x={sx} y={sy + sh / 2 - 20} width={sw} align="center" fontFamily="Inter" fontSize={Math.max(20, refDim * 0.05)} fill="#B8B8BE" />
        )}
      </Group>

      {/* cutout — top-center in portrait, left-center in landscape */}
      {geo.cutout === "island" &&
        (landscape ? (
          <Rect x={sx + refDim * 0.03} y={cy - refDim * 0.15} width={refDim * 0.072} height={refDim * 0.3} cornerRadius={refDim * 0.036} fill="#000000" listening={false} />
        ) : (
          <Rect x={cx - refDim * 0.15} y={sy + refDim * 0.03} width={refDim * 0.3} height={refDim * 0.072} cornerRadius={refDim * 0.036} fill="#000000" listening={false} />
        ))}
      {geo.cutout === "punch" &&
        (landscape ? (
          <Circle x={sx + refDim * 0.045} y={cy} radius={refDim * 0.02} fill="#000000" listening={false} />
        ) : (
          <Circle x={cx} y={sy + refDim * 0.045} radius={refDim * 0.02} fill="#000000" listening={false} />
        ))}

      {/* glass gloss */}
      <Rect
        x={sx}
        y={sy}
        width={sw}
        height={sh}
        cornerRadius={sr}
        fillLinearGradientStartPoint={{ x: sx, y: sy }}
        fillLinearGradientEndPoint={{ x: sx + sw * 0.7, y: sy + sh * 0.5 }}
        fillLinearGradientColorStops={[0, "rgba(255,255,255,0.12)", 0.5, "rgba(255,255,255,0.02)", 1, "rgba(255,255,255,0)"]}
        listening={false}
      />
    </Group>
  );
}
