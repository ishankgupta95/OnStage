"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { s } from "@/lib/onstage/css";
import { getBackend } from "@/lib/data/backend";
import { BrandMark } from "../chrome";
import { IcoAlert } from "../icons";

const PROVIDERS = [
  { id: "apple" as const, label: "Continue with Apple", tint: "var(--text)" },
  { id: "google" as const, label: "Continue with Google", tint: "#c9542f" },
];

export function AuthScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<null | "email" | "apple" | "google">(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy("email");
    setError(null);
    const result = await getBackend().signInWithEmail(email.trim());
    setBusy(null);
    if (result.sent) setSent(true);
    else setError(result.message);
  };

  const withProvider = async (id: "apple" | "google") => {
    if (busy) return;
    setBusy(id);
    setError(null);
    const result = await getBackend().signInWithProvider(id);
    if (result) router.push(result.redirectTo);
    else {
      setBusy(null);
      setError("That provider isn't available right now.");
    }
  };

  return (
    <div
      style={s(
        "min-height:var(--screen-h,100vh);background:var(--bg);color:var(--text);display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr)",
      )}
    >
      <div
        style={s(
          "display:flex;flex-direction:column;justify-content:center;padding:48px 56px;max-width:520px;margin-left:auto;width:100%",
        )}
      >
        <div style={s("display:flex;align-items:center;gap:9px")}>
          <BrandMark font={16} weight={500} />
        </div>

        {sent ? (
          <>
            <h1
              style={s(
                "margin:34px 0 0;font-size:32px;line-height:1.08;letter-spacing:-.03em;font-weight:500",
              )}
            >
              Check your inbox
            </h1>
            <p style={s("margin:10px 0 0;font-size:14.5px;line-height:1.6;color:var(--muted)")}>
              We sent a link to <span style={s("color:var(--text)")}>{email}</span>. It signs you in
              for 30 days — no password to forget.
            </p>
            <div style={s("display:flex;gap:10px;margin-top:26px")}>
              <button
                type="button"
                onClick={() => {
                  setSent(false);
                  setError(null);
                }}
                className="hov-ink"
                style={s(
                  "height:42px;padding:0 16px;border:1px solid rgba(var(--ink-rgb),.16);border-radius:8px;background:transparent;color:var(--text);font-size:14px;cursor:pointer",
                )}
              >
                Use a different email
              </button>
              <button
                type="button"
                onClick={() => router.push("/dashboard")}
                className="hov-accent"
                style={s(
                  "height:42px;padding:0 16px;border:1px solid var(--accent);border-radius:8px;background:transparent;color:var(--accent);font-size:14px;font-weight:500;cursor:pointer",
                )}
              >
                I&apos;ve got the link
              </button>
            </div>
          </>
        ) : (
          <>
            <h1
              style={s(
                "margin:34px 0 0;font-size:32px;line-height:1.08;letter-spacing:-.03em;font-weight:500",
              )}
            >
              Sign in
            </h1>
            <p style={s("margin:10px 0 0;font-size:14.5px;line-height:1.6;color:var(--muted)")}>
              Your sets, brand kits and store connections stay attached to this account.
            </p>

            <div style={s("display:flex;flex-direction:column;gap:9px;margin-top:26px")}>
              {PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void withProvider(p.id)}
                  className="hov-ink"
                  style={s(
                    `display:flex;align-items:center;justify-content:center;gap:10px;height:42px;border:1px solid rgba(var(--ink-rgb),.16);border-radius:8px;background:transparent;color:var(--text);font-size:14px;font-weight:500;cursor:${
                      busy ? "progress" : "pointer"
                    };opacity:${busy && busy !== p.id ? 0.5 : 1}`,
                  )}
                >
                  <span style={s(`width:16px;height:16px;border-radius:4px;background:${p.tint}`)} />
                  {busy === p.id ? "Opening…" : p.label}
                </button>
              ))}
            </div>

            <div style={s("display:flex;align-items:center;gap:12px;margin:22px 0")}>
              <span
                style={s(
                  "flex:1;height:1px;background:linear-gradient(to right,transparent,rgba(var(--ink-rgb),.16) 20px,rgba(var(--ink-rgb),.16) 100%)",
                )}
              />
              <span style={s("font-size:11px;letter-spacing:.09em;color:var(--muted-3)")}>
                OR EMAIL
              </span>
              <span
                style={s(
                  "flex:1;height:1px;background:linear-gradient(to left,transparent,rgba(var(--ink-rgb),.16) 20px,rgba(var(--ink-rgb),.16) 100%)",
                )}
              />
            </div>

            {/* noValidate: the browser's own bubble is off-brand, and the
                backend is the real authority on what it will accept. */}
            <form
              onSubmit={submitEmail}
              noValidate
              style={s("display:flex;flex-direction:column;gap:8px")}
            >
              <label htmlFor="work-email" style={s("font-size:12px;color:var(--muted)")}>
                Work email
              </label>
              <input
                id="work-email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError(null);
                }}
                placeholder="you@studio.com"
                autoComplete="email"
                style={s(
                  `width:100%;height:40px;padding:0 11px;border:1px solid ${
                    error ? "rgba(var(--warn-rgb),.5)" : "rgba(var(--ink-rgb),.16)"
                  };border-radius:8px;background:var(--surface-2);color:var(--text);font:400 14px 'Inter',sans-serif;outline:none`,
                )}
              />
              {error && (
                <div
                  style={s(
                    "display:flex;align-items:center;gap:7px;font-size:12.5px;color:var(--warn)",
                  )}
                >
                  <IcoAlert size={13} w={2} style={s("flex:none")} />
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={busy !== null || email.trim() === ""}
                className="hov-accent"
                style={s(
                  `margin-top:6px;height:42px;border:1px solid var(--accent);border-radius:8px;background:transparent;color:var(--accent);font-size:14px;font-weight:500;cursor:${
                    busy ? "progress" : "pointer"
                  };opacity:${email.trim() === "" ? 0.55 : 1}`,
                )}
              >
                {busy === "email" ? "Sending…" : "Send me a link"}
              </button>
            </form>

            <div style={s("margin-top:18px;font-size:12.5px;color:var(--muted-3)")}>
              No password to forget. The link signs you in for 30 days.
            </div>
          </>
        )}
      </div>

      <div
        style={s(
          "position:relative;overflow:hidden;background:var(--surface-2);border-left:1px solid rgba(var(--ink-rgb),.08);display:grid;place-items:center",
        )}
      >
        <div
          style={s(
            "position:absolute;inset:0;background:radial-gradient(70% 60% at 60% 40%, rgba(var(--accent-rgb),.16), transparent 70%)",
          )}
        />
        <div style={s("position:relative;display:flex;gap:14px;align-items:center")}>
          <div
            style={s(
              "width:130px;height:266px;border-radius:12px;background:linear-gradient(160deg,#1f2b4d,#0e1424);animation:onst-float 8s ease-in-out infinite",
            )}
          />
          <div
            style={s(
              "width:150px;height:306px;border-radius:13px;background:linear-gradient(150deg,#ff6b53,#c9315f 62%,#6d1a4a)",
            )}
          />
          <div
            style={s(
              "width:130px;height:266px;border-radius:12px;background:linear-gradient(155deg,#1b6f6a,#0f3a3d);animation:onst-float 9s ease-in-out .7s infinite",
            )}
          />
        </div>
        <div
          style={s(
            "position:absolute;bottom:34px;left:34px;right:34px;font-size:13px;line-height:1.6;color:var(--muted)",
          )}
        >
          2,100 indie developers shipped a set this month. The median first set took 11 minutes.
        </div>
      </div>
    </div>
  );
}
