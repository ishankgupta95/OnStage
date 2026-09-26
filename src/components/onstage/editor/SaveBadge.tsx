"use client";

import { s } from "@/lib/onstage/css";
import { useOnstage } from "@/store/onstage";

/**
 * The top bar's status pill. The design shows it green and reading SAVED —
 * which is only honest if it also reports the other two states.
 */
export function SaveBadge() {
  const state = useOnstage((st) => st.saveState);
  const reason = useOnstage((st) => st.saveError);
  const [tint, label] =
    state === "saving"
      ? ["var(--muted-2)", "SAVING…"]
      : state === "error"
        ? ["var(--warn)", "NOT SAVED"]
        : ["var(--ok)", "SAVED"];

  return (
    <span
      title={state === "error" ? (reason ?? undefined) : undefined}
      style={s(
        "display:inline-flex;align-items:center;gap:5px;padding:2px 7px;border-radius:4px;background:rgba(var(--ink-rgb),.05);font:400 10px/1.4 'Inter',ui-sans-serif;color:var(--muted-2);letter-spacing:.04em",
      )}
    >
      <span style={s(`width:5px;height:5px;border-radius:50%;background:${tint}`)} />
      {label}
    </span>
  );
}
