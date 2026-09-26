import type {
  AbDiff,
  CaptionSuggestion,
  CaptionTone,
  ImportedListing,
  MemberRole,
  Prefs,
  SetDoc,
  AbStat,
  AbVariant,
  ActivityEntry,
  App,
  BrandKit,
  Comment,
  Invoice,
  Job,
  Locale,
  Member,
  ScreenshotSet,
  Session,
  SizeRow,
  StoreConnection,
  UploadResult,
  UsageMetric,
  Variant,
} from "./types";
import { localBackend } from "./local";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  THE SUPABASE SEAM
 * ─────────────────────────────────────────────────────────────────────────────
 *  Every screen reads through this interface and nothing else. To move onto
 *  Supabase, write a second implementation of `Backend` (queries + RLS) and
 *  return it from `getBackend()` — no screen has to change.
 *
 *  Everything is async on purpose, even though the local implementation
 *  resolves immediately: the loading and error paths in the UI are already
 *  exercised, so nothing has to be retrofitted later.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export interface Backend {
  /* auth */
  getSession(): Promise<Session | null>;
  signInWithEmail(email: string): Promise<{ sent: true } | { sent: false; message: string }>;
  signInWithProvider(provider: "apple" | "google"): Promise<{ redirectTo: string } | null>;
  signOut(): Promise<void>;

  /* library */
  listApps(): Promise<App[]>;
  listSets(appId?: string): Promise<ScreenshotSet[]>;
  createApp(input: { name: string }): Promise<App>;
  createSet(input: { appId: string; name: string; doc?: SetDoc }): Promise<ScreenshotSet>;
  renameSet(setId: string, name: string): Promise<void>;
  /** A copy of a set in the same app — its document as stored, sharing its
   *  screenshots (`deleteSet` keeps any another set still uses). */
  duplicateSet(setId: string): Promise<ScreenshotSet>;
  /**
   * Delete a set's record and document, and each of its screenshots that no
   * other stored document references. `keepImages` names screenshots the
   * caller can still reach outside storage (the open set's undo history),
   * which are kept too.
   */
  deleteSet(setId: string, options?: { keepImages?: string[] }): Promise<void>;

  /** The set this browser last opened, for a bare `/editor` to return to.
   *  Null if none was recorded. It may since have been deleted — check the
   *  library before opening it. */
  getLastSetId(): Promise<string | null>;
  /** Record the set just opened as the one to return to. */
  rememberLastSet(setId: string): Promise<void>;

  /* preferences — the person's, not a set's */
  /** The person's preferences; defaults for anything not chosen yet. */
  getPrefs(): Promise<Prefs>;
  /** Change some preferences; resolves with all of them as now stored. */
  setPrefs(patch: Partial<Prefs>): Promise<Prefs>;

  /* the editable document — what the canvas edits and export renders */
  loadSetDoc(setId: string): Promise<SetDoc | null>;
  saveSetDoc(setId: string, doc: SetDoc): Promise<void>;

  /* screenshots — the bytes behind a frame's `img:<id>` ref */
  /** Store a screenshot as-is (no downscaling); returns a fresh random id. */
  putImage(blob: Blob): Promise<string>;
  /** The screenshot stored under `id`, or null if there is none. */
  getImage(id: string): Promise<Blob | null>;
  /** Remove screenshots. Only `deleteSet` (after a reference check) and an
   *  explicit "clear all data" call this — never undo, frame removal or a
   *  replaced screenshot, because undo can bring a ref back. */
  deleteImages(ids: string[]): Promise<void>;

  /** Pull an existing listing in from its store URL. */
  importFromStoreUrl(url: string): Promise<ImportedListing | { error: string }>;

  /* one project */
  listSizeRows(appId: string): Promise<SizeRow[]>;
  listVariants(appId: string): Promise<Variant[]>;
  listLocales(appId: string): Promise<Locale[]>;
  listActivity(appId: string): Promise<ActivityEntry[]>;

  /* store connections + delivery */
  listConnections(): Promise<StoreConnection[]>;
  /** Begin an OAuth handshake, or explain why it can't start. */
  connectStore(id: "apple" | "google"): Promise<{ redirectTo: string } | { error: string }>;
  disconnectStore(id: "apple" | "google"): Promise<void>;
  listJobs(appId?: string): Promise<Job[]>;
  /** Hand a rendered set to a store. The FE calls this; the BE does the work. */
  uploadToStore(input: {
    appId: string;
    destination: "apple" | "google";
    files: { path: string; blob: Blob }[];
  }): Promise<UploadResult>;

  /* review */
  listComments(appId: string): Promise<Comment[]>;
  resolveComment(commentId: string, resolved: boolean): Promise<void>;
  replyToComment(commentId: string, body: string): Promise<void>;

  /* account */
  listMembers(): Promise<Member[]>;
  inviteMember(email: string, role: MemberRole): Promise<{ ok: true } | { ok: false; message: string }>;
  setMemberRole(memberId: string, role: MemberRole): Promise<void>;
  listInvoices(): Promise<Invoice[]>;
  /** A signed URL for the invoice PDF. */
  getInvoiceUrl(invoiceId: string): Promise<string | null>;
  listUsage(): Promise<UsageMetric[]>;
  cancelSubscription(): Promise<void>;
  listBrandKits(): Promise<BrandKit[]>;
  createBrandKit(name: string): Promise<BrandKit>;
  /** The email notifications the person has switched on (true) or off
   *  (false), by id. An id with no entry keeps its default. */
  getNotificationPrefs(): Promise<Record<string, boolean>>;
  /** Switch one email notification on or off. */
  setNotificationPref(id: string, enabled: boolean): Promise<void>;

  /* metering — the free plan's export allowance */
  recordExport(files: number): Promise<Session | null>;

  /* captions */
  suggestCaptions(input: { caption: string; tone: CaptionTone }): Promise<CaptionSuggestion[]>;

  /* growth */
  getAbTest(appId: string): Promise<{ stats: AbStat[]; variants: AbVariant[]; diffs: AbDiff[] }>;
}

let backend: Backend = localBackend;

/**
 * Swap point. Today this is the local backend; point it at a Supabase one and
 * the whole app follows.
 */
export const getBackend = (): Backend => backend;

/** Install a different implementation at boot, or in a test. */
export function setBackend(next: Backend) {
  backend = next;
}
