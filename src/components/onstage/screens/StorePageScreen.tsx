"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { s } from "@/lib/onstage/css";
import { bgCss, capInk } from "@/lib/onstage/data";
import { setHref } from "@/lib/onstage/setLinks";
import { useSetPreview } from "@/lib/onstage/useSetPreview";
import { useSetApp } from "@/lib/onstage/useSetApp";
import { FALLBACK_APP_NAME, appIdentity } from "@/lib/onstage/appName";
import { BackButton } from "../chrome";
import { NotFoundScreen } from "./NotFoundScreen";

const tab = (on: boolean) =>
  `padding:5px 11px;border:none;border-radius:4px;background:${
    on ? "rgba(var(--ink-rgb),.09)" : "transparent"
  };color:${on ? "var(--text)" : "var(--muted-2)"};font-size:12px;font-weight:${
    on ? 600 : 400
  };cursor:pointer`;

/** The listing as each store actually renders it. */
export function StorePageScreen() {
  // Previews the set without editing it: the store toggle is this page's own
  // view, starting from the set's target (plan D10 — only the editor and
  // guided screens change a set).
  // `?set=` names the set (the project board's "This set" card); without
  // it, the set a bare /editor would open.
  const setId = useSearchParams().get("set") || null;
  const { frames, store, set, missing, appName } = useSetPreview(setId);
  // The set's own app, never the sample's invented listing (S3.4).
  const app = useSetApp(set?.id);
  const id = appIdentity(appName, app);
  const name = id.name;
  const tint = id.tint;
  const first = frames[0];
  const [view, setView] = useState<"apple" | "play" | null>(null);
  const play = (view ?? store) === "play";

  if (missing) {
    return (
      <NotFoundScreen
        kicker="SET NOT FOUND"
        title="This set isn't in this browser"
        body="It was deleted, or it was made in another browser — Onstage keeps each set in the browser that made it."
        settingsLink={false}
      />
    );
  }

  return (
    <div style={s("min-height:var(--screen-h,100vh);background:var(--bg);color:var(--text)")}>
      <div
        style={s(
          "display:flex;align-items:center;gap:14px;padding:13px 28px;border-bottom:1px solid rgba(var(--ink-rgb),.07);background:var(--chrome)",
        )}
      >
        <BackButton href={set ? `/project?app=${encodeURIComponent(set.appId)}` : "/project"} />
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
          // "Open in canvas" means the canvas, whatever the work mode.
          href={set ? setHref("canvas", set.id) : "/editor"}
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
          {/* The feature graphic as the export makes it: frame 1's background
              and caption, the app's name when something names it. */}
          {play && first && (
            <div
              style={s(
                `height:172px;background:${bgCss(first.bg)};display:flex;align-items:center;justify-content:space-between;padding:0 30px`,
              )}
            >
              <div style={s("min-width:0")}>
                {name && (
                  <div style={s(`font-size:24px;font-weight:600;letter-spacing:-.025em;color:${capInk(first.bg)}`)}>
                    {name}
                  </div>
                )}
                <div style={s(`margin-top:5px;font-size:13.5px;color:${capInk(first.bg)};opacity:.78`)}>
                  {first.caption}
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
                  `display:grid;place-items:center;width:74px;height:74px;border-radius:17px;background:${tint};color:#fff;font-size:29px;font-weight:600`,
                )}
              >
                {id.initial}
              </span>
              {/* The app's name only: its subtitle, ratings, age rating and
                  category live in the store listing, which Onstage doesn't
                  have (they used to be the sample's). */}
              <div style={s("flex:1;min-width:0")}>
                <div style={s("font-size:21px;font-weight:600;letter-spacing:-.025em")}>
                  {name ?? FALLBACK_APP_NAME}
                </div>
              </div>
              <button
                type="button"
                style={s(
                  play
                    ? `flex:none;height:34px;padding:0 20px;border:none;border-radius:8px;background:${tint};color:#fff;font-size:13px;font-weight:600;cursor:pointer`
                    : `flex:none;height:30px;padding:0 20px;border:none;border-radius:999px;background:${tint};color:#fff;font-size:12.5px;font-weight:700;cursor:pointer`,
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

            {/* No "About this app": the description is the store listing's,
                not something a set holds (it was the sample app's). */}
          </div>
        </div>

        <div style={s("display:flex;flex-direction:column;gap:14px")}>
          {/* No "Listing checks" card: it was a fixed list that never looked
              at the set (SCREENSB-8). Computed checks come back with S10.5. */}
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
