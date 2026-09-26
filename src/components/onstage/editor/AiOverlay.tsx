"use client";

import { useOnstage } from "@/store/onstage";
import { s } from "@/lib/onstage/css";
import { Async, Shimmer } from "@/components/onstage/Async";
import { getBackend } from "@/lib/data/backend";
import { useQuery } from "@/lib/data/useQuery";
import type { CaptionTone } from "@/lib/data/types";
import { IcoAlert, IcoClose, IcoSparkle } from "../icons";

const LOCALES = [
  {
    name: "German",
    sub: "5 of 5 frames translated",
    badge: "REFLOWED",
    on: true,
  },
  {
    name: "Japanese",
    sub: "5 of 5 frames translated",
    badge: "DONE",
    on: true,
  },
  { name: "Spanish", sub: "5 of 5 frames translated", badge: "DONE", on: true },
  { name: "French", sub: "Not translated yet", badge: "", on: false },
  { name: "Portuguese (BR)", sub: "Not translated yet", badge: "", on: false },
  { name: "Korean", sub: "Not translated yet", badge: "", on: false },
];

/** Captions and languages — the drawer behind "Rewrite with AI". */
export function AiOverlay() {
  const st = useOnstage();
  const f = st.frames[st.active] ?? st.frames[0];
  const close = () => st.setState({ overlay: null });

  // Suggestions come from the backend, so the tone is a real input rather than
  // a chip that only restyles itself.
  const suggestions = useQuery(`captions:${st.aiTone}:${f.caption}`, () =>
    getBackend().suggestCaptions({
      caption: f.caption,
      tone: st.aiTone as CaptionTone,
    }),
  );

  return (
    <div
      style={s(
        "position:absolute;inset:0;z-index:200;display:flex;justify-content:flex-end;background:var(--backdrop)",
      )}
    >
      <div
        style={s(
          "width:406px;height:100%;background:var(--surface);border-left:1px solid rgba(var(--ink-rgb),.1);box-shadow:-30px 0 80px rgba(0,0,0,.6);display:flex;flex-direction:column",
        )}
      >
        <div
          style={s(
            "display:flex;align-items:center;gap:11px;padding:15px 16px;border-bottom:1px solid rgba(var(--ink-rgb),.08)",
          )}
        >
          <span
            style={s(
              "display:grid;place-items:center;width:26px;height:26px;border-radius:6px;background:rgba(var(--accent-rgb),.14);color:var(--accent)",
            )}
          >
            <IcoSparkle size={15} />
          </span>
          <span
            style={s("font-size:14px;font-weight:700;letter-spacing:-.015em")}
          >
            Captions &amp; languages
          </span>
          <button
            type="button"
            aria-label="Close"
            onClick={close}
            style={s(
              "margin-left:auto;display:grid;place-items:center;width:26px;height:26px;border:none;border-radius:5px;background:transparent;color:var(--muted-2);cursor:pointer",
            )}
          >
            <IcoClose />
          </button>
        </div>

        <div
          style={s(
            "display:flex;gap:2px;margin:12px 16px 0;padding:2px;border:1px solid rgba(var(--ink-rgb),.09);border-radius:6px",
          )}
        >
          {(["Captions", "Localize"] as const).map((t) => {
            const on = st.aiTab === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => st.setState({ aiTab: t })}
                style={s(
                  `flex:1;padding:6px 0;border:none;border-radius:4px;background:${
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

        <div style={s("flex:1;overflow-y:auto;padding:16px")}>
          {st.aiTab === "Captions" ? (
            <div>
              <div
                style={s(
                  "font:400 10px 'Inter',ui-sans-serif;letter-spacing:.09em;color:var(--muted-2)",
                )}
              >
                FRAME {String(st.active + 1).padStart(2, "0")} HEADLINE
              </div>
              <div
                style={s(
                  "margin-top:9px;padding:12px;border-radius:7px;border:1px solid rgba(var(--ink-rgb),.1);background:var(--bg);font-size:15px;font-weight:600;letter-spacing:-.015em",
                )}
              >
                {f.caption}
              </div>
              <div style={s("display:flex;gap:6px;margin-top:12px")}>
                {["Direct", "Benefit-led", "Playful"].map((t) => {
                  const on = st.aiTone === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => st.setState({ aiTone: t })}
                      style={s(
                        `padding:5px 11px;border-radius:5px;border:1px solid ${
                          on
                            ? "rgba(var(--accent-rgb),.4)"
                            : "rgba(var(--ink-rgb),.1)"
                        };background:${on ? "rgba(var(--accent-rgb),.1)" : "transparent"};color:${
                          on ? "var(--accent-hi)" : "var(--muted)"
                        };font-size:12px;font-weight:500;cursor:pointer`,
                      )}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>

              <div
                style={s(
                  "margin-top:18px;font:400 10px 'Inter',ui-sans-serif;letter-spacing:.09em;color:var(--muted-2)",
                )}
              >
                SUGGESTIONS
              </div>
              <div
                style={s(
                  "margin-top:9px;display:flex;flex-direction:column;gap:8px",
                )}
              >
                <Async
                  query={suggestions}
                  skeleton={
                    <>
                      {[0, 1, 2].map((i) => (
                        <Shimmer
                          key={i}
                          style="height:76px;border-radius:7px"
                        />
                      ))}
                    </>
                  }
                >
                  {(rows) =>
                    rows.map((g) => (
                      <div
                        key={g.text}
                        style={s(
                          "padding:12px;border-radius:7px;border:1px solid rgba(var(--ink-rgb),.09);background:var(--surface-3)",
                        )}
                      >
                        <div
                          style={s(
                            "font-size:14px;font-weight:600;letter-spacing:-.015em",
                          )}
                        >
                          {g.text}
                        </div>
                        <div
                          style={s(
                            "display:flex;align-items:center;gap:10px;margin-top:9px",
                          )}
                        >
                          <span
                            style={s(
                              "font:400 10.5px 'Inter',ui-sans-serif;color:var(--muted-4)",
                            )}
                          >
                            {g.meta}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              st.patchFrame({ caption: g.text });
                              st.setState({ overlay: null });
                            }}
                            style={s(
                              "margin-left:auto;height:26px;padding:0 11px;border:none;border-radius:5px;background:rgba(var(--accent-rgb),.14);color:var(--accent-hi);font-size:12px;font-weight:600;cursor:pointer",
                            )}
                          >
                            Use
                          </button>
                        </div>
                      </div>
                    ))
                  }
                </Async>
              </div>
              <button
                type="button"
                onClick={st.rewriteAllCaptions}
                style={s(
                  "width:100%;margin-top:14px;height:36px;border:1px dashed rgba(var(--ink-rgb),.16);border-radius:7px;background:transparent;color:var(--muted);font-size:12.5px;cursor:pointer",
                )}
              >
                Rewrite all {st.frames.length} headlines in this tone
              </button>
            </div>
          ) : (
            <div>
              <div
                style={s(
                  "font:400 10px 'Inter',ui-sans-serif;letter-spacing:.09em;color:var(--muted-2)",
                )}
              >
                LANGUAGES
              </div>
              <div
                style={s(
                  "margin-top:10px;display:flex;flex-direction:column;gap:7px",
                )}
              >
                {LOCALES.map((l) => (
                  <div
                    key={l.name}
                    style={s(
                      `display:flex;align-items:center;gap:10px;padding:9px 11px;border-radius:7px;border:1px solid ${
                        l.on
                          ? "rgba(var(--accent-rgb),.28)"
                          : "rgba(var(--ink-rgb),.08)"
                      };background:${l.on ? "rgba(var(--accent-rgb),.04)" : "transparent"};cursor:pointer`,
                    )}
                  >
                    <span
                      style={s(
                        `flex:none;display:grid;place-items:center;width:16px;height:16px;border-radius:4px;border:1px solid ${
                          l.on ? "var(--accent)" : "rgba(var(--ink-rgb),.18)"
                        };background:${l.on ? "var(--accent)" : "transparent"};color:${
                          l.on ? "var(--on-accent)" : "transparent"
                        };font-size:10px;font-weight:700`,
                      )}
                    >
                      ✓
                    </span>
                    <div style={s("flex:1;min-width:0")}>
                      <div style={s("font-size:13px;font-weight:500")}>
                        {l.name}
                      </div>
                      <div style={s("font-size:11.5px;color:var(--muted-3)")}>
                        {l.sub}
                      </div>
                    </div>
                    {l.badge ? (
                      <span
                        style={s(
                          `padding:2px 7px;border-radius:4px;font:500 10px 'Inter',ui-sans-serif;background:${
                            l.badge === "REFLOWED"
                              ? "rgba(var(--warn-rgb),.13)"
                              : "rgba(var(--ok-rgb),.12)"
                          };color:${l.badge === "REFLOWED" ? "#f5b544" : "var(--ok)"}`,
                        )}
                      >
                        {l.badge}
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
              <div
                style={s(
                  "margin-top:16px;padding:12px;border-radius:7px;border:1px solid rgba(var(--warn-rgb),.24);background:rgba(var(--warn-rgb),.06);display:flex;gap:9px",
                )}
              >
                <IcoAlert
                  size={14}
                  w={2}
                  style={s("flex:none;margin-top:1px;color:var(--warn)")}
                />
                <div>
                  <div
                    style={s(
                      "font-size:12.5px;font-weight:600;color:var(--warn)",
                    )}
                  >
                    German runs 22% longer
                  </div>
                  <div
                    style={s(
                      "margin-top:3px;font-size:12px;line-height:1.5;color:var(--muted)",
                    )}
                  >
                    Frames 2 and 5 reflowed to two lines. Nothing overruns the
                    safe area.
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={close}
                className="hov-accent"
                style={s(
                  "width:100%;margin-top:14px;height:38px;border:1px solid var(--accent);border-radius:7px;background:transparent;color:var(--accent);font-size:13.5px;font-weight:700;cursor:pointer",
                )}
              >
                Apply to set
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
