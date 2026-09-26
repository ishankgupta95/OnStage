"use client";

import type { ReactNode } from "react";
import { s } from "@/lib/onstage/css";
import type { ScreenshotSet } from "@/lib/data/types";
import { useNow } from "@/lib/onstage/useNow";
import { formatUpdated } from "@/lib/onstage/when";

export const statusTint = (status: string) =>
  status === "Ready"
    ? ["rgba(var(--ok-rgb),.12)", "var(--ok)"]
    : status === "Missing size"
      ? ["rgba(var(--warn-rgb),.12)", "#f5b544"]
      : status === "Uploaded"
        ? ["rgba(var(--accent-rgb),.12)", "var(--accent-hi)"]
        : ["rgba(var(--ink-rgb),.05)", "var(--muted)"];

/**
 * One set in a list — the dashboard's "Recent sets" row, shared with the
 * project board's Sets tab, which adds its own actions and a selected state.
 */
export function SetRow({
  set,
  index,
  last,
  selected = false,
  onClick,
  name,
  actions,
  below,
}: {
  set: ScreenshotSet;
  index: number;
  last: boolean;
  selected?: boolean;
  onClick?: () => void;
  /** Replaces the name line (the project board's inline rename). */
  name?: ReactNode;
  /** Buttons at the end of the row. */
  actions?: ReactNode;
  /** A panel under the row (the project board's delete confirmation). */
  below?: ReactNode;
}) {
  const [bg, fg] = statusTint(set.status);
  const now = useNow();
  return (
    <div
      style={s(
        `background:${
          selected ? "rgba(var(--accent-rgb),.08)" : index % 2 ? "rgba(var(--ink-rgb),.014)" : "transparent"
        };border-bottom:${last ? "none" : "1px solid rgba(var(--ink-rgb),.06)"}`,
      )}
    >
      <div
        onClick={onClick}
        style={s(`display:flex;align-items:center;gap:14px;padding:11px 14px;cursor:${onClick ? "pointer" : "default"}`)}
      >
        <div style={s(`flex:none;width:30px;height:38px;border-radius:4px;background:${set.swatch}`)} />
        <div style={s("min-width:0;flex:1")}>
          {name ?? (
            <div
              style={s("font-size:13.5px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}
            >
              {set.name}
            </div>
          )}
          <div style={s("margin-top:2px;font-size:12px;color:var(--muted-3)")}>{set.sub}</div>
        </div>
        <span style={s("font:400 11px 'Inter',ui-sans-serif;color:var(--muted-4);white-space:nowrap")}>
          {set.frameCount} FRAMES
        </span>
        <span
          style={s(
            `width:106px;text-align:center;padding:3px 8px;border-radius:4px;font-size:11.5px;font-weight:500;background:${bg};color:${fg}`,
          )}
        >
          {set.status}
        </span>
        <span style={s("font-size:12px;color:var(--muted-4);width:76px;text-align:right")}>
          {formatUpdated(set.updatedAt, now)}
        </span>
        {actions}
      </div>
      {below}
    </div>
  );
}
