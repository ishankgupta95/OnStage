"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { s } from "@/lib/onstage/css";
import { FEATURES } from "@/lib/features";
import { BackButton } from "../chrome";
import { AccountIdentityCard } from "./settings/AccountIdentityCard";
import { BillingPanel } from "./settings/BillingPanel";
import { NotificationsPanel } from "./settings/NotificationsPanel";
import { PreferencesPanel } from "./settings/PreferencesPanel";
import { StoreConnectionsPanel } from "./settings/StoreConnectionsPanel";
import { TeamPanel } from "./settings/TeamPanel";
import { H1 } from "./settings/styles";

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
  ...(FEATURES.storeUpload ? ["Store connections"] : []),
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

export function SettingsScreen() {
  const params = useSearchParams();
  const initial = NAV.indexOf(params.get("tab") ?? "") >= 0 ? params.get("tab")! : DEFAULT_TAB;
  const [tab, setTab] = useState(initial);

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

              <PreferencesPanel />
            </div>
          )}

          {FEATURES.storeUpload && tab === "Store connections" && <StoreConnectionsPanel />}

          {FEATURES.teams && tab === "Team" && <TeamPanel />}

          {FEATURES.accounts && tab === "Notifications" && <NotificationsPanel />}
        </div>
      </div>
    </div>
  );
}
