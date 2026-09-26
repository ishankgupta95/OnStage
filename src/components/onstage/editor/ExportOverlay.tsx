"use client";

import Link from "next/link";
import { useOnstage } from "@/store/onstage";
import { s } from "@/lib/onstage/css";
import { EXPORT_SLOTS } from "@/lib/onstage/export/slots";
import { getBackend } from "@/lib/data/backend";
import { useQuery } from "@/lib/data/useQuery";
import { FEATURES } from "@/lib/features";
import { IcoClose, IcoAlert, IcoExport } from "../icons";

const SIZES: [string, string, string][] = [
  ["Apple — iPhone 6.9″", "1320 × 2868", "Required"],
  ["Apple — iPhone 6.5″", "1242 × 2688", ""],
  ["Apple — iPad Pro 13″", "2064 × 2752", ""],
  ["Google — Phone", "1080 × 1920", "Required"],
  ["Google — Tablet 7″", "1200 × 1920", "Missing frames"],
  ["Google — Feature graphic", "1024 × 500", ""],
];

const DESTS = [
  {
    id: "zip",
    label: "Download a zip",
    sub: "Folders per locale and size",
    connection: null,
  },
  {
    id: "asc",
    label: "App Store Connect",
    sub: "Trailhead 2.4 · draft",
    connection: "apple",
  },
  {
    id: "play",
    label: "Play Console",
    sub: "Connect to enable",
    connection: "google",
  },
] as const;

const TREE = [
  { text: "trailhead-store-assets/", ind: 0 },
  { text: "en-US/ · de-DE/", ind: 1 },
  { text: "APP_IPHONE_69/ 01…05.png", ind: 2 },
  { text: "APP_IPHONE_65/ 01…05.png", ind: 2 },
  { text: "PHONE/ 01…05.png", ind: 2 },
  { text: "TABLET_7/ 01…05.png", ind: 2 },
];

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

/** Sizes · locales · destination — the dialog that turns a set into files. */
export function ExportOverlay() {
  const st = useOnstage();
  const connections = useQuery("connections", () =>
    getBackend().listConnections(),
  );
  const frameCount = st.frames.length;
  const localeCount = Math.max(1, st.exportLangs.length);
  const count = st.exportPicks.reduce(
    (n, i) =>
      n + (EXPORT_SLOTS[i]?.kind === "feature" ? 1 : frameCount) * localeCount,
    0,
  );
  // Measured against real output: a full-bleed gradient + device PNG lands
  // around 0.46 bytes per pixel.
  const estBytes = st.exportPicks.reduce((b, i) => {
    const slot = EXPORT_SLOTS[i];
    if (!slot) return b;
    const files = (slot.kind === "feature" ? 1 : frameCount) * localeCount;
    return b + slot.w * slot.h * 0.46 * files;
  }, 0);
  const weight =
    st.exportState === "done" && st.exportBytes
      ? `${(st.exportBytes / 1_048_576).toFixed(1)} MB`
      : `${(estBytes / 1_048_576).toFixed(1)} MB`;

  const toStore = st.exportDest !== "zip";
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
              ? `Render & upload ${count} files`
              : `Render ${count} files`;

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
          <div>
            <div
              style={s(
                "font-size:14.5px;font-weight:700;letter-spacing:-.015em",
              )}
            >
              Export Trailhead
            </div>
            <div
              style={s(
                "font:400 10.5px 'Inter',ui-sans-serif;color:var(--muted-4)",
              )}
            >
              {frameCount} FRAMES · {localeCount} LOCALE
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
              {SIZES.map((e, i) => {
                const on = st.exportPicks.indexOf(i) >= 0;
                return (
                  <div
                    key={e[0]}
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
                        {e[0]}
                      </div>
                      <div
                        style={s(
                          "font:400 10.5px 'Inter',ui-sans-serif;color:var(--muted-4)",
                        )}
                      >
                        {e[1]}
                      </div>
                    </div>
                    {e[2] ? (
                      <span
                        style={s(
                          `padding:2px 7px;border-radius:4px;font-size:10.5px;font-weight:500;background:${
                            e[2] === "Missing frames"
                              ? "rgba(var(--warn-rgb),.13)"
                              : "rgba(var(--ink-rgb),.05)"
                          };color:${e[2] === "Missing frames" ? "#f5b544" : "var(--muted-2)"}`,
                        )}
                      >
                        {e[2]}
                      </span>
                    ) : null}
                    <span
                      style={s(
                        "font:400 11px 'Inter',ui-sans-serif;color:var(--muted-2);width:52px;text-align:right",
                      )}
                    >
                      {on
                        ? `${(SIZES[i][0].includes("Feature") ? 1 : frameCount) * localeCount} files`
                        : "—"}
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
              {["EN", "DE", "JA", "ES"].map((l) => {
                const on = st.exportLangs.indexOf(l) >= 0;
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
              {DESTS.map((d) => {
                const on = st.exportDest === d.id;
                const conn = d.connection
                  ? connections.data?.find((c) => c.id === d.connection)
                  : undefined;
                const ready = !d.connection || Boolean(conn?.connected);
                return (
                  <div
                    key={d.id}
                    onClick={() => st.setState({ exportDest: d.id })}
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
                        {d.label}
                      </div>
                      <div style={s("font-size:11.5px;color:var(--muted-3)")}>
                        {conn ? conn.sub : d.sub}
                      </div>
                    </div>
                    {d.connection ? (
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
              })}
            </div>

            {/* A refused upload belongs here, on the destination that refused —
                the files are already rendered, so the zip is one click away. */}
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
                  <div style={s("display:flex;gap:8px;margin-top:11px")}>
                    {FEATURES.billing && st.exportBlockedByQuota && (
                      <Link
                        href="/pricing"
                        style={s(
                          "display:inline-flex;align-items:center;height:28px;padding:0 12px;border-radius:8px;border:1px solid var(--accent);background:transparent;color:var(--accent);font-size:12px;font-weight:500",
                        )}
                      >
                        See plans
                      </Link>
                    )}
                    {toStore && !st.exportBlockedByQuota && (
                      <Link
                        href="/settings?tab=Store+connections"
                        style={s(
                          "display:inline-flex;align-items:center;height:28px;padding:0 12px;border-radius:8px;border:1px solid var(--accent);background:transparent;color:var(--accent);font-size:12px;font-weight:500",
                        )}
                      >
                        Reconnect
                      </Link>
                    )}
                    {!st.exportBlockedByQuota && (
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
              {TREE.map((l) => (
                <div
                  key={l.text}
                  style={s(
                    `padding-left:${l.ind * 13}px;color:${
                      l.ind === 2 ? "var(--muted-3)" : "var(--text-2)"
                    }`,
                  )}
                >
                  {l.text}
                </div>
              ))}
            </div>
            <div
              style={s(
                "display:flex;gap:8px;margin-top:12px;padding:10px 11px;border-radius:7px;border:1px solid rgba(var(--warn-rgb),.22);background:rgba(var(--warn-rgb),.06);font-size:11.5px;line-height:1.5;color:var(--warn)",
              )}
            >
              <IcoAlert size={13} w={2} style={s("flex:none;margin-top:1px")} />
              <span>
                Tablet 7″ uses 5 phone frames stretched to fit. Google accepts
                it, but it will look soft.
              </span>
            </div>
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
                    "Uploaded nothing yet — zip saved to Downloads"
                  ) : (
                    `Sent to ${storeName} — track it in Renders & uploads`
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
