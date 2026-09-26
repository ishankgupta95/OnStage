"use client";

import { s } from "@/lib/onstage/css";
import { BackButton } from "../chrome";

const CARDS = [
  {
    title: "Screenshot rejected",
    where: "CANVAS · DROP TARGET",
    icon: "!",
    warn: true,
    headline: "That PNG is 720 × 1280 — too small for 6.9″",
    body: "Apple needs 1320 × 2868. Upscaling would look soft, so Onstage won't do it silently.",
    primary: "Pick another file",
    secondary: "Use anyway",
    note: "The frame keeps its previous screen. Nothing is lost.",
  },
  {
    title: "Store token expired",
    where: "EXPORT · DESTINATION",
    icon: "!",
    warn: true,
    headline: "App Store Connect needs reconnecting",
    body: "Your API key expired on 2 March. Renders still download as a zip.",
    primary: "Reconnect",
    secondary: "Download instead",
    note: "Shown inside the export dialog, on the destination you picked.",
  },
  {
    title: "Render failed",
    where: "RENDERS & UPLOADS",
    icon: "!",
    warn: true,
    headline: "12 of 40 files failed to render",
    body: "A custom font stopped loading mid-job. The 28 finished files are ready now.",
    primary: "Retry the 12",
    secondary: "Download 28",
    note: "Partial results are always kept — never an all-or-nothing failure.",
  },
  {
    title: "Caption overruns",
    where: "CANVAS · INLINE",
    icon: "!",
    warn: true,
    headline: "German headline is 4 lines at 6.5″",
    body: "It clears the safe area on 6.9″ but not on 6.5″. Onstage can drop it to 38pt.",
    primary: "Resize to fit",
    secondary: "Edit the text",
    note: "Flagged on the frame itself with the overflow shaded, not in a toast.",
  },
  {
    title: "Offline",
    where: "GLOBAL · TOP BAR",
    icon: "○",
    warn: false,
    headline: "Working offline — edits saved locally",
    body: "Your last 14 changes are queued. They sync when the connection returns.",
    primary: "Retry now",
    secondary: "Keep working",
    note: "Nothing is blocked. Export is the only action that waits.",
  },
  {
    title: "Someone else edited this",
    where: "CANVAS · ON FOCUS",
    icon: "○",
    warn: false,
    headline: "Jamie changed frame 03 two minutes ago",
    body: "You're looking at the older version of the headline and background.",
    primary: "Load their version",
    secondary: "Keep mine",
    note: "Only surfaces on the frames that actually differ.",
  },
];

/** Every failure the product can hit, shown where it actually appears. */
export function StatesScreen() {
  return (
    <div style={s("min-height:var(--screen-h,100vh);background:var(--bg);color:var(--text)")}>
      <div
        style={s(
          "display:flex;align-items:center;gap:14px;padding:13px 28px;border-bottom:1px solid rgba(var(--ink-rgb),.07);background:var(--chrome)",
        )}
      >
        <BackButton href="/editor" />
        <span style={s("font-size:14.5px;font-weight:500;letter-spacing:-.015em")}>
          Error &amp; edge states
        </span>
        <span style={s("font-size:11px;letter-spacing:.09em;color:var(--muted-4)")}>
          SHOWN IN PLACE, NEVER AS A TOAST ALONE
        </span>
      </div>

      <div
        style={s(
          "max-width:1180px;margin:0 auto;padding:26px 28px 60px;display:grid;grid-template-columns:1fr 1fr;gap:20px",
        )}
      >
        {CARDS.map((e) => (
          <div
            key={e.title}
            style={s(
              "padding:18px;border:1px solid rgba(var(--ink-rgb),.09);border-radius:14px;background:var(--surface)",
            )}
          >
            <div style={s("display:flex;align-items:baseline;gap:10px")}>
              <span style={s("font-size:14.5px;font-weight:500")}>{e.title}</span>
              <span style={s("font-size:11px;letter-spacing:.08em;color:var(--muted-4)")}>
                {e.where}
              </span>
            </div>
            <div
              style={s(
                `display:flex;gap:11px;margin-top:12px;padding:13px;border-radius:10px;border:1px solid ${
                  e.warn ? "rgba(var(--warn-rgb),.28)" : "rgba(var(--ink-rgb),.12)"
                };background:${e.warn ? "rgba(var(--warn-rgb),.06)" : "var(--surface-2)"}`,
              )}
            >
              <span
                style={s(
                  `display:grid;place-items:center;flex:none;width:22px;height:22px;border-radius:50%;background:${
                    e.warn ? "rgba(var(--warn-rgb),.16)" : "rgba(var(--ink-rgb),.08)"
                  };color:${e.warn ? "var(--warn)" : "var(--muted)"};font-size:12px;font-weight:600`,
                )}
              >
                {e.icon}
              </span>
              <div style={s("flex:1;min-width:0")}>
                <div
                  style={s(
                    `font-size:13px;font-weight:500;color:${e.warn ? "var(--warn)" : "var(--muted)"}`,
                  )}
                >
                  {e.headline}
                </div>
                <div style={s("margin-top:4px;font-size:12.5px;line-height:1.55;color:var(--muted)")}>
                  {e.body}
                </div>
                <div style={s("display:flex;gap:8px;margin-top:11px")}>
                  <button
                    type="button"
                    style={s(
                      "height:28px;padding:0 12px;border-radius:8px;border:1px solid var(--accent);background:transparent;color:var(--accent);font-size:12px;font-weight:500;cursor:pointer",
                    )}
                  >
                    {e.primary}
                  </button>
                  <button
                    type="button"
                    style={s(
                      "height:28px;padding:0 11px;border:1px solid rgba(var(--ink-rgb),.14);border-radius:8px;background:transparent;color:var(--muted);font-size:12px;cursor:pointer",
                    )}
                  >
                    {e.secondary}
                  </button>
                </div>
              </div>
            </div>
            <div style={s("margin-top:12px;font-size:12px;line-height:1.55;color:var(--muted-3)")}>
              {e.note}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
