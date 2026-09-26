import type { Backend } from "./backend";
import { FEATURES } from "../features";
import * as sample from "./sample";
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
 * The in-browser implementation: sample content, plus the few things the user
 * changes (resolved comments, sign-in) kept in localStorage so they survive a
 * reload. Replaced wholesale by a Supabase backend.
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
  docs: "onstage:set-docs:v1",
  sets: "onstage:sets:v1",
  apps: "onstage:apps:v1",
  kits: "onstage:brand-kits:v1",
  connections: "onstage:connections:v1",
  members: "onstage:members:v1",
  exports: "onstage:exports-used:v1",
  cancelled: "onstage:cancelled:v1",
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

function writeJson(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function readSet(key: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    return new Set(JSON.parse(localStorage.getItem(key) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

function writeSet(key: string, value: Set<string>) {
  try {
    localStorage.setItem(key, JSON.stringify([...value]));
  } catch {
    /* storage full or blocked — the change simply doesn't outlive the tab */
  }
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
    try {
      localStorage.removeItem(KEY.session);
    } catch {
      /* ignore */
    }
    return { sent: true };
  },
  signInWithProvider: async () => {
    try {
      localStorage.removeItem(KEY.session);
    } catch {
      /* ignore */
    }
    // Supabase returns an OAuth URL here; locally we just land on the app.
    return { redirectTo: "/dashboard" };
  },
  signOut: async () => {
    try {
      localStorage.setItem(KEY.session, "out");
    } catch {
      /* ignore */
    }
  },

  /* ── library ─────────────────────────────────────────────────────────── */
  listApps: async () => [...sample.APPS, ...readJson<App[]>(KEY.apps, [])],
  listSets: async (appId) => {
    const all = [...sample.SETS, ...readJson<ScreenshotSet[]>(KEY.sets, [])];
    const removed = readJson<string[]>(`${KEY.sets}:deleted`, []);
    const renamed = readJson<Record<string, string>>(`${KEY.sets}:names`, {});
    const live = all
      .filter((s) => !removed.includes(s.id))
      .map((s) => (renamed[s.id] ? { ...s, name: renamed[s.id] } : s));
    return appId ? live.filter((s) => s.appId === appId) : live;
  },

  createApp: async ({ name }) => {
    const app: App = {
      id: `app_${Date.now().toString(36)}`,
      name,
      initial: name.charAt(0).toUpperCase() || "?",
      meta: "0 SETS · DRAFT",
      tint: "#5d5294",
      thumbs: Array(4).fill("linear-gradient(160deg,#1f2b4d,#0e1424)"),
      tags: [{ label: "Draft", kind: "neutral" }],
    };
    writeJson(KEY.apps, [...readJson<App[]>(KEY.apps, []), app]);
    return app;
  },

  createSet: async ({ appId, name, doc }) => {
    const set: ScreenshotSet = {
      id: `set_${Date.now().toString(36)}`,
      appId,
      name,
      sub: "New set · EN",
      frameCount: doc?.frames.length ?? 5,
      status: "Draft",
      updatedAt: "Just now",
      swatch: "linear-gradient(150deg,#ff6b53,#c9315f)",
    };
    writeJson(KEY.sets, [...readJson<ScreenshotSet[]>(KEY.sets, []), set]);
    if (doc) writeJson(KEY.docs, { ...readJson(KEY.docs, {}), [set.id]: doc });
    return set;
  },

  renameSet: async (setId, name) => {
    const names = readJson<Record<string, string>>(`${KEY.sets}:names`, {});
    writeJson(`${KEY.sets}:names`, { ...names, [setId]: name });
  },

  deleteSet: async (setId) => {
    const removed = readJson<string[]>(`${KEY.sets}:deleted`, []);
    writeJson(`${KEY.sets}:deleted`, [...new Set([...removed, setId])]);
  },

  loadSetDoc: async (setId) => readJson<Record<string, SetDoc>>(KEY.docs, {})[setId] ?? null,

  saveSetDoc: async (setId, doc) => {
    const all = readJson<Record<string, SetDoc>>(KEY.docs, {});
    if (writeJson(KEY.docs, { ...all, [setId]: doc })) return;
    // Dropped screenshots are data URLs and can blow the 5MB quota. Keep the
    // layout rather than losing everything, and let the caller report it.
    const stripped = { ...doc, frames: doc.frames.map((f) => ({ ...f, screenshot: null })) };
    if (writeJson(KEY.docs, { ...all, [setId]: stripped })) {
      throw new Error("This browser's storage is full — the layout was saved, screenshots were not.");
    }
    throw new Error("This browser refused to store the set.");
  },

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
    writeJson(KEY.connections, { ...readJson(KEY.connections, {}), [id]: true });
    return { redirectTo: "/settings?tab=Store+connections" };
  },

  disconnectStore: async (id) => {
    writeJson(KEY.connections, { ...readJson(KEY.connections, {}), [id]: false });
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
    const set = readSet(KEY.resolved);
    if (resolved) set.add(commentId);
    else set.delete(commentId);
    writeSet(KEY.resolved, set);
  },

  replyToComment: async (commentId, body) => {
    writeJson(KEY.replies, { ...readJson(KEY.replies, {}), [commentId]: body });
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
    const invited = readJson<Member[]>(KEY.members, []);
    if ([...sample.MEMBERS, ...invited].some((m) => m.email === email)) {
      return { ok: false, message: "They're already on the team." };
    }
    const member: Member = {
      id: `m_${Date.now().toString(36)}`,
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
    const roles = readJson<Record<string, MemberRole>>(`${KEY.members}:roles`, {});
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
      id: `kit_${Date.now().toString(36)}`,
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
    writeJson(KEY.kits, [...readJson<BrandKit[]>(KEY.kits, []), kit]);
    return kit;
  },

  recordExport: async (files) => {
    void files;
    // No metering while exports are free. If this kept counting, the day
    // billing comes back every returning user would already be over quota.
    if (!FEATURES.exportQuota) return unmetered();
    const used = readJson<number>(KEY.exports, 0) + 1;
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
