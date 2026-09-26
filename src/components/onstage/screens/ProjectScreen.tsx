"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { s } from "@/lib/onstage/css";
import { Async, Shimmer } from "@/components/onstage/Async";
import { getBackend } from "@/lib/data/backend";
import { useQuery } from "@/lib/data/useQuery";
import { FEATURES } from "@/lib/features";
import { useOnstage } from "@/store/onstage";
import { BackButton } from "../chrome";
import { IcoExport } from "../icons";
import { LocalesTab } from "./project/LocalesTab";
import { UploadsTab } from "./project/UploadsTab";

const APP_ID = "trailhead";

const THUMB_BGS = [
  "linear-gradient(150deg,#ff6b53,#c9315f)",
  "linear-gradient(160deg,#1f2b4d,#0e1424)",
  "linear-gradient(155deg,#1b6f6a,#0f3a3d)",
  "linear-gradient(150deg,#ff6b53,#c9315f)",
  "linear-gradient(160deg,#1a1917,#0b0b0a)",
];
const THUMB_TILT = [-10, 0, 9, -14, 0];

const CARD =
  "border:1px solid rgba(var(--ink-rgb),.09);border-radius:9px;background:var(--surface);padding:14px";
const CARD_LABEL = "font:400 10px 'Inter',ui-sans-serif;letter-spacing:.09em;color:var(--muted-2)";
const CARD_ROW =
  "display:flex;align-items:center;gap:9px;padding:7px 8px;margin:0 -8px;border-radius:6px;color:var(--text);font-size:12.5px";
const CARD_ROW_META = "font:400 10px 'Inter',ui-sans-serif;color:var(--muted-4)";

/**
 * The review row of the "THIS SET" card. Its own component so the comment read
 * only runs when `FEATURES.teams` mounts it — and so the count is real: the
 * badge used to be the literal string "3 OPEN", which never matched
 * listComments.
 */
function ReviewRow() {
  const comments = useQuery(`comments:${APP_ID}`, () => getBackend().listComments(APP_ID));
  const open = (comments.data ?? []).filter((c) => !c.resolved).length;
  return (
    <Link href="/review" className="hov-row" style={s(CARD_ROW)}>
      <span style={s("flex:1")}>Review &amp; comments</span>
      <span style={s(CARD_ROW_META)}>{comments.data ? `${open} OPEN` : ""}</span>
    </Link>
  );
}

const TABS = ["Sets", "Locales", "Uploads"] as const;
type Tab = (typeof TABS)[number];

/** The required-sizes board and the A/B variants beside it. */
function SetsTab() {
  const router = useRouter();
  const sizeRows = useQuery(`sizes:${APP_ID}`, () => getBackend().listSizeRows(APP_ID));
  const variants = useQuery(`variants:${APP_ID}`, () => getBackend().listVariants(APP_ID));

  return (
    <div>
      <div style={s("display:flex;align-items:center;justify-content:space-between")}>
        <h2 style={s("margin:0;font-size:19px;font-weight:500;letter-spacing:-.022em")}>
          Required sizes
        </h2>
        <span style={s("font:400 10.5px 'Inter',ui-sans-serif;color:var(--muted-4)")}>
          APPLE 2 OF 2 · GOOGLE 2 OF 3
        </span>
      </div>

      <div style={s("margin-top:13px;display:flex;flex-direction:column;gap:10px")}>
        <Async
          query={sizeRows}
          skeleton={
            <>
              {[0, 1, 2].map((i) => (
                <Shimmer key={i} style="height:118px;border-radius:9px" />
              ))}
            </>
          }
        >
          {(rows) =>
            rows.map((r) => {
              const missing = r.status === "Missing";
              return (
                <div
                  key={r.id}
                  style={s(
                    `padding:13px 14px;border:1px solid ${
                      missing ? "rgba(var(--warn-rgb),.26)" : "rgba(var(--ink-rgb),.09)"
                    };border-radius:9px;background:${
                      missing ? "rgba(var(--warn-rgb),.05)" : "var(--surface)"
                    }`,
                  )}
                >
                  <div style={s("display:flex;align-items:center;gap:12px")}>
                    <span
                      style={s(
                        "flex:none;width:58px;text-align:center;padding:3px 0;border-radius:4px;background:rgba(var(--ink-rgb),.05);font:500 10px 'Inter',ui-sans-serif;letter-spacing:.06em;color:var(--muted)",
                      )}
                    >
                      {r.store}
                    </span>
                    <div style={s("flex:1;min-width:0")}>
                      <div style={s("font-size:13.5px;font-weight:600;letter-spacing:-.01em")}>
                        {r.label}
                      </div>
                      <div
                        style={s(
                          "margin-top:2px;font:400 10.5px 'Inter',ui-sans-serif;color:var(--muted-4)",
                        )}
                      >
                        {r.px}
                      </div>
                    </div>
                    <span
                      style={s(
                        `flex:none;width:84px;text-align:center;padding:3px 8px;border-radius:4px;font-size:11.5px;font-weight:500;background:${
                          r.status === "Ready"
                            ? "rgba(var(--ok-rgb),.12)"
                            : missing
                              ? "rgba(var(--warn-rgb),.14)"
                              : "rgba(var(--ink-rgb),.05)"
                        };color:${
                          r.status === "Ready" ? "var(--ok)" : missing ? "#f5b544" : "var(--muted)"
                        }`,
                      )}
                    >
                      {r.status}
                    </span>
                    <button
                      type="button"
                      onClick={() => router.push("/editor")}
                      style={s(
                        `flex:none;height:28px;padding:0 12px;border-radius:5px;border:1px solid ${
                          missing ? "transparent" : "rgba(var(--ink-rgb),.13)"
                        };background:${missing ? "var(--accent)" : "transparent"};color:${
                          missing ? "var(--on-accent)" : "var(--text)"
                        };font-size:12px;font-weight:${missing ? 700 : 500};cursor:pointer`,
                      )}
                    >
                      {r.action}
                    </button>
                  </div>
                  {r.frames > 0 && (
                    <div style={s("display:flex;gap:6px;margin-top:11px")}>
                      {Array.from({ length: r.frames }).map((_, i) => (
                        <div
                          key={i}
                          style={s(
                            `flex:none;width:44px;height:58px;border-radius:4px;background:${
                              THUMB_BGS[i % 5]
                            };display:grid;place-items:center`,
                          )}
                        >
                          <div
                            style={s(
                              `width:16px;height:32px;border-radius:4px;background:#111214;transform:perspective(220px) rotateY(${
                                THUMB_TILT[i % 5]
                              }deg)`,
                            )}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          }
        </Async>
      </div>

      <h2 style={s("margin:30px 0 0;font-size:19px;font-weight:500;letter-spacing:-.022em")}>
        A/B variants
      </h2>
      <p style={s("margin:7px 0 0;font-size:13.5px;color:var(--muted-2)")}>
        Two versions of the same set. Push one live, keep the other ready.
      </p>
      <div style={s("display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:13px")}>
        <Async
          query={variants}
          skeleton={
            <>
              {[0, 1].map((i) => (
                <Shimmer key={i} style="height:150px;border-radius:9px" />
              ))}
            </>
          }
        >
          {(rows) =>
            rows.map((v) => (
              <div
                key={v.id}
                style={s(
                  `padding:14px;border:1px solid ${
                    v.live ? "rgba(var(--ok-rgb),.28)" : "rgba(var(--ink-rgb),.09)"
                  };border-radius:9px;background:var(--surface)`,
                )}
              >
                <div style={s("display:flex;align-items:center;justify-content:space-between")}>
                  <span style={s("font-size:13.5px;font-weight:600")}>{v.name}</span>
                  <span
                    style={s(
                      `padding:2px 8px;border-radius:4px;font:500 10px 'Inter',ui-sans-serif;letter-spacing:.07em;background:${
                        v.live ? "rgba(var(--ok-rgb),.13)" : "rgba(var(--ink-rgb),.05)"
                      };color:${v.live ? "var(--ok)" : "var(--muted)"}`,
                    )}
                  >
                    {v.pill}
                  </span>
                </div>
                <div style={s("display:flex;gap:5px;margin-top:11px")}>
                  {v.swatches.map((b, bi) => (
                    <div key={bi} style={s(`flex:1;height:52px;border-radius:4px;background:${b}`)} />
                  ))}
                </div>
                <div style={s("display:flex;align-items:center;gap:9px;margin-top:12px")}>
                  <span style={s("font-size:12px;color:var(--muted-2)")}>{v.note}</span>
                  <button
                    type="button"
                    onClick={() => router.push("/editor")}
                    style={s(
                      `margin-left:auto;height:28px;padding:0 11px;border-radius:5px;border:1px solid ${
                        v.live ? "rgba(var(--ink-rgb),.13)" : "transparent"
                      };background:${v.live ? "transparent" : "var(--accent)"};color:${
                        v.live ? "var(--text)" : "var(--on-accent)"
                      };font-size:12px;font-weight:${v.live ? 500 : 700};cursor:pointer`,
                    )}
                  >
                    {v.action}
                  </button>
                </div>
              </div>
            ))
          }
        </Async>
      </div>
    </div>
  );
}

export function ProjectScreen() {
  const router = useRouter();
  const setState = useOnstage((st) => st.setState);
  const [tab, setTab] = useState<Tab>("Sets");

  const connections = useQuery("connections", () => getBackend().listConnections());
  const locales = useQuery(`locales:${APP_ID}`, () => getBackend().listLocales(APP_ID));
  const activity = useQuery(`activity:${APP_ID}`, () => getBackend().listActivity(APP_ID));

  return (
    <div style={s("min-height:var(--screen-h,100vh);background:var(--bg);color:var(--text)")}>
      <div
        style={s(
          "display:flex;align-items:center;gap:14px;padding:13px 28px;border-bottom:1px solid rgba(var(--ink-rgb),.07);background:var(--chrome)",
        )}
      >
        <BackButton href="/dashboard" radius={6} />
        <span
          style={s(
            "display:grid;place-items:center;width:28px;height:28px;border-radius:7px;background:#1b6f6a;font-size:13px;font-weight:700;color:#fff",
          )}
        >
          T
        </span>
        <div>
          <div style={s("font-size:14.5px;font-weight:600;letter-spacing:-.015em")}>Trailhead</div>
          <div style={s("font:400 10.5px 'Inter',ui-sans-serif;color:var(--muted-4)")}>
            3 SETS · 4 LOCALES
          </div>
        </div>
        <div
          style={s(
            "margin-left:22px;display:flex;gap:2px;padding:2px;border:1px solid rgba(var(--ink-rgb),.09);border-radius:6px",
          )}
        >
          {TABS.map((t) => {
            const on = tab === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                style={s(
                  `padding:5px 12px;border:none;border-radius:4px;background:${
                    on ? "rgba(var(--ink-rgb),.09)" : "transparent"
                  };color:${on ? "var(--text)" : "var(--muted-2)"};font-size:12.5px;font-weight:${
                    on ? 600 : 400
                  };cursor:pointer`,
                )}
              >
                {t}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => {
            setState({ overlay: "export" });
            router.push("/editor");
          }}
          style={s(
            "margin-left:auto;display:inline-flex;align-items:center;gap:7px;height:32px;padding:0 13px;border:1px solid var(--accent);border-radius:6px;background:transparent;color:var(--accent);font-size:12.5px;font-weight:700;cursor:pointer",
          )}
        >
          <IcoExport size={14} />
          Export &amp; upload
        </button>
      </div>

      <div
        style={s(
          "max-width:1240px;margin:0 auto;padding:28px 28px 60px;display:grid;grid-template-columns:minmax(0,1fr) 296px;gap:26px",
        )}
      >
        {tab === "Sets" && <SetsTab />}
        {tab === "Locales" && <LocalesTab appId={APP_ID} />}
        {tab === "Uploads" && <UploadsTab appId={APP_ID} />}

        <div style={s("display:flex;flex-direction:column;gap:14px")}>
          <div style={s(CARD)}>
            <div style={s(CARD_LABEL)}>STORE CONNECTIONS</div>
            <div style={s("margin-top:11px;display:flex;flex-direction:column;gap:9px")}>
              <Async query={connections} skeleton={<Shimmer style="height:60px" />}>
                {(rows) =>
                  rows.map((c) => (
                    <div key={c.id} style={s("display:flex;align-items:center;gap:9px")}>
                      <span
                        style={s(
                          `flex:none;width:8px;height:8px;border-radius:50%;background:${
                            c.connected ? "var(--ok)" : "rgba(var(--ink-rgb),.22)"
                          }`,
                        )}
                      />
                      <div style={s("flex:1;min-width:0")}>
                        <div style={s("font-size:13px;font-weight:500")}>{c.name}</div>
                        <div style={s("font-size:11.5px;color:var(--muted-3)")}>{c.sub}</div>
                      </div>
                      <Link
                        href="/settings?tab=Store+connections"
                        style={s(
                          `display:inline-flex;align-items:center;height:26px;padding:0 10px;border-radius:5px;border:1px solid ${
                            c.connected ? "rgba(var(--ink-rgb),.13)" : "transparent"
                          };background:${c.connected ? "transparent" : "var(--accent)"};color:${
                            c.connected ? "var(--muted)" : "var(--on-accent)"
                          };font-size:11.5px;font-weight:${c.connected ? 500 : 700}`,
                        )}
                      >
                        {c.connected ? "Manage" : "Connect"}
                      </Link>
                    </div>
                  ))
                }
              </Async>
            </div>
          </div>

          <div style={s(CARD)}>
            <div style={s(CARD_LABEL)}>LOCALES</div>
            <div style={s("display:flex;flex-wrap:wrap;gap:6px;margin-top:11px")}>
              <Async query={locales} skeleton={<Shimmer style="height:24px;width:100%" />}>
                {(rows) =>
                  rows.map((l) => {
                    const on = l.state !== "untranslated";
                    return (
                      <span
                        key={l.code}
                        title={l.name}
                        style={s(
                          `padding:4px 9px;border-radius:5px;border:1px solid ${
                            on ? "rgba(var(--accent-rgb),.35)" : "rgba(var(--ink-rgb),.1)"
                          };background:${
                            on ? "rgba(var(--accent-rgb),.09)" : "transparent"
                          };font:500 11px 'Inter',ui-sans-serif;color:${
                            on ? "var(--accent-hi)" : "var(--muted-4)"
                          }`,
                        )}
                      >
                        {l.code}
                      </span>
                    );
                  })
                }
              </Async>
            </div>
            <button
              type="button"
              onClick={() => setTab("Locales")}
              style={s(
                "width:100%;margin-top:12px;height:32px;border:1px solid rgba(var(--accent-rgb),.35);border-radius:6px;background:rgba(var(--accent-rgb),.08);color:var(--accent-hi);font-size:12.5px;font-weight:600;cursor:pointer",
              )}
            >
              Translate set with AI
            </button>
          </div>

          <div style={s(CARD)}>
            <div style={s(CARD_LABEL)}>ACTIVITY</div>
            <div style={s("margin-top:11px;display:flex;flex-direction:column;gap:10px")}>
              <Async query={activity} skeleton={<Shimmer style="height:80px" />}>
                {(rows) =>
                  rows.map((a) => (
                    <div key={a.id} style={s("display:flex;gap:9px")}>
                      <span
                        style={s(
                          `flex:none;margin-top:5px;width:5px;height:5px;border-radius:50%;background:${a.tint}`,
                        )}
                      />
                      <div>
                        <div style={s("font-size:12.5px;line-height:1.45")}>{a.text}</div>
                        <div
                          style={s(
                            "margin-top:1px;font:400 10px 'Inter',ui-sans-serif;color:var(--muted-4)",
                          )}
                        >
                          {a.when}
                        </div>
                      </div>
                    </div>
                  ))
                }
              </Async>
            </div>
          </div>

          <div style={s(CARD)}>
            <div style={s(CARD_LABEL)}>THIS SET</div>
            <div style={s("margin-top:11px;display:flex;flex-direction:column;gap:2px")}>
              {FEATURES.teams && <ReviewRow />}
              {[
                ["A/B test results", "/ab-test", "DAY 14"],
                ["Store listing preview", "/store-preview", ""],
              ].map(([label, href, meta]) => (
                <Link key={href} href={href} className="hov-row" style={s(CARD_ROW)}>
                  <span style={s("flex:1")}>{label}</span>
                  <span style={s(CARD_ROW_META)}>{meta}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
