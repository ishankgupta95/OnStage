"use client";

import { useSyncExternalStore } from "react";

/**
 * The time, refreshed every half minute while something shows it — for
 * "5 min ago" labels, read during render without calling Date.now() there.
 */
let now = 0;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  if (!timer) {
    now = Date.now();
    timer = setInterval(() => {
      now = Date.now();
      for (const l of listeners) l();
    }, 30_000);
  }
  return () => {
    listeners.delete(onChange);
    if (!listeners.size) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

const read = () => (now || (now = Date.now()));

export const useNow = () => useSyncExternalStore(subscribe, read, () => 0);
