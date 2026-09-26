"use client";

import { useState } from "react";
import { s } from "@/lib/onstage/css";
import { getBackend } from "@/lib/data/backend";
import type { ImportedListing } from "@/lib/data/types";
import { IcoAlert } from "./icons";

/**
 * "Paste your store URL" — a real field. The backend does the fetching, so
 * this only has to validate, report, and hand back what it found.
 */
export function StoreUrlField({
  onImported,
  cta = "Pull it in",
  placeholder = "https://apps.apple.com/…",
}: {
  onImported: (listing: ImportedListing) => void;
  cta?: string;
  placeholder?: string;
}) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !url.trim()) return;
    setBusy(true);
    setError(null);
    const result = await getBackend().importFromStoreUrl(url.trim());
    setBusy(false);
    if ("error" in result) setError(result.error);
    else onImported(result);
  };

  return (
    <form onSubmit={submit} noValidate style={s("display:flex;flex-direction:column;gap:8px")}>
      <div style={s("display:flex;gap:8px")}>
        <input
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setError(null);
          }}
          placeholder={placeholder}
          aria-label="Store listing URL"
          style={s(
            `flex:1;min-width:0;height:38px;padding:0 11px;border:1px solid ${
              error ? "rgba(var(--warn-rgb),.5)" : "rgba(var(--ink-rgb),.14)"
            };border-radius:8px;background:var(--bg);color:var(--text);font:400 13px 'Inter',sans-serif;outline:none`,
          )}
        />
        <button
          type="submit"
          disabled={busy || !url.trim()}
          style={s(
            `flex:none;height:38px;padding:0 14px;border:none;border-radius:8px;background:var(--accent);color:var(--on-accent);font-size:13px;font-weight:600;cursor:pointer;opacity:${
              url.trim() ? 1 : 0.5
            }`,
          )}
        >
          {busy ? "Reading…" : cta}
        </button>
      </div>
      {error && (
        <div style={s("display:flex;align-items:center;gap:7px;font-size:12.5px;color:var(--warn)")}>
          <IcoAlert size={13} w={2} style={s("flex:none")} />
          {error}
        </div>
      )}
    </form>
  );
}
