"use client";

import { Stage, Layer, Rect, Text } from "react-konva";

// 6.9" iPhone export size (1290×2796). Scaled down to fit the editor viewport.
const CANVAS_W = 1290;
const CANVAS_H = 2796;
const FIT_H = 620;
const scale = FIT_H / CANVAS_H;

export default function Canvas() {
  return (
    <Stage
      width={CANVAS_W * scale}
      height={CANVAS_H * scale}
      scaleX={scale}
      scaleY={scale}
      style={{
        borderRadius: 14,
        overflow: "hidden",
        boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
      }}
    >
      <Layer>
        <Rect
          x={0}
          y={0}
          width={CANVAS_W}
          height={CANVAS_H}
          fillLinearGradientStartPoint={{ x: 0, y: 0 }}
          fillLinearGradientEndPoint={{ x: CANVAS_W, y: CANVAS_H }}
          fillLinearGradientColorStops={[0, "#10B981", 1, "#0F5132"]}
        />
        <Text
          text="Your app, on stage."
          x={80}
          y={200}
          width={CANVAS_W - 160}
          fontFamily="Inter, sans-serif"
          fontStyle="bold"
          fontSize={140}
          lineHeight={1.1}
          fill="#FFFFFF"
          align="center"
        />
        {/* device frame placeholder */}
        <Rect
          x={CANVAS_W * 0.18}
          y={680}
          width={CANVAS_W * 0.64}
          height={CANVAS_H * 0.6}
          cornerRadius={96}
          fill="#0A0A0A"
          shadowColor="#000000"
          shadowBlur={80}
          shadowOpacity={0.4}
          shadowOffsetY={40}
        />
        {/* screen */}
        <Rect
          x={CANVAS_W * 0.18 + 40}
          y={680 + 40}
          width={CANVAS_W * 0.64 - 80}
          height={CANVAS_H * 0.6 - 80}
          cornerRadius={68}
          fill="#1E293B"
        />
      </Layer>
    </Stage>
  );
}
