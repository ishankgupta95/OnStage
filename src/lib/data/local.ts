import type { Backend } from "./backend";
import { FEATURES } from "../features";
import { defaultDoc } from "../onstage/docOps";
import { randomId } from "./ids";
import { docImageIds, imageIdsInJson } from "./imageRefs";
import * as images from "./imageStore";
import { SET_DOCS_KEY, migrateScreenshotsToImages } from "./migrateImages";
import * as sample from "./sample";
import { summarizeDoc } from "./setSummary";
import type {
  App,
  BrandKit,
  CaptionSuggestion,
  CaptionTone,
  Comment,
  Member,
  MemberRole,
  ScreenshotSet,
  Session,
  SetDoc,
  UploadResult,
} from "./types";

/**
 * The in-browser implementation: sample content, plus what the user changes
 * kept in this browser — small JSON records in localStorage, screenshot bytes
 * in IndexedDB (imageStore.ts). Replaced wholesale by a Supabase backend.
 */

const ok = <T>(value: T): Promise<T> => Promise.resolve(value);

/** What the caption assistant offers, per tone. */
const TONE_SUGGESTIONS: Record<CaptionTone, CaptionSuggestion[]> = {
  Direct: [
    { text: "Every run, on one map", meta: "22 CHARS · FITS ONE LINE" },
    { text: "See where you've been", meta: "21 CHARS · FITS ONE LINE" },
    { text: "Your whole year of running, mapped", meta: "34 CHARS · WRAPS TO TWO" },
  ],
  "Benefit-led": [
    { text: "Never lose a route again", meta: "24 CHARS · FITS ONE LINE" },
    { text: "Know your pace before you go", meta: "28 CHARS · FITS ONE LINE" },
    { text: "Every split, without the stopwatch", meta: "34 CHARS · WRAPS TO TWO" },
  ],
  Playful: [
    { text: "Brag with evidence", meta: "18 CHARS · FITS ONE LINE" },
    { text: "Your legs did that", meta: "18 CHARS · FITS ONE LINE" },
    { text: "Proof you left the house", meta: "24 CHARS · FITS ONE LINE" },
  ],
};

const KEY = {
  resolved: "onstage:resolved-comments:v1",
  replies: "onstage:comment-replies:v1",
  session: "onstage:session:v1",
  docs: SET_DOCS_KEY,
  sets: "onstage:sets:v1",
  apps: "onstage:apps:v1",
  kits: "onstage:brand-kits:v1",
  connections: "onstage:connections:v1",
  members: "onstage:members:v1",
  exports: "onstage:exports-used:v1",
  cancelled: "onstage:cancelled:v1",
  lastSet: "onstage:last-set:v1",
  seeded: "onstage:seeded:v1",
};

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Why the browser refused a write, in words a person can act on. Every
 * mutating method rejects with one of these instead of carrying on as if the
 * change had been kept (DATA-5).
 */
function storageRefused(e: unknown): Error {
  const { name, code } = (e ?? {}) as { name?: string; code?: number };
  const full =
    name === "QuotaExceededError" || name === "NS_ERROR_DOM_QUOTA_REACHED" || code === 22 || code === 1014;
  return new Error(full ? "This browser's storage is full." : "This browser is blocking storage for this site.");
}

function writeRaw(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    throw storageRefused(e);
  }
}

function writeJson(key: string, value: unknown) {
  writeRaw(key, JSON.stringify(value));
}

function removeKey(key: string) {
  try {
    localStorage.removeItem(key);
  } catch (e) {
    throw storageRefused(e);
  }
}

/**
 * The stored value an update starts from. Missing reads as `fallback`; a
 * value that can't be parsed throws, so an update never writes over (and
 * destroys) something it couldn't read.
 */
function readForUpdate<T>(key: string, fallback: T): T {
  let raw: string | null;
  try {
    raw = localStorage.getItem(key);
  } catch (e) {
    throw storageRefused(e);
  }
  if (raw === null) return fallback;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = undefined;
  }
  if (!sameShape(parsed, fallback)) {
    throw new Error("Something Onstage saved in this browser is unreadable, so it won't write over it.");
  }
  return parsed as T;
}

/** A stored value is only updated if it is the kind of thing the update
 *  expects — a list, a record, a number — never coerced into one. */
function sameShape(value: unknown, like: unknown): boolean {
  if (Array.isArray(like)) return Array.isArray(value);
  if (typeof like === "number") return typeof value === "number" && Number.isFinite(value);
  if (typeof like === "boolean") return typeof value === "boolean";
  if (like && typeof like === "object") return !!value && typeof value === "object" && !Array.isArray(value);
  return value !== undefined;
}

function readSet(key: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    return new Set(JSON.parse(localStorage.getItem(key) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

/**
 * Every set document, keyed by set id. Missing storage reads as no documents;
 * a stored value that can't be parsed throws, so nothing ever writes over
 * (and destroys) sets it couldn't read.
 */
function readDocs(): Record<string, SetDoc> {
  if (typeof window === "undefined") return {};
  let raw: string | null;
  try {
    raw = localStorage.getItem(KEY.docs);
  } catch {
    throw new Error("This browser is blocking storage, so Onstage can't read or save sets.");
  }
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("The sets saved in this browser are unreadable, so Onstage won't write over them.");
  }
  return parsed as Record<string, SetDoc>;
}

function writeDocs(docs: Record<string, SetDoc>) {
  writeJson(KEY.docs, docs);
}

/**
 * Screenshots used to live inside the documents as data URLs. Move them to
 * the image store once per page load, before the first document read or
 * write, so nothing reads a half-migrated value or saves over one.
 */
let docsReady: Promise<unknown> | null = null;
function whenDocsReady(): Promise<unknown> {
  if (typeof window === "undefined") return Promise.resolve();
  docsReady ??= migrateScreenshotsToImages().catch((e) =>
    console.warn("[onstage] screenshot migration failed; the stored sets were left as they were", e),
  );
  return docsReady;
}

/** A key's raw stored value, to put back exactly if a later write fails. */
function rawValue(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    throw storageRefused(e);
  }
}

/** Put a key back to a raw value from `rawValue` (null: it was absent). */
function restoreRaw(key: string, raw: string | null) {
  if (raw === null) removeKey(key);
  else writeRaw(key, raw);
}

/* ── the sample, as ordinary records (plan D2) ─────────────────────────────
   Trailhead used to be fixture rows prepended to every list, which could be
   neither opened as themselves nor deleted. It is now written once, under
   its old ids so a document saved at `onstage:set-docs:v1['trailhead-69']`
   stays attached, and then belongs to the user like any other set.        */

const SEED_APP_ID = "trailhead";
const SEED_SET_ID = "trailhead-69";

/** The sample app's record. Its fixture tags and set count describe a
 *  listing this browser doesn't have, so they aren't carried over. */
function seedApp(): App {
  const app = sample.APPS.find((a) => a.id === SEED_APP_ID)!;
  return { ...app, meta: "1 SET", tags: [] };
}

/** The sample set's record, describing the document it will open: the one
 *  already saved under its id, if any, else the default. Only read — seeding
 *  never writes or creates a document. */
function seedSet(): ScreenshotSet {
  let saved: SetDoc | undefined;
  try {
    saved = readDocs()[SEED_SET_ID];
  } catch {
    saved = undefined;
  }
  const usable = !!saved && Array.isArray(saved.frames) && saved.frames.length > 0;
  const set = sample.SETS.find((x) => x.id === SEED_SET_ID)!;
  return {
    ...set,
    ...summarizeDoc(usable ? saved! : defaultDoc()),
    updatedAt: new Date().toISOString(),
  };
}

/** True while the sample couldn't be stored this page load: the lists then
 *  show it from memory instead of failing. */
let seedUnstored = false;

/**
 * Write the sample app and set once, before anything reads or changes the
 * library. Guarded by `onstage:seeded:v1`, which stays set even after the
 * user deletes the sample, so it never comes back. Idempotent by id: a
 * retry after a partial failure adds only what is missing.
 */
function ensureSeeded() {
  if (typeof window === "undefined") return;
  let marker: string | null;
  try {
    marker = localStorage.getItem(KEY.seeded);
  } catch {
    seedUnstored = true;
    return;
  }
  if (marker !== null) {
    seedUnstored = false;
    return;
  }
  try {
    const apps = readForUpdate<App[]>(KEY.apps, []);
    const sets = readForUpdate<ScreenshotSet[]>(KEY.sets, []);
    if (!apps.some((a) => a.id === SEED_APP_ID)) writeJson(KEY.apps, [seedApp(), ...apps]);
    if (!sets.some((x) => x.id === SEED_SET_ID)) writeJson(KEY.sets, [seedSet(), ...sets]);
    writeJson(KEY.seeded, new Date().toISOString());
    seedUnstored = false;
  } catch (e) {
    seedUnstored = true;
    console.warn("[onstage] couldn't store the sample set; showing it from memory", e);
  }
}

/** The stored apps — plus the sample from memory if it couldn't be stored. */
function libraryApps(): App[] {
  ensureSeeded();
  const apps = readJson<App[]>(KEY.apps, []);
  const list = Array.isArray(apps) ? apps : [];
  return seedUnstored && !list.some((a) => a.id === SEED_APP_ID) ? [seedApp(), ...list] : list;
}

/** The stored sets — plus the sample from memory if it couldn't be stored. */
function librarySets(): ScreenshotSet[] {
  ensureSeeded();
  const sets = readJson<ScreenshotSet[]>(KEY.sets, []);
  const list = Array.isArray(sets) ? sets : [];
  return seedUnstored && !list.some((x) => x.id === SEED_SET_ID) ? [seedSet(), ...list] : list;
}

/** Why a set can't be changed: gone — or, for the sample while it could
 *  only be shown from memory, because storage refused it. */
function notStored(setId: string): Error {
  return setId === SEED_SET_ID && seedUnstored
    ? new Error("This browser's storage is full or blocked, so the sample set couldn't be stored.")
    : new Error("That set isn't in this browser any more.");
}

/**
 * Drop localStorage written by a surface that is now flagged off. Idempotent
 * and safe to call on every boot: each key is only removed while its feature
 * is off, so flipping a flag back on stops the cleanup for that key.
 *
 * Without this, state from the account era misbehaves across the flip — a
 * stuck "out" sentinel pins the session at null, a stored meter counts against
 * a quota that no longer exists, and invited teammates reappear the moment
 * teams comes back.
 */
export function clearStaleAccountKeys() {
  if (typeof window === "undefined") return;
  const stale = [
    ...(FEATURES.accounts ? [] : [KEY.session]),
    ...(FEATURES.exportQuota ? [] : [KEY.exports]),
    ...(FEATURES.teams ? [] : [KEY.members, `${KEY.members}:roles`]),
    ...(FEATURES.billing ? [] : [KEY.cancelled]),
  ];
  try {
    for (const key of stale) localStorage.removeItem(key);
  } catch {
    /* storage blocked — nothing to clean up in that case anyway */
  }
}

/**
 * The sample account with the allowance removed — `exportsAllowed: null` is
 * "unlimited" per types.ts. Used while FEATURES.exportQuota is off, so the
 * fixture keeps its real number and flipping the flag restores metering.
 */
const unmetered = (): Session => ({ ...sample.SESSION, exportsAllowed: null });

export const localBackend: Backend = {
  /* ── auth ─────────────────────────────────────────────────────────────
     No identity provider yet, so the sample account is always signed in.
     A Supabase backend returns the real session (and null when signed out,
     which the UI already handles).                                        */
  getSession: async (): Promise<Session | null> => {
    // With accounts off there is nothing to sign out of, and the only thing
    // that ever cleared this sentinel was signing in — which is gated. Ignore
    // it, or anyone who clicked Sign out before the flip is stuck at null
    // forever. (clearStaleAccountKeys() removes it outright on boot.)
    if (
      FEATURES.accounts &&
      typeof window !== "undefined" &&
      localStorage.getItem(KEY.session) === "out"
    ) {
      return null;
    }
    // Likewise the stored meter: with the quota off it must not inflate
    // exportsUsed, or re-enabling billing starts every returning user over.
    if (!FEATURES.exportQuota) return unmetered();
    const extra = readJson<number>(KEY.exports, 0);
    return { ...sample.SESSION, exportsUsed: sample.SESSION.exportsUsed + extra };
  },
  signInWithEmail: async (email) => {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return { sent: false, message: "That doesn't look like an email address." };
    }
    removeKey(KEY.session);
    return { sent: true };
  },
  signInWithProvider: async () => {
    removeKey(KEY.session);
    // Supabase returns an OAuth URL here; locally we just land on the app.
    return { redirectTo: "/dashboard" };
  },
  signOut: async () => {
    writeRaw(KEY.session, "out");
  },

  /* ── library ───────────────────────────────────────────────────────────
     Records only — the sample is seeded once as ordinary records, never
     prepended (plan D2).                                                   */
  listApps: async () => libraryApps(),
  listSets: async (appId) => {
    const sets = librarySets();
    return appId ? sets.filter((x) => x.appId === appId) : sets;
  },

  createApp: async ({ name }) => {
    ensureSeeded();
    const app: App = {
      id: `app_${randomId()}`,
      name,
      initial: name.charAt(0).toUpperCase() || "?",
      meta: "0 SETS · DRAFT",
      tint: "#5d5294",
      thumbs: Array(4).fill("linear-gradient(160deg,#1f2b4d,#0e1424)"),
      tags: [{ label: "Draft", kind: "neutral" }],
    };
    writeJson(KEY.apps, [...readForUpdate<App[]>(KEY.apps, []), app]);
    return app;
  },

  createSet: async ({ appId, name, doc }) => {
    if (doc) await whenDocsReady();
    ensureSeeded();
    const set: ScreenshotSet = {
      id: `set_${randomId()}`,
      appId,
      name,
      // Without a document the set opens on the default one.
      ...summarizeDoc(doc ?? defaultDoc()),
      // A timestamp, not a display string: lists order by it (the newest set
      // is what a bare /editor falls back to) and format it when shown.
      updatedAt: new Date().toISOString(),
    };
    const sets = readForUpdate<ScreenshotSet[]>(KEY.sets, []);
    // The document first: a library record must never point at a document
    // that wasn't stored. If the record then fails, put the documents back
    // exactly as they were.
    const docsBefore = doc ? localStorage.getItem(KEY.docs) : null;
    if (doc) writeDocs({ ...readDocs(), [set.id]: doc });
    try {
      writeJson(KEY.sets, [...sets, set]);
    } catch (e) {
      if (doc) {
        try {
          if (docsBefore === null) removeKey(KEY.docs);
          else writeRaw(KEY.docs, docsBefore);
        } catch {
          /* an orphaned document is invisible and harmless */
        }
      }
      throw e;
    }
    return set;
  },

  renameSet: async (setId, name) => {
    ensureSeeded();
    const trimmed = name.trim();
    if (!trimmed) throw new Error("A set needs a name.");
    const sets = readForUpdate<ScreenshotSet[]>(KEY.sets, []);
    if (!sets.some((x) => x.id === setId)) throw notStored(setId);
    writeJson(
      KEY.sets,
      sets.map((x) => (x.id === setId ? { ...x, name: trimmed } : x)),
    );
  },

  duplicateSet: async (setId) => {
    await whenDocsReady();
    ensureSeeded();
    const sets = readForUpdate<ScreenshotSet[]>(KEY.sets, []);
    const source = sets.find((x) => x.id === setId);
    if (!source) throw notStored(setId);
    const docs = readDocs();
    const doc = docs[setId];
    const copy: ScreenshotSet = {
      ...source,
      id: `set_${randomId()}`,
      name: `${source.name} copy`,
      updatedAt: new Date().toISOString(),
    };
    // The same order as createSet: the document (the same image refs — the
    // copy shares its screenshots), then the record; a failed record puts
    // the documents back exactly. A set never saved has no document, and
    // neither does its copy: both open on the default.
    const docsBefore = rawValue(KEY.docs);
    if (doc !== undefined) writeDocs({ ...docs, [copy.id]: doc });
    try {
      writeJson(KEY.sets, [...sets, copy]);
    } catch (e) {
      if (doc !== undefined) {
        try {
          restoreRaw(KEY.docs, docsBefore);
        } catch {
          /* an orphaned document is invisible and harmless */
        }
      }
      throw e;
    }
    return copy;
  },

  // The set's record and document go, then each screenshot only it used
  // (plan S2.2, GAP-11). A screenshot another stored document mentions — in
  // any field, even one this code doesn't know yet — or that the caller
  // still holds (the open set's undo history) stays: a duplicate shares its
  // original's screenshots, and undo can bring a removed one back.
  deleteSet: async (setId, options) => {
    await whenDocsReady();
    ensureSeeded();
    // Deleting the sample settles seeding for good, even if the marker
    // couldn't be stored before: otherwise the next list read would seed it
    // again (or keep showing it from memory).
    if (setId === SEED_SET_ID) {
      if (rawValue(KEY.seeded) === null) writeJson(KEY.seeded, new Date().toISOString());
      seedUnstored = false;
    }
    const sets = readForUpdate<ScreenshotSet[]>(KEY.sets, []);
    const docs = readDocs();
    const listed = sets.some((x) => x.id === setId);
    const hasDoc = Object.prototype.hasOwnProperty.call(docs, setId);
    if (!listed && !hasDoc) return;
    const doc = docs[setId];
    const rest = { ...docs };
    delete rest[setId];

    // Record first, then document, as one change: if the document can't be
    // removed, the record comes back, so a listed set never loses its doc.
    const setsBefore = rawValue(KEY.sets);
    if (listed) writeJson(KEY.sets, sets.filter((x) => x.id !== setId));
    if (hasDoc) {
      try {
        writeDocs(rest);
      } catch (e) {
        if (listed) {
          try {
            restoreRaw(KEY.sets, setsBefore);
          } catch {
            /* the record is gone but its document stayed: invisible, harmless */
          }
        }
        throw e;
      }
    }

    const keep = imageIdsInJson(JSON.stringify(rest));
    for (const id of options?.keepImages ?? []) keep.add(id);
    const unshared = [...docImageIds(doc)].filter((id) => !keep.has(id));
    if (!unshared.length) return;
    try {
      await images.deleteImages(unshared);
    } catch {
      throw new Error("The set was deleted, but its screenshots couldn't be removed from this browser's storage.");
    }
  },

  // SUPABASE SEAM: a per-device preference — it can stay in localStorage
  // even with a server, since "the set I was just in" is about this browser.
  getLastSetId: async () => {
    const id = readJson<unknown>(KEY.lastSet, null);
    return typeof id === "string" && id ? id : null;
  },
  rememberLastSet: async (setId) => {
    writeJson(KEY.lastSet, setId);
  },

  loadSetDoc: async (setId) => {
    await whenDocsReady();
    return readDocs()[setId] ?? null;
  },

  // A failed write rejects and leaves what was stored untouched — never a
  // partial save. Screenshots are `img:` refs now, so a document is a few KB.
  // The set's library record follows its document (GAP-10): frame count,
  // swatch, status and the time of this save.
  saveSetDoc: async (setId, doc) => {
    await whenDocsReady();
    ensureSeeded();
    const docs = readDocs();
    const sets = readForUpdate<ScreenshotSet[]>(KEY.sets, []);
    const i = sets.findIndex((x) => x.id === setId);
    if (i < 0) {
      // No record (a document from before sets were real): the doc alone.
      writeDocs({ ...docs, [setId]: doc });
      return;
    }
    const setsBefore = rawValue(KEY.sets);
    const next = sets.slice();
    next[i] = { ...sets[i], ...summarizeDoc(doc), updatedAt: new Date().toISOString() };
    writeJson(KEY.sets, next);
    try {
      writeDocs({ ...docs, [setId]: doc });
    } catch (e) {
      try {
        restoreRaw(KEY.sets, setsBefore);
      } catch {
        /* a record a save ahead of its document: corrected by the next save */
      }
      throw e;
    }
  },

  /* ── screenshots ─────────────────────────────────────────────────────
     SUPABASE SEAM: a Storage bucket. Locally the bytes live in IndexedDB
     (imageStore.ts), keyed by random ids.                                 */
  putImage: (blob) => images.putImage(blob),
  getImage: (id) => images.getImage(id),
  deleteImages: (ids) => images.deleteImages(ids),

  importFromStoreUrl: async (url) => {
    if (!/^https?:\/\/(apps\.apple\.com|play\.google\.com)\//i.test(url.trim())) {
      return { error: "Paste an apps.apple.com or play.google.com link." };
    }
    // A Supabase backend scrapes the listing; locally we return the worked
    // example so the rest of the flow is exercised.
    return {
      appName: "Trailhead",
      subtitle: "Run & Trail Log",
      tint: "#1b6f6a",
      screenshots: [],
    };
  },

  /* ── one project ─────────────────────────────────────────────────────── */
  listSizeRows: () => ok(sample.SIZE_ROWS),
  listVariants: () => ok(sample.VARIANTS),
  listLocales: () => ok(sample.LOCALES),
  listActivity: () => ok(sample.ACTIVITY),

  /* ── store connections + delivery ────────────────────────────────────── */
  listConnections: async () => {
    const overrides = readJson<Record<string, boolean>>(KEY.connections, {});
    return sample.CONNECTIONS.map((c) =>
      c.id in overrides
        ? {
            ...c,
            connected: overrides[c.id],
            sub: overrides[c.id] ? "Connected just now" : "Not connected",
            warning: overrides[c.id] ? "" : c.warning,
          }
        : c,
    );
  },

  connectStore: async (id) => {
    // SUPABASE SEAM: return the provider's OAuth URL. Locally we mark it
    // connected so the rest of the export path can be walked.
    writeJson(KEY.connections, { ...readForUpdate(KEY.connections, {}), [id]: true });
    return { redirectTo: "/settings?tab=Store+connections" };
  },

  disconnectStore: async (id) => {
    writeJson(KEY.connections, { ...readForUpdate(KEY.connections, {}), [id]: false });
  },
  listJobs: () => ok(sample.JOBS),
  uploadToStore: async ({ destination }): Promise<UploadResult> => {
    const conn = sample.CONNECTIONS.find((c) => c.id === destination);
    if (!conn?.connected) {
      return {
        ok: false,
        reason: destination === "google" ? "token-expired" : "not-connected",
        message:
          destination === "google"
            ? "Play rejected the upload: service account key revoked. Reconnect in Settings → Store connections, then retry."
            : "Connect App Store Connect in Settings before uploading.",
      };
    }
    // A Supabase backend hands the files to an edge function and returns its
    // job id; locally there is nowhere to put them, so say so plainly.
    return {
      ok: false,
      reason: "not-connected",
      message: "Uploads need the store backend. The files are ready — download the zip meanwhile.",
    };
  },

  /* ── review ──────────────────────────────────────────────────────────── */
  listComments: async () => {
    const resolved = readSet(KEY.resolved);
    const replies = readJson<Record<string, string>>(KEY.replies, {});
    return sample.COMMENTS.map(
      (c): Comment => ({
        ...c,
        resolved: resolved.has(c.id),
        reply: replies[c.id] ? { author: "You", body: replies[c.id] } : c.reply,
      }),
    );
  },
  resolveComment: async (commentId, resolved) => {
    const set = new Set(readForUpdate<string[]>(KEY.resolved, []));
    if (resolved) set.add(commentId);
    else set.delete(commentId);
    writeJson(KEY.resolved, [...set]);
  },

  replyToComment: async (commentId, body) => {
    writeJson(KEY.replies, { ...readForUpdate(KEY.replies, {}), [commentId]: body });
  },

  /* ── account ─────────────────────────────────────────────────────────── */
  listMembers: async () => {
    // Gated here rather than by emptying sample.MEMBERS: the merge below
    // assumes a non-empty base whose last row is the "seat available"
    // placeholder, and would push undefined into the array otherwise.
    if (!FEATURES.teams) return [];
    const roles = readJson<Record<string, MemberRole>>(`${KEY.members}:roles`, {});
    const invited = readJson<Member[]>(KEY.members, []);
    const base = sample.MEMBERS.map((m) => (roles[m.id] ? { ...m, role: roles[m.id] } : m));
    // Invited seats take the placeholder row's place.
    return invited.length ? [...base.slice(0, -1), ...invited, base[base.length - 1]] : base;
  },

  inviteMember: async (email, role) => {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return { ok: false, message: "That doesn't look like an email address." };
    }
    const invited = readForUpdate<Member[]>(KEY.members, []);
    if ([...sample.MEMBERS, ...invited].some((m) => m.email === email)) {
      return { ok: false, message: "They're already on the team." };
    }
    const member: Member = {
      id: `m_${randomId()}`,
      name: email.split("@")[0],
      email,
      role,
      lastSeen: "Invited",
      tint: "#75798c",
    };
    writeJson(KEY.members, [...invited, member]);
    return { ok: true };
  },

  setMemberRole: async (memberId, role) => {
    const roles = readForUpdate<Record<string, MemberRole>>(`${KEY.members}:roles`, {});
    writeJson(`${KEY.members}:roles`, { ...roles, [memberId]: role });
  },

  listInvoices: () => ok(sample.INVOICES),
  // SUPABASE SEAM: a signed URL from storage. Nothing to sign locally.
  getInvoiceUrl: async () => null,
  listUsage: () => ok(sample.USAGE),
  cancelSubscription: async () => {
    writeJson(KEY.cancelled, true);
  },
  listBrandKits: async () => [...sample.BRAND_KITS, ...readJson<BrandKit[]>(KEY.kits, [])],
  createBrandKit: async (name) => {
    const kit: BrandKit = {
      id: `kit_${randomId()}`,
      name,
      setCount: 0,
      tint: "#5d5294",
      colors: [
        { role: "Primary", hex: "#5D5294" },
        { role: "Deep", hex: "#2B2741" },
        { role: "Surface", hex: "#0F1114" },
        { role: "Accent", hex: "#B5ABFC" },
        { role: "Paper", hex: "#F3F5FE" },
      ],
      defaults: [
        { label: "Device frame", sub: "Applied to new frames", value: "Graphite" },
        { label: "Perspective", sub: "Starting tilt", value: "Flat" },
        { label: "Caption position", sub: "Above the device", value: "Top" },
        { label: "Safe margins", sub: "Store-safe padding", value: "On" },
      ],
    };
    writeJson(KEY.kits, [...readForUpdate<BrandKit[]>(KEY.kits, []), kit]);
    return kit;
  },

  recordExport: async (files) => {
    void files;
    // No metering while exports are free. If this kept counting, the day
    // billing comes back every returning user would already be over quota.
    if (!FEATURES.exportQuota) return unmetered();
    const used = readForUpdate<number>(KEY.exports, 0) + 1;
    writeJson(KEY.exports, used);
    return { ...sample.SESSION, exportsUsed: sample.SESSION.exportsUsed + used };
  },

  // A Supabase backend sends `caption` to a model; locally the tone alone
  // picks a curated set.
  suggestCaptions: async ({ tone }) => TONE_SUGGESTIONS[tone] ?? TONE_SUGGESTIONS.Direct,

  /* ── growth ──────────────────────────────────────────────────────────── */
  getAbTest: () =>
    ok({ stats: sample.AB_STATS, variants: sample.AB_VARIANTS, diffs: sample.AB_DIFFS }),
};
