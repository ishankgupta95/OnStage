"use client";

import { useOnstage } from "@/store/onstage";
import { s } from "@/lib/onstage/css";
import { BGS, FRAME_COLORS, TILT_PRESETS } from "@/lib/onstage/data";
import { DropZone } from "../DropZone";
import { IcoClose, IcoCursor, IcoUpload } from "../icons";

const LABEL = "font:400 10px 'Inter',ui-sans-serif;letter-spacing:.08em;color:var(--muted-2);margin-bottom:7px";

/** The right-hand panel — whatever is selected, edited by its own controls. */
export function Inspector() {
  const st = useOnstage();
  const f = st.frames[st.active] ?? st.frames[0];

  const tiltName = (() => {
    const m = TILT_PRESETS.find((p) => p.x === f.tiltX && p.y === f.tiltY);
    return m ? `${m.label} tilt` : "Custom tilt";
  })();
  const tiltReadout = `${f.tiltY > 0 ? "+" : ""}${f.tiltY}° / ${f.tiltX > 0 ? "+" : ""}${f.tiltX}°`;

  const sizeDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const move = (ev: PointerEvent | React.PointerEvent) => {
      const t = Math.max(0, Math.min(1, (ev.clientX - box.left) / box.width));
      st.setState({ captionSize: Math.round(24 + t * 48) });
    };
    const up = () => {
      window.removeEventListener("pointermove", move as EventListener);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move as EventListener);
    window.addEventListener("pointerup", up);
    move(e);
  };

  const sizePct = ((st.captionSize - 24) / 48) * 100;

  return (
    <aside
      style={s(
        "width:274px;flex:none;background:var(--chrome);border-left:1px solid rgba(var(--ink-rgb),.08);display:flex;flex-direction:column;overflow-y:auto",
      )}
    >
      <div
        style={s(
          "display:flex;align-items:center;justify-content:space-between;padding:13px 14px 11px;border-bottom:1px solid rgba(var(--ink-rgb),.07)",
        )}
      >
        <div style={s("display:flex;align-items:center;gap:8px")}>
          <span
            style={s(
              "display:grid;place-items:center;width:22px;height:22px;border-radius:5px;background:rgba(var(--accent-rgb),.14);color:var(--accent)",
            )}
          >
            <IcoCursor size={13} w={1.9} />
          </span>
          <span style={s("font-size:13px;font-weight:700;letter-spacing:-.01em")}>
            {st.sel === "device" ? "Phone" : st.sel === "caption" ? "Headline" : "Background"}
          </span>
        </div>
        <button
          type="button"
          aria-label="Clear selection"
          onClick={() => st.setState({ sel: null, pop: null })}
          style={s(
            "display:grid;place-items:center;width:22px;height:22px;border:none;border-radius:4px;background:transparent;color:var(--muted-2);cursor:pointer",
          )}
        >
          <IcoClose size={13} />
        </button>
      </div>

      <div style={s("padding:14px;display:flex;flex-direction:column;gap:16px")}>
        {st.sel === "caption" && (
          <>
            <div>
              <div style={s(LABEL)}>HEADLINE</div>
              <textarea
                value={f.caption}
                onChange={(e) => st.patchFrame({ caption: e.target.value })}
                style={s(
                  "width:100%;min-height:64px;padding:9px;border-radius:6px;border:1px solid rgba(var(--ink-rgb),.11);background:var(--bg);color:var(--text);font:500 13px/1.4 'Inter',sans-serif;resize:vertical",
                )}
              />
              <div
                style={s(
                  "display:flex;justify-content:space-between;margin-top:6px;font:400 10px 'Inter',ui-sans-serif;color:var(--muted-4)",
                )}
              >
                <span>{f.caption.length} chars</span>
                <span>fits 6.9″ · 6.5″</span>
              </div>
            </div>
            <div>
              <div style={s(LABEL)}>SIZE</div>
              <div
                onPointerDown={sizeDown}
                style={s(
                  "position:relative;height:22px;display:flex;align-items:center;cursor:pointer;touch-action:none",
                )}
              >
                <div style={s("height:3px;width:100%;border-radius:3px;background:rgba(var(--ink-rgb),.11)")} />
                <div
                  style={s(
                    `position:absolute;left:0;height:3px;border-radius:3px;background:var(--accent);width:${sizePct}%`,
                  )}
                />
                <div
                  style={s(
                    `position:absolute;left:${sizePct}%;transform:translateX(-50%);width:12px;height:12px;border-radius:50%;background:var(--text);box-shadow:0 1px 5px rgba(0,0,0,.5)`,
                  )}
                />
              </div>
              <div style={s("text-align:right;font:400 10px 'Inter',ui-sans-serif;color:var(--muted)")}>
                {st.captionSize} pt
              </div>
            </div>
          </>
        )}

        {st.sel === "device" && (
          <>
            <div>
              <div style={s(LABEL)}>SCREENSHOT</div>
              <DropZone
                from={st.active}
                base="border:1px dashed rgba(var(--ink-rgb),.16);border-radius:7px;padding:16px 12px;text-align:center;background:var(--bg)"
                hover="border-color:var(--accent);background:rgba(var(--accent-rgb),.06)"
              >
                <div
                  style={s(
                    "display:grid;place-items:center;margin:0 auto 8px;width:30px;height:30px;border-radius:7px;background:rgba(var(--ink-rgb),.05);color:var(--muted)",
                  )}
                >
                  <IcoUpload size={16} />
                </div>
                <div style={s("font-size:12px;font-weight:500")}>
                  {f.screenshot ? "Replace this screen" : "Drop a screen"}
                </div>
                <div style={s("margin-top:3px;font-size:11px;color:var(--muted-2)")}>PNG up to 12 MB</div>
              </DropZone>
            </div>
            <div>
              <div style={s(LABEL)}>PERSPECTIVE</div>
              <button
                type="button"
                onClick={() => st.setState({ sel: "device", pop: st.pop === "persp" ? null : "persp" })}
                style={s(
                  "width:100%;display:flex;align-items:center;justify-content:space-between;padding:9px 10px;border:1px solid rgba(var(--ink-rgb),.11);border-radius:6px;background:var(--bg);color:var(--text);font-size:12.5px;cursor:pointer",
                )}
              >
                <span>{tiltName}</span>
                <span style={s("font:400 10.5px 'Inter',ui-sans-serif;color:var(--accent-hi2)")}>
                  {tiltReadout}
                </span>
              </button>
              <div style={s("margin-top:6px;font-size:11px;line-height:1.5;color:var(--muted-2)")}>
                Tilt lives on the phone itself. Select it on canvas and drag the handle.
              </div>
            </div>
            <div>
              <div style={s(LABEL)}>FRAME COLOUR</div>
              <div style={s("display:flex;gap:6px")}>
                {FRAME_COLORS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    title={c.label}
                    aria-label={c.label}
                    onClick={() => st.setState({ frameColor: c.id })}
                    style={s(
                      `width:30px;height:30px;border-radius:6px;border:1.5px solid ${
                        st.frameColor === c.id ? "var(--accent)" : "rgba(var(--ink-rgb),.14)"
                      };background:${c.css};cursor:pointer`,
                    )}
                  />
                ))}
              </div>
            </div>
          </>
        )}

        {st.sel === "bg" && (
          <>
            <div>
              <div style={s(LABEL)}>FILL</div>
              <div style={s("display:grid;grid-template-columns:repeat(3,1fr);gap:6px")}>
                {BGS.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    title={b.label}
                    aria-label={b.label}
                    onClick={() => st.patchFrame({ bg: b.id })}
                    style={s(
                      `height:44px;border-radius:6px;border:1.5px solid ${
                        f.bg === b.id ? "var(--accent)" : "rgba(var(--ink-rgb),.12)"
                      };background:${b.css};cursor:pointer`,
                    )}
                  />
                ))}
              </div>
            </div>
            <div>
              <div style={s(LABEL)}>APPLY TO</div>
              <div style={s("display:flex;flex-direction:column;gap:5px")}>
                <button
                  type="button"
                  onClick={st.applyBgToAll}
                  style={s(
                    "display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid rgba(var(--ink-rgb),.11);border-radius:6px;background:var(--bg);color:var(--text);font-size:12.5px;text-align:left;cursor:pointer",
                  )}
                >
                  All {st.frames.length} frames
                </button>
                <button
                  type="button"
                  onClick={() => st.setState({ panorama: false })}
                  style={s(
                    "display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid rgba(var(--ink-rgb),.11);border-radius:6px;background:transparent;color:var(--muted);font-size:12.5px;text-align:left;cursor:pointer",
                  )}
                >
                  This frame only
                </button>
              </div>
            </div>
          </>
        )}

        <div style={s("padding-top:2px;border-top:1px solid rgba(var(--ink-rgb),.07)")}>
          <div
            style={s("display:flex;align-items:center;justify-content:space-between;padding-top:12px")}
          >
            <span style={s("font-size:12px;color:var(--muted)")}>Brand kit</span>
            <span style={s("display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:500")}>
              <span style={s("display:flex;gap:2px")}>
                <span style={s("width:9px;height:9px;border-radius:2px;background:#1b6f6a")} />
                <span style={s("width:9px;height:9px;border-radius:2px;background:#134f63")} />
                <span style={s("width:9px;height:9px;border-radius:2px;background:#f0efe9")} />
              </span>
              Trailhead
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}
