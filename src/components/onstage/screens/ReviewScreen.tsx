"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { s } from "@/lib/onstage/css";
import { Async, Shimmer } from "@/components/onstage/Async";
import { getBackend } from "@/lib/data/backend";
import { useQuery } from "@/lib/data/useQuery";
import { bgCss, capInk } from "@/lib/onstage/data";
import { FEATURES } from "@/lib/features";
import { useOnstage } from "@/store/onstage";
import { BackButton } from "../chrome";

const APP_ID = "trailhead";

const AVATARS = [
  { initials: "MK", tint: "#5d5294" },
  { initials: "JD", tint: "#3f6fa8" },
  { initials: "AR", tint: "#1b6f6a" },
];

export function ReviewScreen() {
  const router = useRouter();
  const st = useOnstage();
  const [tab, setTab] = useState<"open" | "resolved">("open");
  const comments = useQuery(`comments:${APP_ID}`, () =>
    getBackend().listComments(APP_ID),
  );

  const all = comments.data ?? [];
  const open = all.filter((c) => !c.resolved);
  const shown = tab === "open" ? open : all.filter((c) => c.resolved);

  // How many open threads sit on each frame — the pins on the artboards.
  const pins = open.reduce<Record<number, number>>((acc, c) => {
    acc[c.frameIndex] = (acc[c.frameIndex] ?? 0) + 1;
    return acc;
  }, {});

  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const toggleResolved = async (id: string, next: boolean) => {
    await getBackend().resolveComment(id, next);
    comments.refetch();
  };

  const sendReply = async (id: string) => {
    if (!draft.trim()) return;
    await getBackend().replyToComment(id, draft.trim());
    setDraft("");
    setReplyTo(null);
    comments.refetch();
  };

  const openFrame = (i: number, sel: "caption" | "device") => {
    st.setState({ active: i, sel });
    router.push("/editor");
  };

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
          Review — Trailhead 6.9″ set
        </span>
        {/* Collaborator chrome. The route itself already rides on
            FEATURES.teams; gated again here so the screen stays honest
            wherever it is mounted. */}
        {FEATURES.teams && (
          <div style={s("margin-left:14px;display:flex;align-items:center")}>
            {AVATARS.map((a, i) => (
              <span
                key={a.initials}
                style={s(
                  `display:grid;place-items:center;width:26px;height:26px;border-radius:50%;background:${
                    a.tint
                  };color:#fff;font-size:10.5px;font-weight:600;margin-left:${
                    i ? -7 : 0
                  }px;box-shadow:0 0 0 2px var(--chrome)`,
                )}
              >
                {a.initials}
              </span>
            ))}
          </div>
        )}
        {FEATURES.teams && (
          <button
            type="button"
            className="hov-accent"
            style={s(
              "margin-left:auto;height:32px;padding:0 13px;border:1px solid var(--accent);border-radius:8px;background:transparent;color:var(--accent);font-size:12.5px;font-weight:500;cursor:pointer",
            )}
          >
            Invite reviewer
          </button>
        )}
      </div>

      <div
        style={s(
          "max-width:1240px;margin:0 auto;padding:26px 28px 60px;display:grid;grid-template-columns:minmax(0,1fr) 372px;gap:26px",
        )}
      >
        <div>
          <div
            style={s(
              "display:flex;align-items:baseline;justify-content:space-between",
            )}
          >
            <h1
              style={s(
                "margin:0;font-size:20px;font-weight:500;letter-spacing:-.022em",
              )}
            >
              {st.frames.length} frames · {open.length} open comment
              {open.length === 1 ? "" : "s"}
            </h1>
            <span
              style={s(
                "font-size:11px;letter-spacing:.09em;color:var(--muted-4)",
              )}
            >
              CLICK A PIN TO OPEN A THREAD
            </span>
          </div>
          <div
            style={s("display:flex;gap:12px;margin-top:14px;flex-wrap:wrap")}
          >
            {st.frames.map((fr, i) => (
              <div
                key={i}
                onClick={() => openFrame(i, "caption")}
                style={s(
                  `position:relative;flex:none;width:154px;height:326px;border-radius:10px;overflow:hidden;background:${bgCss(
                    fr.bg,
                  )};display:flex;flex-direction:column;align-items:center;cursor:pointer;border:1px solid rgba(var(--ink-rgb),.08)`,
                )}
              >
                <div
                  style={s(
                    `padding:16px 13px 0;text-align:center;font:500 13px/1.18 'Inter',sans-serif;letter-spacing:-.02em;color:${capInk(
                      fr.bg,
                    )}`,
                  )}
                >
                  {fr.caption}
                </div>
                <div
                  style={s(
                    `margin-top:12px;width:86px;height:176px;border-radius:12px;background:linear-gradient(150deg,#3a3833,#141312);box-shadow:0 14px 26px rgba(0,0,0,.45);transform:perspective(520px) rotateY(${
                      fr.tiltY * 0.8
                    }deg) rotateX(${fr.tiltX * 0.8}deg)`,
                  )}
                />
                {pins[i] ? (
                  <span
                    style={s(
                      "position:absolute;top:9px;right:9px;display:grid;place-items:center;width:22px;height:22px;border-radius:50%;background:var(--accent);color:var(--on-accent);font-size:11px;font-weight:600",
                    )}
                  >
                    {pins[i]}
                  </span>
                ) : null}
                <span
                  style={s(
                    "position:absolute;bottom:6px;left:8px;font-size:10px;letter-spacing:.06em;color:rgba(255,255,255,.7)",
                  )}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div style={s("display:flex;flex-direction:column;gap:12px")}>
          <div
            style={s(
              "display:flex;gap:2px;padding:2px;border:1px solid rgba(var(--ink-rgb),.09);border-radius:8px",
            )}
          >
            {(
              [
                ["open", `Open (${open.length})`],
                ["resolved", `Resolved (${all.length - open.length})`],
              ] as const
            ).map(([id, label]) => {
              const on = tab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  style={s(
                    `flex:1;padding:6px 0;border:none;border-radius:6px;background:${
                      on ? "rgba(var(--ink-rgb),.08)" : "transparent"
                    };color:${on ? "var(--text)" : "var(--muted-2)"};font-size:12.5px;font-weight:${
                      on ? 500 : 400
                    };cursor:pointer`,
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <Async
            query={comments}
            skeleton={
              <>
                {[0, 1, 2].map((i) => (
                  <Shimmer key={i} style="height:150px;border-radius:14px" />
                ))}
              </>
            }
          >
            {() =>
              shown.length ? (
                shown.map((t) => (
                  <div
                    key={t.id}
                    style={s(
                      "padding:14px;border:1px solid rgba(var(--ink-rgb),.09);border-radius:14px;background:var(--surface)",
                    )}
                  >
                    <div style={s("display:flex;align-items:center;gap:9px")}>
                      <span
                        style={s(
                          `display:grid;place-items:center;width:24px;height:24px;border-radius:50%;background:${t.tint};color:#fff;font-size:10px;font-weight:600`,
                        )}
                      >
                        {t.initials}
                      </span>
                      <span style={s("font-size:13px;font-weight:500")}>
                        {t.author}
                      </span>
                      <span style={s("font-size:11px;color:var(--muted-3)")}>
                        {t.when}
                      </span>
                      <span
                        style={s(
                          "margin-left:auto;padding:2px 7px;border-radius:6px;background:rgba(var(--accent-rgb),.12);color:var(--accent-hi);font-size:10.5px;letter-spacing:.06em",
                        )}
                      >
                        FRAME {String(t.frameIndex + 1).padStart(2, "0")}
                      </span>
                    </div>
                    <div
                      style={s(
                        "margin-top:9px;font-size:13px;line-height:1.55;color:var(--text-2)",
                      )}
                    >
                      {t.body}
                    </div>
                    {t.reply ? (
                      <div
                        style={s(
                          "margin-top:10px;padding-left:11px;border-left:2px solid rgba(var(--accent-rgb),.35)",
                        )}
                      >
                        <div style={s("font-size:12px;font-weight:500")}>
                          {t.reply.author}
                        </div>
                        <div
                          style={s(
                            "margin-top:3px;font-size:12.5px;line-height:1.55;color:var(--muted)",
                          )}
                        >
                          {t.reply.body}
                        </div>
                      </div>
                    ) : null}
                    <div
                      style={s(
                        "display:flex;align-items:center;gap:8px;margin-top:12px",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => void toggleResolved(t.id, !t.resolved)}
                        style={s(
                          `height:28px;padding:0 11px;border:1px solid ${
                            t.resolved
                              ? "rgba(var(--ok-rgb),.5)"
                              : "rgba(var(--ink-rgb),.14)"
                          };border-radius:8px;background:${
                            t.resolved
                              ? "rgba(var(--ok-rgb),.12)"
                              : "transparent"
                          };color:${t.resolved ? "var(--ok)" : "var(--text)"};font-size:12px;cursor:pointer`,
                        )}
                      >
                        {t.resolved ? "Reopen" : "Resolve"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setReplyTo(replyTo === t.id ? null : t.id);
                          setDraft("");
                        }}
                        style={s(
                          `height:28px;padding:0 11px;border:1px solid ${
                            replyTo === t.id
                              ? "rgba(var(--accent-rgb),.4)"
                              : "rgba(var(--ink-rgb),.14)"
                          };border-radius:8px;background:transparent;color:${
                            replyTo === t.id
                              ? "var(--accent-hi)"
                              : "var(--muted)"
                          };font-size:12px;cursor:pointer`,
                        )}
                      >
                        Reply
                      </button>
                      <button
                        type="button"
                        onClick={() => openFrame(t.frameIndex, t.target)}
                        style={s(
                          "margin-left:auto;height:28px;padding:0 11px;border:none;border-radius:8px;background:transparent;color:var(--accent-hi);font-size:12px;font-weight:500;cursor:pointer",
                        )}
                      >
                        Open frame →
                      </button>
                    </div>

                    {replyTo === t.id && (
                      <div style={s("display:flex;gap:8px;margin-top:10px")}>
                        <textarea
                          value={draft}
                          autoFocus
                          onChange={(e) => setDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                              void sendReply(t.id);
                            }
                          }}
                          placeholder="Reply — ⌘↵ to send"
                          style={s(
                            "flex:1;min-height:60px;padding:9px;border-radius:8px;border:1px solid rgba(var(--ink-rgb),.12);background:var(--bg);color:var(--text);font:400 12.5px/1.5 'Inter',sans-serif;resize:vertical;outline:none",
                          )}
                        />
                        <button
                          type="button"
                          onClick={() => void sendReply(t.id)}
                          disabled={!draft.trim()}
                          style={s(
                            `align-self:flex-end;height:30px;padding:0 12px;border:none;border-radius:8px;background:var(--accent);color:var(--on-accent);font-size:12px;font-weight:600;cursor:pointer;opacity:${
                              draft.trim() ? 1 : 0.5
                            }`,
                          )}
                        >
                          Send
                        </button>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div
                  style={s(
                    "padding:40px 20px;text-align:center;border:1px dashed rgba(var(--ink-rgb),.14);border-radius:14px",
                  )}
                >
                  <div style={s("font-size:14px;font-weight:500")}>
                    {tab === "open" ? "Nothing open" : "Nothing resolved yet"}
                  </div>
                  <div
                    style={s(
                      "margin-top:6px;font-size:12.5px;color:var(--muted-2)",
                    )}
                  >
                    {tab === "open"
                      ? "Every thread on this set has been dealt with."
                      : "Resolved threads collect here."}
                  </div>
                </div>
              )
            }
          </Async>
        </div>
      </div>
    </div>
  );
}
