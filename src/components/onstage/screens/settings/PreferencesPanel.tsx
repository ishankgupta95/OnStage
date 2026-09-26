"use client";

import { useState } from "react";
import { s } from "@/lib/onstage/css";
import { getBackend } from "@/lib/data/backend";
import type { Prefs } from "@/lib/data/types";
import { useQuery } from "@/lib/data/useQuery";
import { setWorkMode, useOnstage } from "@/store/onstage";
import { STORE_TABS, storeTab } from "../../chrome";
import { WarnLine } from "../../WarnLine";
import { PANEL } from "./styles";

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

const STORES: { id: Prefs["defaultStore"]; label: string }[] = [
  { id: "apple", label: "App Store" },
  { id: "play", label: "Google Play" },
];

/**
 * How you want to work, and the store new sets start on — the person's own
 * preferences (`onstage:prefs:v1` locally), not any set's (plan S3.2). A
 * choice the browser refuses to store says why, under its card.
 */
export function PreferencesPanel() {
  const workMode = useOnstage((st) => st.workMode);
  const [modeError, setModeError] = useState<string | null>(null);

  const prefs = useQuery("prefs", () => getBackend().getPrefs());
  // A store picked here since the read, once it is stored.
  const [picked, setPicked] = useState<Prefs["defaultStore"] | null>(null);
  const [storeBusy, setStoreBusy] = useState(false);
  const [storeError, setStoreError] = useState<string | null>(null);
  const defaultStore = picked ?? prefs.data?.defaultStore ?? null;

  const pickMode = async (mode: Prefs["workMode"]) => {
    setModeError(null);
    try {
      await setWorkMode(mode);
    } catch (e) {
      setModeError(e instanceof Error ? e.message : "Couldn't save that choice.");
    }
  };

  const pickStore = async (store: Prefs["defaultStore"]) => {
    setStoreBusy(true);
    setStoreError(null);
    try {
      await getBackend().setPrefs({ defaultStore: store });
      setPicked(store);
    } catch (e) {
      setStoreError(e instanceof Error ? e.message : "Couldn't save that choice.");
    }
    setStoreBusy(false);
  };

  return (
    <>
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
        <div style={s("display:grid;grid-template-columns:1fr 1fr;gap:11px;margin-top:14px")}>
          {MODES.map((m) => {
            const on = workMode === m.id;
            return (
              <div
                key={m.id}
                onClick={() => void pickMode(m.id)}
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
                <div style={s("margin-top:8px;font-size:12.5px;line-height:1.55;color:var(--muted-2)")}>
                  {m.body}
                </div>
              </div>
            );
          })}
        </div>
        {modeError && <WarnLine style="margin-top:12px">{modeError}</WarnLine>}
      </div>

      <div style={s(`margin-top:16px;${PANEL}`)}>
        <div style={s("font-size:15px;font-weight:500")}>Preferences</div>
        <div style={s("margin-top:12px;display:flex;flex-direction:column;gap:12px")}>
          <div
            style={s(
              "display:flex;align-items:center;gap:12px;padding-bottom:12px;border-bottom:1px solid rgba(var(--ink-rgb),.06)",
            )}
          >
            <div style={s("flex:1;min-width:0")}>
              <div style={s("font-size:13.5px;font-weight:500")}>Default store target</div>
              <div style={s("margin-top:2px;font-size:12px;color:var(--muted-2)")}>
                The store new sets start on
              </div>
            </div>
            <div role="radiogroup" aria-label="Default store target" style={s(`flex:none;${STORE_TABS}`)}>
              {STORES.map((st) => (
                <button
                  key={st.id}
                  type="button"
                  role="radio"
                  aria-checked={defaultStore === st.id}
                  disabled={storeBusy || prefs.loading}
                  onClick={() => void pickStore(st.id)}
                  style={s(storeTab(defaultStore === st.id))}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        {storeError && <WarnLine style="margin-top:4px">{storeError}</WarnLine>}
      </div>
    </>
  );
}
