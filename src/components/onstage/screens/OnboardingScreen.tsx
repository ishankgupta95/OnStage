"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { s } from "@/lib/onstage/css";
import { createFirstSet } from "@/lib/onstage/sets";
import { useCreateAndOpen } from "@/lib/onstage/useCreateAndOpen";
import { useOnstage } from "@/store/onstage";
import { FEATURES } from "@/lib/features";
import { BrandMark } from "../chrome";
import { StoreUrlField } from "../StoreUrlField";
import { WarnLine } from "../WarnLine";
import { IcoGlobe, IcoGrid, IcoUpload } from "../icons";
import { TEMPLATES, TEMPLATE_COUNT, bgCss, capInk } from "@/lib/onstage/data";

export const ROUTE_CARD =
  "padding:18px;border:1px solid rgba(var(--ink-rgb),.1);border-radius:10px;background:var(--surface);cursor:pointer;transition:border-color .16s ease";
export const ROUTE_ICON =
  "display:grid;place-items:center;width:36px;height:36px;border-radius:9px;background:rgba(var(--accent-rgb),.13);color:var(--accent)";

const ALL_START_ROUTES = [
  {
    id: "url",
    title: "Paste your store URL",
    body: "We pull your current screenshots, icon and app name straight off the listing.",
    meta: "FASTEST · 20 SECONDS",
    Icon: IcoGlobe,
  },
  {
    id: "upload",
    title: "Upload your screens",
    body: "Drop 3–10 PNGs. Onstage sizes them for every device each store requires.",
    meta: "MOST CONTROL",
    Icon: IcoUpload,
  },
  {
    id: "template",
    title: "Start from a template",
    body: "Pick a finished set, then swap your screens into it frame by frame.",
    meta: `${TEMPLATE_COUNT} SETS`,
    Icon: IcoGrid,
  },
];

/** The ways in, here and on the empty dashboard. Reading a listing from its
 *  store URL needs a server (`FEATURES.storeImport`, plan D3), so without
 *  one that route isn't offered. */
export const START_ROUTES = ALL_START_ROUTES.filter((r) => r.id !== "url" || FEATURES.storeImport);

/** The three looks on offer, each a template the new set is made in — its
 *  preview drawn from that template's own background and angle. Nothing
 *  here is matched to the person's app (nothing reads it). */
const STYLES: { slug: string; meta: string }[] = [
  { slug: "moss", meta: "PANORAMIC" },
  { slug: "cold-open", meta: "HIGH CONTRAST" },
  { slug: "field-notes", meta: "LIGHT, EDITORIAL" },
];
const LOOKS = STYLES.flatMap(({ slug, meta }) => {
  const tpl = TEMPLATES.find((t) => t.slug === slug);
  return tpl ? [{ slug, meta, name: tpl.name, bg: bgCss(tpl.bg), ty: tpl.ty, light: capInk(tpl.bg) !== "#fff" }] : [];
});

export function OnboardingScreen() {
  const router = useRouter();
  const setState = useOnstage((st) => st.setState);
  // First run ends in a new set (plan D10): the look picked, or the plain
  // default, opened in the chosen mode. It never restyles an existing set.
  const create = useCreateAndOpen();
  // Two steps: how to begin, then a look (the old screenshot picker showed
  // screens nobody had imported — SCREENSA-5).
  const [step, setStep] = useState(0);
  const [urlOpen, setUrlOpen] = useState(false);
  const [found, setFound] = useState<string | null>(null);

  return (
    <div
      style={s(
        "min-height:var(--screen-h,100vh);background:var(--bg);color:var(--text);display:flex;flex-direction:column",
      )}
    >
      <div
        style={s("display:flex;align-items:center;gap:12px;padding:16px 28px")}
      >
        <Link
          href="/"
          style={s(
            "display:flex;align-items:center;gap:12px;color:var(--text)",
          )}
        >
          <BrandMark font={15} weight={700} />
        </Link>
        <div
          style={s("margin-left:auto;display:flex;align-items:center;gap:9px")}
        >
          {[0, 1].map((i) => (
            <span
              key={i}
              style={s(
                `width:${i === step ? 22 : 7}px;height:7px;border-radius:4px;background:${
                  i <= step ? "var(--accent)" : "rgba(var(--ink-rgb),.14)"
                };transition:width .2s ease`,
              )}
            />
          ))}
          <span
            style={s(
              "font:400 10.5px 'Inter',ui-sans-serif;color:var(--muted-4);margin-left:5px",
            )}
          >
            STEP {step + 1} OF 2
          </span>
        </div>
      </div>

      <div
        style={s(
          "flex:1;display:grid;place-items:center;padding:20px 28px 60px",
        )}
      >
        <div style={s("width:100%;max-width:880px")}>
          {step === 0 && (
            <div>
              <div
                style={s(
                  "font:400 10.5px 'Inter',ui-sans-serif;letter-spacing:.12em;color:var(--muted-2)",
                )}
              >
                FIRST SET
              </div>
              <h1
                style={s(
                  "margin:14px 0 0;font-size:40px;line-height:1.06;letter-spacing:-.034em;font-weight:500",
                )}
              >
                How would you like to{" "}
                <span style={s("font-weight:300;font-style:italic")}>
                  begin
                </span>
                ?
              </h1>
              <p
                style={s(
                  "margin:12px 0 0;max-width:56ch;font-size:15px;line-height:1.6;color:var(--muted)",
                )}
              >
                Any route gets you to the same place: a full set, sized for both
                stores. You can change everything later.
              </p>
              <div
                style={s(
                  `display:grid;grid-template-columns:repeat(${START_ROUTES.length},1fr);gap:14px;margin-top:28px`,
                )}
              >
                {START_ROUTES.map((r) => (
                  <div
                    key={r.id}
                    className="hov-accent-border"
                    onClick={() =>
                      r.id === "template"
                        ? router.push("/templates")
                        : r.id === "url"
                          ? setUrlOpen(true)
                          : setStep(1)
                    }
                    style={s(ROUTE_CARD)}
                  >
                    <span style={s(ROUTE_ICON)}>
                      <r.Icon size={19} />
                    </span>
                    <div
                      style={s(
                        "margin-top:14px;font-size:15px;font-weight:600;letter-spacing:-.015em",
                      )}
                    >
                      {r.title}
                    </div>
                    <div
                      style={s(
                        "margin-top:7px;font-size:13px;line-height:1.55;color:var(--muted-2)",
                      )}
                    >
                      {r.body}
                    </div>
                    <div
                      style={s(
                        "margin-top:14px;font:400 10.5px 'Inter',ui-sans-serif;color:var(--accent-hi)",
                      )}
                    >
                      {r.meta}
                    </div>
                  </div>
                ))}
              </div>
              {FEATURES.storeImport && urlOpen && (
                <div
                  style={s(
                    "margin-top:16px;padding:14px;border:1px solid rgba(var(--accent-rgb),.32);border-radius:10px;background:var(--surface)",
                  )}
                >
                  <div style={s("font-size:13.5px;font-weight:500")}>
                    Paste your store URL
                  </div>
                  <div
                    style={s(
                      "margin:5px 0 11px;font-size:12.5px;color:var(--muted-2)",
                    )}
                  >
                    An apps.apple.com or play.google.com link to your listing.
                  </div>
                  <StoreUrlField
                    onImported={(listing) => {
                      setFound(listing.appName);
                      setStep(1);
                    }}
                  />
                </div>
              )}
              {FEATURES.storeImport && found && (
                <div
                  style={s("margin-top:10px;font-size:12.5px;color:var(--ok)")}
                >
                  Found {found}.
                </div>
              )}
              {/* No "Import a zip instead": there is no zip import yet
                  (project files arrive with S10.1 — SCREENSA-6). */}
            </div>
          )}

          {step === 1 && (
            <div>
              <div
                style={s(
                  "font:400 10.5px 'Inter',ui-sans-serif;letter-spacing:.12em;color:var(--muted-2)",
                )}
              >
                STEP 2 — PICK A LOOK
              </div>
              <h1
                style={s(
                  "margin:14px 0 0;font-size:36px;line-height:1.08;letter-spacing:-.032em;font-weight:500",
                )}
              >
                Three looks to start from
              </h1>
              <p
                style={s("margin:11px 0 0;font-size:14.5px;color:var(--muted)")}
              >
                Pick one to start; everything stays editable.
              </p>
              <div
                style={s(
                  "display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:24px",
                )}
              >
                {LOOKS.map(({ slug, meta, name, bg, ty, light }) => (
                  <div
                    key={slug}
                    onClick={() => void create.run(slug, () => createFirstSet({ slug }))}
                    style={s(`cursor:${create.busy ? "progress" : "pointer"}`)}
                  >
                    <div
                      style={s(
                        `position:relative;height:230px;border-radius:10px;overflow:hidden;background:${bg};display:flex;flex-direction:column;align-items:center;border:1px solid rgba(var(--ink-rgb),.09)`,
                      )}
                    >
                      <div
                        style={s(
                          `margin:18px 16px 0;width:calc(100% - 32px);height:6px;border-radius:3px;background:${
                            light
                              ? "rgba(0,0,0,.42)"
                              : "rgba(var(--ink-rgb),.6)"
                          }`,
                        )}
                      />
                      <div
                        style={s(
                          `margin-top:16px;width:74px;height:146px;border-radius:12px;background:linear-gradient(150deg,#3a3833,#141312);box-shadow:0 14px 28px rgba(0,0,0,.5);transform:perspective(560px) rotateY(${ty}deg)`,
                        )}
                      />
                    </div>
                    <div
                      style={s(
                        "display:flex;align-items:baseline;justify-content:space-between;margin-top:10px",
                      )}
                    >
                      <span style={s("font-size:13.5px;font-weight:600")}>
                        {name}
                      </span>
                      <span
                        style={s(
                          "font:400 10.5px 'Inter',ui-sans-serif;color:var(--muted-4)",
                        )}
                      >
                        {create.busy === slug ? "CREATING…" : meta}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              {create.error && <WarnLine style="margin-top:14px">{create.error.message}</WarnLine>}
              <div
                style={s(
                  "display:flex;align-items:center;gap:11px;margin-top:26px",
                )}
              >
                <button
                  type="button"
                  className="hov-accent"
                  disabled={create.busy !== null}
                  onClick={() => void create.run("canvas", () => createFirstSet({}))}
                  style={s(
                    "height:42px;padding:0 19px;border:1px solid var(--accent);border-radius:7px;background:transparent;color:var(--accent);font-size:14px;font-weight:500;cursor:pointer",
                  )}
                >
                  Open the canvas
                </button>
                <button
                  type="button"
                  className="hov-ink"
                  disabled={create.busy !== null}
                  onClick={() => {
                    setState({ gStep: 0 });
                    void create.run("guided", () => createFirstSet({}), "guided");
                  }}
                  style={s(
                    "height:42px;padding:0 16px;border:1px solid rgba(var(--ink-rgb),.13);border-radius:7px;background:transparent;color:var(--text);font-size:14px;cursor:pointer",
                  )}
                >
                  Walk me through it
                </button>
                <button
                  type="button"
                  onClick={() => router.push("/templates")}
                  style={s(
                    "height:42px;padding:0 16px;border:none;border-radius:7px;background:transparent;color:var(--muted);font-size:14px;cursor:pointer",
                  )}
                >
                  See all {TEMPLATE_COUNT}
                </button>
                {/* Back to the start (the removed picker step's own button). */}
                <button
                  type="button"
                  onClick={() => setStep(0)}
                  style={s(
                    "margin-left:auto;height:42px;padding:0 16px;border:1px solid rgba(var(--ink-rgb),.13);border-radius:7px;background:transparent;color:var(--text);font-size:14px;cursor:pointer",
                  )}
                >
                  Back
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
