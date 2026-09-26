"use client";

import { useState } from "react";
import { s } from "@/lib/onstage/css";
import { Async, Shimmer } from "@/components/onstage/Async";
import { getBackend } from "@/lib/data/backend";
import { useQuery } from "@/lib/data/useQuery";
import { H1 } from "./styles";

/**
 * The Store connections tab, in its own module so the parent can mount it
 * behind `FEATURES.storeUpload` (plan D3): without a store backend no
 * connection can be made and no upload can succeed, so neither the tab nor
 * its `listConnections` read exists in the local build.
 */
export function StoreConnectionsPanel() {
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
  );
}
