"use client";

import { useRouter } from "next/navigation";
import { s } from "@/lib/onstage/css";
import { getBackend } from "@/lib/data/backend";
import { useSession } from "@/lib/data/useSession";
import { PANEL } from "./styles";

/**
 * Avatar, name, email and Sign out — the only part of the Account tab that
 * needs an account. Its own module so the parent can mount it behind
 * `FEATURES.accounts` without calling useSession() when accounts are off; the
 * rest of the tab (work mode, preferences) belongs in a login-free build.
 */
export function AccountIdentityCard() {
  const router = useRouter();
  const session = useSession();

  // An explicit guard, not `?? "··"`: a null session is a real state here, and
  // the placeholder version renders a "··" avatar beside a dangling
  // " · joined Nov 2025".
  if (!session.data) return null;

  return (
    <div style={s(`margin-top:18px;${PANEL}`)}>
      <div style={s("display:flex;align-items:center;gap:14px")}>
        <span
          style={s(
            "display:grid;place-items:center;width:46px;height:46px;border-radius:50%;background:#5d5294;color:#fff;font-size:15px;font-weight:600",
          )}
        >
          {session.data.initials}
        </span>
        <div style={s("flex:1;min-width:0")}>
          <div style={s("font-size:15px;font-weight:500")}>{session.data.name}</div>
          <div style={s("margin-top:2px;font-size:13px;color:var(--muted)")}>
            {session.data.email} · joined Nov 2025
          </div>
        </div>
        <button
          type="button"
          onClick={async () => {
            await getBackend().signOut();
            router.push("/signin");
          }}
          className="hov-ink"
          style={s(
            "height:30px;padding:0 12px;border:1px solid rgba(var(--ink-rgb),.16);border-radius:8px;background:transparent;color:var(--text);font-size:12.5px;cursor:pointer",
          )}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
