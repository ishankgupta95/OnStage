"use client";

import { useOnstage } from "@/store/onstage";
import { s } from "@/lib/onstage/css";
import { bgCss, capInk } from "@/lib/onstage/data";
import { FALLBACK_APP_NAME, appIdentity } from "@/lib/onstage/appName";
import { useSetApp } from "@/lib/onstage/useSetApp";
import { IcoClose } from "../icons";

/** "As the App Store shows it" — the search-result sanity check. */
export function StoreOverlay() {
  const st = useOnstage();
  // The set's own app — never the sample's listing (S3.4).
  const app = useSetApp(st.loadedSetId);
  const id = appIdentity(st.appName, app);
  const name = id.name ?? FALLBACK_APP_NAME;
  const tint = id.tint;
  return (
    <div
      style={s(
        "position:absolute;inset:0;z-index:200;display:grid;place-items:center;padding:26px;background:var(--backdrop);backdrop-filter:blur(6px)",
      )}
    >
      <div
        style={s(
          "width:100%;max-width:520px;border-radius:12px;border:1px solid rgba(var(--ink-rgb),.11);background:var(--surface);overflow:hidden;box-shadow:0 40px 100px rgba(0,0,0,.7)",
        )}
      >
        <div
          style={s(
            "display:flex;align-items:center;gap:10px;padding:13px 16px;border-bottom:1px solid rgba(var(--ink-rgb),.08)",
          )}
        >
          {/* Follows the set's store (the top bar's App Store / Play Store
              toggle, GAP-5). The full Play carousel is S5.5. */}
          <span style={s("font-size:13.5px;font-weight:600")}>
            {st.store === "play" ? "As Google Play shows it" : "As the App Store shows it"}
          </span>
          <span style={s("font:400 10.5px 'Inter',ui-sans-serif;color:var(--muted-4)")}>
            {st.store === "play" ? "PHONE · SEARCH RESULT" : "IPHONE · SEARCH RESULT"}
          </span>
          <button
            type="button"
            aria-label="Close"
            onClick={() => st.setState({ overlay: null })}
            style={s(
              "margin-left:auto;display:grid;place-items:center;width:26px;height:26px;border:none;border-radius:5px;background:transparent;color:var(--muted-2);cursor:pointer",
            )}
          >
            <IcoClose />
          </button>
        </div>
        <div style={s("padding:20px;background:var(--paper);color:var(--paper-ink)")}>
          <div style={s("display:flex;align-items:center;gap:13px")}>
            <span
              style={s(
                `display:grid;place-items:center;width:56px;height:56px;border-radius:13px;background:${tint};color:#fff;font-size:22px;font-weight:700`,
              )}
            >
              {id.initial}
            </span>
            <div style={s("flex:1;min-width:0")}>
              <div style={s("font-size:16px;font-weight:700;letter-spacing:-.02em")}>{name}</div>
            </div>
            <button
              type="button"
              style={s(
                `height:30px;padding:0 18px;border:none;border-radius:999px;background:${tint};color:#fff;font-size:12.5px;font-weight:700;cursor:pointer`,
              )}
            >
              GET
            </button>
          </div>
          <div style={s("display:flex;gap:9px;margin-top:18px;overflow:hidden")}>
            {st.frames.slice(0, 3).map((fr, i) => (
              <div
                key={i}
                style={s(
                  `flex:none;width:132px;height:250px;border-radius:9px;overflow:hidden;background:${bgCss(
                    fr.bg,
                  )};display:flex;flex-direction:column;align-items:center;box-shadow:0 6px 16px rgba(var(--paper-line-rgb),.18)`,
                )}
              >
                <div
                  style={s(
                    `padding:13px 11px 0;text-align:center;font:700 11px/1.2 'Inter',sans-serif;letter-spacing:-.02em;color:${capInk(
                      fr.bg,
                    )}`,
                  )}
                >
                  {fr.caption}
                </div>
                <div
                  style={s(
                    `margin-top:9px;width:74px;height:150px;border-radius:11px;background:linear-gradient(150deg,#3a3833,#141312);box-shadow:0 10px 20px rgba(0,0,0,.4);transform:perspective(460px) rotateY(${
                      fr.tiltY * 0.7
                    }deg) rotateX(${fr.tiltX * 0.7}deg)`,
                  )}
                />
              </div>
            ))}
          </div>
          <div style={s("margin-top:14px;font-size:11.5px;color:var(--paper-muted)")}>
            Only the first 2–3 frames appear in search. Onstage flags anything unreadable at this
            size.
          </div>
        </div>
      </div>
    </div>
  );
}
