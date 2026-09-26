"use client";

import { useRouter } from "next/navigation";
import { s } from "@/lib/onstage/css";
import { Async, Shimmer } from "@/components/onstage/Async";
import { getBackend } from "@/lib/data/backend";
import { useQuery } from "@/lib/data/useQuery";
import type { Locale } from "@/lib/data/types";
import { useOnstage } from "@/store/onstage";
import { IcoAlert, IcoPlus, IcoSparkle } from "@/components/onstage/icons";

const STATE_STYLE: Record<Locale["state"], { label: string; bg: string; fg: string }> = {
  source: { label: "SOURCE", bg: "rgba(var(--ink-rgb),.06)", fg: "var(--muted)" },
  done: { label: "DONE", bg: "rgba(var(--ok-rgb),.12)", fg: "var(--ok)" },
  reflowed: { label: "REFLOWED", bg: "rgba(var(--warn-rgb),.13)", fg: "#f5b544" },
  untranslated: { label: "NOT TRANSLATED", bg: "rgba(var(--ink-rgb),.05)", fg: "var(--muted-3)" },
};

/** Which languages this set ships in, and how complete each one is. */
export function LocalesTab({ appId }: { appId: string }) {
  const router = useRouter();
  const setState = useOnstage((st) => st.setState);
  const frameCount = useOnstage((st) => st.frames.length);
  const locales = useQuery(`locales:${appId}`, () => getBackend().listLocales(appId));

  const translate = () => {
    setState({ overlay: "ai", aiTab: "Localize" });
    router.push("/editor");
  };

  return (
    <div>
      <div style={s("display:flex;align-items:flex-end;justify-content:space-between;gap:16px")}>
        <div>
          <h2 style={s("margin:0;font-size:19px;font-weight:500;letter-spacing:-.022em")}>
            Languages
          </h2>
          <p style={s("margin:7px 0 0;font-size:13.5px;color:var(--muted-2)")}>
            Each language gets its own folder in the export, with its own headlines.
          </p>
        </div>
        <button
          type="button"
          onClick={translate}
          className="hov-accent"
          style={s(
            "flex:none;display:inline-flex;align-items:center;gap:7px;height:34px;padding:0 13px;border:1px solid var(--accent);border-radius:8px;background:transparent;color:var(--accent);font-size:13px;font-weight:500;cursor:pointer",
          )}
        >
          <IcoSparkle size={14} />
          Translate with AI
        </button>
      </div>

      <div style={s("margin-top:14px;display:flex;flex-direction:column;gap:9px")}>
        <Async
          query={locales}
          skeleton={
            <>
              {[0, 1, 2, 3].map((i) => (
                <Shimmer key={i} style="height:62px" />
              ))}
            </>
          }
        >
          {(rows) =>
            rows.map((l) => {
              const tone = STATE_STYLE[l.state];
              const pct = Math.round((l.translated / Math.max(1, frameCount)) * 100);
              return (
                <div
                  key={l.code}
                  style={s(
                    `padding:13px 14px;border:1px solid ${
                      l.state === "reflowed"
                        ? "rgba(var(--warn-rgb),.26)"
                        : "rgba(var(--ink-rgb),.09)"
                    };border-radius:9px;background:var(--surface)`,
                  )}
                >
                  <div style={s("display:flex;align-items:center;gap:12px")}>
                    <span
                      style={s(
                        "flex:none;width:58px;text-align:center;padding:3px 0;border-radius:4px;background:rgba(var(--ink-rgb),.05);font:500 10px 'Inter',ui-sans-serif;letter-spacing:.06em;color:var(--muted)",
                      )}
                    >
                      {l.code}
                    </span>
                    <div style={s("flex:1;min-width:0")}>
                      <div style={s("font-size:13.5px;font-weight:600;letter-spacing:-.01em")}>
                        {l.name}
                      </div>
                      <div
                        style={s(
                          "margin-top:2px;font:400 10.5px 'Inter',ui-sans-serif;color:var(--muted-4)",
                        )}
                      >
                        {l.translated} OF {frameCount} FRAMES
                      </div>
                    </div>
                    <span
                      style={s(
                        `flex:none;padding:3px 9px;border-radius:4px;font-size:11.5px;font-weight:500;background:${tone.bg};color:${tone.fg}`,
                      )}
                    >
                      {tone.label}
                    </span>
                    <button
                      type="button"
                      onClick={translate}
                      style={s(
                        `flex:none;height:28px;padding:0 12px;border-radius:5px;border:1px solid ${
                          l.state === "untranslated" ? "transparent" : "rgba(var(--ink-rgb),.13)"
                        };background:${
                          l.state === "untranslated" ? "var(--accent)" : "transparent"
                        };color:${
                          l.state === "untranslated" ? "var(--on-accent)" : "var(--text)"
                        };font-size:12px;font-weight:${
                          l.state === "untranslated" ? 700 : 500
                        };cursor:pointer`,
                      )}
                    >
                      {l.state === "untranslated" ? "Translate" : "Review"}
                    </button>
                  </div>
                  <div
                    style={s(
                      "margin-top:11px;height:3px;border-radius:3px;background:rgba(var(--ink-rgb),.08);overflow:hidden",
                    )}
                  >
                    <div
                      style={s(
                        `height:3px;border-radius:3px;width:${pct}%;background:${
                          l.state === "reflowed" ? "var(--warn)" : "var(--accent)"
                        }`,
                      )}
                    />
                  </div>
                  {l.state === "reflowed" && (
                    <div
                      style={s(
                        "display:flex;gap:8px;margin-top:11px;padding-top:11px;border-top:1px solid rgba(var(--warn-rgb),.2);font-size:12.5px;line-height:1.55;color:var(--warn)",
                      )}
                    >
                      <IcoAlert size={13} w={2} style={s("flex:none;margin-top:2px")} />
                      German runs 22% longer. Frames 2 and 5 reflowed to two lines — nothing
                      overruns the safe area.
                    </div>
                  )}
                </div>
              );
            })
          }
        </Async>

        <button
          type="button"
          onClick={translate}
          style={s(
            "display:flex;align-items:center;justify-content:center;gap:8px;height:44px;border:1px dashed rgba(var(--ink-rgb),.16);border-radius:9px;background:transparent;color:var(--muted-2);font-size:12.5px;cursor:pointer",
          )}
        >
          <IcoPlus size={14} />
          Add a language
        </button>
      </div>
    </div>
  );
}
