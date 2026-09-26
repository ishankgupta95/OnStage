"use client";

import { useState } from "react";
import { s } from "@/lib/onstage/css";
import { H1 } from "./styles";

const NOTIFY = [
  { id: "export", label: "Export finished", sub: "When a render queue job completes" },
  {
    id: "reject",
    label: "Store rejected an upload",
    sub: "Apple or Google returned an error",
  },
  { id: "comment", label: "Comments and mentions", sub: "Someone replies or @mentions you" },
  { id: "expiry", label: "Store token expiring", sub: "Seven days before it lapses" },
  { id: "news", label: "Product news", sub: "New templates and sizes, monthly" },
];

/**
 * Email delivery preferences — an account surface, mounted behind
 * `FEATURES.accounts`. Its own module so the toggle state doesn't sit unused
 * in SettingsScreen when the tab is off.
 */
export function NotificationsPanel() {
  const [notifyOff, setNotifyOff] = useState<string[]>(["news"]);

  const toggleNotify = (id: string) =>
    setNotifyOff((cur) => (cur.indexOf(id) >= 0 ? cur.filter((x) => x !== id) : cur.concat([id])));

  return (
    <div>
      <h1 style={s(H1)}>Notifications</h1>
      <div
        style={s(
          "margin-top:18px;border:1px solid rgba(var(--ink-rgb),.09);border-radius:14px;background:var(--surface);padding:6px 18px",
        )}
      >
        {NOTIFY.map((n, i) => {
          const off = notifyOff.indexOf(n.id) >= 0;
          return (
            <div
              key={n.id}
              style={s(
                `display:flex;align-items:center;gap:14px;padding:13px 0;border-bottom:${
                  i < NOTIFY.length - 1 ? "1px solid rgba(var(--ink-rgb),.06)" : "none"
                }`,
              )}
            >
              <div style={s("flex:1;min-width:0")}>
                <div style={s("font-size:13.5px;font-weight:500")}>{n.label}</div>
                <div style={s("margin-top:2px;font-size:12px;color:var(--muted-2)")}>{n.sub}</div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={!off}
                aria-label={n.label}
                onClick={() => toggleNotify(n.id)}
                style={s(
                  `flex:none;position:relative;width:38px;height:22px;border-radius:999px;border:1px solid ${
                    off ? "rgba(var(--ink-rgb),.16)" : "var(--accent)"
                  };background:${
                    off ? "transparent" : "rgba(var(--accent-rgb),.22)"
                  };cursor:pointer;padding:0`,
                )}
              >
                <span
                  style={s(
                    `position:absolute;top:2px;left:${
                      off ? 2 : 17
                    }px;width:16px;height:16px;border-radius:50%;background:${
                      off ? "var(--muted-2)" : "var(--accent)"
                    };transition:left .14s ease`,
                  )}
                />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
