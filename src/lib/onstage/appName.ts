import type { Backend } from "@/lib/data/backend";

/**
 * The app name a set's exports carry (plan S3.4): the zip and its folder,
 * the export dialog's title and the Play feature graphic. Never the sample
 * app's name unless that is the app.
 */

/** What the zip and the dialog say when nothing names the app. */
export const FALLBACK_APP_NAME = "Onstage export";

/**
 * The set's own `appName` (typed in the export dialog), else the name of the
 * app the set belongs to, else null — "nothing names this app". The zip and
 * dialog then use FALLBACK_APP_NAME; the feature graphic prints no name.
 * A library that can't be read counts as no app record.
 */
export async function resolveAppName(
  doc: { appName?: string },
  setId: string | null,
  backend: Pick<Backend, "listSets" | "listApps">,
): Promise<string | null> {
  const own = typeof doc.appName === "string" ? doc.appName.trim() : "";
  if (own) return own;
  if (!setId) return null;
  try {
    const [sets, apps] = await Promise.all([backend.listSets(), backend.listApps()]);
    const set = sets.find((s) => s.id === setId);
    const app = set ? apps.find((a) => a.id === set.appId) : undefined;
    const name = typeof app?.name === "string" ? app.name.trim() : "";
    return name || null;
  } catch {
    return null;
  }
}

/** The tint a new app gets (local `createApp`), and the icon's when no app
 *  record gives one. */
export const DEFAULT_APP_TINT = "#5d5294";

/**
 * The app as a store listing shows it: name, icon letter and icon tint. A
 * name the set gives its app (typed in the export dialog) is a different app
 * from its record's, so the icon follows that name — never the record's
 * letter and colour beside another app's name. Null name: nothing names it.
 */
export function appIdentity(
  ownName: string | null | undefined,
  app: { name: string; initial?: string; tint?: string } | null | undefined,
): { name: string | null; initial: string; tint: string } {
  const own = typeof ownName === "string" ? ownName.trim() : "";
  const recordName = typeof app?.name === "string" ? app.name.trim() : "";
  const fromRecord = !own || own === recordName;
  const name = (fromRecord ? recordName : own) || null;
  // The first character, not the first UTF-16 unit: an emoji stays whole.
  const initial = fromRecord && app?.initial ? app.initial : (Array.from(name ?? FALLBACK_APP_NAME)[0] ?? "");
  return {
    name,
    initial: initial.toUpperCase(),
    tint: (fromRecord && app?.tint) || DEFAULT_APP_TINT,
  };
}

/** A name as a file and folder name: lower-case ASCII letters and digits in
 *  dash-separated words, at most 60 characters. Nothing usable left (an emoji
 *  or CJK name) gives "onstage-export". */
export function exportSlug(name: string | null): string {
  const slug = (name ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
  return slug || "onstage-export";
}

/** The zip's top folder for an app name. */
export const exportRoot = (name: string | null): string => `${exportSlug(name)}-store-assets`;

/** The zip's file name for an app name. */
export const zipFileName = (name: string | null): string => `${exportRoot(name)}.zip`;
