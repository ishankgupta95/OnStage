"use client";

import { beginHistoryGesture, endHistoryGesture, historyGestureLive, useOnstage } from "@/store/onstage";
import { s } from "@/lib/onstage/css";
import { BGS, DEVICES, TILT_PRESETS, bgCss } from "@/lib/onstage/data";
import {
  IcoAlign,
  IcoChevron,
  IcoCube,
  IcoCursor,
  IcoGrow,
  IcoPanorama,
  IcoPhoneWide,
  IcoShadow,
  IcoShrink,
  IcoSparkle,
} from "../icons";

/** The floating bar under the stage — it changes with what is selected. */
export function ContextBar() {
  const st = useOnstage();
  const f = st.frames[st.active] ?? st.frames[0];
  const set = st.setState;

  const deviceLabel = (DEVICES.find((d) => d.id === st.device) || DEVICES[0]).label;
  const tiltReadout = `${f.tiltY > 0 ? "+" : ""}${f.tiltY}° / ${f.tiltX > 0 ? "+" : ""}${f.tiltX}°`;

  return (
    <div
      style={s(
        "position:absolute;left:50%;bottom:158px;transform:translateX(-50%);z-index:40;display:flex;align-items:center;gap:6px;padding:5px;border-radius:8px;background:var(--pop);border:1px solid rgba(var(--ink-rgb),.1);box-shadow:0 16px 44px rgba(0,0,0,.55);backdrop-filter:blur(16px)",
      )}
    >
      {st.sel === "device" && (
        <div style={s("display:flex;align-items:center;gap:5px")}>
          <button
            type="button"
            onClick={() => set({ pop: st.pop === "device" ? null : "device" })}
            style={s(
              "display:inline-flex;align-items:center;gap:7px;height:30px;padding:0 9px;border:none;border-radius:5px;background:rgba(var(--ink-rgb),.06);color:var(--text);font-size:12.5px;font-weight:500;cursor:pointer",
            )}
          >
            <IcoPhoneWide size={13} />
            {deviceLabel}
            <IcoChevron size={11} />
          </button>
          <div style={s("width:1px;height:20px;background:rgba(var(--ink-rgb),.1)")} />
          <button
            type="button"
            onClick={() => set({ sel: "device", pop: st.pop === "persp" ? null : "persp" })}
            style={s(
              `display:inline-flex;align-items:center;gap:7px;height:30px;padding:0 9px 0 5px;border:1px solid ${
                st.pop === "persp" ? "rgba(var(--accent-rgb),.45)" : "transparent"
              };border-radius:5px;background:${
                st.pop === "persp" ? "rgba(var(--accent-rgb),.1)" : "rgba(var(--ink-rgb),.06)"
              };color:var(--text);font-size:12.5px;font-weight:500;cursor:pointer`,
            )}
          >
            <span
              style={s(
                "display:grid;place-items:center;width:22px;height:18px;border-radius:3px;background:rgba(var(--accent-rgb),.16);color:var(--accent)",
              )}
            >
              <IcoCube size={13} />
            </span>
            Perspective
            <span
              style={s(
                "font:400 10.5px 'Inter',ui-sans-serif;color:var(--accent-hi2);padding:1px 5px;border-radius:3px;background:rgba(var(--accent-rgb),.12)",
              )}
            >
              {tiltReadout}
            </span>
          </button>
          <div style={s("width:1px;height:20px;background:rgba(var(--ink-rgb),.1)")} />
          <button
            type="button"
            title="Contact shadow"
            onClick={() => set({ shadow: !st.shadow })}
            style={s(
              `display:grid;place-items:center;width:30px;height:30px;border:none;border-radius:5px;background:${
                st.shadow ? "rgba(var(--accent-rgb),.13)" : "transparent"
              };color:${st.shadow ? "var(--accent)" : "var(--muted)"};cursor:pointer`,
            )}
          >
            <IcoShadow size={14} />
          </button>
          <button
            type="button"
            title="Smaller"
            onClick={() => st.nudgeScale(-0.06)}
            style={s(
              "display:grid;place-items:center;width:30px;height:30px;border:none;border-radius:5px;background:transparent;color:var(--muted);cursor:pointer",
            )}
          >
            <IcoShrink size={14} />
          </button>
          <button
            type="button"
            title="Larger"
            onClick={() => st.nudgeScale(0.06)}
            style={s(
              "display:grid;place-items:center;width:30px;height:30px;border:none;border-radius:5px;background:transparent;color:var(--muted);cursor:pointer",
            )}
          >
            <IcoGrow size={14} />
          </button>
        </div>
      )}

      {st.sel === "caption" && (
        <div style={s("display:flex;align-items:center;gap:5px")}>
          <button
            type="button"
            onClick={() => set({ pop: st.pop === "font" ? null : "font" })}
            style={s(
              "display:inline-flex;align-items:center;gap:7px;height:30px;padding:0 9px;border:none;border-radius:5px;background:rgba(var(--ink-rgb),.06);color:var(--text);font-size:12.5px;font-weight:500;cursor:pointer",
            )}
          >
            {st.captionFont}
            <IcoChevron size={11} />
          </button>
          <div
            style={s(
              "display:flex;align-items:center;gap:1px;padding:2px;border-radius:5px;background:rgba(var(--ink-rgb),.05)",
            )}
          >
            {(["left", "center", "right"] as const).map((a) => (
              <button
                key={a}
                type="button"
                aria-label={`Align ${a}`}
                onClick={() => set({ align: a })}
                style={s(
                  `display:grid;place-items:center;width:26px;height:24px;border:none;border-radius:4px;background:${
                    st.align === a ? "rgba(var(--ink-rgb),.1)" : "transparent"
                  };color:${st.align === a ? "var(--text)" : "var(--muted-2)"};cursor:pointer`,
                )}
              >
                <IcoAlign dir={a} />
              </button>
            ))}
          </div>
          <div style={s("width:1px;height:20px;background:rgba(var(--ink-rgb),.1)")} />
          <button
            type="button"
            onClick={() => set({ overlay: "ai" })}
            style={s(
              "display:inline-flex;align-items:center;gap:7px;height:30px;padding:0 10px;border:1px solid rgba(var(--accent-rgb),.35);border-radius:5px;background:rgba(var(--accent-rgb),.1);color:var(--accent-hi);font-size:12.5px;font-weight:600;cursor:pointer",
            )}
          >
            <IcoSparkle size={13} />
            Rewrite with AI
          </button>
        </div>
      )}

      {st.sel === "bg" && (
        <div style={s("display:flex;align-items:center;gap:7px")}>
          <span
            style={s(
              "font:400 10.5px 'Inter',ui-sans-serif;letter-spacing:.06em;color:var(--muted-2);padding-left:3px",
            )}
          >
            BACKGROUND
          </span>
          <div style={s("display:flex;gap:4px")}>
            {BGS.slice(0, 6).map((b) => (
              <button
                key={b.id}
                type="button"
                title={b.label}
                aria-label={b.label}
                onClick={() => st.patchFrame({ bg: b.id })}
                style={s(
                  `width:26px;height:26px;border-radius:5px;border:1.5px solid ${
                    f.bg === b.id ? "var(--accent)" : "rgba(var(--ink-rgb),.14)"
                  };background:${b.css};cursor:pointer`,
                )}
              />
            ))}
          </div>
          <div style={s("width:1px;height:20px;background:rgba(var(--ink-rgb),.1)")} />
          <button
            type="button"
            onClick={() => set({ panorama: !st.panorama })}
            style={s(
              `display:inline-flex;align-items:center;gap:7px;height:30px;padding:0 10px;border:1px solid ${
                st.panorama ? "rgba(var(--accent-rgb),.45)" : "rgba(var(--ink-rgb),.11)"
              };border-radius:5px;background:${
                st.panorama ? "rgba(var(--accent-rgb),.12)" : "transparent"
              };color:${st.panorama ? "var(--accent-hi)" : "var(--muted)"};font-size:12.5px;font-weight:500;cursor:pointer`,
            )}
          >
            <IcoPanorama size={13} />
            Panoramic
          </button>
        </div>
      )}

      {!st.sel && (
        <div
          style={s(
            "display:flex;align-items:center;gap:9px;padding:0 4px;font-size:12.5px;color:var(--muted-2)",
          )}
        >
          <IcoCursor size={14} />
          Click the phone, the headline, or the background to edit it
        </div>
      )}
    </div>
  );
}

/** Frame picker popover. */
export function DevicePopover() {
  const { device, setState } = useOnstage();
  return (
    <div
      style={s(
        "position:absolute;left:50%;bottom:206px;transform:translateX(-50%);z-index:45;width:300px;padding:10px;border-radius:10px;background:var(--pop);border:1px solid rgba(var(--ink-rgb),.11);box-shadow:0 26px 70px rgba(0,0,0,.62)",
      )}
    >
      <div
        style={s(
          "font:400 10px 'Inter',ui-sans-serif;letter-spacing:.08em;color:var(--muted-2);padding:2px 4px 8px",
        )}
      >
        FRAME
      </div>
      <div style={s("display:flex;flex-direction:column;gap:2px")}>
        {DEVICES.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => setState({ device: d.id, pop: null })}
            style={s(
              `display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 9px;border:none;border-radius:5px;background:${
                device === d.id ? "rgba(var(--accent-rgb),.13)" : "transparent"
              };color:${device === d.id ? "var(--accent-hi)" : "var(--text)"};font-size:12.5px;text-align:left;cursor:pointer`,
            )}
          >
            <span>{d.label}</span>
            <span style={s("font:400 10px 'Inter',ui-sans-serif;color:var(--muted-3)")}>{d.px}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** Perspective popover — the control that replaces a 2D/3D switch. */
export function PerspectivePopover() {
  const st = useOnstage();
  const f = st.frames[st.active] ?? st.frames[0];

  // Each drag is one undo step: history pauses at pointerdown and records
  // the whole drag at pointerup (or when the pointer is cancelled).
  const padDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const gesture = beginHistoryGesture();
    const move = (ev: PointerEvent | React.PointerEvent) => {
      // The set changed mid-drag: the rest of the drag changes nothing.
      if (!historyGestureLive(gesture)) return;
      const nx = Math.max(-1, Math.min(1, ((ev.clientX - box.left) / box.width - 0.5) * 2));
      const ny = Math.max(-1, Math.min(1, ((ev.clientY - box.top) / box.height - 0.5) * 2));
      st.patchFrame({ tiltY: Math.round(nx * -34), tiltX: Math.round(ny * -22) });
    };
    const up = () => {
      window.removeEventListener("pointermove", move as EventListener);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      endHistoryGesture(gesture);
    };
    window.addEventListener("pointermove", move as EventListener);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    move(e);
  };

  const depthDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const gesture = beginHistoryGesture();
    const move = (ev: PointerEvent | React.PointerEvent) => {
      // The set changed mid-drag: the rest of the drag changes nothing.
      if (!historyGestureLive(gesture)) return;
      const t = Math.max(0, Math.min(1, (ev.clientX - box.left) / box.width));
      st.patchFrame({ depth: Math.round(t * 100) });
    };
    const up = () => {
      window.removeEventListener("pointermove", move as EventListener);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      endHistoryGesture(gesture);
    };
    window.addEventListener("pointermove", move as EventListener);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    move(e);
  };

  return (
    <div
      style={s(
        "position:absolute;left:50%;bottom:206px;transform:translateX(-50%);z-index:45;width:326px;padding:14px;border-radius:10px;background:var(--pop);border:1px solid rgba(var(--ink-rgb),.11);box-shadow:0 26px 70px rgba(0,0,0,.62);backdrop-filter:blur(18px)",
      )}
    >
      <div
        style={s("display:flex;align-items:center;justify-content:space-between;margin-bottom:11px")}
      >
        <span style={s("font-size:13px;font-weight:700;letter-spacing:-.01em")}>Perspective</span>
        <button
          type="button"
          onClick={st.resetTilt}
          style={s(
            "border:none;background:transparent;color:var(--muted);font-size:11.5px;cursor:pointer;padding:2px 4px",
          )}
        >
          Reset
        </button>
      </div>
      <div
        onPointerDown={padDown}
        style={s(
          "position:relative;height:112px;border-radius:8px;background:var(--surface-2);border:1px solid rgba(var(--ink-rgb),.09);cursor:grab;overflow:hidden;touch-action:none",
        )}
      >
        <div
          style={s(
            "position:absolute;inset:0;background-image:linear-gradient(rgba(var(--ink-rgb),.055) 1px,transparent 1px),linear-gradient(90deg,rgba(var(--ink-rgb),.055) 1px,transparent 1px);background-size:22.4px 22.4px",
          )}
        />
        <div style={s("position:absolute;left:50%;top:0;bottom:0;width:1px;background:rgba(var(--ink-rgb),.14)")} />
        <div style={s("position:absolute;top:50%;left:0;right:0;height:1px;background:rgba(var(--ink-rgb),.14)")} />
        <div style={s("position:absolute;inset:0;display:grid;place-items:center;perspective:520px")}>
          <div
            style={s(
              `width:52px;height:104px;border-radius:9px;background:linear-gradient(150deg,#4a4842,#171614);box-shadow:0 12px 22px rgba(0,0,0,.5),inset 0 0 0 1px rgba(var(--ink-rgb),.09);transform:rotateX(${f.tiltX}deg) rotateY(${f.tiltY}deg);transition:transform .1s linear`,
            )}
          />
        </div>
        <div
          style={s(
            `position:absolute;left:${50 + (f.tiltY / -34) * 50}%;top:${
              50 + (f.tiltX / -22) * 50
            }%;transform:translate(-50%,-50%);width:13px;height:13px;border-radius:50%;background:var(--accent);box-shadow:0 0 0 4px rgba(var(--accent-rgb),.22);pointer-events:none`,
          )}
        />
        <span
          style={s(
            "position:absolute;left:8px;bottom:6px;font:400 9.5px 'Inter',ui-sans-serif;color:var(--muted-4)",
          )}
        >
          drag to tilt
        </span>
      </div>
      <div style={s("display:flex;gap:14px;margin-top:11px")}>
        <div style={s("flex:1")}>
          <div
            style={s(
              "display:flex;justify-content:space-between;font:400 10px 'Inter',ui-sans-serif;color:var(--muted-2);margin-bottom:5px",
            )}
          >
            <span>DEPTH</span>
            <span style={s("color:var(--text)")}>{f.depth}%</span>
          </div>
          <div
            onPointerDown={depthDown}
            style={s(
              "position:relative;height:22px;display:flex;align-items:center;cursor:pointer;touch-action:none",
            )}
          >
            <div style={s("height:3px;width:100%;border-radius:3px;background:rgba(var(--ink-rgb),.11)")} />
            <div
              style={s(
                `position:absolute;left:0;height:3px;border-radius:3px;background:var(--accent);width:${f.depth}%`,
              )}
            />
            <div
              style={s(
                `position:absolute;left:${f.depth}%;transform:translateX(-50%);width:12px;height:12px;border-radius:50%;background:var(--text);box-shadow:0 1px 5px rgba(0,0,0,.5)`,
              )}
            />
          </div>
        </div>
      </div>
      <div style={s("height:1px;margin:11px 0;background:rgba(var(--ink-rgb),.08)")} />
      <div style={s("display:grid;grid-template-columns:repeat(4,1fr);gap:6px")}>
        {TILT_PRESETS.map((p) => {
          const on = p.x === f.tiltX && p.y === f.tiltY;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => st.patchFrame({ tiltX: p.x, tiltY: p.y, depth: p.d })}
              style={s(
                `display:flex;flex-direction:column;align-items:center;gap:4px;padding:6px 2px 5px;border:1px solid ${
                  on ? "var(--accent)" : "rgba(var(--ink-rgb),.1)"
                };border-radius:6px;background:${
                  on ? "rgba(var(--accent-rgb),.1)" : "transparent"
                };color:${on ? "var(--accent-hi)" : "var(--muted)"};cursor:pointer`,
              )}
            >
              <span style={s("display:grid;place-items:center;height:34px;perspective:260px")}>
                <span
                  style={s(
                    `display:block;width:17px;height:32px;border-radius:4px;background:linear-gradient(150deg,#514f48,#1a1917);box-shadow:0 5px 10px rgba(0,0,0,.45);transform:rotateX(${p.x}deg) rotateY(${p.y}deg)`,
                  )}
                />
              </span>
              <span style={s("font-size:10.5px;font-weight:500;letter-spacing:-.01em")}>{p.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Font picker — the caption toolbar's counterpart to the frame popover. */
export function FontPopover() {
  const { captionFont, setState } = useOnstage();
  const fonts = ["Inter", "Fraunces", "Plus Jakarta Sans", "JetBrains Mono"];
  return (
    <div
      style={s(
        "position:absolute;left:50%;bottom:206px;transform:translateX(-50%);z-index:45;width:240px;padding:10px;border-radius:10px;background:var(--pop);border:1px solid rgba(var(--ink-rgb),.11);box-shadow:0 26px 70px rgba(0,0,0,.62)",
      )}
    >
      <div
        style={s(
          "font:400 10px 'Inter',ui-sans-serif;letter-spacing:.08em;color:var(--muted-2);padding:2px 4px 8px",
        )}
      >
        TYPEFACE
      </div>
      <div style={s("display:flex;flex-direction:column;gap:2px")}>
        {fonts.map((fnt) => (
          <button
            key={fnt}
            type="button"
            onClick={() => setState({ captionFont: fnt, pop: null })}
            style={s(
              `padding:8px 9px;border:none;border-radius:5px;background:${
                captionFont === fnt ? "rgba(var(--accent-rgb),.13)" : "transparent"
              };color:${
                captionFont === fnt ? "var(--accent-hi)" : "var(--text)"
              };font-size:12.5px;text-align:left;cursor:pointer`,
            )}
          >
            {fnt}
          </button>
        ))}
      </div>
    </div>
  );
}

export { bgCss };
