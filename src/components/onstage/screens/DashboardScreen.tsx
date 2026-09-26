"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { s } from "@/lib/onstage/css";
import { Async, Shimmer } from "@/components/onstage/Async";
import { getBackend } from "@/lib/data/backend";
import { useQuery } from "@/lib/data/useQuery";
import { useSession } from "@/lib/data/useSession";
import { FEATURES } from "@/lib/features";
import { BrandMark } from "../chrome";
import { IcoAlert, IcoPlus, IcoSearch } from "../icons";

const THUMB_TILT = [-12, 0, 10, -6];

/**
 * The plan + remaining-exports chip. Mounted behind `FEATURES.billing`, and in
 * its own component so useSession() doesn't run when billing is off.
 */
function PlanPill() {
  const session = useSession();
  if (!session.data || session.data.exportsAllowed === null) return null;
  return (
    <span
      style={s(
        "padding:4px 9px;border-radius:5px;border:1px solid rgba(var(--accent-rgb),.35);background:rgba(var(--accent-rgb),.1);font:500 11px 'Inter',ui-sans-serif;color:var(--accent-hi);white-space:nowrap",
      )}
    >
      {session.data.plan.toUpperCase()} · {session.data.exportsUsed}/{session.data.exportsAllowed}{" "}
      EXPORTS
    </span>
  );
}

/**
 * The account avatar, which doubles as the dashboard's only route to
 * /settings. An explicit guard on the session, not `?? "··"`: with no account
 * the placeholder rendered a "··" chip labelled "Account settings".
 */
function AccountChip() {
  const session = useSession();
  if (!session.data) return null;
  return (
    <Link
      href="/settings"
      aria-label="Account settings"
      title={session.data.email}
      style={s(
        "display:grid;place-items:center;width:28px;height:28px;border-radius:50%;background:var(--surface-3);color:var(--text);font-size:11.5px;font-weight:600",
      )}
    >
      {session.data.initials}
    </Link>
  );
}

const statusTint = (status: string) =>
  status === "Ready"
    ? ["rgba(var(--ok-rgb),.12)", "var(--ok)"]
    : status === "Missing size"
      ? ["rgba(var(--warn-rgb),.12)", "#f5b544"]
      : status === "Uploaded"
        ? ["rgba(var(--accent-rgb),.12)", "var(--accent-hi)"]
        : ["rgba(var(--ink-rgb),.05)", "var(--muted)"];

const tagTint = (kind: string) =>
  kind === "ok"
    ? ["rgba(var(--ok-rgb),.12)", "var(--ok)"]
    : kind === "warn"
      ? ["rgba(var(--warn-rgb),.12)", "#f5b544"]
      : ["rgba(var(--ink-rgb),.05)", "var(--muted)"];

export function DashboardScreen() {
  const router = useRouter();
  const apps = useQuery("apps", () => getBackend().listApps());
  const sets = useQuery("sets", () => getBackend().listSets());

  const search = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  // ⌘K / Ctrl-K focuses the search, as the shortcut in the box promises.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        search.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const matchApp = (name: string, meta: string) =>
    !q || `${name} ${meta}`.toLowerCase().includes(q);

  return (
    <div
      style={s(
        "min-height:var(--screen-h,100vh);background:var(--bg);color:var(--text)",
      )}
    >
      <div
        style={s(
          "display:flex;align-items:center;gap:16px;padding:13px 28px;border-bottom:1px solid rgba(var(--ink-rgb),.07);background:var(--chrome)",
        )}
      >
        <Link
          href="/"
          style={s(
            "display:flex;align-items:center;gap:9px;cursor:pointer;color:var(--text)",
          )}
        >
          <BrandMark font={15} weight={700} />
        </Link>
        <div
          style={s(
            "display:flex;align-items:center;gap:8px;margin-left:14px;width:290px;height:32px;padding:0 10px;border:1px solid rgba(var(--ink-rgb),.09);border-radius:6px;color:var(--muted-4)",
          )}
        >
          <IcoSearch size={14} />
          <input
            ref={search}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search apps and sets"
            aria-label="Search apps and sets"
            style={s(
              "flex:1;min-width:0;border:none;background:transparent;color:var(--text);font:400 12.5px 'Inter',sans-serif;outline:none",
            )}
          />
          {query ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setQuery("")}
              style={s(
                "border:none;background:transparent;color:var(--muted-3);font-size:15px;line-height:1;cursor:pointer;padding:0",
              )}
            >
              ×
            </button>
          ) : (
            <span style={s("font:400 10.5px 'Inter',ui-sans-serif")}>⌘K</span>
          )}
        </div>
        <div
          style={s("margin-left:auto;display:flex;align-items:center;gap:10px")}
        >
          {FEATURES.billing && <PlanPill />}
          {FEATURES.billing && (
            <Link
              href="/pricing"
              style={s(
                "display:inline-flex;align-items:center;height:30px;padding:0 12px;border:1px solid rgba(var(--ink-rgb),.12);border-radius:6px;background:transparent;color:var(--text);font-size:12.5px;font-weight:500",
              )}
            >
              Upgrade
            </Link>
          )}
          {/* The avatar is the dashboard's only route to /settings, so with
              accounts off it becomes a plain settings link rather than
              disappearing. */}
          {FEATURES.accounts ? (
            <AccountChip />
          ) : (
            <Link
              href="/settings"
              style={s(
                "display:inline-flex;align-items:center;height:30px;padding:0 12px;border:1px solid rgba(var(--ink-rgb),.12);border-radius:6px;background:transparent;color:var(--text);font-size:12.5px;font-weight:500",
              )}
            >
              Settings
            </Link>
          )}
        </div>
      </div>

      <div style={s("max-width:1180px;margin:0 auto;padding:34px 28px 60px")}>
        <div
          style={s(
            "display:flex;align-items:flex-end;justify-content:space-between;gap:20px",
          )}
        >
          <div>
            <h1
              style={s(
                "margin:0;font-size:30px;letter-spacing:-.03em;font-weight:500",
              )}
            >
              Your apps
            </h1>
            <p style={s("margin:7px 0 0;font-size:14px;color:var(--muted-2)")}>
              Three apps · 6 sets · last export 2 days ago
            </p>
          </div>
          <Link
            href="/onboarding"
            style={s(
              "display:inline-flex;align-items:center;gap:8px;height:38px;padding:0 15px;border:1px solid var(--accent);border-radius:6px;background:transparent;color:var(--accent);font-size:13.5px;font-weight:700",
            )}
          >
            <IcoPlus size={15} w={2.3} />
            New set
          </Link>
        </div>

        <div
          style={s(
            "display:flex;align-items:center;gap:12px;margin-top:22px;padding:12px 14px;border-radius:8px;border:1px solid rgba(var(--warn-rgb),.24);background:rgba(var(--warn-rgb),.07)",
          )}
        >
          <span
            style={s(
              "display:grid;place-items:center;width:24px;height:24px;border-radius:5px;background:rgba(var(--warn-rgb),.16);color:var(--warn)",
            )}
          >
            <IcoAlert size={14} w={2} />
          </span>
          <span style={s("font-size:13.5px")}>
            Trailhead&apos;s Play Store set is missing the 7″ tablet size. Apple
            accepted, Google will reject.
          </span>
          <Link
            href="/project"
            style={s(
              "margin-left:auto;display:inline-flex;align-items:center;height:28px;padding:0 11px;border:1px solid rgba(var(--ink-rgb),.14);border-radius:5px;background:transparent;color:var(--text);font-size:12px;font-weight:500",
            )}
          >
            Fix it
          </Link>
        </div>

        <div
          style={s(
            "display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:22px",
          )}
        >
          <Async
            query={apps}
            skeleton={
              <>
                {[0, 1, 2].map((i) => (
                  <Shimmer key={i} style="height:212px;border-radius:9px" />
                ))}
              </>
            }
          >
            {(rows) =>
              rows
                .filter((a) => matchApp(a.name, a.meta))
                .map((a) => (
                  <div
                    key={a.id}
                    onClick={() =>
                      router.push(`/project?app=${encodeURIComponent(a.id)}`)
                    }
                    style={s(
                      "border:1px solid rgba(var(--ink-rgb),.09);border-radius:9px;background:var(--surface);overflow:hidden;cursor:pointer",
                    )}
                  >
                    <div
                      style={s(
                        "display:flex;gap:5px;padding:12px 12px 0;background:var(--surface-2)",
                      )}
                    >
                      {a.thumbs.map((b, i) => (
                        <div
                          key={i}
                          style={s(
                            `flex:1;height:96px;border-radius:5px;background:${b};display:flex;flex-direction:column;align-items:center;padding-top:9px;overflow:hidden`,
                          )}
                        >
                          <div
                            style={s(
                              `width:22px;height:56px;border-radius:5px;background:#111214;box-shadow:0 5px 11px rgba(0,0,0,.45);transform:perspective(320px) rotateY(${THUMB_TILT[i]}deg)`,
                            )}
                          />
                        </div>
                      ))}
                    </div>
                    <div style={s("padding:13px 14px 15px")}>
                      <div
                        style={s("display:flex;align-items:center;gap:10px")}
                      >
                        <span
                          style={s(
                            `display:grid;place-items:center;width:34px;height:34px;border-radius:8px;background:${a.tint};color:#fff;font-size:14px;font-weight:700`,
                          )}
                        >
                          {a.initial}
                        </span>
                        <div style={s("min-width:0")}>
                          <div
                            style={s(
                              "font-size:14.5px;font-weight:600;letter-spacing:-.015em",
                            )}
                          >
                            {a.name}
                          </div>
                          <div
                            style={s(
                              "margin-top:2px;font:400 10.5px 'Inter',ui-sans-serif;color:var(--muted-4)",
                            )}
                          >
                            {a.meta}
                          </div>
                        </div>
                      </div>
                      <div style={s("display:flex;gap:6px;margin-top:12px")}>
                        {a.tags.map((tag) => {
                          const [bg, fg] = tagTint(tag.kind);
                          return (
                            <span
                              key={tag.label}
                              style={s(
                                `padding:3px 8px;border-radius:4px;font-size:11px;font-weight:500;white-space:nowrap;background:${bg};color:${fg}`,
                              )}
                            >
                              {tag.label}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))
            }
          </Async>
        </div>

        <div style={s("margin-top:40px")}>
          <div
            style={s(
              "display:flex;align-items:baseline;justify-content:space-between",
            )}
          >
            <h2
              style={s(
                "margin:0;font-size:17px;font-weight:500;letter-spacing:-.02em",
              )}
            >
              Recent sets
            </h2>
            <span
              style={s(
                "font:400 10.5px 'Inter',ui-sans-serif;color:var(--muted-4)",
              )}
            >
              EDITED IN THE LAST 30 DAYS
            </span>
          </div>
          <div
            style={s(
              "margin-top:12px;border:1px solid rgba(var(--ink-rgb),.09);border-radius:8px;overflow:hidden",
            )}
          >
            <Async
              query={sets}
              skeleton={<Shimmer style="height:250px;border-radius:0" />}
            >
              {(rows) => {
                const visible = rows.filter((r) => matchApp(r.name, r.sub));
                if (!visible.length)
                  return (
                    <div style={s("padding:34px;text-align:center")}>
                      <div style={s("font-size:13.5px;font-weight:500")}>
                        No sets match that
                      </div>
                      <div
                        style={s(
                          "margin-top:5px;font-size:12.5px;color:var(--muted-2)",
                        )}
                      >
                        Try a different name, template or locale.
                      </div>
                    </div>
                  );
                return visible.map((r, i) => {
                  const [bg, fg] = statusTint(r.status);
                  return (
                    <div
                      key={r.id}
                      onClick={() =>
                        router.push(
                          r.status === "Draft" ? "/editor" : "/project",
                        )
                      }
                      style={s(
                        `display:flex;align-items:center;gap:14px;padding:11px 14px;cursor:pointer;background:${
                          i % 2 ? "rgba(var(--ink-rgb),.014)" : "transparent"
                        };border-bottom:${
                          i < rows.length - 1
                            ? "1px solid rgba(var(--ink-rgb),.06)"
                            : "none"
                        }`,
                      )}
                    >
                      <div
                        style={s(
                          `flex:none;width:30px;height:38px;border-radius:4px;background:${r.swatch}`,
                        )}
                      />
                      <div style={s("min-width:0;flex:1")}>
                        <div style={s("font-size:13.5px;font-weight:500")}>
                          {r.name}
                        </div>
                        <div
                          style={s(
                            "margin-top:2px;font-size:12px;color:var(--muted-3)",
                          )}
                        >
                          {r.sub}
                        </div>
                      </div>
                      <span
                        style={s(
                          "font:400 11px 'Inter',ui-sans-serif;color:var(--muted-4)",
                        )}
                      >
                        {r.frameCount} FRAMES
                      </span>
                      <span
                        style={s(
                          `width:106px;text-align:center;padding:3px 8px;border-radius:4px;font-size:11.5px;font-weight:500;background:${bg};color:${fg}`,
                        )}
                      >
                        {r.status}
                      </span>
                      <span
                        style={s(
                          "font-size:12px;color:var(--muted-4);width:76px;text-align:right",
                        )}
                      >
                        {r.updatedAt}
                      </span>
                    </div>
                  );
                });
              }}
            </Async>
          </div>
        </div>
      </div>
    </div>
  );
}
