"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { s } from "@/lib/onstage/css";
import { FEATURES } from "@/lib/features";
import { BrandMark } from "../chrome";
import { ROUTE_CARD, ROUTE_ICON, START_ROUTES } from "./OnboardingScreen";

/** No sets yet — the same three routes as onboarding, in a quieter frame. */
export function EmptyScreen() {
  const router = useRouter();
  return (
    <div
      style={s(
        "min-height:var(--screen-h,100vh);background:var(--bg);color:var(--text);display:flex;flex-direction:column",
      )}
    >
      <div
        style={s(
          "display:flex;align-items:center;gap:16px;padding:13px 28px;border-bottom:1px solid rgba(var(--ink-rgb),.07);background:var(--chrome)",
        )}
      >
        <Link href="/" style={s("display:flex;align-items:center;gap:9px;cursor:pointer;color:var(--text)")}>
          <BrandMark font={15} weight={500} />
        </Link>
        {/* Hardcoded initials rather than a session read, so no session flag
            reaches them — gate the chip itself. */}
        {FEATURES.accounts && (
          <span
            style={s(
              "margin-left:auto;display:grid;place-items:center;width:28px;height:28px;border-radius:50%;background:var(--surface-3);font-size:11.5px;font-weight:600",
            )}
          >
            MK
          </span>
        )}
      </div>

      <div style={s("flex:1;display:grid;place-items:center;padding:40px 28px 70px")}>
        <div style={s("width:100%;max-width:760px;text-align:center")}>
          <div style={s("display:flex;justify-content:center;gap:14px;perspective:900px")}>
            <div
              style={s(
                "width:78px;height:158px;border-radius:11px;border:1.5px dashed rgba(var(--ink-rgb),.18);transform:rotateY(18deg)",
              )}
            />
            <div
              style={s(
                "width:88px;height:178px;border-radius:12px;border:1.5px dashed rgba(var(--accent-rgb),.55);background:rgba(var(--accent-rgb),.05)",
              )}
            />
            <div
              style={s(
                "width:78px;height:158px;border-radius:11px;border:1.5px dashed rgba(var(--ink-rgb),.18);transform:rotateY(-18deg)",
              )}
            />
          </div>
          <h1 style={s("margin:30px 0 0;font-size:28px;font-weight:500;letter-spacing:-.028em")}>
            No sets yet
          </h1>
          <p
            style={s(
              "margin:10px auto 0;max-width:52ch;font-size:14.5px;line-height:1.6;color:var(--muted)",
            )}
          >
            A set is one app, one store size, and the frames inside it. Start from your live listing,
            your own screens, or a template.
          </p>
          <div
            style={s(
              "display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:26px;text-align:left",
            )}
          >
            {START_ROUTES.map((r) => (
              <div
                key={r.id}
                className="hov-accent-border"
                onClick={() => (r.id === "template" ? router.push("/templates") : router.push("/onboarding"))}
                style={s(ROUTE_CARD)}
              >
                <span style={s(ROUTE_ICON)}>
                  <r.Icon size={19} />
                </span>
                <div style={s("margin-top:12px;font-size:14px;font-weight:500;letter-spacing:-.015em")}>
                  {r.title}
                </div>
                <div style={s("margin-top:6px;font-size:12.5px;line-height:1.5;color:var(--muted-2)")}>
                  {r.body}
                </div>
              </div>
            ))}
          </div>
          <div style={s("margin-top:20px;font-size:12.5px;color:var(--muted-3)")}>
            Or{" "}
            <Link href="/editor" style={s("color:var(--accent-hi);cursor:pointer")}>
              open the sample set
            </Link>{" "}
            to look around first.
          </div>
        </div>
      </div>
    </div>
  );
}
