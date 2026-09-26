"use client";

import { useState } from "react";
import { s } from "@/lib/onstage/css";
import { Async, Shimmer } from "@/components/onstage/Async";
import { getBackend } from "@/lib/data/backend";
import { useQuery } from "@/lib/data/useQuery";
import type { MemberRole } from "@/lib/data/types";
import { IcoAlert, IcoClose } from "@/components/onstage/icons";

const ROLES: MemberRole[] = ["Editor", "Reviewer"];

export function TeamPanel() {
  const members = useQuery("members", () => getBackend().listMembers());
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>("Editor");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const seatsUsed = (members.data ?? []).filter((m) => m.role !== "—").length;

  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await getBackend().inviteMember(email.trim(), role);
    setBusy(false);
    if (res.ok) {
      setEmail("");
      setOpen(false);
      members.refetch();
    } else setError(res.message);
  };

  const changeRole = async (id: string, next: MemberRole) => {
    await getBackend().setMemberRole(id, next);
    members.refetch();
  };

  return (
    <div>
      <div style={s("display:flex;align-items:flex-end;justify-content:space-between;gap:16px")}>
        <div>
          <h1 style={s("margin:0;font-size:24px;font-weight:500;letter-spacing:-.025em")}>Team</h1>
          <p style={s("margin:8px 0 0;font-size:13.5px;color:var(--muted)")}>
            {seatsUsed} of 5 seats used on Studio
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="hov-accent"
          style={s(
            "height:34px;padding:0 14px;border:1px solid var(--accent);border-radius:8px;background:transparent;color:var(--accent);font-size:13px;font-weight:500;cursor:pointer",
          )}
        >
          Invite by email
        </button>
      </div>

      {open && (
        <form
          onSubmit={invite}
          noValidate
          style={s(
            "margin-top:14px;padding:14px;border:1px solid rgba(var(--accent-rgb),.32);border-radius:14px;background:var(--surface)",
          )}
        >
          <div style={s("display:flex;align-items:center;gap:9px")}>
            <span style={s("font-size:13.5px;font-weight:500;flex:1")}>Invite a teammate</span>
            <button
              type="button"
              aria-label="Close"
              onClick={() => setOpen(false)}
              style={s(
                "display:grid;place-items:center;width:24px;height:24px;border:none;border-radius:5px;background:transparent;color:var(--muted-2);cursor:pointer",
              )}
            >
              <IcoClose size={13} />
            </button>
          </div>
          <div style={s("display:flex;gap:8px;margin-top:11px")}>
            <input
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError(null);
              }}
              placeholder="teammate@studio.com"
              aria-label="Email address"
              style={s(
                `flex:1;height:36px;padding:0 11px;border:1px solid ${
                  error ? "rgba(var(--warn-rgb),.5)" : "rgba(var(--ink-rgb),.16)"
                };border-radius:8px;background:var(--bg);color:var(--text);font:400 13.5px 'Inter',sans-serif;outline:none`,
              )}
            />
            <div
              style={s(
                "display:flex;gap:2px;padding:2px;border:1px solid rgba(var(--ink-rgb),.12);border-radius:8px",
              )}
            >
              {ROLES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  style={s(
                    `padding:0 11px;height:32px;border:none;border-radius:6px;background:${
                      role === r ? "rgba(var(--accent-rgb),.14)" : "transparent"
                    };color:${
                      role === r ? "var(--accent-hi)" : "var(--muted-2)"
                    };font-size:12.5px;cursor:pointer`,
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
            <button
              type="submit"
              disabled={busy || !email.trim()}
              style={s(
                `height:36px;padding:0 14px;border:none;border-radius:8px;background:var(--accent);color:var(--on-accent);font-size:13px;font-weight:600;cursor:pointer;opacity:${
                  email.trim() ? 1 : 0.5
                }`,
              )}
            >
              {busy ? "Sending…" : "Send invite"}
            </button>
          </div>
          {error && (
            <div
              style={s(
                "display:flex;align-items:center;gap:7px;margin-top:9px;font-size:12.5px;color:var(--warn)",
              )}
            >
              <IcoAlert size={13} w={2} style={s("flex:none")} />
              {error}
            </div>
          )}
        </form>
      )}

      <div
        style={s(
          "margin-top:16px;border:1px solid rgba(var(--ink-rgb),.09);border-radius:14px;overflow:hidden;background:var(--surface)",
        )}
      >
        <Async query={members} skeleton={<Shimmer style="height:200px;border-radius:0" />}>
          {(rows) =>
            rows.map((m, i) => (
              <div
                key={m.id}
                style={s(
                  `display:flex;align-items:center;gap:13px;padding:12px 16px;border-bottom:${
                    i < rows.length - 1 ? "1px solid rgba(var(--ink-rgb),.06)" : "none"
                  };opacity:${m.tint ? 1 : 0.55}`,
                )}
              >
                <span
                  style={s(
                    `display:grid;place-items:center;width:30px;height:30px;border-radius:50%;background:${
                      m.tint || "transparent"
                    };border:${
                      m.tint ? "none" : "1px dashed rgba(var(--ink-rgb),.22)"
                    };color:${m.tint ? "#fff" : "var(--muted-2)"};font-size:11px;font-weight:600`,
                  )}
                >
                  {m.tint
                    ? m.name
                        .split(" ")
                        .map((w) => w[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()
                    : "+"}
                </span>
                <div style={s("flex:1;min-width:0")}>
                  <div style={s("font-size:13.5px;font-weight:500")}>{m.name}</div>
                  <div style={s("margin-top:2px;font-size:12px;color:var(--muted-2)")}>
                    {m.email}
                  </div>
                </div>
                {m.role === "Owner" || m.role === "—" ? (
                  <span
                    style={s(
                      `width:88px;text-align:center;padding:3px 8px;border-radius:6px;font-size:11.5px;background:${
                        m.role === "Owner"
                          ? "rgba(var(--accent-rgb),.12)"
                          : "rgba(var(--ink-rgb),.05)"
                      };color:${m.role === "Owner" ? "var(--accent-hi)" : "var(--muted)"}`,
                    )}
                  >
                    {m.role}
                  </span>
                ) : (
                  <select
                    value={m.role}
                    aria-label={`Role for ${m.name}`}
                    onChange={(e) => void changeRole(m.id, e.target.value as MemberRole)}
                    style={s(
                      "width:88px;text-align:center;padding:3px 8px;border-radius:6px;border:1px solid rgba(var(--ink-rgb),.12);background:rgba(var(--ink-rgb),.05);color:var(--muted);font:400 11.5px 'Inter',sans-serif;cursor:pointer",
                    )}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                )}
                <span style={s("width:96px;text-align:right;font-size:12px;color:var(--muted-3)")}>
                  {m.lastSeen}
                </span>
              </div>
            ))
          }
        </Async>
      </div>
    </div>
  );
}
