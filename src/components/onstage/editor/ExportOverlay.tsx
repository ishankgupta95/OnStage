"use client";

import Link from "next/link";
import { useState } from "react";
import { useOnstage } from "@/store/onstage";
import { FALLBACK_APP_NAME, exportRoot, resolveAppName } from "@/lib/onstage/appName";
import { s } from "@/lib/onstage/css";
import { exportPlan, formatMB, tabletNote } from "@/lib/onstage/export/plan";
import { EXPORT_SLOTS, exportableLocales, usableLocales } from "@/lib/onstage/export/slots";
import { plural } from "@/lib/onstage/words";
import { getBackend } from "@/lib/data/backend";
import { useQuery } from "@/lib/data/useQuery";
import { FEATURES } from "@/lib/features";
import { IcoClose, IcoAlert, IcoExport } from "../icons";

/** The size each store insists on (the design's "Required" badges). */
const REQUIRED = ["APP_IPHONE_69", "PHONE"];

const ZIP_DEST = {
  id: "zip",
  label: "Download a zip",
  sub: "Folders per locale and size",
} as const;

const STORE_DESTS = [
  {
    id: "asc",
    label: "App Store Connect",
    sub: "Uploads to a draft version",
    connection: "apple",
  },
  {
    id: "play",
    label: "Play Console",
    sub: "Connect to enable",
    connection: "google",
  },
] as const;

/**
 * The remaining-exports line under the render button. Mounted behind
 * `FEATURES.exportQuota` and separate from ExportOverlay so its session read
 * doesn't run while exports are free.
 */
function QuotaNote() {
  const session = useQuery("session", () => getBackend().getSession());
  const remaining =
    session.data && session.data.exportsAllowed !== null
      ? Math.max(0, session.data.exportsAllowed - session.data.exportsUsed)
      : null;
  if (remaining === null) return <>Unlimited on your plan</>;
  return (
    <>
      {remaining > 0
        ? `Counts as 1 of your ${remaining} remaining export${remaining === 1 ? "" : "s"}`
        : "No exports left on the free plan"}
    </>
  );
}

/** One destination row: a radio, what it is, and (for a store) whether
 *  it is connected. */
function DestRow({
  on,
  label,
  sub,
  badge,
  onPick,
}: {
  on: boolean;
  label: string;
  sub: string;
  /** Store rows only: connected, or waiting on the person. */
  badge?: { ready: boolean };
  onPick: () => void;
}) {
  const ready = badge ? badge.ready : true;
  return (
    <div
      onClick={onPick}
      style={s(
        `display:flex;align-items:center;gap:10px;padding:9px 11px;border-radius:7px;border:1px solid ${
          on
            ? "rgba(var(--accent-rgb),.32)"
            : "rgba(var(--ink-rgb),.08)"
        };background:${
          on ? "rgba(var(--accent-rgb),.05)" : "transparent"
        };cursor:pointer;opacity:${ready ? 1 : 0.6}`,
      )}
    >
      <span
        style={s(
          `flex:none;width:14px;height:14px;border-radius:50%;border:1px solid ${
            on ? "var(--accent)" : "rgba(var(--ink-rgb),.2)"
          };box-shadow:${on ? "inset 0 0 0 3.5px var(--accent)" : "none"}`,
        )}
      />
      <div style={s("flex:1;min-width:0")}>
        <div style={s("font-size:13px;font-weight:500")}>
          {label}
        </div>
        <div style={s("font-size:11.5px;color:var(--muted-3)")}>
          {sub}
        </div>
      </div>
      {badge ? (
        <span
          style={s(
            `padding:2px 7px;border-radius:4px;font:500 10px 'Inter',ui-sans-serif;background:${
              ready
                ? "rgba(var(--ok-rgb),.12)"
                : "rgba(var(--warn-rgb),.14)"
            };color:${ready ? "var(--ok)" : "var(--warn)"}`,
          )}
        >
          {ready ? "CONNECTED" : "ACTION NEEDED"}
        </span>
      ) : null}
    </div>
  );
}

/**
 * App Store Connect and Play Console as destinations. Mounted only with
 * `FEATURES.storeUpload` (plan D3): without a store backend no upload can
 * succeed, so the dialog offers the zip alone — and the connection read
 * lives here so it doesn't run then.
 */
function StoreDestRows() {
  const st = useOnstage();
  const connections = useQuery("connections", () =>
    getBackend().listConnections(),
  );
  return (
    <>
      {STORE_DESTS.map((d) => {
        const conn = connections.data?.find((c) => c.id === d.connection);
        return (
          <DestRow
            key={d.id}
            on={st.exportDest === d.id}
            label={d.label}
            sub={conn ? conn.sub : d.sub}
            badge={{ ready: Boolean(conn?.connected) }}
            onPick={() => st.setState({ exportDest: d.id })}
          />
        );
      })}
    </>
  );
}

/**
 * "Export <app>": the name the zip, its folder and the feature graphic carry
 * (S3.4) — the set's own name for its app if it has one, else its app's —
 * edited in place. Cleared, it goes back to the app's name.
 */
function AppNameTitle({ appName, fallback }: { appName: string | undefined; fallback: string | null }) {
  const setAppName = useOnstage((st) => st.setAppName);
  const shown = appName ?? fallback ?? FALLBACK_APP_NAME;
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft === null) return;
    const next = draft.trim();
    setDraft(null);
    // Retyping what was shown — the app's own name, or "Onstage export" when
    // nothing names it — isn't a name of the set's own.
    if (appName === undefined && next === (fallback ?? FALLBACK_APP_NAME)) return;
    setAppName(next);
  };
  return (
    <div style={s("display:flex;align-items:baseline;gap:5px;min-width:0;font-size:14.5px;font-weight:700;letter-spacing:-.015em")}>
      Export
      <input
        aria-label="App name"
        value={draft ?? shown}
        placeholder={fallback ?? FALLBACK_APP_NAME}
        // Grows with the name, up to a point; a longer one scrolls in place.
        size={Math.min(36, Math.max(8, (draft ?? shown).length + 1))}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") setDraft(null);
        }}
        style={s(
          "min-width:0;padding:0 0 1px;border:none;border-bottom:1px dashed rgba(var(--ink-rgb),.22);background:transparent;color:var(--text);font:inherit;letter-spacing:inherit;outline:none",
        )}
      />
    </div>
  );
}

/** Sizes · locales · destination — the dialog that turns a set into files. */
export function ExportOverlay() {
  const st = useOnstage();
  // The app the set belongs to, for its name (S3.4).
  const appRecord = useQuery(`app-name:${st.loadedSetId ?? ""}`, () =>
    resolveAppName({}, st.loadedSetId, getBackend()),
  );
  const appName = st.appName ?? appRecord.data ?? null;
  const frameCount = st.frames.length;
  // What this selection writes — the same rules renderSet follows.
  // Only locales the set has captions in (interim EDITOR-6 fix, until S9.1).
  const locales = exportableLocales(st.frames);
  const langs = usableLocales(st.frames, st.exportLangs);
  const plan = exportPlan({ picks: st.exportPicks, langs, frameCount, root: exportRoot(appName) });
  const localeCount = plan.locales.length;
  const count = plan.files;
  const weight =
    st.exportState === "done" && st.exportBytes ? formatMB(st.exportBytes) : `~${formatMB(plan.estBytes)}`;
  const note = tabletNote(plan, st.device);

  // Without a store backend every export is a zip, whatever was picked.
  const toStore = FEATURES.storeUpload && st.exportDest !== "zip";
  // The error card's ways out. A refused upload leaves this run's files
  // rendered (exportBytes is set once they are), so the zip is one click
  // away whichever destination is picked now; a failed render has none.
  const seePlans = FEATURES.billing && st.exportBlockedByQuota;
  const reconnect = toStore && !st.exportBlockedByQuota;
  const downloadInstead = FEATURES.storeUpload && st.exportBytes > 0 && !st.exportBlockedByQuota;
  const storeName =
    st.exportDest === "asc" ? "App Store Connect" : "Play Console";
  const busy = st.exportState === "rendering" || st.exportState === "uploading";

  const close = () => {
    if (busy) return; // never abandon a run in progress
    st.setState({
      overlay: null,
      exportState: null,
      exportError: null,
      exportDone: 0,
      exportDeliveredTo: null,
      exportBlockedByQuota: false,
    });
  };

  const pct = st.exportTotal
    ? Math.round((st.exportDone / st.exportTotal) * 100)
    : 8;
  const label =
    st.exportState === "rendering"
      ? st.exportTotal
        ? `Rendering ${st.exportDone} of ${st.exportTotal}…`
        : "Preparing…"
      : st.exportState === "uploading"
        ? `Uploading to ${storeName}…`
        : st.exportState === "done"
          ? st.exportDeliveredTo === "zip"
            ? "Done — download ready"
            : `Uploaded to ${storeName}`
          : st.exportState === "error"
            ? "Try again"
            : toStore
              ? `Render & upload ${plural(count, "file")}`
              : `Render ${plural(count, "file")}`;

  return (
    <div
      style={s(
        "position:absolute;inset:0;z-index:200;display:grid;place-items:center;padding:26px;background:var(--backdrop);backdrop-filter:blur(6px)",
      )}
    >
      <div
        style={s(
          "width:100%;max-width:900px;max-height:100%;overflow-y:auto;border-radius:12px;border:1px solid rgba(var(--ink-rgb),.11);background:var(--surface);box-shadow:0 40px 100px rgba(0,0,0,.7)",
        )}
      >
        <div
          style={s(
            "display:flex;align-items:center;gap:12px;padding:15px 18px;border-bottom:1px solid rgba(var(--ink-rgb),.08)",
          )}
        >
          <span
            style={s(
              "display:grid;place-items:center;width:26px;height:26px;border-radius:6px;background:rgba(var(--accent-rgb),.14);color:var(--accent)",
            )}
          >
            <IcoExport size={15} w={2.1} />
          </span>
          <div style={s("min-width:0")}>
            <AppNameTitle appName={st.appName} fallback={appRecord.data ?? null} />
            <div
              style={s(
                "font:400 10.5px 'Inter',ui-sans-serif;color:var(--muted-4)",
              )}
            >
              {frameCount} FRAME{frameCount === 1 ? "" : "S"} · {localeCount} LOCALE
              {localeCount === 1 ? "" : "S"}
            </div>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={close}
            disabled={busy}
            style={s(
              "margin-left:auto;display:grid;place-items:center;width:26px;height:26px;border:none;border-radius:5px;background:transparent;color:var(--muted-2);cursor:pointer",
            )}
          >
            <IcoClose />
          </button>
        </div>

        <div
          style={s("display:grid;grid-template-columns:minmax(0,1fr) 310px")}
        >
          <div
            style={s(
              "padding:18px;border-right:1px solid rgba(var(--ink-rgb),.08)",
            )}
          >
            <div
              style={s(
                "font:400 10px 'Inter',ui-sans-serif;letter-spacing:.09em;color:var(--muted-2)",
              )}
            >
              SIZES
            </div>
            <div
              style={s(
                "margin-top:11px;display:flex;flex-direction:column;gap:7px",
              )}
            >
              {EXPORT_SLOTS.map((slot, i) => {
                const on = st.exportPicks.indexOf(i) >= 0;
                const files = plan.slots.find((p) => p.index === i)?.files;
                return (
                  <div
                    key={slot.label}
                    onClick={() => st.toggleExportSize(i)}
                    style={s(
                      `display:flex;align-items:center;gap:10px;padding:9px 11px;border-radius:7px;border:1px solid ${
                        on
                          ? "rgba(var(--accent-rgb),.32)"
                          : "rgba(var(--ink-rgb),.08)"
                      };background:${on ? "rgba(var(--accent-rgb),.05)" : "transparent"};cursor:pointer`,
                    )}
                  >
                    <span
                      style={s(
                        `flex:none;display:grid;place-items:center;width:16px;height:16px;border-radius:4px;border:1px solid ${
                          on ? "var(--accent)" : "rgba(var(--ink-rgb),.18)"
                        };background:${on ? "var(--accent)" : "transparent"};color:${
                          on ? "var(--on-accent)" : "transparent"
                        };font-size:10px;font-weight:700`,
                      )}
                    >
                      ✓
                    </span>
                    <div style={s("flex:1;min-width:0")}>
                      <div style={s("font-size:13px;font-weight:500")}>
                        {slot.label}
                      </div>
                      <div
                        style={s(
                          "font:400 10.5px 'Inter',ui-sans-serif;color:var(--muted-4)",
                        )}
                      >
                        {slot.w} × {slot.h}
                      </div>
                    </div>
                    {REQUIRED.includes(slot.folder) ? (
                      <span
                        style={s(
                          "padding:2px 7px;border-radius:4px;font-size:10.5px;font-weight:500;background:rgba(var(--ink-rgb),.05);color:var(--muted-2)",
                        )}
                      >
                        Required
                      </span>
                    ) : null}
                    <span
                      style={s(
                        "font:400 11px 'Inter',ui-sans-serif;color:var(--muted-2);width:52px;text-align:right",
                      )}
                    >
                      {on && files !== undefined ? plural(files, "file") : "—"}
                    </span>
                  </div>
                );
              })}
            </div>

            <div
              style={s(
                "height:1px;margin:16px 0;background:rgba(var(--ink-rgb),.08)",
              )}
            />
            <div
              style={s(
                "font:400 10px 'Inter',ui-sans-serif;letter-spacing:.09em;color:var(--muted-2)",
              )}
            >
              LOCALES
            </div>
            <div
              style={s("display:flex;flex-wrap:wrap;gap:6px;margin-top:11px")}
            >
              {locales.map((l) => {
                const on = langs.indexOf(l) >= 0;
                return (
                  <button
                    key={l}
                    type="button"
                    onClick={() => st.toggleExportLang(l)}
                    style={s(
                      `padding:5px 11px;border-radius:5px;border:1px solid ${
                        on
                          ? "rgba(var(--accent-rgb),.4)"
                          : "rgba(var(--ink-rgb),.1)"
                      };background:${on ? "rgba(var(--accent-rgb),.1)" : "transparent"};color:${
                        on ? "var(--accent-hi)" : "var(--muted-2)"
                      };font:500 11.5px 'Inter',ui-sans-serif;cursor:pointer`,
                    )}
                  >
                    {l}
                  </button>
                );
              })}
            </div>

            <div
              style={s(
                "height:1px;margin:16px 0;background:rgba(var(--ink-rgb),.08)",
              )}
            />
            <div
              style={s(
                "font:400 10px 'Inter',ui-sans-serif;letter-spacing:.09em;color:var(--muted-2)",
              )}
            >
              DESTINATION
            </div>
            <div
              style={s(
                "display:flex;flex-direction:column;gap:7px;margin-top:11px",
              )}
            >
              <DestRow
                on={!toStore}
                label={ZIP_DEST.label}
                sub={ZIP_DEST.sub}
                onPick={() => st.setState({ exportDest: ZIP_DEST.id })}
              />
              {FEATURES.storeUpload && <StoreDestRows />}
            </div>

            {/* A refused upload belongs here, on the destination that refused —
                the files are already rendered, so the zip is one click away.
                A failed render has no files: the main button tries again. */}
            {st.exportState === "error" && (
              <div
                style={s(
                  "display:flex;gap:10px;margin-top:12px;padding:12px;border-radius:7px;border:1px solid rgba(var(--warn-rgb),.28);background:rgba(var(--warn-rgb),.06)",
                )}
              >
                <IcoAlert
                  size={14}
                  w={2}
                  style={s("flex:none;margin-top:2px;color:var(--warn)")}
                />
                <div style={s("flex:1;min-width:0")}>
                  <div
                    style={s(
                      "font-size:12.5px;font-weight:600;color:var(--warn)",
                    )}
                  >
                    {st.exportBlockedByQuota
                      ? "You're out of exports"
                      : toStore
                        ? `${storeName} didn't accept it`
                        : "Export failed"}
                  </div>
                  <div
                    style={s(
                      "margin-top:4px;font-size:12px;line-height:1.55;color:var(--muted)",
                    )}
                  >
                    {st.exportError}
                  </div>
                  {(seePlans || reconnect || downloadInstead) && (
                    <div style={s("display:flex;gap:8px;margin-top:11px")}>
                      {seePlans && (
                        <Link
                          href="/pricing"
                          style={s(
                            "display:inline-flex;align-items:center;height:28px;padding:0 12px;border-radius:8px;border:1px solid var(--accent);background:transparent;color:var(--accent);font-size:12px;font-weight:500",
                          )}
                        >
                          See plans
                        </Link>
                      )}
                      {reconnect && (
                        <Link
                          href="/settings?tab=Store+connections"
                          style={s(
                            "display:inline-flex;align-items:center;height:28px;padding:0 12px;border-radius:8px;border:1px solid var(--accent);background:transparent;color:var(--accent);font-size:12px;font-weight:500",
                          )}
                        >
                          Reconnect
                        </Link>
                      )}
                      {downloadInstead && (
                        <button
                          type="button"
                          onClick={st.downloadRenderedZip}
                          style={s(
                            "height:28px;padding:0 11px;border:1px solid rgba(var(--ink-rgb),.14);border-radius:8px;background:transparent;color:var(--muted);font-size:12px;cursor:pointer",
                          )}
                        >
                          Download instead
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div
            style={s(
              "padding:18px;background:var(--surface-2);display:flex;flex-direction:column",
            )}
          >
            <div
              style={s(
                "font:400 10px 'Inter',ui-sans-serif;letter-spacing:.09em;color:var(--muted-2)",
              )}
            >
              YOU&apos;LL GET
            </div>
            <div
              style={s(
                "display:flex;align-items:baseline;gap:7px;margin-top:9px",
              )}
            >
              <span
                style={s(
                  "font-size:32px;font-weight:700;letter-spacing:-.035em",
                )}
              >
                {count}
              </span>
              <span style={s("font-size:12.5px;color:var(--muted-2)")}>
                PNG files · {weight}
              </span>
            </div>
            <div
              style={s(
                "margin-top:14px;padding:11px;border-radius:7px;background:var(--bg);border:1px solid rgba(var(--ink-rgb),.07);font:400 11.5px/1.95 'Inter',ui-sans-serif;color:var(--muted)",
              )}
            >
              {plan.tree.map((l) => (
                <div
                  key={`${l.ind}:${l.text}`}
                  style={s(
                    `padding-left:${l.ind * 13}px;overflow-wrap:anywhere;color:${
                      l.ind === 2 ? "var(--muted-3)" : "var(--text-2)"
                    }`,
                  )}
                >
                  {l.text}
                </div>
              ))}
            </div>
            {/* Only when a tablet size is picked — and it says what really
                happens to the phone screenshot there (EDITOR-16). */}
            {note && (
              <div
                role="note"
                style={s(
                  "display:flex;gap:8px;margin-top:12px;padding:10px 11px;border-radius:7px;border:1px solid rgba(var(--warn-rgb),.22);background:rgba(var(--warn-rgb),.06);font-size:11.5px;line-height:1.5;color:var(--warn)",
                )}
              >
                <IcoAlert size={13} w={2} style={s("flex:none;margin-top:1px")} />
                <span>{note}</span>
              </div>
            )}
            <div style={s("margin-top:auto;padding-top:16px")}>
              <button
                type="button"
                onClick={() => void st.runExport()}
                disabled={busy || count === 0}
                style={s(
                  `width:100%;height:40px;border:none;border-radius:7px;background:${
                    st.exportState === "done"
                      ? "var(--ok)"
                      : st.exportState === "error"
                        ? "var(--warn)"
                        : "var(--accent)"
                  };color:var(--on-accent);font-size:13.5px;font-weight:700;cursor:${
                    busy ? "progress" : "pointer"
                  };opacity:${count === 0 ? 0.5 : 1}`,
                )}
              >
                {label}
              </button>
              <div
                style={s(
                  st.exportState
                    ? "margin-top:10px;height:3px;border-radius:3px;background:rgba(var(--ink-rgb),.1);overflow:hidden"
                    : "display:none",
                )}
              >
                <div
                  style={s(
                    `height:3px;border-radius:3px;background:${
                      st.exportState === "error"
                        ? "var(--warn)"
                        : "var(--accent)"
                    };width:${st.exportState === "done" ? 100 : pct}%;transition:width .25s linear`,
                  )}
                />
              </div>
              <div
                style={s(
                  `margin-top:9px;font-size:11.5px;text-align:center;color:${
                    st.exportState === "error"
                      ? "var(--warn)"
                      : "var(--muted-4)"
                  }`,
                )}
              >
                {st.exportState === "done" ? (
                  st.exportDeliveredTo === "zip" ? (
                    FEATURES.storeUpload ? (
                      "Uploaded nothing yet — zip saved to Downloads"
                    ) : (
                      "Zip saved to Downloads"
                    )
                  ) : (
                    // Renders & uploads is the job queue (`FEATURES.jobQueue`).
                    FEATURES.jobQueue
                      ? `Sent to ${storeName} — track it in Renders & uploads`
                      : `Sent to ${storeName}`
                  )
                ) : FEATURES.exportQuota ? (
                  <QuotaNote />
                ) : (
                  "Renders in your browser"
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
