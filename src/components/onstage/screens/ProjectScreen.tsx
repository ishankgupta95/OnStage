"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import ErrorState from "@/components/ErrorState";
import { s } from "@/lib/onstage/css";
import { Async, Shimmer } from "@/components/onstage/Async";
import { getBackend } from "@/lib/data/backend";
import type { App, ScreenshotSet, SetDoc } from "@/lib/data/types";
import { useQuery, type QueryState } from "@/lib/data/useQuery";
import { FEATURES } from "@/lib/features";
import { bgCss } from "@/lib/onstage/data";
import { setLocales } from "@/lib/onstage/locales";
import { requiredSizes } from "@/lib/onstage/readiness";
import { openSetHref, setHref } from "@/lib/onstage/setLinks";
import { createBlankSet, newestFirst, setPreviewSource } from "@/lib/onstage/sets";
import { useAppRoute } from "@/lib/onstage/useAppRoute";
import { useCreateAndOpen } from "@/lib/onstage/useCreateAndOpen";
import { flushSaves, removeSet, useOnstage } from "@/store/onstage";
import { BackButton } from "../chrome";
import { IcoExport, IcoPlus } from "../icons";
import { SetRow } from "../SetRow";
import { WarnLine } from "../WarnLine";
import { NotFoundScreen } from "./NotFoundScreen";
import { LocalesTab } from "./project/LocalesTab";
import { UploadsTab } from "./project/UploadsTab";


const CARD =
  "border:1px solid rgba(var(--ink-rgb),.09);border-radius:9px;background:var(--surface);padding:14px";
const CARD_LABEL = "font:400 10px 'Inter',ui-sans-serif;letter-spacing:.09em;color:var(--muted-2)";
const CARD_ROW =
  "display:flex;align-items:center;gap:9px;padding:7px 8px;margin:0 -8px;border-radius:6px;color:var(--text);font-size:12.5px";
const CARD_ROW_META = "font:400 10px 'Inter',ui-sans-serif;color:var(--muted-4)";

/**
 * The review row of the "THIS SET" card. Its own component so the comment read
 * only runs when `FEATURES.teams` mounts it — and so the count is real: the
 * badge used to be the literal string "3 OPEN", which never matched
 * listComments.
 */
function ReviewRow({ appId }: { appId: string }) {
  const comments = useQuery(`comments:${appId}`, () => getBackend().listComments(appId));
  const open = (comments.data ?? []).filter((c) => !c.resolved).length;
  return (
    <Link href="/review" className="hov-row" style={s(CARD_ROW)}>
      <span style={s("flex:1")}>Review &amp; comments</span>
      <span style={s(CARD_ROW_META)}>{comments.data ? `${open} OPEN` : ""}</span>
    </Link>
  );
}

type Tab = "Sets" | "Locales" | "Uploads";
/** Uploads is the job history — fixture-only until a backend exists (D3). */
const TABS: Tab[] = FEATURES.jobQueue ? ["Sets", "Locales", "Uploads"] : ["Sets", "Locales"];

const ROW_BUTTON =
  "flex:none;height:28px;padding:0 12px;border-radius:5px;border:1px solid rgba(var(--ink-rgb),.13);background:transparent;color:var(--text);font-size:12px;font-weight:500;cursor:pointer";
/** The quieter row actions — the store card's "Manage" button. */
const ROW_BUTTON_QUIET =
  "flex:none;display:inline-flex;align-items:center;height:26px;padding:0 10px;border-radius:5px;border:1px solid rgba(var(--ink-rgb),.13);background:transparent;color:var(--muted);font-size:11.5px;font-weight:500;cursor:pointer";

/**
 * "Delete this set?" — asked in the page, under its row, in the design's
 * in-place warning card (never `confirm()`).
 */
function DeleteConfirm({
  name,
  busy,
  error,
  onDelete,
  onKeep,
}: {
  name: string;
  busy: boolean;
  error: string | null;
  onDelete: () => void;
  onKeep: () => void;
}) {
  return (
    <div
      role="group"
      aria-label={`Delete ${name}?`}
      style={s(
        "display:flex;gap:11px;margin:0 14px 12px;padding:13px;border-radius:10px;border:1px solid rgba(var(--warn-rgb),.28);background:rgba(var(--warn-rgb),.06)",
      )}
    >
      <span
        style={s(
          "display:grid;place-items:center;flex:none;width:22px;height:22px;border-radius:50%;background:rgba(var(--warn-rgb),.16);color:var(--warn);font-size:12px;font-weight:600",
        )}
      >
        !
      </span>
      <div style={s("flex:1;min-width:0")}>
        <div style={s("font-size:13px;font-weight:500;color:var(--warn)")}>Delete “{name}”?</div>
        <div style={s("margin-top:4px;font-size:12.5px;line-height:1.55;color:var(--muted)")}>
          Its frames leave this browser, and so does every screenshot no other set uses. This
          can&apos;t be undone.
        </div>
        <div style={s("display:flex;gap:8px;margin-top:11px")}>
          <button
            type="button"
            onClick={onDelete}
            disabled={busy}
            style={s(
              "height:28px;padding:0 12px;border-radius:8px;border:1px solid var(--accent);background:transparent;color:var(--accent);font-size:12px;font-weight:500;cursor:pointer",
            )}
          >
            {busy ? "Deleting…" : "Delete set"}
          </button>
          <button
            type="button"
            onClick={onKeep}
            disabled={busy}
            style={s(
              "height:28px;padding:0 11px;border:1px solid rgba(var(--ink-rgb),.14);border-radius:8px;background:transparent;color:var(--muted);font-size:12px;cursor:pointer",
            )}
          >
            Keep it
          </button>
        </div>
        {error && <WarnLine style="margin-top:10px;align-items:flex-start">{error}</WarnLine>}
      </div>
    </div>
  );
}

/**
 * The selected set's store sizes, each Ready or Missing from the set's own
 * document (plan S2.3) — rows from EXPORT_SLOTS for its store, counted in
 * the header; every row's action opens that set.
 */
function RequiredSizes({
  set,
  doc,
  onOpen,
}: {
  set: ScreenshotSet;
  doc: QueryState<SetDoc | null>;
  onOpen: () => void;
}) {
  const sizes = doc.data ? requiredSizes(doc.data) : null;
  return (
    <>
      <div style={s("margin-top:30px;display:flex;align-items:center;justify-content:space-between;gap:12px")}>
        <h2 style={s("margin:0;font-size:19px;font-weight:500;letter-spacing:-.022em")}>
          Required sizes
        </h2>
        <span
          style={s(
            "min-width:0;font:400 10.5px 'Inter',ui-sans-serif;color:var(--muted-4);white-space:nowrap;overflow:hidden;text-overflow:ellipsis",
          )}
        >
          {sizes ? `${set.name.toUpperCase()} · ${sizes.store === "play" ? "GOOGLE" : "APPLE"} ${sizes.ready} OF ${sizes.rows.length}` : ""}
        </span>
      </div>

      <div style={s("margin-top:13px;display:flex;flex-direction:column;gap:10px")}>
        <Async
          query={doc}
          skeleton={
            <>
              {[0, 1, 2].map((i) => (
                <Shimmer key={i} style="height:118px;border-radius:9px" />
              ))}
            </>
          }
        >
          {(d) => {
            if (!d) return null;
            // The frames each size is made from, as thumbnails.
            const shots = d.frames.filter((f) => typeof f?.screenshot === "string" && f.screenshot);
            return requiredSizes(d).rows.map((r) => {
              const missing = r.status === "Missing";
              const thumbs = r.id === "FEATURE" ? d.frames.slice(0, 1) : shots;
              return (
                <div
                  key={r.id}
                  style={s(
                    `padding:13px 14px;border:1px solid ${
                      missing ? "rgba(var(--warn-rgb),.26)" : "rgba(var(--ink-rgb),.09)"
                    };border-radius:9px;background:${
                      missing ? "rgba(var(--warn-rgb),.05)" : "var(--surface)"
                    }`,
                  )}
                >
                  <div style={s("display:flex;align-items:center;gap:12px")}>
                    <span
                      style={s(
                        "flex:none;width:58px;text-align:center;padding:3px 0;border-radius:4px;background:rgba(var(--ink-rgb),.05);font:500 10px 'Inter',ui-sans-serif;letter-spacing:.06em;color:var(--muted)",
                      )}
                    >
                      {r.store}
                    </span>
                    <div style={s("flex:1;min-width:0")}>
                      <div style={s("font-size:13.5px;font-weight:600;letter-spacing:-.01em")}>
                        {r.label}
                      </div>
                      <div
                        style={s(
                          "margin-top:2px;font:400 10.5px 'Inter',ui-sans-serif;color:var(--muted-4)",
                        )}
                      >
                        {r.px}
                      </div>
                    </div>
                    <span
                      style={s(
                        `flex:none;width:84px;text-align:center;padding:3px 8px;border-radius:4px;font-size:11.5px;font-weight:500;background:${
                          missing ? "rgba(var(--warn-rgb),.14)" : "rgba(var(--ok-rgb),.12)"
                        };color:${missing ? "#f5b544" : "var(--ok)"}`,
                      )}
                    >
                      {r.status}
                    </span>
                    <button
                      type="button"
                      onClick={onOpen}
                      style={s(
                        `flex:none;height:28px;padding:0 12px;border-radius:5px;border:1px solid ${
                          missing ? "transparent" : "rgba(var(--ink-rgb),.13)"
                        };background:${missing ? "var(--accent)" : "transparent"};color:${
                          missing ? "var(--on-accent)" : "var(--text)"
                        };font-size:12px;font-weight:${missing ? 700 : 500};cursor:pointer`,
                      )}
                    >
                      Open
                    </button>
                  </div>
                  {thumbs.length > 0 && (
                    <div style={s("display:flex;gap:6px;margin-top:11px")}>
                      {thumbs.map((f, i) => (
                        <div
                          key={i}
                          style={s(
                            `flex:none;width:44px;height:58px;border-radius:4px;background:${bgCss(
                              f.bg,
                            )};display:grid;place-items:center`,
                          )}
                        >
                          <div
                            style={s(
                              `width:16px;height:32px;border-radius:4px;background:#111214;transform:perspective(220px) rotateY(${Math.max(
                                -20,
                                Math.min(20, Number(f.tiltY) || 0),
                              )}deg)`,
                            )}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            });
          }}
        </Async>
      </div>
    </>
  );
}

/** The app's sets, the required sizes of the selected one, and — with
 *  `FEATURES.abTest` — the A/B variants. */
function SetsTab({
  app,
  sets,
  selected,
  selectedDoc,
  onSelect,
}: {
  app: App;
  sets: QueryState<ScreenshotSet[]>;
  selected: ScreenshotSet | null;
  /** The selected set's document, as the editor would open it. */
  selectedDoc: QueryState<SetDoc | null>;
  onSelect: (id: string) => void;
}) {
  const router = useRouter();
  const create = useCreateAndOpen();

  // One row at a time is being renamed or asked about deletion.
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  // What the busy row is doing, so each control shows only its own progress.
  const [busyWith, setBusyWith] = useState<"rename" | "duplicate" | "delete" | null>(null);
  const begin = (id: string, what: "rename" | "duplicate" | "delete") => {
    setBusy(id);
    setBusyWith(what);
    setRowError(null);
  };
  const done = () => {
    setBusy(null);
    setBusyWith(null);
  };
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);

  const startRename = (r: ScreenshotSet) => {
    setConfirming(null);
    setRowError(null);
    setRenaming(r.id);
    setDraft(r.name);
  };
  const saveRename = async (id: string) => {
    if (!draft.trim() || busy) return;
    begin(id, "rename");
    try {
      await getBackend().renameSet(id, draft);
      setRenaming(null);
      sets.refetch();
    } catch (e) {
      setRowError({ id, message: `Couldn't rename the set — ${e instanceof Error ? e.message : "something went wrong."}` });
    } finally {
      done();
    }
  };
  const confirmDelete = async (id: string) => {
    if (busy) return;
    begin(id, "delete");
    try {
      await removeSet(id);
      setConfirming(null);
    } catch (e) {
      setRowError({ id, message: `Couldn't delete the set — ${e instanceof Error ? e.message : "something went wrong."}` });
    } finally {
      done();
      sets.refetch();
    }
  };

  // A copy in this app, sharing the original's screenshots; the list then
  // selects it. The open set's newest edit is stored first so it's copied.
  const duplicate = async (id: string) => {
    if (busy) return;
    // Copying answers the row's open question, if any: its delete card closes.
    setConfirming(null);
    setRenaming(null);
    begin(id, "duplicate");
    try {
      await flushSaves();
      const copy = await getBackend().duplicateSet(id);
      sets.refetch();
      onSelect(copy.id);
    } catch (e) {
      setRowError({ id, message: `Couldn't duplicate the set — ${e instanceof Error ? e.message : "something went wrong."}` });
    } finally {
      done();
    }
  };

  return (
    <div>
      <div style={s("display:flex;align-items:center;justify-content:space-between;gap:12px")}>
        <h2 style={s("margin:0;font-size:19px;font-weight:500;letter-spacing:-.022em")}>Sets</h2>
        <button
          type="button"
          disabled={create.busy !== null}
          onClick={() => {
            // Opened in the person's work mode.
            const mode = useOnstage.getState().workMode;
            void create.run("new", () => createBlankSet({ appId: app.id, name: `${app.name} — new set` }), mode);
          }}
          style={s(
            "display:inline-flex;align-items:center;gap:7px;height:30px;padding:0 12px;border:1px solid var(--accent);border-radius:6px;background:transparent;color:var(--accent);font-size:12.5px;font-weight:700;cursor:pointer",
          )}
        >
          <IcoPlus size={14} w={2.3} />
          {create.busy ? "Creating…" : "New set"}
        </button>
      </div>
      {create.error && <WarnLine style="margin-top:10px">{create.error.message}</WarnLine>}
      {/* A delete that went through but couldn't finish (its screenshots
          stayed) has no row left to say so under. */}
      {rowError && sets.data && !sets.data.some((r) => r.id === rowError.id) && (
        <WarnLine style="margin-top:10px;align-items:flex-start">{rowError.message}</WarnLine>
      )}
      <div
        style={s(
          "margin-top:13px;border:1px solid rgba(var(--ink-rgb),.09);border-radius:8px;overflow:hidden",
        )}
      >
        <Async query={sets} skeleton={<Shimmer style="height:120px;border-radius:0" />}>
          {(rows) => {
            const list = newestFirst(rows);
            if (!list.length)
              return (
                <div style={s("padding:34px;text-align:center")}>
                  <div style={s("font-size:13.5px;font-weight:500")}>No sets in this app yet</div>
                </div>
              );
            // Row buttons act on their own row, never also select it.
            const act = (fn: () => void) => (e: React.MouseEvent) => {
              e.stopPropagation();
              fn();
            };
            return list.map((r, i) => {
              const editing = renaming === r.id;
              const error = rowError?.id === r.id && confirming !== r.id ? rowError.message : null;
              return (
                <SetRow
                  key={r.id}
                  set={r}
                  index={i}
                  last={i === list.length - 1}
                  selected={r.id === selected?.id}
                  onClick={editing ? undefined : () => onSelect(r.id)}
                  name={
                    editing ? (
                      <input
                        autoFocus
                        value={draft}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void saveRename(r.id);
                          if (e.key === "Escape") setRenaming(null);
                        }}
                        aria-label="Set name"
                        maxLength={80}
                        style={s(
                          "width:100%;height:26px;padding:0 8px;border:1px solid rgba(var(--ink-rgb),.14);border-radius:6px;background:var(--bg);color:var(--text);font:500 13px 'Inter',sans-serif;outline:none",
                        )}
                      />
                    ) : undefined
                  }
                  actions={
                    editing ? (
                      <>
                        <button
                          type="button"
                          disabled={!draft.trim() || busy === r.id}
                          onClick={act(() => void saveRename(r.id))}
                          style={s(ROW_BUTTON)}
                        >
                          Save
                        </button>
                        <button type="button" onClick={act(() => setRenaming(null))} style={s(ROW_BUTTON_QUIET)}>
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button type="button" onClick={act(() => router.push(openSetHref(r.id)))} style={s(ROW_BUTTON)}>
                          Open
                        </button>
                        <button type="button" onClick={act(() => startRename(r))} style={s(ROW_BUTTON_QUIET)}>
                          Rename
                        </button>
                        <button
                          type="button"
                          disabled={busy !== null}
                          onClick={act(() => void duplicate(r.id))}
                          style={s(ROW_BUTTON_QUIET)}
                        >
                          {busy === r.id && busyWith === "duplicate" ? "Copying…" : "Duplicate"}
                        </button>
                        <button
                          type="button"
                          onClick={act(() => {
                            setRenaming(null);
                            setRowError(null);
                            setConfirming(r.id);
                          })}
                          style={s(ROW_BUTTON_QUIET)}
                        >
                          Delete
                        </button>
                      </>
                    )
                  }
                  below={
                    confirming === r.id ? (
                      <DeleteConfirm
                        name={r.name}
                        busy={busy === r.id && busyWith === "delete"}
                        error={rowError?.id === r.id ? rowError.message : null}
                        onDelete={() => void confirmDelete(r.id)}
                        onKeep={() => {
                          setConfirming(null);
                          setRowError(null);
                        }}
                      />
                    ) : error ? (
                      <WarnLine style="margin:0 14px 12px;align-items:flex-start">{error}</WarnLine>
                    ) : null
                  }
                />
              );
            });
          }}
        </Async>
      </div>

      {selected && (
        <RequiredSizes set={selected} doc={selectedDoc} onOpen={() => router.push(openSetHref(selected.id))} />
      )}

      {FEATURES.abTest && <Variants appId={selected?.appId ?? ""} />}
    </div>
  );
}

/** Two versions of the same set — fixture data until A/B tests are real
 *  (`FEATURES.abTest`, plan D3). */
function Variants({ appId }: { appId: string }) {
  const router = useRouter();
  const variants = useQuery(`variants:${appId}`, () => getBackend().listVariants(appId));
  return (
    <>
      <h2 style={s("margin:30px 0 0;font-size:19px;font-weight:500;letter-spacing:-.022em")}>
        A/B variants
      </h2>
      <p style={s("margin:7px 0 0;font-size:13.5px;color:var(--muted-2)")}>
        Two versions of the same set. Push one live, keep the other ready.
      </p>
      <div style={s("display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:13px")}>
        <Async
          query={variants}
          skeleton={
            <>
              {[0, 1].map((i) => (
                <Shimmer key={i} style="height:150px;border-radius:9px" />
              ))}
            </>
          }
        >
          {(rows) =>
            rows.map((v) => (
              <div
                key={v.id}
                style={s(
                  `padding:14px;border:1px solid ${
                    v.live ? "rgba(var(--ok-rgb),.28)" : "rgba(var(--ink-rgb),.09)"
                  };border-radius:9px;background:var(--surface)`,
                )}
              >
                <div style={s("display:flex;align-items:center;justify-content:space-between")}>
                  <span style={s("font-size:13.5px;font-weight:600")}>{v.name}</span>
                  <span
                    style={s(
                      `padding:2px 8px;border-radius:4px;font:500 10px 'Inter',ui-sans-serif;letter-spacing:.07em;background:${
                        v.live ? "rgba(var(--ok-rgb),.13)" : "rgba(var(--ink-rgb),.05)"
                      };color:${v.live ? "var(--ok)" : "var(--muted)"}`,
                    )}
                  >
                    {v.pill}
                  </span>
                </div>
                <div style={s("display:flex;gap:5px;margin-top:11px")}>
                  {v.swatches.map((b, bi) => (
                    <div key={bi} style={s(`flex:1;height:52px;border-radius:4px;background:${b}`)} />
                  ))}
                </div>
                <div style={s("display:flex;align-items:center;gap:9px;margin-top:12px")}>
                  <span style={s("font-size:12px;color:var(--muted-2)")}>{v.note}</span>
                  {/* "Push live" publishes to a store: only with a store backend. */}
                  {(v.action !== "Push live" || FEATURES.storeUpload) && (
                    <button
                      type="button"
                      onClick={() => router.push("/editor")}
                      style={s(
                        `margin-left:auto;height:28px;padding:0 11px;border-radius:5px;border:1px solid ${
                          v.live ? "rgba(var(--ink-rgb),.13)" : "transparent"
                        };background:${v.live ? "transparent" : "var(--accent)"};color:${
                          v.live ? "var(--text)" : "var(--on-accent)"
                        };font-size:12px;font-weight:${v.live ? 500 : 700};cursor:pointer`,
                      )}
                    >
                      {v.action}
                    </button>
                  )}
                </div>
              </div>
            ))
          }
        </Async>
      </div>
    </>
  );
}

/**
 * One app's board, by `?app=` (plan S2.1): its sets, each opened by id. An
 * app this browser doesn't have gets an in-page "not here", not someone
 * else's board.
 */
export function ProjectScreen() {
  const route = useAppRoute();
  if (route.status === "missing") {
    return (
      <NotFoundScreen
        kicker="APP NOT FOUND"
        title="This app isn't in this browser"
        body="It was made in another browser, or the link points at something Onstage doesn't have here."
        settingsLink={false}
      />
    );
  }
  if (route.status === "error") {
    const reason = route.error ?? "Something went wrong.";
    return (
      <ErrorState
        error={new Error(reason)}
        reset={route.retry}
        title="Couldn't open this app"
        description={reason}
        homeHref="/dashboard"
        homeLabel="Back to your apps"
        fullScreen
      />
    );
  }
  if (!route.app) {
    return <div style={s("min-height:var(--screen-h,100vh);background:var(--bg)")} />;
  }
  return <ProjectBoard key={route.app.id} app={route.app} />;
}

/** The activity feed — fixture history until a job queue exists
 *  (`FEATURES.jobQueue`, plan D3). */
function ActivityCard({ appId }: { appId: string }) {
  const activity = useQuery(`activity:${appId}`, () => getBackend().listActivity(appId));
  return (
    <div style={s(CARD)}>
      <div style={s(CARD_LABEL)}>ACTIVITY</div>
      <div style={s("margin-top:11px;display:flex;flex-direction:column;gap:10px")}>
        <Async query={activity} skeleton={<Shimmer style="height:80px" />}>
          {(rows) =>
            rows.map((a) => (
              <div key={a.id} style={s("display:flex;gap:9px")}>
                <span
                  style={s(
                    `flex:none;margin-top:5px;width:5px;height:5px;border-radius:50%;background:${a.tint}`,
                  )}
                />
                <div>
                  <div style={s("font-size:12.5px;line-height:1.45")}>{a.text}</div>
                  <div
                    style={s(
                      "margin-top:1px;font:400 10px 'Inter',ui-sans-serif;color:var(--muted-4)",
                    )}
                  >
                    {a.when}
                  </div>
                </div>
              </div>
            ))
          }
        </Async>
      </div>
    </div>
  );
}

/** Which stores the rendered files could be sent to — only with a store
 *  backend (`FEATURES.storeUpload`, plan D3): without one, every row is
 *  fixture data and "Connect" can never succeed. */
function StoreConnectionsCard() {
  const connections = useQuery("connections", () => getBackend().listConnections());
  return (
    <div style={s(CARD)}>
      <div style={s(CARD_LABEL)}>STORE CONNECTIONS</div>
      <div style={s("margin-top:11px;display:flex;flex-direction:column;gap:9px")}>
        <Async query={connections} skeleton={<Shimmer style="height:60px" />}>
          {(rows) =>
            rows.map((c) => (
              <div key={c.id} style={s("display:flex;align-items:center;gap:9px")}>
                <span
                  style={s(
                    `flex:none;width:8px;height:8px;border-radius:50%;background:${
                      c.connected ? "var(--ok)" : "rgba(var(--ink-rgb),.22)"
                    }`,
                  )}
                />
                <div style={s("flex:1;min-width:0")}>
                  <div style={s("font-size:13px;font-weight:500")}>{c.name}</div>
                  <div style={s("font-size:11.5px;color:var(--muted-3)")}>{c.sub}</div>
                </div>
                <Link
                  href="/settings?tab=Store+connections"
                  style={s(
                    `display:inline-flex;align-items:center;height:26px;padding:0 10px;border-radius:5px;border:1px solid ${
                      c.connected ? "rgba(var(--ink-rgb),.13)" : "transparent"
                    };background:${c.connected ? "transparent" : "var(--accent)"};color:${
                      c.connected ? "var(--muted)" : "var(--on-accent)"
                    };font-size:11.5px;font-weight:${c.connected ? 500 : 700}`,
                  )}
                >
                  {c.connected ? "Manage" : "Connect"}
                </Link>
              </div>
            ))
          }
        </Async>
      </div>
    </div>
  );
}

function ProjectBoard({ app }: { app: App }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("Sets");

  // An edit the editor left waiting for its autosave is stored first, so
  // the list (order, status, the default selection) is the set as saved.
  const sets = useQuery(`sets:${app.id}`, () => flushSaves().then(() => getBackend().listSets(app.id)));
  // The set the board is about: the one picked in the list, else the most
  // recently edited.
  const [picked, setPicked] = useState<string | null>(null);
  const list = sets.data ? newestFirst(sets.data) : [];
  const selected = list.find((r) => r.id === picked) ?? list[0] ?? null;

  // The selected set's document as the editor would open it (the open set
  // as it is now), read without opening it. Its sizes and languages come
  // from here, never from fixture rows (S2.3).
  const loadedSetId = useOnstage((st) => st.loadedSetId);
  const selectedDoc = useQuery<SetDoc | null>(`set-doc:${selected?.id ?? ""}:${loadedSetId ?? ""}`, () =>
    selected
      ? setPreviewSource(undefined, selected.id).then((r) => (r.missing ? null : r.doc))
      : Promise.resolve(null),
  );
  const locales = selectedDoc.data ? setLocales(selectedDoc.data) : [];
  const setCount = sets.data?.length;

  return (
    <div style={s("min-height:var(--screen-h,100vh);background:var(--bg);color:var(--text)")}>
      <div
        style={s(
          "display:flex;align-items:center;gap:14px;padding:13px 28px;border-bottom:1px solid rgba(var(--ink-rgb),.07);background:var(--chrome)",
        )}
      >
        <BackButton href="/dashboard" radius={6} />
        <span
          style={s(
            `display:grid;place-items:center;width:28px;height:28px;border-radius:7px;background:${app.tint};font-size:13px;font-weight:700;color:#fff`,
          )}
        >
          {app.initial}
        </span>
        <div>
          <div style={s("font-size:14.5px;font-weight:600;letter-spacing:-.015em")}>{app.name}</div>
          <div style={s("font:400 10.5px 'Inter',ui-sans-serif;color:var(--muted-4)")}>
            {setCount === undefined ? "" : `${setCount} SET${setCount === 1 ? "" : "S"}`}
          </div>
        </div>
        <div
          style={s(
            "margin-left:22px;display:flex;gap:2px;padding:2px;border:1px solid rgba(var(--ink-rgb),.09);border-radius:6px",
          )}
        >
          {TABS.map((t) => {
            const on = tab === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                style={s(
                  `padding:5px 12px;border:none;border-radius:4px;background:${
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
        <button
          type="button"
          disabled={!selected}
          onClick={() => {
            // The export dialog opens on the selected set once it has loaded.
            if (selected) router.push(setHref("canvas", selected.id, "panel:export"));
          }}
          style={s(
            "margin-left:auto;display:inline-flex;align-items:center;gap:7px;height:32px;padding:0 13px;border:1px solid var(--accent);border-radius:6px;background:transparent;color:var(--accent);font-size:12.5px;font-weight:700;cursor:pointer",
          )}
        >
          <IcoExport size={14} />
          {/* Without a store backend the dialog only downloads a zip. */}
          {FEATURES.storeUpload ? "Export & upload" : "Export"}
        </button>
      </div>

      <div
        style={s(
          "max-width:1240px;margin:0 auto;padding:28px 28px 60px;display:grid;grid-template-columns:minmax(0,1fr) 296px;gap:26px",
        )}
      >
        {tab === "Sets" && (
          <SetsTab app={app} sets={sets} selected={selected} selectedDoc={selectedDoc} onSelect={setPicked} />
        )}
        {tab === "Locales" && <LocalesTab setId={selected?.id ?? null} doc={selectedDoc} />}
        {FEATURES.jobQueue && tab === "Uploads" && <UploadsTab appId={app.id} />}

        <div style={s("display:flex;flex-direction:column;gap:14px")}>
          {FEATURES.storeUpload && <StoreConnectionsCard />}

          <div style={s(CARD)}>
            <div style={s(CARD_LABEL)}>LOCALES</div>
            <div style={s("display:flex;flex-wrap:wrap;gap:6px;margin-top:11px")}>
              <Async query={selectedDoc} skeleton={<Shimmer style="height:24px;width:100%" />}>
                {() =>
                  locales.map((l) => {
                    const on = l.state !== "untranslated";
                    return (
                      <span
                        key={l.code}
                        title={l.name}
                        style={s(
                          `padding:4px 9px;border-radius:5px;border:1px solid ${
                            on ? "rgba(var(--accent-rgb),.35)" : "rgba(var(--ink-rgb),.1)"
                          };background:${
                            on ? "rgba(var(--accent-rgb),.09)" : "transparent"
                          };font:500 11px 'Inter',ui-sans-serif;color:${
                            on ? "var(--accent-hi)" : "var(--muted-4)"
                          }`,
                        )}
                      >
                        {l.code}
                      </span>
                    );
                  })
                }
              </Async>
            </div>
            {/* Translation is the AI drawer's job (`FEATURES.aiAssist`, D3/D9). */}
            {FEATURES.aiAssist && (
              <button
                type="button"
                onClick={() => setTab("Locales")}
                style={s(
                  "width:100%;margin-top:12px;height:32px;border:1px solid rgba(var(--accent-rgb),.35);border-radius:6px;background:rgba(var(--accent-rgb),.08);color:var(--accent-hi);font-size:12.5px;font-weight:600;cursor:pointer",
                )}
              >
                Translate set with AI
              </button>
            )}
          </div>

          {FEATURES.jobQueue && <ActivityCard appId={app.id} />}

          <div style={s(CARD)}>
            <div style={s(CARD_LABEL)}>THIS SET</div>
            <div style={s("margin-top:11px;display:flex;flex-direction:column;gap:2px")}>
              {FEATURES.teams && <ReviewRow appId={app.id} />}
              {[
                // Fixture results with nowhere to promote a winner (plan D3).
                ...(FEATURES.abTest ? [["A/B test results", "/ab-test", "DAY 14"]] : []),
                // The board's selected set, by id.
                [
                  "Store listing preview",
                  selected ? `/store-preview?set=${encodeURIComponent(selected.id)}` : "/store-preview",
                  "",
                ],
              ].map(([label, href, meta]) => (
                <Link key={href} href={href} className="hov-row" style={s(CARD_ROW)}>
                  <span style={s("flex:1")}>{label}</span>
                  <span style={s(CARD_ROW_META)}>{meta}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
