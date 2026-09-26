"use client";

import { s } from "@/lib/onstage/css";
import { FEATURES } from "@/lib/features";
import { BackButton } from "../chrome";
import { IcoClose, IcoPhone } from "../icons";
import { TEMPLATE_COUNT } from "@/lib/onstage/data";

const PLANS = [
  { name: "Free", price: "$0", tag: "", sub: "All templates, 5 exports total, 1 locale.", cta: "Current plan", hot: false },
  {
    name: "Indie",
    price: "$12",
    tag: "MOST PICKED",
    sub: "Unlimited exports, AI captions, store upload, brand kits.",
    cta: "Start trial",
    hot: true,
  },
  {
    name: "Studio",
    price: "$29",
    tag: "",
    sub: "5 seats, shared kits, comments, unlimited locales.",
    cta: "Talk to us",
    hot: false,
  },
];

// Mirrors the desktop nav, so it drops the same entries: Changelog and Docs
// have no route, and Pricing rides on FEATURES.billing.
const NAV = [
  { label: "Templates", meta: String(TEMPLATE_COUNT) },
  { label: "How it works", meta: "" },
  ...(FEATURES.billing ? [{ label: "Pricing", meta: "from $12" }] : []),
];

const PHONE =
  "width:390px;border:1px solid rgba(var(--ink-rgb),.1);border-radius:20px;overflow:hidden;background:var(--bg)";
const PHONE_BAR =
  "display:flex;align-items:center;gap:9px;padding:13px 16px;border-bottom:1px solid rgba(var(--ink-rgb),.07)";

function MiniBrand({ label = "Onstage" }: { label?: string }) {
  return (
    <>
      <span
        style={s(
          "display:grid;place-items:center;width:24px;height:24px;border-radius:6px;background:var(--accent);color:var(--on-accent)",
        )}
      >
        <IcoPhone size={14} />
      </span>
      <span style={s("font-size:14.5px;font-weight:500;letter-spacing:-.02em")}>{label}</span>
    </>
  );
}

/** The marketing pages at 390px, plus the note about what a phone can't do. */
export function MobileScreen() {
  return (
    <div style={s("min-height:var(--screen-h,100vh);background:var(--bg);color:var(--text)")}>
      <div
        style={s(
          "display:flex;align-items:center;gap:14px;padding:13px 28px;border-bottom:1px solid rgba(var(--ink-rgb),.07);background:var(--chrome)",
        )}
      >
        <BackButton href="/" />
        <span style={s("font-size:14.5px;font-weight:500;letter-spacing:-.015em")}>
          Marketing pages at 390px
        </span>
        <span style={s("font-size:11px;letter-spacing:.09em;color:var(--muted-4)")}>
          {FEATURES.billing ? "HERO · PRICING · NAV DRAWER" : "HERO · NAV DRAWER"}
        </span>
      </div>

      <div
        style={s("display:flex;gap:26px;justify-content:center;padding:30px 28px 60px;flex-wrap:wrap")}
      >
        {/* hero */}
        <div style={s(PHONE)}>
          <div style={s(PHONE_BAR)}>
            <MiniBrand />
            <span style={s("margin-left:auto;display:grid;gap:4px;width:20px")}>
              <span style={s("height:1.5px;background:var(--muted)")} />
              <span style={s("height:1.5px;background:var(--muted)")} />
            </span>
          </div>
          <div style={s("position:relative;padding:26px 20px 0;text-align:center;overflow:hidden")}>
            <div
              style={s(
                "position:absolute;inset:0;background-image:radial-gradient(rgba(var(--ink-rgb),.07) 1px,transparent 1px);background-size:22px 22px",
              )}
            />
            <div style={s("position:relative")}>
              <div
                style={s(
                  "display:inline-flex;align-items:center;gap:7px;padding:4px 10px;border-radius:999px;border:1px solid rgba(var(--ink-rgb),.12);font-size:9.5px;letter-spacing:.11em;white-space:nowrap;color:var(--muted)",
                )}
              >
                <span style={s("width:4px;height:4px;border-radius:50%;background:var(--accent)")} />
                NO ACCOUNT, NOTHING UPLOADED
              </div>
              <h1
                style={s(
                  "margin:15px 0 0;font-size:31px;line-height:1.06;letter-spacing:-.032em;font-weight:500",
                )}
              >
                Make a store screenshot{" "}
                <span style={s("font-style:italic;font-weight:300")}>right here</span>.
              </h1>
              <p style={s("margin:12px 0 0;font-size:14px;line-height:1.55;color:var(--muted)")}>
                Drop a screen, tilt it, pick a background. Your screenshots never leave your
                browser.
              </p>
            </div>
            <div
              style={s(
                "position:relative;margin:22px auto 0;width:206px;height:356px;border-radius:14px;overflow:hidden;background:linear-gradient(150deg,#ff6b53,#c9315f 62%,#6d1a4a);display:flex;flex-direction:column",
              )}
            >
              <div
                style={s(
                  "padding:20px 16px 0;font-size:17px;font-weight:500;letter-spacing:-.026em;color:#fff",
                )}
              >
                Every run, mapped
              </div>
              <div style={s("flex:1;display:grid;place-items:center;perspective:800px")}>
                <div
                  style={s(
                    "width:132px;height:262px;border-radius:18px;background:linear-gradient(150deg,#3a3833,#141312);box-shadow:0 18px 30px rgba(0,0,0,.5);transform:rotateY(-15deg);display:grid;place-items:center",
                  )}
                >
                  <span style={s("font-size:10.5px;color:#7d8794")}>Drop a screenshot</span>
                </div>
              </div>
            </div>
            <div
              style={s(
                "display:flex;align-items:center;justify-content:center;gap:6px;margin:14px 0 0;padding:6px;border-radius:9px;background:var(--pop);border:1px solid rgba(var(--ink-rgb),.12)",
              )}
            >
              <span style={s("font-size:11.5px;font-weight:500")}>Perspective</span>
              <span
                style={s(
                  "font-size:10px;padding:2px 6px;border-radius:4px;background:rgba(var(--accent-rgb),.12);color:var(--accent-hi2)",
                )}
              >
                −15° / 0°
              </span>
              <span style={s("font-size:10.5px;color:var(--muted-3)")}>drag to tilt</span>
            </div>
            <div style={s("display:flex;flex-direction:column;gap:8px;padding:18px 0 24px")}>
              <button
                type="button"
                style={s(
                  "height:44px;border:1px solid var(--accent);border-radius:8px;background:transparent;color:var(--accent);font-size:14.5px;font-weight:500;cursor:pointer",
                )}
              >
                Export this set
              </button>
              <button
                type="button"
                style={s(
                  "height:44px;border:1px solid rgba(var(--ink-rgb),.14);border-radius:8px;background:transparent;color:var(--text);font-size:14.5px;cursor:pointer",
                )}
              >
                Start a full set
              </button>
              <span style={s("font-size:11.5px;color:var(--muted-3);text-align:center")}>
                Free · runs in your browser
              </span>
            </div>
          </div>
        </div>

        {/* pricing — a second, independent plan table; gating /pricing alone
            would leave this board advertising a subscription. */}
        {FEATURES.billing && (
        <div style={s(PHONE)}>
          <div style={s(PHONE_BAR)}>
            <MiniBrand label="Pricing" />
          </div>
          <div style={s("padding:24px 20px 30px")}>
            <h1
              style={s(
                "margin:0;font-size:27px;line-height:1.08;letter-spacing:-.03em;font-weight:500;text-align:center",
              )}
            >
              Pay when you ship
            </h1>
            <p
              style={s(
                "margin:10px 0 0;font-size:13.5px;line-height:1.55;color:var(--muted);text-align:center",
              )}
            >
              Build free. Pay only to export or upload.
            </p>
            <div style={s("display:flex;flex-direction:column;gap:11px;margin-top:20px")}>
              {PLANS.map((p) => (
                <div
                  key={p.name}
                  style={s(
                    `padding:14px;border-radius:12px;border:1px solid ${
                      p.hot ? "rgba(var(--accent-rgb),.42)" : "rgba(var(--ink-rgb),.1)"
                    };background:${p.hot ? "rgba(var(--accent-rgb),.05)" : "var(--surface)"}`,
                  )}
                >
                  <div style={s("display:flex;align-items:center;gap:9px")}>
                    <span style={s("font-size:14px;font-weight:500")}>{p.name}</span>
                    {p.tag ? (
                      <span
                        style={s(
                          "padding:2px 7px;border-radius:5px;background:rgba(var(--accent-rgb),.12);color:var(--accent-hi);font-size:9.5px;letter-spacing:.07em",
                        )}
                      >
                        {p.tag}
                      </span>
                    ) : null}
                    <span
                      style={s("margin-left:auto;font-size:19px;font-weight:500;letter-spacing:-.03em")}
                    >
                      {p.price}
                    </span>
                  </div>
                  <div style={s("margin-top:7px;font-size:12.5px;line-height:1.5;color:var(--muted-2)")}>
                    {p.sub}
                  </div>
                  <button
                    type="button"
                    style={s(
                      `width:100%;margin-top:11px;height:38px;border-radius:8px;border:1px solid ${
                        p.hot ? "var(--accent)" : "rgba(var(--ink-rgb),.14)"
                      };background:transparent;color:${
                        p.hot ? "var(--accent)" : "var(--text)"
                      };font-size:13.5px;font-weight:500;cursor:pointer`,
                    )}
                  >
                    {p.cta}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
        )}

        {/* nav drawer */}
        <div style={s(PHONE)}>
          <div style={s(PHONE_BAR)}>
            <MiniBrand />
            <span
              style={s(
                "margin-left:auto;display:grid;place-items:center;width:24px;height:24px;color:var(--muted)",
              )}
            >
              <IcoClose size={15} />
            </span>
          </div>
          <div style={s("padding:10px 16px 24px")}>
            {NAV.map((n, i) => (
              <div
                key={n.label}
                style={s(
                  `display:flex;align-items:baseline;justify-content:space-between;padding:15px 0;border-bottom:${
                    i < NAV.length - 1 ? "1px solid rgba(var(--ink-rgb),.07)" : "none"
                  }`,
                )}
              >
                <span style={s("font-size:17px;font-weight:500;letter-spacing:-.02em")}>
                  {n.label}
                </span>
                <span style={s("font-size:12px;color:var(--muted-3)")}>{n.meta}</span>
              </div>
            ))}
            <div style={s("display:flex;flex-direction:column;gap:8px;margin-top:20px")}>
              <button
                type="button"
                style={s(
                  "height:44px;border:1px solid var(--accent);border-radius:8px;background:transparent;color:var(--accent);font-size:14.5px;font-weight:500;cursor:pointer",
                )}
              >
                Start a set
              </button>
              {FEATURES.accounts && (
                <button
                  type="button"
                  style={s(
                    "height:44px;border:1px solid rgba(var(--ink-rgb),.14);border-radius:8px;background:transparent;color:var(--text);font-size:14.5px;cursor:pointer",
                  )}
                >
                  Sign in
                </button>
              )}
            </div>
            <div
              style={s(
                "margin-top:18px;padding:13px;border-radius:10px;border:1px solid rgba(var(--warn-rgb),.24);background:rgba(var(--warn-rgb),.06);font-size:12.5px;line-height:1.55;color:var(--warn)",
              )}
            >
              The editor needs a screen at least 900px wide.
              {FEATURES.teams
                ? " On a phone you can review sets and approve comments, not lay them out."
                : " Open this set on a larger screen to lay it out."}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
