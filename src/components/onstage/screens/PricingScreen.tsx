"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { s } from "@/lib/onstage/css";
import { BrandMark } from "../chrome";
import { TEMPLATE_COUNT } from "@/lib/onstage/data";

const PLANS = [
  {
    name: "Free",
    price: "$0",
    per: "",
    sub: "For trying it out",
    tag: "",
    cta: "Current plan",
    hot: false,
    href: "/dashboard",
    feats: [
      "Unlimited canvases",
      `All ${TEMPLATE_COUNT} templates`,
      "5 exports total",
      "Watermark-free previews",
      "1 locale",
    ],
  },
  {
    name: "Indie",
    price: "$12",
    per: "/month",
    sub: "Billed monthly, cancel anytime",
    tag: "MOST PICKED",
    cta: "Start 14-day trial",
    hot: true,
    href: "/onboarding",
    feats: [
      "Unlimited exports, all sizes",
      "AI captions in 30 languages",
      "Direct upload to both stores",
      "Brand kits and saved presets",
      "A/B variants per set",
    ],
  },
  {
    name: "Studio",
    price: "$29",
    per: "/month",
    sub: "Up to 5 seats",
    tag: "",
    cta: "Talk to us",
    hot: false,
    href: "/onboarding",
    feats: [
      "Everything in Indie",
      "Shared brand kits and comments",
      "Unlimited apps and locales",
      "Figma + Xcode asset import",
      "Priority render queue",
    ],
  },
];

const FAQS = [
  {
    q: "What counts as an export?",
    a: "One set, rendered at every size you ticked, in every locale. Re-exporting the same set after a tweak is free for 24 hours.",
  },
  {
    q: "Do you keep my screenshots?",
    a: "Source screens stay in your project until you delete it. Rendered files are cached for 30 days, then dropped.",
  },
  {
    q: "Can I use my own fonts?",
    a: "Upload a .ttf or .otf on Indie and up. Onstage embeds it in the render, nothing is licensed on your behalf.",
  },
];

export function PricingScreen() {
  const router = useRouter();
  return (
    <div style={s("min-height:var(--screen-h,100vh);background:var(--bg);color:var(--text)")}>
      <div
        style={s(
          "display:flex;align-items:center;gap:26px;padding:14px 34px;border-bottom:1px solid rgba(var(--ink-rgb),.07)",
        )}
      >
        <Link
          href="/"
          style={s("display:flex;align-items:center;gap:9px;margin-right:auto;cursor:pointer;color:var(--text)")}
        >
          <BrandMark font={16} weight={700} />
        </Link>
        <Link href="/templates" style={s("font-size:13.5px;color:var(--muted)")}>
          Templates
        </Link>
        <Link href="/editor" style={s("font-size:13.5px;color:var(--muted)")}>
          Editor
        </Link>
        <Link
          href="/onboarding"
          style={s(
            "display:inline-flex;align-items:center;height:32px;padding:0 14px;border:1px solid var(--accent);border-radius:6px;background:transparent;color:var(--accent);font-size:13px;font-weight:700",
          )}
        >
          Start free
        </Link>
      </div>

      <div style={s("max-width:1100px;margin:0 auto;padding:60px 34px 80px")}>
        <div style={s("text-align:center")}>
          <h1 style={s("margin:0;font-size:44px;line-height:1.05;letter-spacing:-.035em;font-weight:500")}>
            Pay when you ship
          </h1>
          <p
            style={s(
              "margin:13px auto 0;max-width:52ch;font-size:15.5px;line-height:1.6;color:var(--muted)",
            )}
          >
            Build and preview for free. You only pay when you export the files or push them to a
            store.
          </p>
        </div>

        <div
          style={s(
            "display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:38px;align-items:start",
          )}
        >
          {PLANS.map((p) => (
            <div
              key={p.name}
              style={s(
                `padding:20px;border-radius:11px;border:1px solid ${
                  p.hot ? "rgba(var(--accent-rgb),.45)" : "rgba(var(--ink-rgb),.09)"
                };background:${
                  p.hot
                    ? "linear-gradient(180deg,rgba(var(--accent-rgb),.08),var(--surface) 55%)"
                    : "var(--surface)"
                }`,
              )}
            >
              <div style={s("display:flex;align-items:center;justify-content:space-between")}>
                <span style={s("font-size:14.5px;font-weight:700;letter-spacing:-.015em")}>
                  {p.name}
                </span>
                {p.tag ? (
                  <span
                    style={s(
                      "padding:3px 8px;border-radius:4px;background:rgba(var(--accent-rgb),.15);color:var(--accent-hi);font:500 10px 'Inter',ui-sans-serif;letter-spacing:.07em",
                    )}
                  >
                    {p.tag}
                  </span>
                ) : null}
              </div>
              <div style={s("display:flex;align-items:baseline;gap:6px;margin-top:16px")}>
                <span style={s("font-size:38px;font-weight:700;letter-spacing:-.035em")}>
                  {p.price}
                </span>
                <span style={s("font-size:13px;color:var(--muted-2)")}>{p.per}</span>
              </div>
              <div style={s("margin-top:6px;font-size:12.5px;color:var(--muted-2)")}>{p.sub}</div>
              <button
                type="button"
                onClick={() => router.push(p.href)}
                style={s(
                  `width:100%;margin-top:16px;height:38px;border-radius:7px;border:1px solid ${
                    p.hot ? "transparent" : "rgba(var(--ink-rgb),.14)"
                  };background:${p.hot ? "var(--accent)" : "transparent"};color:${
                    p.hot ? "var(--on-accent)" : "var(--text)"
                  };font-size:13.5px;font-weight:${p.hot ? 700 : 500};cursor:pointer`,
                )}
              >
                {p.cta}
              </button>
              <div style={s("height:1px;margin:18px 0 14px;background:rgba(var(--ink-rgb),.08)")} />
              <div style={s("display:flex;flex-direction:column;gap:9px")}>
                {p.feats.map((t) => (
                  <div key={t} style={s("display:flex;gap:9px;align-items:flex-start")}>
                    <span
                      style={s(
                        `flex:none;display:grid;place-items:center;width:15px;height:15px;margin-top:2px;border-radius:4px;background:${
                          p.hot ? "rgba(var(--accent-rgb),.16)" : "rgba(var(--ink-rgb),.06)"
                        };color:${p.hot ? "var(--accent-hi)" : "var(--muted-2)"};font-size:9px;font-weight:700`,
                      )}
                    >
                      ✓
                    </span>
                    <span style={s("font-size:13px;line-height:1.5;color:var(--text-2)")}>{t}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div
          style={s(
            "display:grid;grid-template-columns:repeat(3,1fr);gap:26px;margin-top:46px;padding-top:26px;border-top:1px solid rgba(var(--ink-rgb),.07)",
          )}
        >
          {FAQS.map((f) => (
            <div key={f.q}>
              <div style={s("font-size:13.5px;font-weight:600")}>{f.q}</div>
              <div style={s("margin-top:7px;font-size:13px;line-height:1.6;color:var(--muted-2)")}>
                {f.a}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
