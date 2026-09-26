"use client";

import Link from "next/link";
import { useState } from "react";
import { s } from "@/lib/onstage/css";
import { bgCss, capInk } from "@/lib/onstage/data";
import { useSetPreview } from "@/lib/onstage/useSetPreview";
import { BackButton } from "../chrome";

const CHECKS = [
  {
    label: "Caption legible at thumbnail size",
    detail: "Smallest headline renders at 19px in search results.",
    ok: true,
  },
  { label: "Contrast on every frame", detail: "Lowest pair is 5.8:1 on frame 03.", ok: true },
  {
    label: "First two frames carry the pitch",
    detail: "Frames 01 and 02 name the benefit without the rest of the set.",
    ok: true,
  },
  {
    label: "Frame 01 tilt is flat",
    detail: "Every other frame leans right. Reviewers read it as an error.",
    ok: false,
  },
  {
    label: "Feature graphic has no text",
    detail: "Play crops it on tablets — keep the app name inside the middle 80%.",
    ok: false,
  },
];

const tab = (on: boolean) =>
  `padding:5px 11px;border:none;border-radius:4px;background:${
    on ? "rgba(var(--ink-rgb),.09)" : "transparent"
  };color:${on ? "var(--text)" : "var(--muted-2)"};font-size:12px;font-weight:${
    on ? 600 : 400
  };cursor:pointer`;

/** The listing as each store actually renders it, plus what would get flagged. */
export function StorePageScreen() {
  // Previews the set without editing it: the store toggle is this page's own
  // view, starting from the set's target (plan D10 — only the editor and
  // guided screens change a set).
  const { frames, store } = useSetPreview();
  const [view, setView] = useState<"apple" | "play" | null>(null);
  const play = (view ?? store) === "play";

  return (
    <div style={s("min-height:var(--screen-h,100vh);background:var(--bg);color:var(--text)")}>
      <div
        style={s(
          "display:flex;align-items:center;gap:14px;padding:13px 28px;border-bottom:1px solid rgba(var(--ink-rgb),.07);background:var(--chrome)",
        )}
      >
        <BackButton href="/project" />
        <span style={s("font-size:14.5px;font-weight:500;letter-spacing:-.015em")}>
          Store listing preview
        </span>
        <div
          style={s(
            "display:flex;gap:2px;margin-left:10px;padding:2px;border:1px solid rgba(var(--ink-rgb),.09);border-radius:8px",
          )}
        >
          <button type="button" onClick={() => setView("apple")} style={s(tab(!play))}>
            App Store
          </button>
          <button type="button" onClick={() => setView("play")} style={s(tab(play))}>
            Play Store
          </button>
        </div>
        <Link
          href="/editor"
          className="hov-accent"
          style={s(
            "margin-left:auto;display:inline-flex;align-items:center;height:32px;padding:0 13px;border:1px solid var(--accent);border-radius:8px;background:transparent;color:var(--accent);font-size:12.5px;font-weight:500",
          )}
        >
          Open in canvas
        </Link>
      </div>

      <div
        style={s(
          "max-width:1240px;margin:0 auto;padding:26px 28px 60px;display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:26px;align-items:start",
        )}
      >
        <div
          style={s(
            "border:1px solid rgba(var(--ink-rgb),.09);border-radius:14px;overflow:hidden;background:var(--paper);color:var(--paper-ink)",
          )}
        >
          {play && (
            <div
              style={s(
                "height:172px;background:linear-gradient(150deg,#1b6f6a,#134f63);display:flex;align-items:center;justify-content:space-between;padding:0 30px",
              )}
            >
              <div>
                <div style={s("font-size:24px;font-weight:600;letter-spacing:-.025em;color:#fff")}>
                  Trailhead
                </div>
                <div style={s("margin-top:5px;font-size:13.5px;color:rgba(255,255,255,.78)")}>
                  Every run, mapped
                </div>
              </div>
              <span
                style={s(
                  "padding:3px 9px;border-radius:6px;background:rgba(0,0,0,.28);color:#fff;font-size:10.5px;letter-spacing:.07em",
                )}
              >
                FEATURE GRAPHIC · 1024×500
              </span>
            </div>
          )}

          <div style={s("padding:24px 30px 28px")}>
            <div style={s("display:flex;align-items:center;gap:16px")}>
              <span
                style={s(
                  "display:grid;place-items:center;width:74px;height:74px;border-radius:17px;background:#1b6f6a;color:#fff;font-size:29px;font-weight:600",
                )}
              >
                T
              </span>
              <div style={s("flex:1;min-width:0")}>
                <div style={s("font-size:21px;font-weight:600;letter-spacing:-.025em")}>Trailhead</div>
                <div style={s("margin-top:3px;font-size:13.5px;color:var(--paper-muted)")}>
                  Run &amp; Trail Log
                </div>
                <div
                  style={s(
                    "display:flex;align-items:center;gap:14px;margin-top:9px;font-size:12px;color:var(--paper-muted)",
                  )}
                >
                  <span>4.8 ★ · 1.2K ratings</span>
                  <span>{play ? "Rated for 3+" : "Age 4+"}</span>
                  <span>Health &amp; Fitness</span>
                </div>
              </div>
              <button
                type="button"
                style={s(
                  play
                    ? "flex:none;height:34px;padding:0 20px;border:none;border-radius:8px;background:#1b6f6a;color:#fff;font-size:13px;font-weight:600;cursor:pointer"
                    : "flex:none;height:30px;padding:0 20px;border:none;border-radius:999px;background:#1b6f6a;color:#fff;font-size:12.5px;font-weight:700;cursor:pointer",
                )}
              >
                {play ? "Install" : "GET"}
              </button>
            </div>

            <div style={s("position:relative;margin-top:26px")}>
              <div style={s("display:flex;gap:12px;overflow:hidden")}>
                {frames.map((fr, i) => (
                  <div
                    key={i}
                    style={s(
                      `flex:none;width:${play ? 128 : 138}px;height:${
                        play ? 258 : 278
                      }px;border-radius:10px;overflow:hidden;background:${bgCss(
                        fr.bg,
                      )};display:flex;flex-direction:column;align-items:center;box-shadow:0 6px 18px rgba(0,0,0,.14)`,
                    )}
                  >
                    <div
                      style={s(
                        `padding:14px 11px 0;text-align:center;font:500 ${
                          play ? 11 : 12
                        }px/1.2 'Inter',sans-serif;letter-spacing:-.02em;color:${capInk(fr.bg)}`,
                      )}
                    >
                      {fr.caption}
                    </div>
                    <div
                      style={s(
                        `margin-top:10px;width:76px;height:154px;border-radius:11px;background:linear-gradient(150deg,#3a3833,#141312);box-shadow:0 10px 20px rgba(0,0,0,.36);transform:perspective(460px) rotateY(${
                          fr.tiltY * 0.7
                        }deg) rotateX(${fr.tiltX * 0.7}deg)`,
                      )}
                    />
                  </div>
                ))}
              </div>
              <div
                style={s(
                  `position:absolute;top:-6px;bottom:-6px;left:${
                    play ? 268 : 288
                  }px;width:1.5px;border-left:1.5px dashed rgba(var(--paper-line-rgb),.42)`,
                )}
              >
                <span
                  style={s(
                    "position:absolute;bottom:-9px;left:8px;padding:2px 7px;border-radius:5px;background:var(--paper-ink);color:var(--paper);font-size:9.5px;letter-spacing:.07em;white-space:nowrap",
                  )}
                >
                  {play ? "PLAY SHOWS 2" : "SEARCH SHOWS 2"}
                </span>
              </div>
            </div>

            <div style={s("margin-top:26px;max-width:64ch")}>
              <div style={s("font-size:15px;font-weight:600;letter-spacing:-.015em")}>
                About this app
              </div>
              <p
                style={s(
                  "margin:8px 0 0;font-size:13.5px;line-height:1.65;color:var(--paper-muted)",
                )}
              >
                Trailhead logs every run and puts it on one map. Pace, elevation and splits for each
                route, shareable in a tap, offline when you leave signal behind.
              </p>
            </div>
          </div>
        </div>

        <div style={s("display:flex;flex-direction:column;gap:14px")}>
          <div
            style={s(
              "padding:16px;border:1px solid rgba(var(--ink-rgb),.09);border-radius:14px;background:var(--surface)",
            )}
          >
            <div style={s("display:flex;align-items:baseline;justify-content:space-between")}>
              <span style={s("font-size:13.5px;font-weight:500")}>Listing checks</span>
              <span style={s("font-size:11px;letter-spacing:.09em;color:var(--muted-4)")}>
                3 PASS · 2 FLAGS
              </span>
            </div>
            <div style={s("margin-top:12px;display:flex;flex-direction:column;gap:11px")}>
              {CHECKS.map((c) => (
                <div key={c.label} style={s("display:flex;gap:10px")}>
                  <span
                    style={s(
                      `flex:none;margin-top:5px;width:7px;height:7px;border-radius:50%;background:${
                        c.ok ? "var(--ok)" : "var(--warn)"
                      }`,
                    )}
                  />
                  <div style={s("min-width:0")}>
                    <div style={s("font-size:12.5px;font-weight:500")}>{c.label}</div>
                    <div
                      style={s("margin-top:2px;font-size:11.5px;line-height:1.5;color:var(--muted-2)")}
                    >
                      {c.detail}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div
            style={s(
              "padding:16px;border:1px solid rgba(var(--ink-rgb),.09);border-radius:14px;background:var(--surface)",
            )}
          >
            <div style={s("font-size:13.5px;font-weight:500")}>Search result crop</div>
            <div style={s("margin-top:6px;font-size:12px;line-height:1.55;color:var(--muted-2)")}>
              {play
                ? "Play shows two frames in the listing card and three on the store page."
                : "Search results show two frames. Anything past frame 03 needs a tap."}
            </div>
            <div style={s("display:flex;gap:6px;margin-top:12px")}>
              {frames.map((fr, i) => (
                <div
                  key={i}
                  style={s(
                    `flex:1;height:44px;border-radius:5px;background:${bgCss(fr.bg)};opacity:${
                      i < 2 ? 1 : 0.32
                    };border:1px solid rgba(var(--ink-rgb),.08)`,
                  )}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
