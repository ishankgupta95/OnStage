"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { s } from "@/lib/onstage/css";
import { getBackend } from "@/lib/data/backend";
import { BrandMark } from "../chrome";
import { IcoAlert } from "../icons";

/**
 * Where the magic link and the OAuth providers come back to.
 *
 * SUPABASE SEAM: this is the page that should call
 * `supabase.auth.exchangeCodeForSession(code)` (or `getSessionFromUrl`) before
 * routing on. Today it just confirms a session exists and continues, so the
 * redirect URLs can already be registered with the provider.
 */
export function AuthCallback() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(params.get("error_description"));

  const next = params.get("next") ?? "/dashboard";

  useEffect(() => {
    if (error) return;
    let alive = true;
    getBackend()
      .getSession()
      .then((session) => {
        if (!alive) return;
        if (session) router.replace(next);
        else setError("That link has expired. Ask for a new one.");
      })
      .catch(() => alive && setError("We couldn't complete the sign-in."));
    return () => {
      alive = false;
    };
  }, [router, next, error]);

  return (
    <div
      style={s(
        "min-height:100vh;background:var(--bg);color:var(--text);display:flex;flex-direction:column",
      )}
    >
      <div style={s("display:flex;align-items:center;gap:9px;padding:16px 28px")}>
        <BrandMark font={15} weight={500} />
      </div>
      <div style={s("flex:1;display:grid;place-items:center;padding:0 28px 60px")}>
        <div style={s("max-width:420px;text-align:center")}>
          {error ? (
            <>
              <span
                style={s(
                  "display:grid;place-items:center;width:44px;height:44px;margin:0 auto;border-radius:12px;background:rgba(var(--warn-rgb),.14);color:var(--warn)",
                )}
              >
                <IcoAlert size={22} w={2} />
              </span>
              <h1
                style={s("margin:22px 0 0;font-size:24px;font-weight:500;letter-spacing:-.028em")}
              >
                Couldn&apos;t sign you in
              </h1>
              <p
                style={s(
                  "margin:10px auto 0;max-width:40ch;font-size:14.5px;line-height:1.6;color:var(--muted)",
                )}
              >
                {error}
              </p>
              <button
                type="button"
                onClick={() => router.push("/signin")}
                className="hov-accent"
                style={s(
                  "margin-top:22px;height:40px;padding:0 16px;border:1px solid var(--accent);border-radius:8px;background:transparent;color:var(--accent);font-size:14px;font-weight:500;cursor:pointer",
                )}
              >
                Back to sign in
              </button>
            </>
          ) : (
            <>
              <div
                style={s(
                  "width:34px;height:34px;margin:0 auto;border-radius:50%;border:2px solid rgba(var(--ink-rgb),.12);border-top-color:var(--accent);animation:onst-spin .8s linear infinite",
                )}
              />
              <div style={s("margin-top:20px;font-size:14.5px;color:var(--muted)")}>
                Signing you in…
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
