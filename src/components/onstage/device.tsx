"use client";

import { s } from "@/lib/onstage/css";
import { FRAME_COLORS, SCREEN_INK } from "@/lib/onstage/data";

const BARS = [38, 52, 44, 70, 58, 82, 64, 48, 76, 100, 66, 54, 72, 46];
const ROWS = [
  { name: "Ridge Loop", val: "5.2 km", tint: "#2f8f86" },
  { name: "Harbour Flat", val: "3.1 km", tint: "#3f6fa8" },
  { name: "Night Sprint", val: "1.8 km", tint: "#a8563f" },
];

const frameCss = (id: string) =>
  (FRAME_COLORS.find((c) => c.id === id) || FRAME_COLORS[0]).css;

/* The canvas bevel gets the design's three-stop graphite; the other finishes
   reuse their picker swatch. */
const CANVAS_FRAME: Record<string, string> = {
  graphite: "linear-gradient(150deg,#3a3833,#141312 45%,#2b2a26)",
};
const canvasFrameCss = (id: string) => CANVAS_FRAME[id] ?? frameCss(id);

/**
 * The Trailhead screen that sits inside the canvas device — the sample app the
 * design uses everywhere a real screenshot would go.
 */
export function PhoneScreenUI() {
  return (
    <div
      style={s(
        "position:absolute;inset:5px;border-radius:26px;overflow:hidden;background:#0f1114;display:flex;flex-direction:column",
      )}
    >
      <div
        style={s(
          "height:22px;flex:none;display:flex;align-items:flex-end;justify-content:space-between;padding:0 12px 2px;font:500 8px 'Inter',sans-serif;color:#cfd6dd",
        )}
      >
        <span>9:41</span>
        <span style={s("display:flex;gap:3px;align-items:center")}>
          <span style={s("width:11px;height:5px;border:1px solid #cfd6dd;border-radius:1.5px")} />
        </span>
      </div>
      <div style={s("padding:8px 12px 0")}>
        <div style={s("font:700 13px 'Inter',sans-serif;letter-spacing:-.02em;color:#eaf0f6")}>
          Today
        </div>
        <div style={s("margin-top:2px;font:400 8px 'Inter',sans-serif;color:#7d8794")}>
          Tuesday, 4 March
        </div>
      </div>
      <div
        style={s(
          "margin:9px 12px 0;padding:10px;border-radius:9px;background:linear-gradient(155deg,#1b6f6a,#134f63)",
        )}
      >
        <div
          style={s(
            `font:400 7.5px 'Inter',sans-serif;letter-spacing:.09em;color:rgba(${SCREEN_INK},.72)`,
          )}
        >
          DISTANCE
        </div>
        <div
          style={s("margin-top:3px;font:700 20px 'Inter',sans-serif;letter-spacing:-.03em;color:#fff")}
        >
          8.4<span style={s("font-size:10px;font-weight:500")}> km</span>
        </div>
        <div style={s("margin-top:7px;display:flex;align-items:flex-end;gap:2.5px;height:22px")}>
          {BARS.map((h, i) => (
            <span
              key={i}
              style={s(
                `flex:1;border-radius:1.5px;background:${i === 9 ? "#fff" : `rgba(${SCREEN_INK},.42)`};height:${h}%`,
              )}
            />
          ))}
        </div>
      </div>
      <div style={s("margin:9px 12px 0;display:flex;flex-direction:column;gap:5px")}>
        {ROWS.map((r) => (
          <div
            key={r.name}
            style={s(
              "display:flex;align-items:center;gap:7px;padding:6px 8px;border-radius:7px;background:#171a1f",
            )}
          >
            <span style={s(`width:15px;height:15px;border-radius:5px;background:${r.tint}`)} />
            <span style={s("flex:1;font:500 8.5px 'Inter',sans-serif;color:#dfe6ee")}>{r.name}</span>
            <span style={s("font:400 8px 'Inter',sans-serif;color:#6f7883")}>{r.val}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** The full device: bevel, screen, notch. */
export function CanvasDevice({
  style,
  notchStyle,
  frameColor = "graphite",
  screenshot,
}: {
  style: string;
  notchStyle: string;
  frameColor?: string;
  /** A dropped screenshot replaces the sample screen. */
  screenshot?: string | null;
}) {
  return (
    <div style={s(style)}>
      <div
        style={s(
          `position:absolute;inset:0;border-radius:30px;background:${canvasFrameCss(frameColor)};box-shadow:0 26px 60px -18px rgba(0,0,0,.75)`,
        )}
      />
      {screenshot ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={screenshot}
          alt=""
          style={s(
            "position:absolute;inset:5px;border-radius:26px;width:calc(100% - 10px);height:calc(100% - 10px);object-fit:cover;background:#0f1114",
          )}
        />
      ) : (
        <PhoneScreenUI />
      )}
      <div style={s(notchStyle)} />
    </div>
  );
}
