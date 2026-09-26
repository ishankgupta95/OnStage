import type { App, AppTag, ScreenshotSet } from "@/lib/data/types";
import { newestFirst } from "./sets";

/**
 * The dashboard's words about the library, derived from the records it
 * lists (plan S2.3) — never a fixed string.
 */

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "2 apps · 5 sets". */
export const librarySummary = (apps: number, sets: number) =>
  `${plural(apps, "app")} · ${plural(sets, "set")}`;

/**
 * An app card's meta line, tags and thumbnail strip, from the app's sets:
 * "2 SETS · IOS + ANDROID"; "1 ready" / "2 drafts"; the newest set's first
 * four backgrounds (the stored strip when it has none).
 */
export function appSummary(
  app: Pick<App, "thumbs">,
  sets: ScreenshotSet[],
): { meta: string; tags: AppTag[]; thumbs: string[] } {
  const stores = new Set(sets.map((x) => x.store).filter(Boolean));
  const platforms = [stores.has("apple") && "IOS", stores.has("play") && "ANDROID"].filter(Boolean).join(" + ");
  const meta = `${plural(sets.length, "SET").toUpperCase()}${platforms ? ` · ${platforms}` : ""}`;

  const ready = sets.filter((x) => x.status === "Ready").length;
  const drafts = sets.filter((x) => x.status === "Draft").length;
  const tags: AppTag[] = [];
  if (ready) tags.push({ label: `${ready} ready`, kind: "ok" });
  if (drafts) tags.push({ label: plural(drafts, "draft"), kind: "neutral" });
  if (!sets.length) tags.push({ label: "No sets yet", kind: "neutral" });

  const newest = newestFirst(sets)[0];
  const strip = newest?.swatches?.length ? newest.swatches : newest ? [newest.swatch] : [];
  const thumbs = strip.length ? Array.from({ length: 4 }, (_, i) => strip[i % strip.length]) : app.thumbs;
  return { meta, tags, thumbs };
}
