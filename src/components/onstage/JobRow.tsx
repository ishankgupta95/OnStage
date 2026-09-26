"use client";

import Link from "next/link";
import { s } from "@/lib/onstage/css";
import type { Job } from "@/lib/data/types";

/**
 * One render or upload. Shared by the queue screen and the project board's
 * Uploads tab so a job looks the same wherever it surfaces.
 */
export function JobRow({ job }: { job: Job }) {
  const failed = job.state === "failed";
  const running = job.state === "running";

  return (
    <div
      style={s(
        `padding:14px 16px;border-radius:14px;border:1px solid ${
          failed ? "rgba(var(--warn-rgb),.3)" : "rgba(var(--ink-rgb),.09)"
        };background:${failed ? "rgba(var(--warn-rgb),.05)" : "var(--surface)"}`,
      )}
    >
      <div style={s("display:flex;align-items:center;gap:13px")}>
        <span
          style={s(
            `display:grid;place-items:center;flex:none;width:28px;height:28px;border-radius:8px;font-size:13px;font-weight:600;background:${
              running
                ? "rgba(var(--accent-rgb),.14)"
                : failed
                  ? "rgba(var(--warn-rgb),.14)"
                  : "rgba(var(--ok-rgb),.12)"
            };color:${running ? "var(--accent-hi)" : failed ? "var(--warn)" : "var(--ok)"}`,
          )}
        >
          {running ? "◐" : failed ? "!" : "✓"}
        </span>
        <div style={s("flex:1;min-width:0")}>
          <div style={s("display:flex;align-items:center;gap:9px")}>
            <span style={s("font-size:13.5px;font-weight:500")}>{job.title}</span>
            <span
              style={s(
                `padding:2px 8px;border-radius:6px;font-size:10px;letter-spacing:.07em;background:${
                  running
                    ? "rgba(var(--accent-rgb),.12)"
                    : failed
                      ? "rgba(var(--warn-rgb),.14)"
                      : "rgba(var(--ink-rgb),.05)"
                };color:${running ? "var(--accent-hi)" : failed ? "var(--warn)" : "var(--muted)"}`,
              )}
            >
              {job.pill}
            </span>
          </div>
          <div style={s("margin-top:3px;font-size:12px;color:var(--muted-2)")}>{job.sub}</div>
        </div>
        <span style={s("width:96px;text-align:right;font-size:12px;color:var(--muted-3)")}>
          {job.when}
        </span>
        <button
          type="button"
          style={s(
            `flex:none;height:28px;padding:0 11px;border-radius:8px;border:1px solid ${
              failed ? "var(--accent)" : "rgba(var(--ink-rgb),.14)"
            };background:transparent;color:${
              failed ? "var(--accent)" : "var(--muted)"
            };font-size:12px;font-weight:${failed ? 500 : 400};cursor:pointer`,
          )}
        >
          {job.action}
        </button>
      </div>

      {running && (
        <div
          style={s(
            "margin-top:11px;height:3px;border-radius:3px;background:rgba(var(--ink-rgb),.09);overflow:hidden",
          )}
        >
          <div
            style={s(`height:3px;border-radius:3px;background:var(--accent);width:${job.progress}%`)}
          />
        </div>
      )}

      {job.error && (
        <div
          style={s(
            "margin-top:11px;padding-top:11px;border-top:1px solid rgba(var(--warn-rgb),.2);font-size:12.5px;line-height:1.55;color:var(--warn)",
          )}
        >
          {job.error}
          {job.destination && job.destination !== "zip" && (
            <>
              {" "}
              <Link href="/settings?tab=Store+connections" style={s("color:var(--accent-hi)")}>
                Open store connections →
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
