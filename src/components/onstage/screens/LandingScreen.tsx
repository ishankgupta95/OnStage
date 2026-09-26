"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { s } from "@/lib/onstage/css";
import { BGS, TEMPLATES, bgCss } from "@/lib/onstage/data";
import { FEATURES } from "@/lib/features";
import { useOnstage } from "@/store/onstage";
import { BrandMark } from "../chrome";
import { IcoCube, IcoExport, IcoSparkle, IcoUpload } from "../icons";

const SIZE_CHIPS = [
  "iPhone 6.9″",
  "iPhone 6.5″",
  "iPad 13″",
  "Pixel phone",
  "Tablet 7″",
  "Tablet 10″",
  "Feature graphic",
];

const EXPORT_TREE = [
  { text: "en-US/", ind: 0, dim: false },
  { text: "APP_IPHONE_69/  01…05.png", ind: 1, dim: true },
  { text: "APP_IPHONE_65/  01…05.png", ind: 1, dim: true },
  { text: "APP_IPAD_PRO_3GEN_129/  01…05.png", ind: 1, dim: true },
  { text: "PHONE/  01…05.png", ind: 1, dim: true },
  { text: "TABLET_7/  01…05.png", ind: 1, dim: true },
  { text: "de-DE/", ind: 0, dim: false },
  { text: "ja-JP/", ind: 0, dim: false },
  { text: "feature-graphic-1024x500.png", ind: 0, dim: false },
];

const FEATURE_CARDS = [
  {
    Icon: IcoCube,
    title: "Tilt the phone, not a slider",
    body: "Perspective lives on the device itself. Grab it, drag it, watch the shadow follow. Four presets when you just want it done.",
    pad: "0 26px 0 0",
  },
  {
    Icon: IcoSparkle,
    title: "Captions that fit the frame",
    body: "Write one headline. Onstage offers three sharper ones and shows you what wraps, then carries the set across your locales.",
    pad: "0 26px",
  },
  {
    Icon: IcoUpload,
    title: "Named the way the stores expect",
    body: "Every file sized and foldered the way App Store Connect and Play Console want it, so the upload is drag-and-drop.",
    pad: "0 0 0 26px",
  },
];

/** The hero devices sit on their own state — the page is a live demo. */
function Hero() {
  const router = useRouter();
  const setState = useOnstage((st) => st.setState);
  const [bg, setBg] = useState("ember");
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const padDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const move = (ev: PointerEvent | React.PointerEvent) => {
      const nx = Math.max(-1, Math.min(1, ((ev.clientX - box.left) / box.width - 0.5) * 2));
      const ny = Math.max(-1, Math.min(1, ((ev.clientY - box.top) / box.height - 0.5) * 2));
      setTilt({ y: Math.round(nx * 26), x: Math.round(ny * -14) });
    };
    const up = () => {
      window.removeEventListener("pointermove", move as EventListener);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move as EventListener);
    window.addEventListener("pointerup", up);
    move(e);
  };

  const readout = `${tilt.y > 0 ? "+" : ""}${tilt.y}° / ${tilt.x > 0 ? "+" : ""}${tilt.x}°`;

  const openExport = () => {
    setState({ overlay: "export" });
    router.push("/editor");
  };

  return (
    <div style={s("position:relative;max-width:1240px;margin:0 auto;padding:34px 34px 0")}>
      <div
        onPointerDown={padDown}
        style={s(
          "position:relative;height:430px;display:flex;align-items:flex-end;justify-content:center;gap:18px;touch-action:none;cursor:grab",
        )}
      >
        <div
          style={s(
            "width:196px;height:340px;border-radius:14px;overflow:hidden;background:linear-gradient(160deg,#1f2b4d,#0e1424);box-shadow:0 40px 80px -34px rgba(0,0,0,.8)",
          )}
        >
          <div
            style={s(
              "padding:22px 18px 0;font-size:17px;font-weight:500;letter-spacing:-.025em;color:#fff",
            )}
          >
            Know your pace
          </div>
          <div
            style={s(
              "margin:18px auto 0;width:118px;height:238px;border-radius:18px;background:linear-gradient(150deg,#3a3833,#141312);transform:perspective(800px) rotateY(15deg)",
            )}
          />
        </div>

        <div
          style={s(
            `position:relative;flex:none;width:246px;height:424px;border-radius:15px;overflow:hidden;display:flex;flex-direction:column;background:${bgCss(
              bg,
            )};box-shadow:0 50px 90px -30px rgba(0,0,0,.85)`,
          )}
        >
          <div
            style={s(
              "padding:26px 22px 0;text-align:center;font-size:20px;font-weight:500;letter-spacing:-.028em;color:#fff",
            )}
          >
            Every run, mapped
          </div>
          <div style={s("flex:1;display:grid;place-items:center;perspective:1200px")}>
            <div
              style={s(
                `position:relative;width:162px;height:322px;transform:rotateX(${tilt.x}deg) rotateY(${tilt.y}deg);transition:transform .1s linear;filter:drop-shadow(0 22px 22px rgba(0,0,0,.4))`,
              )}
            >
              <div
                style={s(
                  "position:absolute;inset:0;border-radius:24px;background:linear-gradient(150deg,#3a3833,#141312 45%,#2b2a26);box-shadow:0 26px 50px -16px rgba(0,0,0,.7)",
                )}
              />
              <div
                style={s(
                  "position:absolute;inset:5px;border-radius:20px;overflow:hidden;background:#0f1114;display:grid;place-items:center",
                )}
              >
                <div style={s("text-align:center;padding:0 14px")}>
                  <div
                    style={s(
                      "display:grid;place-items:center;margin:0 auto 9px;width:30px;height:30px;border-radius:8px;background:rgba(255,255,255,.08);color:#cfd6dd",
                    )}
                  >
                    <IcoUpload size={16} />
                  </div>
                  <div style={s("font-size:11.5px;font-weight:500;color:#dfe6ee")}>
                    Drop a screenshot
                  </div>
                  <div style={s("margin-top:3px;font-size:10.5px;color:#7d8794")}>PNG · any size</div>
                </div>
              </div>
            </div>
          </div>
          <div
            style={s(
              "position:absolute;inset:-3px;border-radius:18px;border:1.5px solid var(--accent);pointer-events:none",
            )}
          />
        </div>

        <div
          style={s(
            "width:196px;height:340px;border-radius:14px;overflow:hidden;background:linear-gradient(155deg,#1b6f6a,#0f3a3d);box-shadow:0 40px 80px -34px rgba(0,0,0,.8)",
          )}
        >
          <div
            style={s(
              "padding:22px 18px 0;font-size:17px;font-weight:500;letter-spacing:-.025em;color:#fff",
            )}
          >
            Trails near you
          </div>
          <div
            style={s(
              "margin:18px auto 0;width:118px;height:238px;border-radius:18px;background:linear-gradient(150deg,#3a3833,#141312);transform:perspective(800px) rotateY(-15deg)",
            )}
          />
        </div>

        <div
          style={s(
            "position:absolute;left:50%;bottom:8px;transform:translateX(-50%);z-index:6;display:flex;align-items:center;gap:6px;padding:6px;border-radius:9px;background:var(--pop);border:1px solid rgba(var(--ink-rgb),.12);box-shadow:0 20px 46px rgba(0,0,0,.45)",
          )}
        >
          <span
            style={s(
              "display:grid;place-items:center;width:24px;height:22px;border-radius:4px;background:rgba(var(--accent-rgb),.16);color:var(--accent)",
            )}
          >
            <IcoCube size={13} />
          </span>
          <span style={s("font-size:12.5px;font-weight:500")}>Perspective</span>
          <span
            style={s(
              "font:400 10.5px 'Inter',ui-sans-serif;color:var(--accent-hi2);padding:2px 6px;border-radius:3px;background:rgba(var(--accent-rgb),.12)",
            )}
          >
            {readout}
          </span>
          <span style={s("width:1px;height:18px;background:rgba(var(--ink-rgb),.1)")} />
          <div style={s("display:flex;gap:3px")}>
            {BGS.slice(0, 4).map((b) => (
              <button
                key={b.id}
                type="button"
                title={b.label}
                aria-label={b.label}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => setBg(b.id)}
                style={s(
                  `width:20px;height:20px;border-radius:4px;border:1.5px solid ${
                    bg === b.id ? "var(--accent)" : "rgba(var(--ink-rgb),.16)"
                  };background:${b.css};cursor:pointer`,
                )}
              />
            ))}
          </div>
          <span style={s("width:1px;height:18px;background:rgba(var(--ink-rgb),.1)")} />
          <span style={s("font-size:11.5px;color:var(--muted-2);padding-right:4px")}>
            {tilt.x || tilt.y ? "nice — now export it" : "drag anywhere to tilt"}
          </span>
        </div>
      </div>

      <div style={s("display:flex;align-items:center;justify-content:center;gap:11px;padding:26px 0 40px")}>
        <button
          type="button"
          onClick={openExport}
          className="hov-accent"
          style={s(
            "display:inline-flex;align-items:center;gap:9px;height:44px;padding:0 20px;border:1px solid var(--accent);border-radius:8px;background:transparent;color:var(--accent);font-size:14.5px;font-weight:500;cursor:pointer",
          )}
        >
          Export this set
          <IcoExport size={15} w={2.1} />
        </button>
        <Link
          href="/onboarding"
          className="hov-ink"
          style={s(
            "display:inline-flex;align-items:center;height:44px;padding:0 18px;border:1px solid rgba(var(--ink-rgb),.14);border-radius:8px;background:transparent;color:var(--text);font-size:14.5px;font-weight:500;cursor:pointer",
          )}
        >
          Start a full set
        </Link>
        <span style={s("font-size:12.5px;color:var(--muted-3);margin-left:6px")}>
          Free · runs in your browser
        </span>
      </div>
    </div>
  );
}

export function LandingScreen() {
  const router = useRouter();
  const setState = useOnstage((st) => st.setState);

  return (
    <div style={s("background:var(--bg);color:var(--text)")}>
      {/* ── nav ─────────────────────────────────────────────────────── */}
      <div
        style={s(
          "position:sticky;top:0;z-index:60;display:flex;align-items:center;gap:26px;padding:14px 34px;background:var(--scrim-strong);backdrop-filter:blur(16px);border-bottom:1px solid rgba(var(--ink-rgb),.07)",
        )}
      >
        <div style={s("display:flex;align-items:center;gap:9px;margin-right:auto")}>
          <BrandMark withNib font={16} weight={700} />
        </div>
        <div style={s("display:flex;align-items:center;gap:24px;font-size:13.5px;color:var(--muted)")}>
          <Link href="/templates" style={s("color:inherit")}>
            Templates
          </Link>
          <Link href="/editor" style={s("color:inherit")}>
            Editor
          </Link>
          {FEATURES.billing && (
            <Link href="/pricing" style={s("color:inherit")}>
              Pricing
            </Link>
          )}
        </div>
        <div style={s("display:flex;align-items:center;gap:10px")}>
          {FEATURES.accounts && (
            <Link
              href="/signin"
              style={s(
                "display:inline-flex;align-items:center;height:32px;padding:0 12px;border:1px solid rgba(var(--ink-rgb),.12);border-radius:6px;background:transparent;color:var(--text);font-size:13px;font-weight:500",
              )}
            >
              Sign in
            </Link>
          )}
          <Link
            href="/onboarding"
            style={s(
              "display:inline-flex;align-items:center;height:32px;padding:0 14px;border:1px solid var(--accent);border-radius:6px;background:transparent;color:var(--accent);font-size:13px;font-weight:700",
            )}
          >
            Start a set
          </Link>
        </div>
      </div>

      {/* ── hero ────────────────────────────────────────────────────── */}
      <div style={s("position:relative;overflow:hidden;border-bottom:1px solid rgba(var(--ink-rgb),.07)")}>
        <div
          style={s(
            "position:absolute;inset:0;background-image:radial-gradient(rgba(var(--ink-rgb),.075) 1px, transparent 1px);background-size:26px 26px",
          )}
        />
        <div
          style={s(
            "position:absolute;top:-140px;left:50%;transform:translateX(-50%);width:1100px;height:560px;background:radial-gradient(50% 50% at 50% 50%, rgba(var(--accent-rgb),.16), transparent 70%);pointer-events:none",
          )}
        />
        <div style={s("position:relative;max-width:1000px;margin:0 auto;padding:62px 34px 0;text-align:center")}>
          <div
            style={s(
              "display:inline-flex;align-items:center;gap:8px;padding:5px 11px;border-radius:999px;border:1px solid rgba(var(--ink-rgb),.12);font-size:10.5px;letter-spacing:.12em;white-space:nowrap;color:var(--muted)",
            )}
          >
            <span style={s("width:5px;height:5px;border-radius:50%;background:var(--accent)")} />
            NO ACCOUNT, NOTHING UPLOADED
          </div>
          <h1
            style={s(
              "margin:20px 0 0;font-size:clamp(36px,4.1vw,58px);line-height:1.03;letter-spacing:-.038em;font-weight:500;text-wrap:balance",
            )}
          >
            Make a store screenshot{" "}
            <span style={s("font-style:italic;font-weight:300")}>right here</span>.
          </h1>
          <p
            style={s(
              "margin:18px auto 0;max-width:56ch;font-size:16px;line-height:1.6;color:var(--muted)",
            )}
          >
            Drop a screen onto the phone below, tilt it, pick a background. Your screenshots never
            leave your browser.
          </p>
        </div>
        <Hero />
      </div>

      {/* ── size chips ──────────────────────────────────────────────── */}
      <div style={s("max-width:1240px;margin:0 auto;padding:10px 34px 74px")}>
        <div
          style={s(
            "display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding-top:26px;border-top:1px solid rgba(var(--ink-rgb),.07)",
          )}
        >
          <span
            style={s("font:400 10.5px 'Inter',ui-sans-serif;letter-spacing:.1em;color:var(--muted-4)")}
          >
            EVERY REQUIRED SIZE, ONE EXPORT
          </span>
          <div style={s("display:flex;gap:7px;flex-wrap:wrap")}>
            {SIZE_CHIPS.map((c) => (
              <span
                key={c}
                style={s(
                  "padding:5px 10px;border-radius:5px;border:1px solid rgba(var(--ink-rgb),.1);background:rgba(var(--ink-rgb),.02);font-size:12px;color:var(--muted)",
                )}
              >
                {c}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── templates ───────────────────────────────────────────────── */}
      <div style={s("max-width:1240px;margin:0 auto;padding:0 34px 84px")}>
        <div
          style={s(
            "display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:24px",
          )}
        >
          <div>
            <h2 style={s("margin:0;font-size:36px;letter-spacing:-.03em;font-weight:500")}>
              Pick a look, not a layout
            </h2>
            <p
              style={s(
                "margin:10px 0 0;max-width:56ch;font-size:15px;line-height:1.6;color:var(--muted)",
              )}
            >
              240 sets built by app designers, each one already sized for both stores. Swap in your
              screens and the whole set restyles.
            </p>
          </div>
          <Link
            href="/templates"
            style={s(
              "flex:none;display:inline-flex;align-items:center;height:38px;padding:0 15px;border:1px solid rgba(var(--ink-rgb),.14);border-radius:6px;background:transparent;color:var(--text);font-size:13px;font-weight:500",
            )}
          >
            See all →
          </Link>
        </div>
        <div style={s("display:grid;grid-template-columns:repeat(6,1fr);gap:14px")}>
          {TEMPLATES.slice(0, 6).map((t) => (
            <div key={t.slug} onClick={() => router.push("/templates")} style={s("cursor:pointer")}>
              <div
                style={s(
                  `position:relative;height:176px;border-radius:8px;overflow:hidden;background:${t.preview};display:flex;flex-direction:column;align-items:center;border:1px solid rgba(var(--ink-rgb),.08)`,
                )}
              >
                <div
                  style={s(
                    `margin:16px 14px 0;width:calc(100% - 28px);height:5px;border-radius:3px;background:${
                      t.name === "Field Notes" ? "rgba(0,0,0,.45)" : "rgba(var(--ink-rgb),.6)"
                    }`,
                  )}
                />
                <div
                  style={s(
                    `margin-top:14px;width:56px;height:112px;border-radius:9px;background:linear-gradient(150deg,#3a3833,#141312);box-shadow:0 12px 22px rgba(0,0,0,.45);transform:perspective(500px) rotateY(${t.ty}deg)`,
                  )}
                />
              </div>
              <div style={s("margin-top:9px;font-size:12.5px;font-weight:500")}>{t.name}</div>
              <div
                style={s("margin-top:2px;font:400 10.5px 'Inter',ui-sans-serif;color:var(--muted-4)")}
              >
                {t.frames} frames
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── three claims ────────────────────────────────────────────── */}
      <div style={s("border-top:1px solid rgba(var(--ink-rgb),.07);background:var(--surface-2)")}>
        <div
          style={s(
            "max-width:1240px;margin:0 auto;padding:74px 34px;display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:rgba(var(--ink-rgb),.07)",
          )}
        >
          {FEATURE_CARDS.map(({ Icon, title, body, pad }) => (
            <div key={title} style={s(`background:var(--surface-2);padding:${pad}`)}>
              <div
                style={s(
                  "display:grid;place-items:center;width:34px;height:34px;border-radius:8px;background:rgba(var(--accent-rgb),.13);color:var(--accent)",
                )}
              >
                <Icon size={18} w={1.7} />
              </div>
              <h3 style={s("margin:16px 0 0;font-size:19px;letter-spacing:-.02em;font-weight:500")}>
                {title}
              </h3>
              <p style={s("margin:9px 0 0;font-size:14px;line-height:1.6;color:var(--muted)")}>
                {body}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ── what comes out ──────────────────────────────────────────── */}
      <div
        style={s(
          "background:var(--surface-2);color:var(--text);border-top:1px solid rgba(var(--ink-rgb),.07);border-bottom:1px solid rgba(var(--ink-rgb),.07)",
        )}
      >
        <div
          style={s(
            "max-width:1240px;margin:0 auto;padding:76px 34px;display:grid;grid-template-columns:minmax(0,1fr) 420px;gap:60px;align-items:center",
          )}
        >
          <div>
            <div
              style={s("font:400 10.5px 'Inter',ui-sans-serif;letter-spacing:.12em;color:var(--muted)")}
            >
              WHAT COMES OUT
            </div>
            <h2
              style={s(
                "margin:16px 0 0;font-size:38px;line-height:1.08;letter-spacing:-.032em;font-weight:500",
              )}
            >
              One set in.{" "}
              <span style={s("font-weight:300;font-style:italic")}>Every file</span> the stores ask
              for, out.
            </h2>
            <p
              style={s(
                "margin:14px 0 0;max-width:50ch;font-size:15.5px;line-height:1.62;color:var(--muted)",
              )}
            >
              Named, ordered, and sized to spec — 6.9″ and 6.5″ for Apple, phone and 7″/10″ tablet
              for Play, plus your feature graphic. Locales get their own folders.
            </p>
            <div style={s("display:flex;gap:10px;margin-top:26px")}>
              <button
                type="button"
                onClick={() => {
                  setState({ overlay: "export" });
                  router.push("/editor");
                }}
                style={s(
                  "height:40px;padding:0 16px;border:1px solid var(--accent);border-radius:7px;background:transparent;color:var(--accent);font-size:14px;font-weight:600;cursor:pointer",
                )}
              >
                See an export
              </button>
              {FEATURES.billing && (
                <Link
                  href="/pricing"
                  style={s(
                    "display:inline-flex;align-items:center;height:40px;padding:0 16px;border:1px solid rgba(var(--ink-rgb),.14);border-radius:7px;background:transparent;color:var(--text);font-size:14px;font-weight:500",
                  )}
                >
                  Pricing
                </Link>
              )}
            </div>
          </div>
          <div
            style={s(
              "border-radius:10px;background:var(--surface);border:1px solid rgba(var(--ink-rgb),.09);box-shadow:0 24px 60px -28px rgba(0,0,0,.35);overflow:hidden",
            )}
          >
            <div
              style={s(
                "display:flex;align-items:center;gap:7px;padding:11px 13px;border-bottom:1px solid rgba(var(--ink-rgb),.08);font:500 11.5px 'Inter',ui-sans-serif;color:var(--muted)",
              )}
            >
              <span style={s("width:8px;height:8px;border-radius:50%;background:var(--accent)")} />
              trailhead-store-assets.zip
            </div>
            <div style={s("padding:12px 13px;font:400 12px/2.05 'Inter',ui-sans-serif;color:var(--text)")}>
              {EXPORT_TREE.map((l) => (
                <div
                  key={l.text}
                  style={s(
                    `padding-left:${l.ind * 18}px;color:${
                      l.dim ? "var(--muted-2)" : "var(--text)"
                    };font-weight:${l.dim ? 400 : 500}`,
                  )}
                >
                  {l.text}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── footer ──────────────────────────────────────────────────── */}
      <div style={s("border-top:1px solid rgba(var(--ink-rgb),.07)")}>
        <div
          style={s(
            "max-width:1240px;margin:0 auto;padding:56px 34px;display:flex;align-items:center;justify-content:space-between;gap:24px;flex-wrap:wrap",
          )}
        >
          <div style={s("display:flex;align-items:center;gap:9px")}>
            <BrandMark size={24} font={14} weight={700} tracking="-.02em" />
            <span style={s("font-size:13px;color:var(--muted-4)")}>
              — store screenshots, done in an afternoon.
            </span>
          </div>
          <div style={s("display:flex;gap:20px;font-size:13px;color:var(--muted-2)")}>
            <Link href="/templates" style={s("color:inherit")}>
              Templates
            </Link>
            {FEATURES.billing && (
              <Link href="/pricing" style={s("color:inherit")}>
                Pricing
              </Link>
            )}
            <Link href="/privacy" style={s("color:inherit")}>
              Privacy
            </Link>
            <Link href="/terms" style={s("color:inherit")}>
              Terms
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
