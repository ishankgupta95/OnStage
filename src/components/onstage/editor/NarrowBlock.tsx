"use client";

import Link from "next/link";
import { s } from "@/lib/onstage/css";
import { FEATURES } from "@/lib/features";
import { BrandMark } from "../chrome";
import { IcoAlert } from "../icons";

/**
 * Shown instead of the canvas below 900px. The rule, and this wording, come
 * from the design's own 390px board: laying a set out needs room, but
 * reviewing one does not.
 */
export function NarrowBlock() {
  return (
    <div className="narrow-only">
      <div
        style={s(
          "min-height:100vh;background:var(--bg);color:var(--text);display:flex;flex-direction:column",
        )}
      >
        <div
          style={s(
            "display:flex;align-items:center;gap:9px;padding:13px 20px;border-bottom:1px solid rgba(var(--ink-rgb),.07);background:var(--chrome)",
          )}
        >
          <Link
            href="/dashboard"
            style={s(
              "display:flex;align-items:center;gap:9px;color:var(--text)",
            )}
          >
            <BrandMark font={15} weight={500} />
          </Link>
        </div>

        <div
          style={s(
            "flex:1;display:grid;place-items:center;padding:32px 20px 60px",
          )}
        >
          <div style={s("max-width:420px;text-align:center")}>
            <div
              style={s(
                "display:flex;justify-content:center;gap:10px;perspective:700px",
              )}
            >
              <div
                style={s(
                  "width:56px;height:114px;border-radius:9px;border:1.5px dashed rgba(var(--ink-rgb),.18);transform:rotateY(18deg)",
                )}
              />
              <div
                style={s(
                  "width:64px;height:130px;border-radius:10px;border:1.5px dashed rgba(var(--accent-rgb),.55);background:rgba(var(--accent-rgb),.05)",
                )}
              />
              <div
                style={s(
                  "width:56px;height:114px;border-radius:9px;border:1.5px dashed rgba(var(--ink-rgb),.18);transform:rotateY(-18deg)",
                )}
              />
            </div>
            <h1
              style={s(
                "margin:26px 0 0;font-size:24px;font-weight:500;letter-spacing:-.028em",
              )}
            >
              Not enough room to lay out
            </h1>
            <div
              style={s(
                "display:flex;gap:9px;text-align:left;margin-top:16px;padding:13px;border-radius:10px;border:1px solid rgba(var(--warn-rgb),.24);background:rgba(var(--warn-rgb),.06)",
              )}
            >
              <IcoAlert
                size={14}
                w={2}
                style={s("flex:none;margin-top:2px;color:var(--warn)")}
              />
              <div
                style={s("font-size:12.5px;line-height:1.55;color:var(--warn)")}
              >
                The editor needs a screen at least 900px wide.
                {FEATURES.teams
                  ? " On a phone you can review sets and approve comments, not lay them out."
                  : " Open this set on a larger screen to lay it out."}
              </div>
            </div>
            <div
              style={s(
                "display:flex;flex-direction:column;gap:8px;margin-top:18px",
              )}
            >
              {FEATURES.teams && (
                <Link
                  href="/review"
                  className="hov-accent"
                  style={s(
                    "display:flex;align-items:center;justify-content:center;height:44px;border:1px solid var(--accent);border-radius:8px;color:var(--accent);font-size:14.5px;font-weight:500",
                  )}
                >
                  Review this set
                </Link>
              )}
              <Link
                href="/dashboard"
                className="hov-ink"
                style={s(
                  `display:flex;align-items:center;justify-content:center;height:44px;border:1px solid ${
                    FEATURES.teams ? "rgba(var(--ink-rgb),.14)" : "var(--accent)"
                  };border-radius:8px;color:${
                    FEATURES.teams ? "var(--text)" : "var(--accent)"
                  };font-size:14.5px`,
                )}
              >
                Back to your apps
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
