"use client";

import { s } from "@/lib/onstage/css";
import { Async, Shimmer } from "@/components/onstage/Async";
import { JobRow } from "@/components/onstage/JobRow";
import { getBackend } from "@/lib/data/backend";
import { useQuery } from "@/lib/data/useQuery";
import { BackButton } from "../chrome";

export function QueueScreen() {
  const jobs = useQuery("jobs", () => getBackend().listJobs());

  const summary = jobs.data
    ? [
        ["RUNNING", jobs.data.filter((j) => j.state === "running").length],
        ["FAILED", jobs.data.filter((j) => j.state === "failed").length],
        ["DONE", jobs.data.filter((j) => j.state === "done").length],
      ]
        .filter(([, n]) => (n as number) > 0)
        .map(([label, n]) => `${n} ${label}`)
        .join(" · ")
    : "";

  return (
    <div style={s("min-height:var(--screen-h,100vh);background:var(--bg);color:var(--text)")}>
      <div
        style={s(
          "display:flex;align-items:center;gap:14px;padding:13px 28px;border-bottom:1px solid rgba(var(--ink-rgb),.07);background:var(--chrome)",
        )}
      >
        <BackButton href="/dashboard" />
        <span style={s("font-size:14.5px;font-weight:500;letter-spacing:-.015em")}>
          Renders &amp; uploads
        </span>
        <span style={s("font-size:11px;letter-spacing:.09em;color:var(--muted-4)")}>{summary}</span>
      </div>

      <div style={s("max-width:1100px;margin:0 auto;padding:26px 28px 60px")}>
        <div style={s("display:flex;flex-direction:column;gap:11px")}>
          <Async
            query={jobs}
            skeleton={
              <>
                {[0, 1, 2, 3, 4].map((i) => (
                  <Shimmer key={i} style="height:74px;border-radius:14px" />
                ))}
              </>
            }
          >
            {(rows) => rows.map((j) => <JobRow key={j.id} job={j} />)}
          </Async>
        </div>
      </div>
    </div>
  );
}
