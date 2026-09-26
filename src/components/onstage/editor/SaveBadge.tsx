"use client";

import { s } from "@/lib/onstage/css";
import { useOnstage } from "@/store/onstage";

/**
 * The top bar's status pill. The design shows it green and reading SAVED —
 * which is only honest if it also reports the other two states, and says why
 * a save failed (DATA-5). A long reason is cut short here; the tooltip holds
 * all of it.
 */
export function SaveBadge() {
  const state = useOnstage((st) => st.saveState);
  const reason = useOnstage((st) => st.saveError);
  const failed = state === "error";
  const [tint, label] =
    state === "saving"
      ? ["var(--muted-2)", "SAVING…"]
      : failed
        ? ["var(--warn)", "Couldn't save"]
        : ["var(--ok)", "SAVED"];
  const full = failed && reason ? `${label} — ${reason}` : label;

  // In a tight top bar the reason is cut first (the badge shrinks before the
  // title, down to the width of "Couldn't save"), then the set title. The
  // words themselves always stay, and `position` keeps them above a
  // neighbour if the bar is narrower still.
  return (
    <span
      title={failed ? full : undefined}
      style={s(
        `display:inline-flex;align-items:center;gap:5px;padding:2px 7px;border-radius:4px;background:rgba(var(--ink-rgb),.05);font:400 10px/1.4 'Inter',ui-sans-serif;color:var(--muted-2);letter-spacing:.04em;position:relative;flex-shrink:10;min-width:${failed ? "96px" : "auto"};max-width:420px`,
      )}
    >
      <span style={s(`flex:none;width:5px;height:5px;border-radius:50%;background:${tint}`)} />
      <span style={s(`flex:none;white-space:nowrap${failed ? ";color:var(--warn)" : ""}`)}>{label}</span>
      {failed && reason && (
        <span style={s("min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;color:var(--warn)")}>
          {` — ${reason}`}
        </span>
      )}
    </span>
  );
}
