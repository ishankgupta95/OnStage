"use client";

import { useState } from "react";
import { s } from "@/lib/onstage/css";
import { Async, Shimmer } from "@/components/onstage/Async";
import { getBackend } from "@/lib/data/backend";
import { useQuery } from "@/lib/data/useQuery";
import { FEATURES } from "@/lib/features";
import { WarnLine } from "../../WarnLine";
import { H1 } from "./styles";

/** Each row is about a surface that has its own flag; only rows whose
 *  surface exists are offered. */
const NOTIFY = [
  { id: "export", label: "Export finished", sub: "When a render queue job completes", on: FEATURES.jobQueue },
  {
    id: "reject",
    label: "Store rejected an upload",
    sub: "Apple or Google returned an error",
    on: FEATURES.storeUpload,
  },
  { id: "comment", label: "Comments and mentions", sub: "Someone replies or @mentions you", on: FEATURES.teams },
  { id: "expiry", label: "Store token expiring", sub: "Seven days before it lapses", on: FEATURES.storeUpload },
  { id: "news", label: "Product news", sub: "New templates and sizes, monthly", on: true },
].filter((n) => n.on);

/** Off until the person turns it on; everything else starts on. */
const OFF_BY_DEFAULT = ["news"];

/**
 * Email delivery preferences — an account surface, mounted behind
 * `FEATURES.accounts`. Its own module so its read doesn't run in
 * SettingsScreen when the tab is off. Each switch is stored through the
 * backend (SCREENSB-10): a switch only moves once its change is kept, and a
 * refused change says why under that row instead of reverting on reload.
 */
export function NotificationsPanel() {
  const prefs = useQuery("notification-prefs", () => getBackend().getNotificationPrefs());
  // Changes stored since the read, laid over it.
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<{ id: string; message: string } | null>(null);

  const isOn = (stored: Record<string, boolean>, id: string) =>
    saved[id] ?? stored[id] ?? OFF_BY_DEFAULT.indexOf(id) < 0;

  const toggleNotify = async (id: string, next: boolean) => {
    setBusy(id);
    setError(null);
    try {
      await getBackend().setNotificationPref(id, next);
      setSaved((cur) => ({ ...cur, [id]: next }));
    } catch (e) {
      setError({ id, message: e instanceof Error ? e.message : "Couldn't save that change." });
    }
    setBusy(null);
  };

  return (
    <div>
      <h1 style={s(H1)}>Notifications</h1>
      <div
        style={s(
          "margin-top:18px;border:1px solid rgba(var(--ink-rgb),.09);border-radius:14px;background:var(--surface);padding:6px 18px",
        )}
      >
        <Async query={prefs} skeleton={<Shimmer style="height:220px;margin:12px 0" />}>
          {(stored) =>
            NOTIFY.map((n, i) => {
              const off = !isOn(stored, n.id);
              return (
                <div
                  key={n.id}
                  style={s(
                    `padding:13px 0;border-bottom:${
                      i < NOTIFY.length - 1 ? "1px solid rgba(var(--ink-rgb),.06)" : "none"
                    }`,
                  )}
                >
                  <div style={s("display:flex;align-items:center;gap:14px")}>
                    <div style={s("flex:1;min-width:0")}>
                      <div style={s("font-size:13.5px;font-weight:500")}>{n.label}</div>
                      <div style={s("margin-top:2px;font-size:12px;color:var(--muted-2)")}>{n.sub}</div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={!off}
                      aria-label={n.label}
                      disabled={busy !== null}
                      onClick={() => void toggleNotify(n.id, off)}
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
                  {error?.id === n.id && <WarnLine style="margin-top:9px">{error.message}</WarnLine>}
                </div>
              );
            })
          }
        </Async>
      </div>
    </div>
  );
}
