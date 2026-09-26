"use client";

import Link from "next/link";
import { useState } from "react";
import { s } from "@/lib/onstage/css";
import { Async, Shimmer } from "@/components/onstage/Async";
import { getBackend } from "@/lib/data/backend";
import { useQuery } from "@/lib/data/useQuery";
import { H1 } from "./styles";

/**
 * The whole Plan & billing tab, in its own module so the parent can mount it
 * behind `FEATURES.billing`. Its `usage` and `invoices` reads used to sit at
 * the top of SettingsScreen and ran on every tab; gating the JSX alone would
 * have left them running (and an early return above them is a rules-of-hooks
 * error).
 */
export function BillingPanel() {
  const usage = useQuery("usage", () => getBackend().listUsage());
  const invoices = useQuery("invoices", () => getBackend().listInvoices());
  const [cancelled, setCancelled] = useState(false);
  const [invoiceNote, setInvoiceNote] = useState<string | null>(null);

  return (
    <div>
      <h1 style={s(H1)}>Plan &amp; billing</h1>
      <div
        style={s(
          "margin-top:18px;padding:18px;border:1px solid rgba(var(--accent-rgb),.4);border-radius:14px;background:var(--surface)",
        )}
      >
        <div style={s("display:flex;align-items:flex-start;gap:16px")}>
          <div style={s("flex:1")}>
            <div style={s("display:flex;align-items:center;gap:9px")}>
              <span style={s("font-size:17px;font-weight:500;letter-spacing:-.02em")}>Indie</span>
              <span
                style={s(
                  "padding:2px 8px;border-radius:6px;border:1px solid var(--accent);color:var(--accent);font-size:10.5px;letter-spacing:.07em",
                )}
              >
                CURRENT
              </span>
            </div>
            <div style={s("margin-top:6px;font-size:13px;color:var(--muted)")}>
              $12 per month · renews 3 April 2026 · card ending 4417
            </div>
          </div>
          <Link
            href="/pricing"
            style={s(
              "display:inline-flex;align-items:center;height:32px;padding:0 13px;border:1px solid rgba(var(--ink-rgb),.16);border-radius:8px;background:transparent;color:var(--text);font-size:12.5px",
            )}
          >
            Change plan
          </Link>
        </div>
        <div
          style={s(
            "height:1px;margin:16px 0;background:linear-gradient(to right,transparent,rgba(var(--ink-rgb),.14) 48px,rgba(var(--ink-rgb),.14) calc(100% - 48px),transparent)",
          )}
        />
        <div style={s("display:grid;grid-template-columns:repeat(3,1fr);gap:18px")}>
          <Async query={usage} skeleton={<Shimmer style="height:64px" />}>
            {(rows) =>
              rows.map((u) => (
                <div key={u.id}>
                  <div style={s("font-size:11px;letter-spacing:.09em;color:var(--muted-3)")}>
                    {u.label}
                  </div>
                  <div
                    style={s("margin-top:6px;font-size:19px;font-weight:500;letter-spacing:-.02em")}
                  >
                    {u.value}
                  </div>
                  <div
                    style={s(
                      "margin-top:8px;height:3px;border-radius:3px;background:rgba(var(--ink-rgb),.1);overflow:hidden",
                    )}
                  >
                    <div
                      style={s(
                        `height:3px;border-radius:3px;background:var(--accent);width:${u.pct}%`,
                      )}
                    />
                  </div>
                </div>
              ))
            }
          </Async>
        </div>
      </div>

      <h2 style={s("margin:28px 0 0;font-size:17px;font-weight:500;letter-spacing:-.02em")}>
        Invoices
      </h2>
      {invoiceNote && (
        <div
          style={s(
            "margin-top:10px;padding:10px 12px;border-radius:8px;border:1px solid rgba(var(--warn-rgb),.24);background:rgba(var(--warn-rgb),.06);font-size:12.5px;color:var(--warn)",
          )}
        >
          Invoice PDFs come from the billing provider — none is connected yet.
        </div>
      )}
      <div
        style={s(
          "margin-top:12px;border:1px solid rgba(var(--ink-rgb),.09);border-radius:14px;overflow:hidden;background:var(--surface)",
        )}
      >
        <Async query={invoices} skeleton={<Shimmer style="height:180px;border-radius:0" />}>
          {(rows) =>
            rows.map((inv, i) => (
              <div
                key={inv.id}
                style={s(
                  `display:flex;align-items:center;gap:14px;padding:11px 14px;border-bottom:${
                    i < rows.length - 1 ? "1px solid rgba(var(--ink-rgb),.06)" : "none"
                  }`,
                )}
              >
                <span style={s("flex:1;font-size:13px")}>{inv.date}</span>
                <span style={s("width:120px;font-size:13px;color:var(--muted)")}>
                  {inv.description}
                </span>
                <span style={s("width:70px;text-align:right;font-size:13px")}>{inv.amount}</span>
                <span
                  style={s(
                    `width:88px;text-align:center;padding:3px 8px;border-radius:6px;font-size:11.5px;background:${
                      inv.status === "Paid"
                        ? "rgba(var(--ok-rgb),.12)"
                        : "rgba(var(--ink-rgb),.05)"
                    };color:${inv.status === "Paid" ? "var(--ok)" : "var(--muted-2)"}`,
                  )}
                >
                  {inv.status}
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    const url = await getBackend().getInvoiceUrl(inv.id);
                    if (url) window.open(url, "_blank", "noopener");
                    else setInvoiceNote(inv.id);
                  }}
                  style={s(
                    "height:26px;padding:0 10px;border:1px solid rgba(var(--ink-rgb),.14);border-radius:6px;background:transparent;color:var(--muted);font-size:11.5px;cursor:pointer",
                  )}
                >
                  PDF
                </button>
              </div>
            ))
          }
        </Async>
      </div>

      <div
        style={s(
          "margin-top:26px;padding:16px;border:1px solid rgba(var(--ink-rgb),.09);border-radius:14px;background:var(--surface)",
        )}
      >
        <div style={s("font-size:14px;font-weight:500")}>Cancel subscription</div>
        <div style={s("margin-top:6px;font-size:13px;line-height:1.6;color:var(--muted)")}>
          Your sets stay editable on the free plan. Exports stop at 5 and store connections are
          disconnected.
        </div>
        <button
          type="button"
          disabled={cancelled}
          onClick={async () => {
            await getBackend().cancelSubscription();
            setCancelled(true);
          }}
          style={s(
            `margin-top:12px;height:32px;padding:0 13px;border:1px solid ${
              cancelled ? "rgba(var(--warn-rgb),.4)" : "rgba(var(--ink-rgb),.16)"
            };border-radius:8px;background:transparent;color:${
              cancelled ? "var(--warn)" : "var(--muted)"
            };font-size:12.5px;cursor:${cancelled ? "default" : "pointer"}`,
          )}
        >
          {cancelled ? "Cancels on 3 April 2026" : "Cancel at period end"}
        </button>
      </div>
    </div>
  );
}
