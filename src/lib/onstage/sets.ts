import { getBackend, type Backend } from "@/lib/data/backend";
import type { ScreenshotSet, SetDoc } from "@/lib/data/types";
import { currentDoc, useOnstage } from "@/store/onstage";
import { TEMPLATES } from "./data";
import { applyTemplateToDoc, defaultDoc } from "./docOps";

/**
 * Which set a screen means when its URL doesn't say, and how new sets come to
 * be (plan S2.1, D10). Screens outside the editor never change the open set:
 * a template or a first-run choice becomes a new set through `createSet`,
 * then the editor opens it by id.
 */

/** A record's last-edit time, for ordering. Only ISO timestamps count; older
 *  records carry display strings ("2h ago"), which sort after every dated one. */
export function updatedTime(set: Pick<ScreenshotSet, "updatedAt">): number {
  if (!/^\d{4}-\d{2}-\d{2}T/.test(set.updatedAt)) return -Infinity;
  const t = Date.parse(set.updatedAt);
  return Number.isNaN(t) ? -Infinity : t;
}

/** Most recently edited first; undated records keep their listed order. */
export const newestFirst = <T extends Pick<ScreenshotSet, "updatedAt">>(sets: T[]): T[] =>
  [...sets].sort((a, b) => {
    const x = updatedTime(a);
    const y = updatedTime(b);
    return x === y ? 0 : y > x ? 1 : -1;
  });

/**
 * The set a bare `/editor` or `/guided` opens: the one open in this tab, else
 * the one this browser last opened, if the library still lists it; otherwise
 * the most recently edited. Null when there are no sets at all.
 */
export async function findSetToOpen(backend: Backend = getBackend()): Promise<ScreenshotSet | null> {
  const [sets, lastId] = await Promise.all([backend.listSets(), backend.getLastSetId()]);
  // The open set first: remembering it can fail (blocked storage) and it is
  // still the one being worked on.
  const open = useOnstage.getState().loadedSetId;
  return (
    sets.find((s) => s.id === open) ?? sets.find((s) => s.id === lastId) ?? newestFirst(sets)[0] ?? null
  );
}

/**
 * Where a set made without an app in view goes (the template gallery, first
 * run, an empty library): the app of the set a bare `/editor` would open,
 * otherwise the first app, otherwise a new one.
 */
export async function appForNewSet(backend: Backend = getBackend()): Promise<string> {
  const [current, apps] = await Promise.all([findSetToOpen(backend), backend.listApps()]);
  if (current && apps.some((a) => a.id === current.appId)) return current.appId;
  if (apps.length) return apps[0].id;
  return (await backend.createApp({ name: "My app" })).id;
}

/**
 * The document a brand-new set starts from: the default, aimed at the store
 * the person's "Default store target" names (S3.2). If the preference
 * can't be read, the default's own store.
 */
export async function newSetDoc(backend: Backend = getBackend()): Promise<SetDoc> {
  const doc = defaultDoc();
  const prefs = await backend.getPrefs().catch(() => null);
  if (prefs) doc.store = prefs.defaultStore;
  return doc;
}

/** A new set on the default document, in `appId` or wherever a set made
 *  without an app in view goes. */
export async function createBlankSet(
  options: { appId?: string; name?: string } = {},
  backend: Backend = getBackend(),
): Promise<ScreenshotSet> {
  const appId = options.appId ?? (await appForNewSet(backend));
  const doc = await newSetDoc(backend);
  return backend.createSet({ appId, name: options.name ?? "New set", doc });
}

let resolving: Promise<string> | null = null;

/**
 * The id a bare `/editor` or `/guided` should open: `findSetToOpen`, or a
 * new blank set when there is none. Concurrent callers (a remount, a second
 * effect run) share one lookup, so an empty library gets one set, not two.
 */
export function resolveSetToOpen(backend: Backend = getBackend()): Promise<string> {
  resolving ??= (async () => {
    const found = await findSetToOpen(backend);
    return found ? found.id : (await createBlankSet({}, backend)).id;
  })().finally(() => {
    resolving = null;
  });
  return resolving;
}

const usable = (doc: SetDoc | null): doc is SetDoc => !!doc && Array.isArray(doc.frames) && doc.frames.length > 0;

/**
 * The set a screen outside the editor previews, and its document as the
 * editor would show it: `setId` when given, else the set "your screens"
 * means — the one a bare `/editor` would open. Its document is the open set
 * as it is now (it can be newer than storage), otherwise its saved copy,
 * otherwise — no set, or a copy that can't be read — the default the editor
 * would show. Read, never opened (D10). `missing` when `setId` isn't listed.
 */
export async function setPreviewSource(
  backend: Backend = getBackend(),
  setId?: string | null,
): Promise<{ set: ScreenshotSet | null; doc: SetDoc; missing: boolean }> {
  const set = setId
    ? ((await backend.listSets()).find((s) => s.id === setId) ?? null)
    : await findSetToOpen(backend);
  if (!set) return { set: null, doc: defaultDoc(), missing: Boolean(setId) };
  const live = useOnstage.getState().loadedSetId === set.id ? currentDoc() : null;
  if (live) return { set, doc: live, missing: false };
  const saved = await backend.loadSetDoc(set.id).catch(() => null);
  return { set, doc: usable(saved) ? saved : defaultDoc(), missing: false };
}

/**
 * "Use this set" on a template: a new set holding your screens (the set
 * `setPreviewSource` names — the one "My screens" previews) restyled by the
 * template, in that set's app. The set it copies is not touched; the copy
 * shares its screenshots, which `deleteSet` keeps while any set uses them.
 */
export async function createSetFromTemplate(slug: string, backend: Backend = getBackend()): Promise<ScreenshotSet> {
  const tpl = TEMPLATES.find((t) => t.slug === slug);
  if (!tpl) throw new Error("That template isn't available.");
  const { set, doc: source } = await setPreviewSource(backend);
  // No set to copy: a brand-new set, on the person's default store.
  const doc = set ? source : await newSetDoc(backend);
  // A new document never carries the old per-set work mode (S3.2), even
  // when the one it copies still has it.
  const { workMode: _legacy, ...fields } = doc;
  void _legacy;
  const appId = set?.appId ?? (await appForNewSet(backend));
  const app = (await backend.listApps()).find((a) => a.id === appId);
  return backend.createSet({
    appId,
    name: `${app?.name ?? "New"} — ${tpl.name}`,
    doc: applyTemplateToDoc(fields, slug)!,
  });
}

/**
 * First run's "pick a look": a fresh set (the default document, not a copy
 * of an existing set) in the chosen template, or plain when none is picked.
 */
export async function createFirstSet(
  options: { slug?: string },
  backend: Backend = getBackend(),
): Promise<ScreenshotSet> {
  const tpl = options.slug ? TEMPLATES.find((t) => t.slug === options.slug) : undefined;
  if (options.slug && !tpl) throw new Error("That template isn't available.");
  const appId = await appForNewSet(backend);
  const app = (await backend.listApps()).find((a) => a.id === appId);
  const base = await newSetDoc(backend);
  return backend.createSet({
    appId,
    name: `${app?.name ?? "New"} — ${tpl ? tpl.name : "new set"}`,
    doc: tpl ? applyTemplateToDoc(base, tpl.slug)! : base,
  });
}
