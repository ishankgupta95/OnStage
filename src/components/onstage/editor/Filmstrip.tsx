"use client";

import { useState } from "react";
import { useOnstage } from "@/store/onstage";
import { s } from "@/lib/onstage/css";
import { bgCss } from "@/lib/onstage/data";
import { IcoClose, IcoPlus } from "../icons";

const chip = (on: boolean) =>
  `flex:none;padding:5px 9px;border-radius:5px;border:1px solid ${
    on ? "rgba(var(--accent-rgb),.5)" : "rgba(var(--ink-rgb),.11)"
  };background:${on ? "rgba(var(--accent-rgb),.13)" : "transparent"};color:${
    on ? "var(--accent-hi)" : "var(--muted)"
  };font:500 11px 'Inter',sans-serif;cursor:pointer`;

/** Frame strip + the set's language chips, over a scrim so it floats. */
export function Filmstrip() {
  const st = useOnstage();
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  return (
    <div
      style={s(
        "position:absolute;left:0;right:0;bottom:0;z-index:25;padding:10px 14px 12px;background:linear-gradient(to top,var(--scrim-strong),var(--scrim-soft) 70%,transparent)",
      )}
    >
      <div
        style={s(
          "display:flex;align-items:flex-end;gap:9px;overflow-x:auto;padding:2px 2px 6px",
        )}
      >
        {st.frames.map((fr, i) => {
          const on = i === st.active;
          return (
            <div
              key={i}
              draggable
              onDragStart={() => setDragFrom(i)}
              onDragEnd={() => {
                setDragFrom(null);
                setDragOver(null);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                if (dragOver !== i) setDragOver(i);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragFrom !== null) st.moveFrame(dragFrom, i);
                setDragFrom(null);
                setDragOver(null);
              }}
              onClick={() => st.select(i, st.sel ?? "device")}
              style={s(
                `position:relative;flex:none;width:64px;padding:4px;border-radius:7px;border:1px solid ${
                  dragOver === i && dragFrom !== null && dragFrom !== i
                    ? "var(--accent-hi)"
                    : on
                      ? "var(--accent)"
                      : "rgba(var(--ink-rgb),.1)"
                };background:${
                  on
                    ? "rgba(var(--accent-rgb),.08)"
                    : "rgba(var(--ink-rgb),.02)"
                };cursor:grab;opacity:${dragFrom === i ? 0.45 : 1}`,
              )}
              className="hov-reveal"
            >
              {st.frames.length > 1 && (
                <button
                  type="button"
                  aria-label={`Delete frame ${i + 1}`}
                  title="Delete frame"
                  className="reveal"
                  onClick={(e) => {
                    e.stopPropagation();
                    st.removeFrame(i);
                  }}
                  style={s(
                    "position:absolute;top:-6px;right:-6px;z-index:2;display:grid;place-items:center;width:18px;height:18px;border-radius:50%;border:1px solid rgba(var(--ink-rgb),.14);background:var(--pop);color:var(--muted);opacity:0;transition:opacity .14s ease;cursor:pointer;padding:0",
                  )}
                >
                  <IcoClose size={10} />
                </button>
              )}
              <div
                style={s(
                  `position:relative;height:100px;border-radius:4px;overflow:hidden;background:${bgCss(
                    st.panorama ? st.frames[0].bg : fr.bg,
                  )};display:flex;flex-direction:column;align-items:center`,
                )}
              >
                <div
                  style={s(
                    "margin:7px 6px 0;width:calc(100% - 12px);height:3px;border-radius:2px;background:rgba(var(--ink-rgb),.55)",
                  )}
                />
                <div
                  style={s(
                    `margin-top:6px;width:26px;height:56px;border-radius:5px;background:#111214;box-shadow:0 4px 9px rgba(0,0,0,.45);transform:rotateY(${
                      fr.tiltY * 0.6
                    }deg) rotateX(${fr.tiltX * 0.6}deg)`,
                  )}
                />
              </div>
              <div
                style={s(
                  "display:flex;align-items:center;justify-content:space-between;padding:4px 5px 0",
                )}
              >
                <span
                  style={s(
                    "font:400 9.5px 'Inter',ui-sans-serif;color:var(--muted-2)",
                  )}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span
                  style={s(
                    `width:5px;height:5px;border-radius:50%;background:${
                      fr.caption ? "var(--ok)" : "rgba(var(--ink-rgb),.2)"
                    }`,
                  )}
                />
              </div>
            </div>
          );
        })}

        <button
          type="button"
          aria-label="Add frame"
          onClick={st.addFrame}
          style={s(
            "flex:none;width:64px;height:118px;border:1px dashed rgba(var(--ink-rgb),.17);border-radius:7px;background:transparent;color:var(--muted-2);cursor:pointer;display:grid;place-items:center;gap:3px",
          )}
        >
          <IcoPlus size={16} />
        </button>

        <div
          style={s(
            "flex:none;display:flex;flex-direction:column;gap:5px;margin-left:6px;padding-left:14px;border-left:1px solid rgba(var(--ink-rgb),.08)",
          )}
        >
          <span
            style={s(
              "font:400 9.5px 'Inter',ui-sans-serif;letter-spacing:.06em;color:var(--muted-4)",
            )}
          >
            LANGUAGE
          </span>
          <div style={s("display:flex;gap:4px")}>
            {["EN", "DE", "JA", "ES"].map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => st.setState({ lang: l })}
                style={s(chip(st.lang === l))}
              >
                {l}
              </button>
            ))}
            <button
              type="button"
              aria-label="Add a language"
              onClick={() => st.setState({ overlay: "ai", aiTab: "Localize" })}
              style={s(
                "display:grid;place-items:center;width:26px;height:24px;border:1px dashed rgba(var(--ink-rgb),.18);border-radius:5px;background:transparent;color:var(--muted-2);cursor:pointer;font-size:13px;line-height:1",
              )}
            >
              +
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
