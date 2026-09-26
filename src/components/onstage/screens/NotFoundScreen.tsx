"use client";

import Link from "next/link";
import { s } from "@/lib/onstage/css";
import { BrandMark } from "../chrome";

export function NotFoundScreen() {
  return (
    <div
      style={s(
        "min-height:var(--screen-h,100vh);background:var(--bg);color:var(--text);display:flex;flex-direction:column",
      )}
    >
      <div style={s("display:flex;align-items:center;gap:9px;padding:16px 28px")}>
        <Link href="/" style={s("display:flex;align-items:center;gap:9px;cursor:pointer;color:var(--text)")}>
          <BrandMark font={15} weight={500} />
        </Link>
      </div>
      <div style={s("flex:1;display:grid;place-items:center;padding:0 28px 60px")}>
        <div style={s("max-width:560px;text-align:center")}>
          <div style={s("display:grid;place-items:center;perspective:800px")}>
            <div
              style={s(
                "position:relative;width:104px;height:210px;border-radius:14px;border:1.5px dashed rgba(var(--ink-rgb),.2);transform:rotateY(-16deg) rotateX(6deg);display:grid;place-items:center",
              )}
            >
              <span style={s("font-size:13px;letter-spacing:.1em;color:var(--muted-4)")}>EMPTY</span>
            </div>
          </div>
          <div style={s("margin-top:28px;font-size:12px;letter-spacing:.14em;color:var(--muted-3)")}>
            404
          </div>
          <h1 style={s("margin:12px 0 0;font-size:28px;font-weight:500;letter-spacing:-.028em")}>
            This set isn&apos;t here
          </h1>
          <p
            style={s(
              "margin:10px auto 0;max-width:46ch;font-size:14.5px;line-height:1.6;color:var(--muted)",
            )}
          >
            It was deleted, or the link points at something Onstage doesn&apos;t have. Sets live in
            this browser — try the one you were working on.
          </p>
          <div style={s("display:flex;justify-content:center;gap:10px;margin-top:24px")}>
            <Link
              href="/dashboard"
              className="hov-accent"
              style={s(
                "display:inline-flex;align-items:center;height:40px;padding:0 16px;border:1px solid var(--accent);border-radius:8px;background:transparent;color:var(--accent);font-size:14px;font-weight:500",
              )}
            >
              Back to your apps
            </Link>
            <Link
              href="/settings"
              style={s(
                "display:inline-flex;align-items:center;height:40px;padding:0 16px;border:1px solid rgba(var(--ink-rgb),.16);border-radius:8px;background:transparent;color:var(--text);font-size:14px",
              )}
            >
              Open settings
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
