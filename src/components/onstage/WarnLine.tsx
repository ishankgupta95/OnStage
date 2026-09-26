"use client";

import { s } from "@/lib/onstage/css";
import { IcoAlert } from "./icons";

/** An inline "why that didn't work" line — the same warn line the store-URL
 *  field, the drop target and the brand kit field show. */
export function WarnLine({ children, style = "" }: { children: React.ReactNode; style?: string }) {
  return (
    <div
      role="alert"
      style={s(`display:flex;align-items:center;gap:7px;font-size:12.5px;color:var(--warn);${style}`)}
    >
      <IcoAlert size={13} w={2} style={s("flex:none")} />
      {children}
    </div>
  );
}
