"use client";

import Link from "next/link";
import { s } from "@/lib/onstage/css";
import { Async, Shimmer } from "@/components/onstage/Async";
import { getBackend } from "@/lib/data/backend";
import { useQuery } from "@/lib/data/useQuery";
import { JobRow } from "@/components/onstage/JobRow";

/** Everything this project has rendered or pushed to a store. */
export function UploadsTab({ appId }: { appId: string }) {
  const jobs = useQuery(`jobs:${appId}`, () => getBackend().listJobs(appId));

  return (
    <div>
      <div style={s("display:flex;align-items:flex-end;justify-content:space-between;gap:16px")}>
        <div>
          <h2 style={s("margin:0;font-size:19px;font-weight:500;letter-spacing:-.022em")}>
            Renders &amp; uploads
          </h2>
          <p style={s("margin:7px 0 0;font-size:13.5px;color:var(--muted-2)")}>
            Partial results are always kept — a failed upload never loses the files it rendered.
          </p>
        </div>
        <Link
          href="/queue"
          className="hov-ink"
          style={s(
            "flex:none;display:inline-flex;align-items:center;height:34px;padding:0 13px;border:1px solid rgba(var(--ink-rgb),.14);border-radius:8px;background:transparent;color:var(--text);font-size:13px;font-weight:500",
          )}
        >
          All activity →
        </Link>
      </div>

      <div style={s("margin-top:14px;display:flex;flex-direction:column;gap:11px")}>
        <Async
          query={jobs}
          skeleton={
            <>
              {[0, 1, 2].map((i) => (
                <Shimmer key={i} style="height:74px;border-radius:14px" />
              ))}
            </>
          }
        >
          {(rows) =>
            rows.length ? (
              rows.map((j) => <JobRow key={j.id} job={j} />)
            ) : (
              <div
                style={s(
                  "padding:40px;text-align:center;border:1px dashed rgba(var(--ink-rgb),.14);border-radius:14px",
                )}
              >
                <div style={s("font-size:14px;font-weight:500")}>Nothing rendered yet</div>
                <div style={s("margin-top:6px;font-size:12.5px;color:var(--muted-2)")}>
                  Export the set and it shows up here.
                </div>
              </div>
            )
          }
        </Async>
      </div>
    </div>
  );
}
