"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { s } from "@/lib/onstage/css";
import { CAPTIONS, TEMPLATES, bgCss, capInk } from "@/lib/onstage/data";
import { useOnstage } from "@/store/onstage";
import { IcoBack } from "../icons";

const facts = (tpl: (typeof TEMPLATES)[number]) => [
  { label: "FRAMES", value: String(tpl.frames) },
  {
    label: "BACKGROUND",
    value: tpl.panoramic ? "Panoramic gradient" : "Per-frame gradient",
  },
  { label: "CAPTION", value: "Above device, centred" },
  { label: "USED BY", value: "1,840 sets" },
];

const FITS = [
  "iPhone 6.9″",
  "iPhone 6.5″",
  "Play phone",
  "Tablet 7″",
  "Feature graphic",
];
const paletteOf = (css: string) => {
  const hexes = css.match(/#[0-9a-f]{3,8}/gi) ?? [];
  return [...hexes, "#f0efe9"].slice(0, 4);
};

/** One template, seen whole, before it is applied to your set. */
export function TemplateDetailScreen({ slug }: { slug: string }) {
  const tpl = TEMPLATES.find((t) => t.slug === slug) ?? TEMPLATES[0];
  const router = useRouter();
  const applyTemplate = useOnstage((st) => st.applyTemplate);
  const frames = useOnstage((st) => st.frames);
  const [mine, setMine] = useState(false);

  // The strip shows the template's own sample captions, or yours against it.
  const strip = mine
    ? frames.map((f) => ({ caption: f.caption, screenshot: f.screenshot }))
    : CAPTIONS.map((c) => ({ caption: c, screenshot: null as string | null }));

  const apply = () => {
    applyTemplate(tpl.slug);
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
        <Link
          href="/templates"
          className="hov-ink"
          style={s(
            "display:inline-flex;align-items:center;gap:7px;height:30px;padding:0 11px;border:1px solid rgba(var(--ink-rgb),.11);border-radius:8px;background:transparent;color:var(--text);font-size:12.5px;cursor:pointer",
          )}
        >
          <IcoBack size={14} />
          All templates
        </Link>
        <span
          style={s("font-size:14.5px;font-weight:500;letter-spacing:-.015em")}
        >
          {tpl.name}
        </span>
        {tpl.badge ? (
          <span
            style={s(
              "padding:2px 8px;border-radius:6px;background:rgba(var(--accent-rgb),.12);color:var(--accent-hi);font-size:10.5px;letter-spacing:.07em",
            )}
          >
            {tpl.badge}
          </span>
        ) : null}
        <button
          type="button"
          onClick={apply}
          className="hov-accent"
          style={s(
            "margin-left:auto;display:inline-flex;align-items:center;height:32px;padding:0 14px;border:1px solid var(--accent);border-radius:8px;background:transparent;color:var(--accent);font-size:12.5px;font-weight:500;cursor:pointer",
          )}
        >
          Use this set
        </button>
      </div>

      <div
        style={s(
          "max-width:1240px;margin:0 auto;padding:26px 28px 60px;display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:26px;align-items:start",
        )}
      >
        <div>
          <div
            style={s(
              "display:flex;align-items:center;gap:9px;margin-bottom:12px",
            )}
          >
            <span
              style={s(
                "font:400 10.5px 'Inter',ui-sans-serif;letter-spacing:.09em;color:var(--muted-4)",
              )}
            >
              PREVIEW WITH
            </span>
            <div
              style={s(
                "display:flex;gap:2px;padding:2px;border:1px solid rgba(var(--ink-rgb),.09);border-radius:6px",
              )}
            >
              {[
                ["Sample set", false],
                ["My screens", true],
              ].map(([label, val]) => (
                <button
                  key={String(label)}
                  type="button"
                  onClick={() => setMine(val as boolean)}
                  style={s(
                    `padding:5px 11px;border:none;border-radius:4px;background:${
                      mine === val ? "rgba(var(--ink-rgb),.09)" : "transparent"
                    };color:${
                      mine === val ? "var(--text)" : "var(--muted-2)"
                    };font-size:12px;font-weight:${mine === val ? 600 : 400};cursor:pointer`,
                  )}
                >
                  {label as string}
                </button>
              ))}
            </div>
          </div>
          <div
            style={s(
              "display:flex;gap:12px;overflow-x:auto;padding-bottom:6px",
            )}
          >
            {strip.map((frame, i) => (
              <div
                key={i}
                style={s(
                  `position:relative;flex:none;width:194px;height:410px;border-radius:12px;overflow:hidden;display:flex;flex-direction:column;background-image:${bgCss(tpl.bg)};background-size:${tpl.panoramic ? "500% 100%" : "100% 100%"};background-position:${
                    tpl.panoramic ? i * 25 : 50
                  }% 50%;border:1px solid rgba(var(--ink-rgb),.08)`,
                )}
              >
                <div
                  style={s(
                    `flex:none;padding:22px 18px 0;text-align:center;font:500 16px/1.18 'Inter',sans-serif;letter-spacing:-.026em;color:${capInk(
                      tpl.bg,
                    )}`,
                  )}
                >
                  {frame.caption}
                </div>
                <div
                  style={s(
                    "flex:1;display:grid;place-items:center;perspective:900px",
                  )}
                >
                  <div
                    style={s(
                      `position:relative;width:120px;height:246px;border-radius:18px;overflow:hidden;background:linear-gradient(150deg,#3a3833,#141312);box-shadow:0 18px 34px rgba(0,0,0,.5);transform:rotateY(${tpl.ty}deg)`,
                    )}
                  >
                    {frame.screenshot && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={frame.screenshot}
                        alt=""
                        style={s(
                          "position:absolute;inset:4px;width:calc(100% - 8px);height:calc(100% - 8px);border-radius:14px;object-fit:cover",
                        )}
                      />
                    )}
                  </div>
                </div>
                <span
                  style={s(
                    "position:absolute;bottom:8px;left:10px;font-size:10px;letter-spacing:.06em;color:rgba(255,255,255,.65)",
                  )}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
              </div>
            ))}
          </div>

          <h1
            style={s(
              "margin:22px 0 0;font-size:24px;font-weight:500;letter-spacing:-.026em",
            )}
          >
            {tpl.tagline.charAt(0).toUpperCase() + tpl.tagline.slice(1)}
          </h1>
          <p
            style={s(
              "margin:10px 0 0;max-width:66ch;font-size:14.5px;line-height:1.62;color:var(--muted)",
            )}
          >
            Built for apps that lead with a single benefit per frame. Headlines
            sit above the device so nothing competes with the screen itself, and
            the gradient shifts across the set so the five frames read as one
            strip in the store.
          </p>
          <div
            style={s("display:flex;gap:24px;margin-top:22px;flex-wrap:wrap")}
          >
            {facts(tpl).map((f) => (
              <div key={f.label}>
                <div
                  style={s(
                    "font-size:11px;letter-spacing:.09em;color:var(--muted-3)",
                  )}
                >
                  {f.label}
                </div>
                <div style={s("margin-top:5px;font-size:14px;font-weight:500")}>
                  {f.value}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={s("display:flex;flex-direction:column;gap:14px")}>
          <div
            style={s(
              "padding:16px;border:1px solid rgba(var(--ink-rgb),.09);border-radius:14px;background:var(--surface)",
            )}
          >
            <div
              style={s(
                "font-size:11px;letter-spacing:.09em;color:var(--muted-3)",
              )}
            >
              PALETTE
            </div>
            <div style={s("display:flex;gap:7px;margin-top:11px")}>
              {paletteOf(tpl.preview).map((c) => (
                <div
                  key={c}
                  style={s(
                    `flex:1;height:40px;border-radius:8px;background:${c};border:1px solid rgba(var(--ink-rgb),.08)`,
                  )}
                />
              ))}
            </div>
            <div
              style={s(
                "margin-top:13px;font-size:11px;letter-spacing:.09em;color:var(--muted-3)",
              )}
            >
              TYPE
            </div>
            <div style={s("margin-top:7px;font-size:13.5px")}>
              Inter 500 · −2.5% tracking
            </div>
            <div
              style={s(
                "margin-top:13px;font-size:11px;letter-spacing:.09em;color:var(--muted-3)",
              )}
            >
              FITS
            </div>
            <div
              style={s("display:flex;flex-wrap:wrap;gap:6px;margin-top:8px")}
            >
              {FITS.map((f) => (
                <span
                  key={f}
                  style={s(
                    "padding:3px 9px;border-radius:6px;border:1px solid rgba(var(--ink-rgb),.12);font-size:11.5px;color:var(--muted)",
                  )}
                >
                  {f}
                </span>
              ))}
            </div>
          </div>

          <div
            style={s(
              "padding:16px;border:1px solid rgba(var(--ink-rgb),.09);border-radius:14px;background:var(--surface)",
            )}
          >
            <div style={s("font-size:13.5px;font-weight:500")}>
              Applying to Trailhead
            </div>
            <div
              style={s(
                "margin-top:7px;font-size:12.5px;line-height:1.55;color:var(--muted-2)",
              )}
            >
              Your five screens map one to one. Headlines carry over; the
              gradient replaces your current backgrounds.
            </div>
            <button
              type="button"
              onClick={apply}
              className="hov-accent"
              style={s(
                "width:100%;margin-top:12px;height:36px;border:1px solid var(--accent);border-radius:8px;background:transparent;color:var(--accent);font-size:13px;font-weight:500;cursor:pointer",
              )}
            >
              Apply and open canvas
            </button>
            <button
              type="button"
              onClick={() => setMine(true)}
              className="hov-ink"
              style={s(
                "width:100%;margin-top:7px;height:34px;border:1px solid rgba(var(--ink-rgb),.14);border-radius:8px;background:transparent;color:var(--text);font-size:12.5px;cursor:pointer",
              )}
            >
              Preview with my screens first
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
