"use client";

import { s } from "@/lib/onstage/css";
import { Async, Shimmer } from "@/components/onstage/Async";
import { getBackend } from "@/lib/data/backend";
import { useQuery } from "@/lib/data/useQuery";
import { bgCss } from "@/lib/onstage/data";
import { BackButton } from "../chrome";

const APP_ID = "trailhead";

export function AbTestScreen() {
  const test = useQuery(`abtest:${APP_ID}`, () =>
    getBackend().getAbTest(APP_ID),
  );

  return (
    <div
      style={s(
        "min-height:var(--screen-h,100vh);background:var(--bg);color:var(--text)",
      )}
    >
      <div
        style={s(
          "display:flex;align-items:center;gap:14px;padding:13px 28px;border-bottom:1px solid rgba(var(--ink-rgb),.07);background:var(--chrome)",
        )}
      >
        <BackButton href="/project" />
        <span
          style={s("font-size:14.5px;font-weight:500;letter-spacing:-.015em")}
        >
          A/B test — Trailhead 6.9″ set
        </span>
        <span
          style={s(
            "padding:3px 9px;border-radius:6px;background:rgba(var(--ok-rgb),.12);color:var(--ok);font-size:10.5px;letter-spacing:.07em",
          )}
        >
          RUNNING · DAY 14 OF 14
        </span>
        <button
          type="button"
          className="hov-accent"
          style={s(
            "margin-left:auto;height:32px;padding:0 13px;border:1px solid var(--accent);border-radius:8px;background:transparent;color:var(--accent);font-size:12.5px;font-weight:500;cursor:pointer",
          )}
        >
          Promote variant B
        </button>
      </div>

      <div style={s("max-width:1240px;margin:0 auto;padding:26px 28px 60px")}>
        <div
          style={s(
            "display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:rgba(var(--ink-rgb),.08);border:1px solid rgba(var(--ink-rgb),.09);border-radius:14px;overflow:hidden",
          )}
        >
          <Async
            query={test}
            skeleton={<Shimmer style="height:96px;border-radius:0" />}
          >
            {({ stats }) =>
              stats.map((st2) => (
                <div
                  key={st2.id}
                  style={s("background:var(--surface);padding:16px 18px")}
                >
                  <div
                    style={s(
                      "font-size:11px;letter-spacing:.09em;color:var(--muted-3)",
                    )}
                  >
                    {st2.label}
                  </div>
                  <div
                    style={s(
                      "display:flex;align-items:baseline;gap:8px;margin-top:8px",
                    )}
                  >
                    <span
                      style={s(
                        "font-size:24px;font-weight:500;letter-spacing:-.03em",
                      )}
                    >
                      {st2.value}
                    </span>
                    {st2.delta ? (
                      <span
                        style={s(
                          "padding:2px 7px;border-radius:5px;background:rgba(var(--ok-rgb),.14);color:var(--ok);font-size:11.5px;font-weight:500",
                        )}
                      >
                        {st2.delta}
                      </span>
                    ) : null}
                  </div>
                  <div
                    style={s(
                      "margin-top:5px;font-size:12px;color:var(--muted-2)",
                    )}
                  >
                    {st2.sub}
                  </div>
                </div>
              ))
            }
          </Async>
        </div>

        <div
          style={s(
            "display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:20px",
          )}
        >
          <Async
            query={test}
            skeleton={
              <>
                {[0, 1].map((i) => (
                  <Shimmer key={i} style="height:420px;border-radius:14px" />
                ))}
              </>
            }
          >
            {({ variants }) =>
              variants.map((v) => (
                <div
                  key={v.id}
                  style={s(
                    `padding:16px;border-radius:14px;border:1px solid ${
                      v.winning
                        ? "rgba(var(--ok-rgb),.4)"
                        : "rgba(var(--ink-rgb),.09)"
                    };background:var(--surface)`,
                  )}
                >
                  <div style={s("display:flex;align-items:center;gap:10px")}>
                    <span style={s("font-size:15px;font-weight:500")}>
                      {v.name}
                    </span>
                    <span
                      style={s(
                        `padding:2px 8px;border-radius:6px;font-size:10.5px;letter-spacing:.07em;background:${
                          v.winning
                            ? "rgba(var(--ok-rgb),.13)"
                            : "rgba(var(--ink-rgb),.06)"
                        };color:${v.winning ? "var(--ok)" : "var(--muted)"}`,
                      )}
                    >
                      {v.pill}
                    </span>
                    <span
                      style={s(
                        "margin-left:auto;font-size:12.5px;color:var(--muted)",
                      )}
                    >
                      {v.split}
                    </span>
                  </div>
                  <div style={s("display:flex;gap:8px;margin-top:13px")}>
                    {v.captions.map((c, i) => (
                      <div
                        key={c}
                        style={s(
                          `flex:1;height:214px;border-radius:9px;overflow:hidden;background:${bgCss(
                            v.backgrounds[i],
                          )};display:flex;flex-direction:column;align-items:center`,
                        )}
                      >
                        <div
                          style={s(
                            "padding:12px 10px 0;text-align:center;font:500 10.5px/1.2 'Inter',sans-serif;letter-spacing:-.02em;color:#fff",
                          )}
                        >
                          {c}
                        </div>
                        <div
                          style={s(
                            `margin-top:9px;width:56px;height:118px;border-radius:9px;background:linear-gradient(150deg,#3a3833,#141312);transform:perspective(340px) rotateY(${
                              v.winning ? -14 : 0
                            }deg)`,
                          )}
                        />
                      </div>
                    ))}
                  </div>
                  <div
                    style={s(
                      "height:1px;margin:15px 0;background:linear-gradient(to right,transparent,rgba(var(--ink-rgb),.14) 30px,rgba(var(--ink-rgb),.14) calc(100% - 30px),transparent)",
                    )}
                  />
                  <div style={s("display:flex;flex-direction:column;gap:10px")}>
                    {v.rows.map(({ label, value, pct }) => (
                      <div key={label}>
                        <div
                          style={s(
                            "display:flex;align-items:baseline;justify-content:space-between;font-size:12.5px",
                          )}
                        >
                          <span style={s("color:var(--muted)")}>{label}</span>
                          <span style={s("font-weight:500")}>{value}</span>
                        </div>
                        <div
                          style={s(
                            "margin-top:6px;height:4px;border-radius:4px;background:rgba(var(--ink-rgb),.08);overflow:hidden",
                          )}
                        >
                          <div
                            style={s(
                              `height:4px;border-radius:4px;background:${
                                v.winning ? "var(--ok)" : "var(--accent)"
                              };width:${pct}%`,
                            )}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            }
          </Async>
        </div>

        <div
          style={s(
            "margin-top:20px;padding:16px 18px;border:1px solid rgba(var(--accent-rgb),.3);border-radius:14px;background:var(--surface)",
          )}
        >
          <div style={s("font-size:14.5px;font-weight:500")}>
            What changed between them
          </div>
          <div
            style={s(
              "margin-top:12px;display:flex;flex-direction:column;gap:11px",
            )}
          >
            <Async query={test} skeleton={<Shimmer style="height:90px" />}>
              {({ diffs }) =>
                diffs.map((d) => (
                  <div
                    key={d.frame}
                    style={s("display:flex;gap:12px;align-items:flex-start")}
                  >
                    <span
                      style={s(
                        "flex:none;width:80px;font-size:11px;letter-spacing:.07em;color:var(--muted-3);padding-top:2px",
                      )}
                    >
                      {d.frame}
                    </span>
                    <span
                      style={s(
                        "flex:1;font-size:13px;line-height:1.55;color:var(--text-2)",
                      )}
                    >
                      {d.text}
                    </span>
                    <span
                      style={s(
                        `flex:none;padding:2px 8px;border-radius:5px;font-size:11.5px;font-weight:500;background:${
                          d.better
                            ? "rgba(var(--ok-rgb),.13)"
                            : "rgba(var(--warn-rgb),.13)"
                        };color:${d.better ? "var(--ok)" : "var(--warn)"}`,
                      )}
                    >
                      {d.effect}
                    </span>
                  </div>
                ))
              }
            </Async>
          </div>
        </div>
      </div>
    </div>
  );
}
