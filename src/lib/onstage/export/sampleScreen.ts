/**
 * The Trailhead sample screen, painted to a canvas.
 *
 * This is the same artwork `PhoneScreenUI` renders in the editor — kept in
 * lockstep so an exported PNG shows exactly what the canvas showed. Values are
 * the design's own pixel sizes for a 166×364 screen, multiplied by `k`.
 */
const BARS = [38, 52, 44, 70, 58, 82, 64, 48, 76, 100, 66, 54, 72, 46];
const ROWS = [
  { name: "Ridge Loop", val: "5.2 km", tint: "#2f8f86" },
  { name: "Harbour Flat", val: "3.1 km", tint: "#3f6fa8" },
  { name: "Night Sprint", val: "1.8 km", tint: "#a8563f" },
];

import { SCREEN_INK } from "@/lib/onstage/data";

const DESIGN_W = 166;
const DESIGN_H = 364;

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export function paintSampleScreen(width = 664): HTMLCanvasElement {
  const k = width / DESIGN_W;
  const c = document.createElement("canvas");
  c.width = Math.round(DESIGN_W * k);
  c.height = Math.round(DESIGN_H * k);
  const ctx = c.getContext("2d")!;
  const f = (weight: number, size: number) => `${weight} ${size * k}px Inter, sans-serif`;

  ctx.fillStyle = "#0f1114";
  ctx.fillRect(0, 0, c.width, c.height);

  // status bar
  ctx.fillStyle = "#cfd6dd";
  ctx.font = f(500, 8);
  ctx.textBaseline = "alphabetic";
  ctx.fillText("9:41", 12 * k, 20 * k);
  ctx.strokeStyle = "#cfd6dd";
  ctx.lineWidth = 1 * k;
  roundRect(ctx, (DESIGN_W - 12 - 11) * k, 15 * k, 11 * k, 5 * k, 1.5 * k);
  ctx.stroke();

  // title
  ctx.fillStyle = "#eaf0f6";
  ctx.font = f(700, 13);
  ctx.fillText("Today", 12 * k, 40 * k);
  ctx.fillStyle = "#7d8794";
  ctx.font = f(400, 8);
  ctx.fillText("Tuesday, 4 March", 12 * k, 51 * k);

  // distance card
  const cardX = 12 * k;
  const cardY = 58 * k;
  const cardW = (DESIGN_W - 24) * k;
  const cardH = 74 * k;
  const g = ctx.createLinearGradient(cardX, cardY, cardX + cardW * 0.5, cardY + cardH);
  g.addColorStop(0, "#1b6f6a");
  g.addColorStop(1, "#134f63");
  ctx.fillStyle = g;
  roundRect(ctx, cardX, cardY, cardW, cardH, 9 * k);
  ctx.fill();

  ctx.fillStyle = `rgba(${SCREEN_INK},.72)`;
  ctx.font = f(400, 7.5);
  ctx.fillText("DISTANCE", cardX + 10 * k, cardY + 17 * k);
  ctx.fillStyle = "#fff";
  ctx.font = f(700, 20);
  ctx.fillText("8.4", cardX + 10 * k, cardY + 39 * k);
  const numW = ctx.measureText("8.4").width;
  ctx.font = f(500, 10);
  ctx.fillText(" km", cardX + 10 * k + numW, cardY + 39 * k);

  const barsY = cardY + 46 * k;
  const barsH = 22 * k;
  const gap = 2.5 * k;
  const barW = (cardW - 20 * k - gap * (BARS.length - 1)) / BARS.length;
  BARS.forEach((hPct, i) => {
    const bh = (barsH * hPct) / 100;
    ctx.fillStyle = i === 9 ? "#fff" : `rgba(${SCREEN_INK},.42)`;
    roundRect(ctx, cardX + 10 * k + i * (barW + gap), barsY + (barsH - bh), barW, bh, 1.5 * k);
    ctx.fill();
  });

  // route rows
  let rowY = cardY + cardH + 9 * k;
  const rowH = 27 * k;
  for (const r of ROWS) {
    ctx.fillStyle = "#171a1f";
    roundRect(ctx, cardX, rowY, cardW, rowH, 7 * k);
    ctx.fill();
    ctx.fillStyle = r.tint;
    roundRect(ctx, cardX + 8 * k, rowY + 6 * k, 15 * k, 15 * k, 5 * k);
    ctx.fill();
    ctx.fillStyle = "#dfe6ee";
    ctx.font = f(500, 8.5);
    ctx.fillText(r.name, cardX + 30 * k, rowY + 17 * k);
    ctx.fillStyle = "#6f7883";
    ctx.font = f(400, 8);
    const vw = ctx.measureText(r.val).width;
    ctx.fillText(r.val, cardX + cardW - 8 * k - vw, rowY + 17 * k);
    rowY += rowH + 5 * k;
  }

  return c;
}
