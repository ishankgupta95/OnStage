"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { s } from "@/lib/onstage/css";
import { DEVICES, TILT_PRESETS, bgCss, capInk } from "@/lib/onstage/data";
import { setWorkMode, useOnstage } from "@/store/onstage";
import { BrandMark, ThemeButton } from "../chrome";
import { setHref } from "@/lib/onstage/setLinks";
import { useSetRoute } from "@/lib/onstage/useSetRoute";
import { SetUnavailable } from "../SetUnavailable";
import { ModeSwitch } from "../editor/EditorScreen";
import { SaveBadge } from "../editor/SaveBadge";
import { NarrowBlock } from "../editor/NarrowBlock";
import { DropZone } from "../DropZone";
import { StoredScreenshot } from "../device";
import { FEATURES } from "@/lib/features";
import { StoreUrlField } from "../StoreUrlField";
import { IcoUpload } from "../icons";
import { EXPORT_ROOT, exportPlan, formatMB, tabletNote } from "@/lib/onstage/export/plan";
import { MAX_FRAMES, usableLocales } from "@/lib/onstage/export/slots";
import { plural } from "@/lib/onstage/words";

const STEPS = ["Upload", "Frame", "Caption", "Export"];

const KICKERS = [
  "STEP 1 — YOUR SCREENS",
  "STEP 2 — THE PHONE",
  "STEP 3 — THE WORDS",
  "STEP 4 — THE FILES",
];
const TITLES = [
  "Bring in your screenshots",
  "Pick the phone and its angle",
  "Write the headlines",
  "Check what you'll get",
];
const BODIES = [
  "Five screens is the sweet spot. The first two are what people actually see in search.",
  "One device and one angle for the whole set. Consistency reads as intentional.",
  FEATURES.aiAssist
    ? "Short and specific beats clever. Onstage suggests alternatives and flags anything that won't fit."
    : "Short and specific beats clever.",
  "Every size and language picked for export, in one zip.",
];
const CANVAS_HINTS = [
  "Your screens go inside these frames",
  "The angle applies to every frame",
  "Click a frame to edit its headline",
  "Every frame the export will render",
];
const NEXT_LABELS = [
  "Next — pick the phone",
  "Next — write headlines",
  "Next — check the files",
];

const SUGGESTIONS = [
  "Every run, on one map",
  "See where you've been",
  "Your whole year of running, mapped",
];

const SECTION_LABEL =
  "font-size:11px;letter-spacing:.09em;color:var(--muted-3)";

/** Where a guided drop starts: after the last frame that has a screenshot, as
 *  the frames are when the drop lands — so a second drop appends instead of
 *  replacing the first, and never fills a frame another drop just filled
 *  (GAP-1). */
const afterLastScreenshot = () =>
  useOnstage.getState().frames.reduce((n, fr, i) => (fr.screenshot ? i : n), -1) + 1;

/** Four steps, one decision each — the route for people who don't want a canvas. */
export function GuidedScreen() {
  const st = useOnstage();
  const router = useRouter();
  const step = st.gStep;
  const f = st.frames[st.active] ?? st.frames[0];
  // The names of the files dropped in this visit, by the screenshot each
  // became (a set stores the pictures, not their file names).
  const [names, setNames] = useState<Record<string, string>>({});
  // The canvas shows every frame; keep the one being worked on in view.
  const tiles = useRef<(HTMLDivElement | null)[]>([]);
  useEffect(() => {
    tiles.current[st.active]?.scrollIntoView?.({ block: "nearest", inline: "center" });
  }, [st.active]);
  // What the export will write: the export dialog's own numbers (SCREENSA-8).
  const plan = exportPlan({
    picks: st.exportPicks,
    langs: usableLocales(st.frames, st.exportLangs),
    frameCount: st.frames.length,
    root: EXPORT_ROOT,
  });
  const note = tabletNote(plan, st.device);

  // The same set the canvas edits, opened by the id in the URL (a bare
  // /guided first finds the last one). Frames and step controls wait for
  // it: before then they would edit a placeholder.
  const route = useSetRoute("guided");
  const setId = route.setId ?? "";
  const loaded =
    route.setId !== null &&
    st.loadedSetId === route.setId &&
    (route.status === "ready" || route.status === "checking");

  const next = () => {
    if (step < 3) st.setState({ gStep: step + 1 });
    // The export dialog opens on this set once the canvas has loaded it.
    else router.push(setHref("canvas", setId, "panel:export"));
  };
  const back = () =>
    step ? st.setState({ gStep: step - 1 }) : router.push("/dashboard");

  if (route.status === "missing" || route.status === "error") {
    return <SetUnavailable status={route.status} error={route.error} retry={route.retry} />;
  }

  return (
    <>
      <NarrowBlock />
      <div className="wide-only">
        <div
          style={s(
            "height:var(--screen-h,100vh);min-height:720px;display:flex;flex-direction:column;background:var(--bg);color:var(--text);overflow:hidden",
          )}
        >
          <div
            style={s(
              "height:52px;flex:none;display:flex;align-items:center;gap:14px;padding:0 14px;background:var(--chrome);border-bottom:1px solid rgba(var(--ink-rgb),.08)",
            )}
          >
            <Link
              href="/dashboard"
              style={s(
                "display:flex;align-items:center;gap:9px;cursor:pointer;color:var(--text)",
              )}
            >
              <BrandMark font={15} weight={500} tracking="-.02em" />
            </Link>
            <span
              style={s(
                "width:1px;height:22px;background:rgba(var(--ink-rgb),.1)",
              )}
            />
            {/* The same set the canvas edits, saved the same way: its save
                state shows here too, so a failed save is never silent. */}
            <div style={s("display:flex;align-items:center;gap:8px;min-width:0")}>
              <span
                style={s(
                  "font-size:13.5px;font-weight:500;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis",
                )}
              >
                {route.set?.name}
              </span>
              <SaveBadge />
            </div>
            <div
              style={s(
                "margin-left:auto;display:flex;align-items:center;gap:8px",
              )}
            >
              <ModeSwitch mode="guided" setId={setId} />
              <ThemeButton radius={8} />
            </div>
          </div>

          <div
            style={s(
              "flex:none;display:flex;align-items:center;gap:9px;padding:12px 18px;background:var(--chrome);border-bottom:1px solid rgba(var(--ink-rgb),.07);overflow-x:auto",
            )}
          >
            {STEPS.map((label, i) => {
              const on = i === step;
              const done = i < step;
              return (
                <span key={label} style={s("display:contents")}>
                  <button
                    type="button"
                    onClick={() => st.setState({ gStep: i })}
                    style={s(
                      `flex:none;display:inline-flex;align-items:center;gap:8px;padding:6px 12px 6px 7px;border-radius:999px;border:1px solid ${
                        on ? "var(--accent)" : "rgba(var(--ink-rgb),.1)"
                      };background:${on ? "rgba(var(--accent-rgb),.1)" : "transparent"};color:${
                        on
                          ? "var(--accent-hi)"
                          : done
                            ? "var(--text)"
                            : "var(--muted-2)"
                      };font-size:12.5px;font-weight:${on ? 600 : 400};cursor:pointer`,
                    )}
                  >
                    <span
                      style={s(
                        `display:grid;place-items:center;width:19px;height:19px;border-radius:50%;background:${
                          on || done
                            ? "rgba(var(--accent-rgb),.22)"
                            : "rgba(var(--ink-rgb),.07)"
                        };color:${on || done ? "var(--accent-hi)" : "var(--muted-3)"};font-size:10.5px;font-weight:600`,
                      )}
                    >
                      {done ? "✓" : i + 1}
                    </span>
                    <span>{label}</span>
                  </button>
                  {i < 3 ? (
                    <span
                      style={s(
                        "flex:none;width:16px;height:1px;background:rgba(var(--ink-rgb),.14)",
                      )}
                    />
                  ) : null}
                </span>
              );
            })}
            <span
              style={s(
                "margin-left:auto;flex:none;font-size:11px;letter-spacing:.09em;color:var(--muted-4)",
              )}
            >
              STEP {step + 1} OF 4
            </span>
          </div>

          <div
            style={s(
              "flex:1;display:grid;grid-template-columns:minmax(0,1fr) 380px;min-height:0",
            )}
          >
            <div
              style={s(
                "position:relative;display:grid;place-items:center;padding:26px;overflow:hidden;min-width:0",
              )}
            >
              <div
                style={s(
                  "position:absolute;inset:0;background-image:radial-gradient(rgba(var(--ink-rgb),.06) 1px, transparent 1px);background-size:26px 26px",
                )}
              />
              {/* Every frame — the export renders them all (GAP-1). The one
                  being worked on is the large one; the row scrolls when the
                  set is wider than the canvas. */}
              <div
                style={s(
                  "position:relative;display:flex;align-items:center;gap:16px;max-width:100%;overflow-x:auto;padding:30px 2px 70px;margin:-26px 0 -66px",
                )}
              >
                {loaded && st.frames.map((fr, i) => {
                  const on = i === st.active;
                  const w = on ? 226 : 200;
                  const h = on ? 470 : 418;
                  const dw = on ? 140 : 124;
                  const dh = on ? 286 : 254;
                  const empty = step === 0 && !fr.screenshot;
                  return (
                    <div
                      key={i}
                      ref={(el) => {
                        tiles.current[i] = el;
                      }}
                      onClick={() => st.setState({ active: i })}
                      style={s(
                        `position:relative;flex:none;width:${w}px;height:${h}px;border-radius:14px;overflow:hidden;display:flex;flex-direction:column;background:${
                          step === 0 ? "var(--surface-2)" : bgCss(fr.bg)
                        };border:${
                          step === 0
                            ? "1px dashed rgba(var(--ink-rgb),.18)"
                            : on && step === 2
                              ? "1.5px solid var(--accent)"
                              : "1px solid rgba(var(--ink-rgb),.08)"
                        };cursor:pointer;box-shadow:${
                          step === 0
                            ? "none"
                            : "0 30px 60px -26px rgba(0,0,0,.7)"
                        }`,
                      )}
                    >
                      <div
                        style={s(
                          `flex:none;padding:24px 20px 0;text-align:center;font:500 ${
                            on ? 19 : 17
                          }px/1.16 'Inter',sans-serif;letter-spacing:-.026em;color:${capInk(fr.bg)}`,
                        )}
                      >
                        {step === 0 ? "" : fr.caption}
                      </div>
                      <div
                        style={s(
                          "flex:1;display:grid;place-items:center;perspective:1100px",
                        )}
                      >
                        <div
                          style={s(
                            empty
                              ? `width:${dw}px;height:${dh}px;border-radius:20px;background:transparent;border:1.5px dashed rgba(var(--ink-rgb),.2)`
                              : `position:relative;width:${dw}px;height:${dh}px;border-radius:20px;background:linear-gradient(150deg,#3a3833,#141312);box-shadow:0 20px 38px rgba(0,0,0,.5);transform:rotateX(${fr.tiltX}deg) rotateY(${fr.tiltY}deg);transition:transform .12s linear`,
                          )}
                        >
                          {/* Your own screenshot, on every step — the upload
                              step included (SCREENSA-7). */}
                          {!empty && (
                            <StoredScreenshot
                              shot={fr.screenshot}
                              style="position:absolute;inset:4px;width:calc(100% - 8px);height:calc(100% - 8px);border-radius:16px;object-fit:cover"
                            />
                          )}
                        </div>
                      </div>
                      <span
                        style={s(
                          `position:absolute;bottom:9px;left:10px;padding:2px 7px;border-radius:4px;background:${
                            on && step === 2
                              ? "var(--accent)"
                              : "rgba(0,0,0,.35)"
                          };color:${
                            on && step === 2
                              ? "var(--on-accent)"
                              : "rgba(255,255,255,.72)"
                          };font-size:9.5px;letter-spacing:.07em`,
                        )}
                      >
                        {on && step === 2
                          ? "EDITING"
                          : String(i + 1).padStart(2, "0")}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div
                style={s(
                  "position:absolute;bottom:18px;left:50%;transform:translateX(-50%);font-size:12px;color:var(--muted-3)",
                )}
              >
                {CANVAS_HINTS[step]}
              </div>
            </div>

            <aside
              style={s(
                "background:var(--chrome);border-left:1px solid rgba(var(--ink-rgb),.08);display:flex;flex-direction:column;min-height:0",
              )}
            >
              <div style={s("flex:1;overflow-y:auto;padding:20px")}>
                <div style={s(SECTION_LABEL)}>{KICKERS[step]}</div>
                <h1
                  style={s(
                    "margin:9px 0 0;font-size:22px;font-weight:500;letter-spacing:-.026em",
                  )}
                >
                  {TITLES[step]}
                </h1>
                <p
                  style={s(
                    "margin:9px 0 0;font-size:13.5px;line-height:1.6;color:var(--muted)",
                  )}
                >
                  {BODIES[step]}
                </p>

                {loaded && step === 0 && (
                  <div style={s("margin-top:18px")}>
                    <DropZone
                      from={afterLastScreenshot}
                      multiple
                      onPlaced={(placed) =>
                        setNames((cur) => ({ ...cur, ...Object.fromEntries(placed.map((p) => [p.ref, p.name])) }))
                      }
                      base="border:1px dashed rgba(var(--ink-rgb),.18);border-radius:10px;padding:22px 14px;text-align:center;background:var(--surface-2)"
                      hover="border-color:var(--accent);background:rgba(var(--accent-rgb),.07)"
                    >
                      <div
                        style={s(
                          "display:grid;place-items:center;margin:0 auto 9px;width:34px;height:34px;border-radius:9px;background:rgba(var(--accent-rgb),.12);color:var(--accent)",
                        )}
                      >
                        <IcoUpload size={18} />
                      </div>
                      <div style={s("font-size:13.5px;font-weight:500")}>
                        Drop up to {MAX_FRAMES[st.store]} screenshots
                      </div>
                      {/* Reading a listing needs a server
                          (`FEATURES.storeImport`, plan D3). */}
                      {FEATURES.storeImport && (
                        <div
                          style={s(
                            "margin-top:4px;font-size:12px;color:var(--muted-2)",
                          )}
                        >
                          Or paste your App Store link
                        </div>
                      )}
                    </DropZone>
                    {FEATURES.storeImport && (
                      <div style={s("margin-top:10px")}>
                        <StoreUrlField
                          cta="Import"
                          onImported={() => st.setState({ gStep: 1 })}
                        />
                      </div>
                    )}
                    <div
                      style={s(
                        "margin-top:14px;display:flex;flex-direction:column;gap:7px",
                      )}
                    >
                      {/* The screens this set really holds (SCREENSA-9):
                          each frame with a screenshot, by its file name when
                          it was dropped in this visit. */}
                      {!st.frames.some((fr) => fr.screenshot) && (
                        <div style={s("font-size:12px;color:var(--muted-3)")}>No screens yet.</div>
                      )}
                      {st.frames.flatMap((fr, i) => (fr.screenshot ? [{ fr, i }] : [])).map(({ fr, i }) => (
                        <div
                          key={`${i}:${fr.screenshot}`}
                          style={s(
                            "display:flex;align-items:center;gap:10px;padding:8px 10px;border:1px solid rgba(var(--ink-rgb),.08);border-radius:8px;background:var(--surface)",
                          )}
                        >
                          <span
                            style={s(
                              "position:relative;flex:none;width:18px;height:26px;border-radius:3px;overflow:hidden;background:rgba(var(--ink-rgb),.08)",
                            )}
                          >
                            <StoredScreenshot
                              shot={fr.screenshot}
                              style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover"
                            />
                          </span>
                          <span style={s("flex:1;min-width:0;font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap")}>
                            {(fr.screenshot && names[fr.screenshot]) || `Frame ${String(i + 1).padStart(2, "0")}`}
                          </span>
                          <span
                            style={s(
                              `padding:2px 7px;border-radius:5px;font-size:10px;letter-spacing:.06em;background:${
                                i < 2
                                  ? "rgba(var(--accent-rgb),.12)"
                                  : "rgba(var(--ok-rgb),.12)"
                              };color:${i < 2 ? "var(--accent-hi)" : "var(--ok)"}`,
                            )}
                          >
                            {i < 2 ? "IN SEARCH" : "READY"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {loaded && step === 1 && (
                  <div style={s("margin-top:18px")}>
                    <div style={s(SECTION_LABEL)}>DEVICE</div>
                    <div
                      style={s(
                        "margin-top:9px;display:flex;flex-direction:column;gap:5px",
                      )}
                    >
                      {DEVICES.map((d) => (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => st.setState({ device: d.id })}
                          style={s(
                            `display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 9px;border:none;border-radius:5px;background:${
                              st.device === d.id
                                ? "rgba(var(--accent-rgb),.13)"
                                : "transparent"
                            };color:${
                              st.device === d.id
                                ? "var(--accent-hi)"
                                : "var(--text)"
                            };font-size:12.5px;text-align:left;cursor:pointer`,
                          )}
                        >
                          <span>{d.label}</span>
                          <span
                            style={s("font-size:11px;color:var(--muted-3)")}
                          >
                            {d.px}
                          </span>
                        </button>
                      ))}
                    </div>
                    <div style={s(`margin-top:18px;${SECTION_LABEL}`)}>
                      ANGLE
                    </div>
                    <div
                      style={s(
                        "margin-top:9px;display:grid;grid-template-columns:repeat(4,1fr);gap:7px",
                      )}
                    >
                      {TILT_PRESETS.map((p) => {
                        const on = p.x === f.tiltX && p.y === f.tiltY;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() =>
                              st.setState({
                                frames: st.frames.map((fr) => ({
                                  ...fr,
                                  tiltX: p.x,
                                  tiltY: p.y,
                                  depth: p.d,
                                })),
                              })
                            }
                            style={s(
                              `display:flex;flex-direction:column;align-items:center;gap:4px;padding:6px 2px 5px;border:1px solid ${
                                on ? "var(--accent)" : "rgba(var(--ink-rgb),.1)"
                              };border-radius:6px;background:${
                                on
                                  ? "rgba(var(--accent-rgb),.1)"
                                  : "transparent"
                              };color:${on ? "var(--accent-hi)" : "var(--muted)"};cursor:pointer`,
                            )}
                          >
                            <span
                              style={s(
                                "display:grid;place-items:center;height:38px;perspective:260px",
                              )}
                            >
                              <span
                                style={s(
                                  `display:block;width:17px;height:32px;border-radius:4px;background:linear-gradient(150deg,#514f48,#1a1917);box-shadow:0 5px 10px rgba(0,0,0,.45);transform:rotateX(${p.x}deg) rotateY(${p.y}deg)`,
                                )}
                              />
                            </span>
                            <span style={s("font-size:10.5px;font-weight:500")}>
                              {p.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <div
                      style={s(
                        "margin-top:10px;font-size:12px;line-height:1.55;color:var(--muted-3)",
                      )}
                    >
                      Applied to every frame. You can tilt them one by one in
                      canvas mode.
                    </div>
                  </div>
                )}

                {loaded && step === 2 && (
                  <div style={s("margin-top:18px")}>
                    <div style={s(SECTION_LABEL)}>
                      FRAME {String(st.active + 1).padStart(2, "0")} OF{" "}
                      {st.frames.length}
                    </div>
                    <textarea
                      value={f.caption}
                      onChange={(e) =>
                        st.typeCaption(e.target.value)
                      }
                      style={s(
                        "width:100%;min-height:70px;margin-top:9px;padding:10px;border-radius:8px;border:1px solid rgba(var(--ink-rgb),.12);background:var(--surface-2);color:var(--text);font:500 14px/1.4 'Inter',sans-serif;resize:vertical",
                      )}
                    />
                    {/* Tone chips and suggestions are the caption assistant
                        (`FEATURES.aiAssist`, plan D3/D9): without it they were
                        fixed sample-app headlines that ignored the tone. */}
                    {FEATURES.aiAssist && (
                      <>
                        <div style={s("display:flex;gap:6px;margin-top:10px")}>
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
                        <div style={s(`margin-top:16px;${SECTION_LABEL}`)}>
                          SUGGESTIONS
                        </div>
                        <div
                          style={s(
                            "margin-top:9px;display:flex;flex-direction:column;gap:7px",
                          )}
                        >
                          {SUGGESTIONS.map((t) => (
                            <button
                              key={t}
                              type="button"
                              className="hov-accent-border-solid"
                              onClick={() => st.patchFrame({ caption: t })}
                              style={s(
                                "text-align:left;padding:11px;border:1px solid rgba(var(--ink-rgb),.09);border-radius:8px;background:var(--surface);color:var(--text);font-size:13.5px;font-weight:500;cursor:pointer",
                              )}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        st.setState({
                          active:
                            (st.active + 1) % st.frames.length,
                        })
                      }
                      style={s(
                        "width:100%;margin-top:12px;height:34px;border:1px dashed rgba(var(--ink-rgb),.16);border-radius:8px;background:transparent;color:var(--muted);font-size:12.5px;cursor:pointer",
                      )}
                    >
                      Next frame →
                    </button>
                  </div>
                )}

                {loaded && step === 3 && (
                  <div style={s("margin-top:18px")}>
                    <div
                      style={s(
                        "padding:14px;border:1px solid rgba(var(--ink-rgb),.09);border-radius:10px;background:var(--surface)",
                      )}
                    >
                      <div
                        style={s("display:flex;align-items:baseline;gap:7px")}
                      >
                        <span
                          style={s(
                            "font-size:26px;font-weight:500;letter-spacing:-.03em",
                          )}
                        >
                          {plan.files}
                        </span>
                        <span
                          style={s("font-size:12.5px;color:var(--muted-2)")}
                        >
                          {plan.files === 1 ? "file" : "files"} · ~{formatMB(plan.estBytes)}
                        </span>
                      </div>
                      <div
                        style={s(
                          "margin-top:10px;display:flex;flex-direction:column;gap:6px",
                        )}
                      >
                        {[
                          ...plan.slots.map((p) => ({ label: p.slot.label, meta: plural(p.files, "file") })),
                          {
                            label: `Locales — ${plan.locales.join(", ")}`,
                            meta: `×${plan.locales.length}`,
                          },
                        ].map((r) => (
                          <div
                            key={r.label}
                            style={s(
                              "display:flex;align-items:center;gap:9px;font-size:12.5px",
                            )}
                          >
                            <span
                              style={s(
                                "flex:none;width:7px;height:7px;border-radius:50%;background:var(--ok)",
                              )}
                            />
                            <span style={s("flex:1")}>{r.label}</span>
                            <span
                              style={s("color:var(--muted-3);font-size:11.5px")}
                            >
                              {r.meta}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                    {note && (
                      <div
                        role="note"
                        style={s(
                          "margin-top:12px;padding:11px;border:1px solid rgba(var(--warn-rgb),.24);border-radius:10px;background:rgba(var(--warn-rgb),.06);font-size:12px;line-height:1.55;color:var(--warn)",
                        )}
                      >
                        {note}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div
                style={s(
                  "flex:none;display:flex;align-items:center;gap:9px;padding:14px 20px;border-top:1px solid rgba(var(--ink-rgb),.08)",
                )}
              >
                <button
                  type="button"
                  onClick={back}
                  style={s(
                    "height:40px;padding:0 15px;border:1px solid rgba(var(--ink-rgb),.14);border-radius:8px;background:transparent;color:var(--text);font-size:14px;cursor:pointer",
                  )}
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={next}
                  className="hov-accent"
                  style={s(
                    "flex:1;height:40px;border:1px solid var(--accent);border-radius:8px;background:transparent;color:var(--accent);font-size:14px;font-weight:500;cursor:pointer",
                  )}
                >
                  {step < 3 ? NEXT_LABELS[step] : `Export ${plural(plan.files, "file")}`}
                </button>
              </div>
              <div style={s("flex:none;padding:0 20px 14px;text-align:center")}>
                <span
                  onClick={() => {
                    setWorkMode("canvas").catch((e: unknown) =>
                      console.warn("[onstage] couldn't store the work mode", e),
                    );
                    router.push(setHref("canvas", setId));
                  }}
                  style={s(
                    "font-size:12px;color:var(--muted-3);cursor:pointer",
                  )}
                >
                  Skip the steps — open the canvas
                </span>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </>
  );
}
