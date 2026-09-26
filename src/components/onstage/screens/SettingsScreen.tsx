"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { s } from "@/lib/onstage/css";
import { Async, Shimmer } from "@/components/onstage/Async";
import { getBackend } from "@/lib/data/backend";
import { useQuery } from "@/lib/data/useQuery";
import { FEATURES } from "@/lib/features";
import { useOnstage } from "@/store/onstage";
import { BackButton } from "../chrome";
import { AccountIdentityCard } from "./settings/AccountIdentityCard";
import { BillingPanel } from "./settings/BillingPanel";
import { NotificationsPanel } from "./settings/NotificationsPanel";
import { TeamPanel } from "./settings/TeamPanel";
import { H1, PANEL } from "./settings/styles";

/**
 * With accounts off the first tab is no longer about an identity — it still
 * hosts the work-mode picker and preferences, which belong in a login-free
 * build, so it is renamed rather than dropped.
 */
const ACCOUNT_TAB = FEATURES.accounts ? "Account" : "Preferences";

/** Only the tabs whose feature is on. Deep links use these exact strings. */
const NAV = [
  ACCOUNT_TAB,
  ...(FEATURES.billing ? ["Plan & billing"] : []),
  "Store connections",
  ...(FEATURES.teams ? ["Team"] : []),
  ...(FEATURES.accounts ? ["Notifications"] : []),
];

/**
 * The panels are sibling `tab === "…"` conditionals with no default branch, so
 * an unreachable fallback renders the nav rail beside an empty column. Keep
 * "Plan & billing" when it is visible (unchanged behaviour with every flag on)
 * and otherwise fall back to the first tab that actually exists.
 */
const DEFAULT_TAB = NAV.indexOf("Plan & billing") >= 0 ? "Plan & billing" : NAV[0];

const PREFS = [
  {
    label: "Interface language",
    sub: "Separate from your set locales",
    val: "English",
  },
  {
    label: "Default store target",
    sub: "Which tab opens first",
    val: "App Store",
  },
  {
    label: "Units in size labels",
    sub: "Inches or millimetres",
    val: "Inches",
  },
];

const MODES = [
  {
    id: "guided" as const,
    label: "Guided steps",
    tag: "SIMPLER",
    body: "Four steps, one decision each. Onstage picks sensible defaults and you approve them.",
  },
  {
    id: "canvas" as const,
    label: "Full canvas",
    tag: "",
    body: "Everything on one surface. Select any element and edit it in place.",
  },
];

export function SettingsScreen() {
  const params = useSearchParams();
  const initial = NAV.indexOf(params.get("tab") ?? "") >= 0 ? params.get("tab")! : DEFAULT_TAB;
  const [tab, setTab] = useState(initial);
  const workMode = useOnstage((st) => st.workMode);
  const setState = useOnstage((st) => st.setState);

  const connections = useQuery("connections", () => getBackend().listConnections());
  const [connBusy, setConnBusy] = useState<string | null>(null);
  const [connError, setConnError] = useState<{ id: string; message: string } | null>(null);

  // A change the backend refused shows why on that store's card, instead of
  // the card quietly flipping back on the refetch.
  const toggleConnection = async (id: "apple" | "google", connected: boolean) => {
    setConnBusy(id);
    setConnError(null);
    try {
      if (connected) await getBackend().disconnectStore(id);
      else {
        const res = await getBackend().connectStore(id);
        // SUPABASE SEAM: a real provider returns an OAuth URL to send them to.
        if ("redirectTo" in res && res.redirectTo.startsWith("http")) {
          window.location.assign(res.redirectTo);
          return;
        }
        if ("error" in res) setConnError({ id, message: res.error });
      }
    } catch (e) {
      setConnError({ id, message: e instanceof Error ? e.message : "Something went wrong." });
    }
    setConnBusy(null);
    connections.refetch();
  };

  return (
    <div style={s("min-height:var(--screen-h,100vh);background:var(--bg);color:var(--text)")}>
      <div
        style={s(
          "display:flex;align-items:center;gap:14px;padding:13px 28px;border-bottom:1px solid rgba(var(--ink-rgb),.07);background:var(--chrome)",
        )}
      >
        <BackButton href="/dashboard" />
        <span style={s("font-size:14.5px;font-weight:500;letter-spacing:-.015em")}>Settings</span>
      </div>

      <div
        style={s(
          "max-width:1080px;margin:0 auto;padding:28px 28px 60px;display:grid;grid-template-columns:186px minmax(0,1fr);gap:30px",
        )}
      >
        <div style={s("display:flex;flex-direction:column;gap:3px")}>
          {NAV.map((n) => {
            const on = tab === n;
            return (
              <button
                key={n}
                type="button"
                onClick={() => setTab(n)}
                style={s(
                  `text-align:left;padding:8px 11px;border:none;border-radius:8px;background:${
                    on ? "rgba(var(--accent-rgb),.1)" : "transparent"
                  };color:${on ? "var(--accent-hi)" : "var(--muted)"};font-size:13px;font-weight:${
                    on ? 500 : 400
                  };cursor:pointer`,
                )}
              >
                {n}
              </button>
            );
          })}
        </div>

        <div>
          {FEATURES.billing && tab === "Plan & billing" && <BillingPanel />}

          {tab === ACCOUNT_TAB && (
            <div>
              <h1 style={s(H1)}>{ACCOUNT_TAB}</h1>

              {/* Conditionally mounted, not conditionally rendered: the card
                  owns the useSession() read, so with accounts off it never
                  runs. */}
              {FEATURES.accounts && <AccountIdentityCard />}

              <div
                style={s(
                  "margin-top:16px;padding:18px;border:1px solid rgba(var(--accent-rgb),.32);border-radius:14px;background:var(--surface)",
                )}
              >
                <div style={s("font-size:15px;font-weight:500")}>How you want to work</div>
                <div style={s("margin-top:5px;font-size:13px;line-height:1.6;color:var(--muted)")}>
                  Your choice, changeable any time — including from the switch in the editor&apos;s
                  top bar.
                </div>
                <div
                  style={s("display:grid;grid-template-columns:1fr 1fr;gap:11px;margin-top:14px")}
                >
                  {MODES.map((m) => {
                    const on = workMode === m.id;
                    return (
                      <div
                        key={m.id}
                        onClick={() => setState({ workMode: m.id })}
                        style={s(
                          `padding:14px;border-radius:10px;border:1px solid ${
                            on ? "var(--accent)" : "rgba(var(--ink-rgb),.1)"
                          };background:${on ? "rgba(var(--accent-rgb),.07)" : "transparent"};cursor:pointer`,
                        )}
                      >
                        <div style={s("display:flex;align-items:center;gap:9px")}>
                          <span
                            style={s(
                              `width:14px;height:14px;border-radius:50%;border:1px solid ${
                                on ? "var(--accent)" : "rgba(var(--ink-rgb),.2)"
                              };box-shadow:${on ? "inset 0 0 0 3.5px var(--accent)" : "none"}`,
                            )}
                          />
                          <span style={s("font-size:13.5px;font-weight:500")}>{m.label}</span>
                          {m.tag ? (
                            <span
                              style={s(
                                "padding:2px 7px;border-radius:5px;background:rgba(var(--accent-rgb),.12);color:var(--accent-hi);font-size:10px;letter-spacing:.07em",
                              )}
                            >
                              {m.tag}
                            </span>
                          ) : null}
                        </div>
                        <div
                          style={s(
                            "margin-top:8px;font-size:12.5px;line-height:1.55;color:var(--muted-2)",
                          )}
                        >
                          {m.body}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={s(`margin-top:16px;${PANEL}`)}>
                <div style={s("font-size:15px;font-weight:500")}>Preferences</div>
                <div style={s("margin-top:12px;display:flex;flex-direction:column;gap:12px")}>
                  {PREFS.map((p) => (
                    <div
                      key={p.label}
                      style={s(
                        "display:flex;align-items:center;gap:12px;padding-bottom:12px;border-bottom:1px solid rgba(var(--ink-rgb),.06)",
                      )}
                    >
                      <div style={s("flex:1;min-width:0")}>
                        <div style={s("font-size:13.5px;font-weight:500")}>{p.label}</div>
                        <div style={s("margin-top:2px;font-size:12px;color:var(--muted-2)")}>
                          {p.sub}
                        </div>
                      </div>
                      <span
                        style={s(
                          "flex:none;white-space:nowrap;padding:5px 10px;border-radius:7px;border:1px solid rgba(var(--ink-rgb),.14);font-size:12.5px;color:var(--text)",
                        )}
                      >
                        {p.val}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === "Store connections" && (
            <div>
              <h1 style={s(H1)}>Store connections</h1>
              <p
                style={s(
                  "margin:9px 0 0;max-width:64ch;font-size:13.5px;line-height:1.6;color:var(--muted)",
                )}
              >
                Onstage uploads to the screenshot slots only. It never touches your build, pricing
                or release state.
              </p>
              <div style={s("margin-top:18px;display:flex;flex-direction:column;gap:12px")}>
                <Async
                  query={connections}
                  skeleton={<Shimmer style="height:130px;border-radius:14px" />}
                >
                  {(rows) =>
                    rows.map((c) => (
                      <div
                        key={c.id}
                        style={s(
                          `padding:16px;border-radius:14px;border:1px solid ${
                            c.connected ? "rgba(var(--ink-rgb),.09)" : "rgba(var(--warn-rgb),.3)"
                          };background:${c.connected ? "var(--surface)" : "rgba(var(--warn-rgb),.05)"}`,
                        )}
                      >
                        <div style={s("display:flex;align-items:flex-start;gap:13px")}>
                          <span
                            style={s(
                              "display:grid;place-items:center;width:34px;height:34px;border-radius:9px;background:rgba(var(--ink-rgb),.06);color:var(--text);font-size:14px;font-weight:600",
                            )}
                          >
                            {c.initial}
                          </span>
                          <div style={s("flex:1;min-width:0")}>
                            <div style={s("display:flex;align-items:center;gap:9px")}>
                              <span style={s("font-size:15px;font-weight:500")}>{c.name}</span>
                              <span
                                style={s(
                                  `padding:2px 8px;border-radius:6px;font-size:10.5px;letter-spacing:.07em;background:${
                                    c.connected
                                      ? "rgba(var(--ok-rgb),.12)"
                                      : "rgba(var(--warn-rgb),.14)"
                                  };color:${c.connected ? "var(--ok)" : "var(--warn)"}`,
                                )}
                              >
                                {c.connected ? "CONNECTED" : "ACTION NEEDED"}
                              </span>
                            </div>
                            <div style={s("margin-top:4px;font-size:13px;color:var(--muted)")}>
                              {c.sub}
                            </div>
                            <div
                              style={s("margin-top:9px;display:flex;gap:7px;flex-wrap:wrap")}
                            >
                              {c.scopes.map((sc) => (
                                <span
                                  key={sc}
                                  style={s(
                                    "padding:3px 9px;border-radius:6px;border:1px solid rgba(var(--ink-rgb),.12);font-size:11.5px;color:var(--muted)",
                                  )}
                                >
                                  {sc}
                                </span>
                              ))}
                            </div>
                          </div>
                          <button
                            type="button"
                            disabled={connBusy !== null}
                            onClick={() => void toggleConnection(c.id, c.connected)}
                            style={s(
                              `flex:none;height:30px;padding:0 13px;border-radius:8px;border:1px solid ${
                                c.connected ? "rgba(var(--ink-rgb),.16)" : "var(--accent)"
                              };background:transparent;color:${
                                c.connected ? "var(--text)" : "var(--accent)"
                              };font-size:12.5px;font-weight:500;cursor:pointer`,
                            )}
                          >
                            {connBusy === c.id ? "…" : c.connected ? "Disconnect" : "Reconnect"}
                          </button>
                        </div>
                        {connError?.id === c.id || c.warning ? (
                          <div
                            role={connError?.id === c.id ? "alert" : undefined}
                            style={s(
                              "margin-top:12px;padding-top:12px;border-top:1px solid rgba(var(--warn-rgb),.2);font-size:12.5px;line-height:1.55;color:var(--warn)",
                            )}
                          >
                            {connError?.id === c.id ? connError.message : c.warning}
                          </div>
                        ) : null}
                      </div>
                    ))
                  }
                </Async>
              </div>
            </div>
          )}

          {FEATURES.teams && tab === "Team" && <TeamPanel />}

          {FEATURES.accounts && tab === "Notifications" && <NotificationsPanel />}
        </div>
      </div>
    </div>
  );
}
