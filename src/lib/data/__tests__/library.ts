import * as sample from "../sample";
import type { App, ScreenshotSet } from "../types";

/**
 * A library as a returning user might have it: the three sample apps and
 * four sample sets stored as ordinary records (since S2.2 nothing is
 * prepended from fixtures), with the sample already seeded so it isn't
 * added again. Returns the records written.
 */
export function seedLibrary(
  over: { apps?: App[]; sets?: ScreenshotSet[] } = {},
): { apps: App[]; sets: ScreenshotSet[] } {
  const apps = over.apps ?? sample.APPS.map((a) => ({ ...a }));
  const sets = over.sets ?? sample.SETS.map((x) => ({ ...x }));
  localStorage.setItem("onstage:apps:v1", JSON.stringify(apps));
  localStorage.setItem("onstage:sets:v1", JSON.stringify(sets));
  localStorage.setItem("onstage:seeded:v1", JSON.stringify("2026-09-26T00:00:00.000Z"));
  return { apps, sets };
}

/** Every localStorage key and value, to prove nothing changed. */
export const storageSnapshot = () =>
  Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)]));
