"use client";

import { useCallback, useSyncExternalStore } from "react";
import { getBackend } from "./backend";
import { IMAGE_REF_PREFIX, imageIdFromRef } from "./imageRefs";

/**
 * Screenshot refs → object URLs, shared by every component showing the same
 * picture. Each `img:<id>` is read from the backend once while anything shows
 * it; the object URL is revoked when the last viewer lets go, so a long
 * editing session doesn't hold every screenshot it has ever displayed.
 */

type Entry = {
  count: number;
  url: string | null;
  /** idle: nothing read yet (or a read was dropped); done: read finished. */
  state: "idle" | "loading" | "done";
  /** Reads that failed (rejected, not "missing") since the last success. */
  failures: number;
  listeners: Set<() => void>;
};

/** A read that fails is retried this many times, backing off, while it is
 *  still on screen — a one-off IndexedDB hiccup shouldn't blank a frame for
 *  the rest of the session. A missing Blob is final. */
const RETRIES = 3;

const entries = new Map<string, Entry>();

function notify(entry: Entry) {
  for (const fn of entry.listeners) fn();
}

function load(id: string, entry: Entry) {
  entry.state = "loading";
  getBackend()
    .getImage(id)
    .then(
      (blob) => {
        if (entries.get(id) !== entry) return;
        // Nobody is showing it any more: create nothing that would need
        // revoking. A viewer that comes back reads it again.
        if (entry.count === 0) {
          entry.state = "idle";
          return;
        }
        entry.state = "done";
        if (!blob) return;
        entry.url = URL.createObjectURL(blob);
        notify(entry);
      },
      (e: unknown) => {
        if (entries.get(id) !== entry) return;
        entry.state = "idle";
        entry.failures++;
        if (entry.failures > RETRIES) {
          entry.state = "done";
          console.warn(`[onstage] couldn't read screenshot ${id}`, e);
          return;
        }
        setTimeout(() => {
          if (entries.get(id) === entry && entry.count > 0 && entry.state === "idle") load(id, entry);
        }, 250 * 2 ** (entry.failures - 1));
      },
    );
}

/** Start (or join) showing `id`. Pair every call with `releaseImageUrl`. */
export function acquireImageUrl(id: string, onChange: () => void): void {
  let entry = entries.get(id);
  if (!entry) {
    entry = { count: 0, url: null, state: "idle", failures: 0, listeners: new Set() };
    entries.set(id, entry);
  }
  entry.count++;
  entry.listeners.add(onChange);
  if (entry.state === "idle") load(id, entry);
}

export function releaseImageUrl(id: string, onChange: () => void): void {
  const entry = entries.get(id);
  if (!entry) return;
  entry.listeners.delete(onChange);
  entry.count--;
  if (entry.count > 0) return;
  // Revoke on the next task, not now: React re-subscribes in the same commit
  // when a component re-renders with the same ref (and twice under
  // StrictMode), and that must reuse the URL rather than re-read the Blob.
  setTimeout(() => {
    if (entry.count > 0 || entries.get(id) !== entry) return;
    entries.delete(id);
    if (entry.url) URL.revokeObjectURL(entry.url);
  }, 0);
}

/** The object URL for `id` if it is loaded, else null. */
export function peekImageUrl(id: string): string | null {
  return entries.get(id)?.url ?? null;
}

const noop = () => {};

/**
 * A displayable URL for a frame's screenshot ref: `img:<id>` resolves through
 * the shared cache (null until the Blob is read, or if it is missing); `data:`
 * and any other URL pass through unchanged.
 */
export function useImageUrl(ref: string | null | undefined): string | null {
  const id = imageIdFromRef(ref);
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!id) return noop;
      acquireImageUrl(id, onChange);
      return () => releaseImageUrl(id, onChange);
    },
    [id],
  );
  const url = useSyncExternalStore(
    subscribe,
    () => (id ? peekImageUrl(id) : null),
    () => null,
  );
  if (!ref) return null;
  if (id) return url;
  return ref.startsWith(IMAGE_REF_PREFIX) ? null : ref;
}
