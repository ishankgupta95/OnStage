"use client";

import type { ReactNode } from "react";
import { s } from "@/lib/onstage/css";
import type { QueryState } from "@/lib/data/useQuery";
import { IcoAlert } from "./icons";

/** A quiet placeholder block, sized by the caller. */
export function Shimmer({ style }: { style: string }) {
  return (
    <div
      style={s(
        `background:rgba(var(--ink-rgb),.05);border-radius:8px;animation:onst-pulse 1.4s ease-in-out infinite;${style}`,
      )}
    />
  );
}

/**
 * Renders one of the three states a backend read can be in. Keeps every screen
 * from hand-rolling its own loading and failure branches.
 */
export function Async<T>({
  query,
  skeleton,
  children,
}: {
  query: QueryState<T>;
  skeleton: ReactNode;
  children: (data: T) => ReactNode;
}) {
  if (query.error) {
    return (
      <div
        style={s(
          "display:flex;gap:11px;padding:14px;border-radius:10px;border:1px solid rgba(var(--warn-rgb),.28);background:rgba(var(--warn-rgb),.06)",
        )}
      >
        <IcoAlert size={16} w={2} style={s("flex:none;margin-top:1px;color:var(--warn)")} />
        <div style={s("flex:1;min-width:0")}>
          <div style={s("font-size:13px;font-weight:500;color:var(--warn)")}>
            Couldn&apos;t load this
          </div>
          <div style={s("margin-top:4px;font-size:12.5px;line-height:1.55;color:var(--muted)")}>
            {query.error}
          </div>
          <button
            type="button"
            onClick={query.refetch}
            style={s(
              "margin-top:11px;height:28px;padding:0 12px;border-radius:8px;border:1px solid var(--accent);background:transparent;color:var(--accent);font-size:12px;font-weight:500;cursor:pointer",
            )}
          >
            Try again
          </button>
        </div>
      </div>
    );
  }
  if (query.loading || query.data === undefined) return <>{skeleton}</>;
  return <>{children(query.data)}</>;
}
