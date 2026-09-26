"use client";

import Link from "next/link";
import { s } from "@/lib/onstage/css";
import { IcoAlert } from "@/components/onstage/icons";

/**
 * Shared fallback for route-segment error boundaries, in the same language as
 * the 404 and empty screens: a quiet card, a kicker, two ways out.
 */
export default function ErrorState({
  error,
  reset,
  unstable_retry,
  title = "Something went wrong",
  description = "An unexpected error interrupted this page. Your work is saved as of the last autosave — try again, and if it keeps happening, reload the page.",
  homeHref,
  homeLabel,
  fullScreen = false,
}: {
  error: Error & { digest?: string };
  reset?: () => void;
  unstable_retry?: () => void;
  title?: string;
  description?: string;
  homeHref?: string;
  homeLabel?: string;
  fullScreen?: boolean;
}) {
  const retry = unstable_retry ?? reset;

  return (
    <div
      style={s(
        `display:grid;place-items:center;padding:0 28px;background:var(--bg);color:var(--text);${
          fullScreen ? "height:100vh" : "min-height:60vh;padding-top:64px;padding-bottom:64px"
        }`,
      )}
    >
      <div style={s("max-width:560px;text-align:center")}>
        <span
          style={s(
            "display:grid;place-items:center;width:44px;height:44px;margin:0 auto;border-radius:12px;background:rgba(var(--warn-rgb),.14);color:var(--warn)",
          )}
        >
          <IcoAlert size={22} w={2} />
        </span>
        <h1 style={s("margin:22px 0 0;font-size:24px;font-weight:500;letter-spacing:-.028em")}>
          {title}
        </h1>
        <p
          style={s(
            "margin:10px auto 0;max-width:46ch;font-size:14.5px;line-height:1.6;color:var(--muted)",
          )}
        >
          {description}
        </p>
        {error.digest ? (
          <p style={s("margin-top:12px;font-size:11px;letter-spacing:.14em;color:var(--muted-3)")}>
            REF {error.digest}
          </p>
        ) : null}
        <div style={s("display:flex;justify-content:center;gap:10px;margin-top:24px")}>
          {retry ? (
            <button
              type="button"
              onClick={retry}
              className="hov-accent"
              style={s(
                "height:40px;padding:0 16px;border:1px solid var(--accent);border-radius:8px;background:transparent;color:var(--accent);font-size:14px;font-weight:500;cursor:pointer",
              )}
            >
              Try again
            </button>
          ) : null}
          {homeHref ? (
            <Link
              href={homeHref}
              className="hov-ink"
              style={s(
                "display:inline-flex;align-items:center;height:40px;padding:0 16px;border:1px solid rgba(var(--ink-rgb),.16);border-radius:8px;background:transparent;color:var(--text);font-size:14px",
              )}
            >
              {homeLabel ?? "Back to home"}
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
