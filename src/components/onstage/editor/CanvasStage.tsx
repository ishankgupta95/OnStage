"use client";

import { useOnstage } from "@/store/onstage";
import { s } from "@/lib/onstage/css";
import { bgCss, capInk } from "@/lib/onstage/data";
import { CanvasDevice } from "../device";

/** The frames themselves — the artboards the whole editor is about. */
export function CanvasStage() {
  const { frames, active, panorama, zoom, shadow, align, captionSize, captionFont, frameColor, sel } =
    useOnstage();
  const select = useOnstage((st) => st.select);
  const scale = zoom / 100;

  return (
    <div
      style={s(
        "position:absolute;inset:0;display:flex;align-items:center;justify-content:flex-start;overflow:auto;padding:0 0 132px",
      )}
    >
      <div
        style={s(
          `display:flex;align-items:center;flex:none;margin:auto;gap:${panorama ? 4 : Math.round(26 * scale)}px;padding:0 40px`,
        )}
      >
        {frames.map((fr, i) => {
          const on = i === active;
          const bgId = panorama ? frames[0].bg : fr.bg;
          const bg = bgCss(bgId);
          return (
            <div
              key={i}
              onClick={() => select(i, sel ?? "device")}
              style={s(
                `position:relative;flex:none;width:${Math.round(268 * scale)}px;height:${Math.round(
                  580 * scale,
                )}px;cursor:pointer;transition:transform .18s ease;transform:translateY(${on ? -6 : 0}px)`,
              )}
            >
              <div
                style={s(
                  `position:absolute;inset:0;border-radius:${Math.round(
                    14 * scale,
                  )}px;overflow:hidden;display:flex;flex-direction:column;background-image:${bg};background-size:${
                    panorama ? `${frames.length * 100}% 100%` : "100% 100%"
                  };background-position:${
                    panorama ? `${(i / Math.max(1, frames.length - 1)) * 100}% 50%` : "50% 50%"
                  }`,
                )}
              >
                <div
                  style={s(
                    `flex:none;padding:${Math.round(30 * scale)}px ${Math.round(
                      24 * scale,
                    )}px 0;text-align:${align};font:700 ${Math.round(
                      captionSize * scale * 0.62,
                    )}px/1.14 '${captionFont}',sans-serif;letter-spacing:-.025em;color:${capInk(
                      bgId,
                    )};text-wrap:pretty`,
                  )}
                >
                  {fr.caption}
                </div>
                <div
                  style={s(
                    "flex:1;display:grid;place-items:center;perspective:1400px;overflow:hidden",
                  )}
                >
                  <CanvasDevice
                    frameColor={frameColor}
                    screenshot={fr.screenshot}
                    style={`position:relative;width:${Math.round(176 * scale)}px;height:${Math.round(
                      374 * scale,
                    )}px;transform-style:preserve-3d;transform:rotateX(${fr.tiltX}deg) rotateY(${
                      fr.tiltY
                    }deg) translateZ(${fr.depth * 0.35}px) scale(${
                      fr.scale
                    });transition:transform .12s linear;filter:${
                      shadow ? "drop-shadow(0 26px 26px rgba(0,0,0,.42))" : "none"
                    }`}
                    notchStyle={`position:absolute;top:${Math.round(
                      11 * scale,
                    )}px;left:50%;transform:translateX(-50%);width:${Math.round(
                      46 * scale,
                    )}px;height:${Math.round(12 * scale)}px;border-radius:9px;background:#0a0a0b`}
                  />
                </div>
              </div>
              <div
                style={s(
                  on
                    ? `position:absolute;inset:-3px;border-radius:${Math.round(
                        16 * scale,
                      )}px;border:1.5px solid var(--accent);pointer-events:none`
                    : "display:none",
                )}
              />
              <div
                style={s(
                  on
                    ? "position:absolute;top:-9px;left:8px;padding:2px 6px;border-radius:3px;background:var(--accent);color:var(--on-accent);font:500 9px 'Inter',ui-sans-serif;letter-spacing:.08em"
                    : "position:absolute;bottom:8px;left:8px;padding:2px 5px;border-radius:3px;background:rgba(0,0,0,.34);color:rgba(var(--ink-rgb),.72);font:400 9px 'Inter',ui-sans-serif",
                )}
              >
                {on ? "SELECTED" : String(i + 1).padStart(2, "0")}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
