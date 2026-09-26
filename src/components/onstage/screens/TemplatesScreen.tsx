"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { s } from "@/lib/onstage/css";
import { LIGHT_TEMPLATES, TEMPLATES, TEMPLATE_FILTERS } from "@/lib/onstage/data";
import { useOnstage } from "@/store/onstage";
import { IcoBack, IcoSearch } from "../icons";

export function TemplatesScreen() {
  const router = useRouter();
  const applyTemplate = useOnstage((st) => st.applyTemplate);
  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const shown = TEMPLATES.filter(
    (t) =>
      (filter === "All" || t.tags.includes(filter)) &&
      (!q || `${t.name} ${t.tagline} ${t.tags.join(" ")}`.toLowerCase().includes(q)),
  );

  return (
    <div style={s("min-height:var(--screen-h,100vh);background:var(--bg);color:var(--text)")}>
      <div
        style={s(
          "display:flex;align-items:center;gap:14px;padding:13px 28px;border-bottom:1px solid rgba(var(--ink-rgb),.07);background:var(--chrome)",
        )}
      >
        <Link
          href="/editor"
          className="hov-ink"
          style={s(
            "display:inline-flex;align-items:center;gap:7px;height:30px;padding:0 11px;border:1px solid rgba(var(--ink-rgb),.11);border-radius:6px;background:transparent;color:var(--text);font-size:12.5px;cursor:pointer",
          )}
        >
          <IcoBack size={14} />
          Back to canvas
        </Link>
        <span style={s("font-size:14px;font-weight:600;letter-spacing:-.015em")}>Templates</span>
        <span style={s("font:400 11px 'Inter',ui-sans-serif;color:var(--muted-4)")}>240 SETS</span>
        <div
          style={s(
            "margin-left:auto;display:flex;align-items:center;gap:8px;width:260px;height:32px;padding:0 10px;border:1px solid rgba(var(--ink-rgb),.09);border-radius:6px;color:var(--muted-4)",
          )}
        >
          <IcoSearch size={14} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search dark, bold, minimal…"
            aria-label="Search templates"
            style={s(
              "flex:1;min-width:0;border:none;background:transparent;color:var(--text);font:400 12.5px 'Inter',sans-serif;outline:none",
            )}
          />
        </div>
      </div>

      <div
        style={s(
          "display:flex;align-items:center;gap:8px;padding:12px 28px;border-bottom:1px solid rgba(var(--ink-rgb),.07);overflow-x:auto",
        )}
      >
        {TEMPLATE_FILTERS.map((f) => {
          const on = filter === f;
          return (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              style={s(
                `flex:none;height:30px;padding:0 12px;border-radius:6px;border:1px solid ${
                  on ? "rgba(var(--accent-rgb),.45)" : "rgba(var(--ink-rgb),.1)"
                };background:${on ? "rgba(var(--accent-rgb),.11)" : "transparent"};color:${
                  on ? "var(--accent-hi)" : "var(--muted)"
                };font-size:12.5px;font-weight:500;cursor:pointer`,
              )}
            >
              {f}
            </button>
          );
        })}
        <div style={s("margin-left:auto;display:flex;align-items:center;gap:7px;flex:none;padding-left:14px")}>
          <span style={s("font:400 10.5px 'Inter',ui-sans-serif;color:var(--muted-4)")}>SHOWING</span>
          <span style={s("font-size:12.5px;font-weight:500")}>{shown.length} sets</span>
        </div>
      </div>

      <div style={s("max-width:1320px;margin:0 auto;padding:24px 28px 70px")}>
        <div
          style={s("display:grid;grid-template-columns:repeat(auto-fill,minmax(198px,1fr));gap:18px")}
        >
          {shown.map((t) => (
            <Link
              key={t.slug}
              href={`/templates/${t.slug}`}
              style={s("cursor:pointer;color:var(--text)")}
            >
              <div
                className="hov-reveal"
                style={s(
                  `position:relative;height:246px;border-radius:9px;overflow:hidden;background:${t.preview};display:flex;flex-direction:column;align-items:center;border:1px solid rgba(var(--ink-rgb),.08)`,
                )}
              >
                <div
                  style={s(
                    `margin:20px 16px 0;width:calc(100% - 32px);height:6px;border-radius:3px;background:${
                      LIGHT_TEMPLATES.indexOf(t.name) >= 0
                        ? "rgba(0,0,0,.42)"
                        : "rgba(var(--ink-rgb),.62)"
                    }`,
                  )}
                />
                <div
                  style={s(
                    `margin-top:18px;width:78px;height:156px;border-radius:12px;background:linear-gradient(150deg,#3a3833,#141312);box-shadow:0 16px 30px rgba(0,0,0,.5);transform:perspective(620px) rotateY(${t.ty}deg)`,
                  )}
                />
                {/* The card opens the template; the hover overlay is the
                    shortcut that restyles the set and jumps to the canvas. */}
                <button
                  type="button"
                  className="reveal"
                  onClick={(e) => {
                    e.preventDefault();
                    applyTemplate(t.slug);
                    router.push("/editor");
                  }}
                  style={s(
                    "position:absolute;inset:0;display:grid;place-items:center;border:none;background:var(--scrim-soft);color:#fff;font-size:13px;font-weight:600;opacity:0;transition:opacity .16s ease;cursor:pointer",
                  )}
                >
                  Use this set
                </button>
                {t.badge ? (
                  <span
                    style={s(
                      "position:absolute;top:9px;left:9px;padding:2px 7px;border-radius:3px;background:var(--scrim-soft);color:#fff;font:500 9.5px 'Inter',ui-sans-serif;letter-spacing:.08em",
                    )}
                  >
                    {t.badge}
                  </span>
                ) : null}
              </div>
              <div
                style={s("display:flex;align-items:baseline;justify-content:space-between;margin-top:9px")}
              >
                <span style={s("font-size:13px;font-weight:500")}>{t.name}</span>
                <span style={s("font:400 10.5px 'Inter',ui-sans-serif;color:var(--muted-4)")}>
                  {t.frames} FR
                </span>
              </div>
              <div style={s("margin-top:3px;font-size:11.5px;color:var(--muted-3)")}>{t.tagline}</div>
            </Link>
          ))}
        </div>
        {shown.length === 0 && (
          <div style={s("padding:60px 0;text-align:center")}>
            <div style={s("font-size:15px;font-weight:500")}>No sets match that</div>
            <div style={s("margin-top:7px;font-size:13px;color:var(--muted-2)")}>
              Try a different filter, or clear the search.
            </div>
            <button
              type="button"
              onClick={() => {
                setFilter("All");
                setQuery("");
              }}
              className="hov-ink"
              style={s(
                "margin-top:14px;height:32px;padding:0 13px;border:1px solid rgba(var(--ink-rgb),.14);border-radius:6px;background:transparent;color:var(--text);font-size:12.5px;cursor:pointer",
              )}
            >
              Show all {TEMPLATES.length}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
