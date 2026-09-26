import * as imageStore from "./imageStore";
import { FRAME_IMAGE_FIELDS, toImageRef } from "./imageRefs";
import type { SetDoc, SetFrame } from "./types";

/**
 * The one-time move of screenshots out of localStorage (plan S1.1, D1).
 *
 * Before this, a dropped screenshot was a base64 `data:` URL inside the frame,
 * and every set document lived in one localStorage key — a real set blew the
 * ~5 MB quota. This converts each `data:` screenshot into an image-store Blob
 * and rewrites the frame to `img:<id>`.
 *
 * The rules, because this rewrites the only copy of the user's work:
 *  - Nothing is rewritten until the raw stored value is copied into the
 *    `backups` store and read back intact.
 *  - A screenshot's ref is replaced only after its Blob has been stored and
 *    read back byte-for-byte.
 *  - One failure keeps that whole document exactly as it was (its data URLs
 *    stay), and is logged. Other documents still convert.
 *  - Idempotent: once no `data:` screenshot is left, a run reads one key and
 *    returns.
 */

export const SET_DOCS_KEY = "onstage:set-docs:v1";

type ImageStore = Pick<
  typeof imageStore,
  "putImage" | "getImage" | "deleteImages" | "putBackup" | "getBackup" | "latestBackup"
>;

export type MigrationReport = {
  /** Sets whose screenshots were moved. */
  migrated: string[];
  /** Sets left exactly as they were, and why. */
  failed: { setId: string; reason: string }[];
  /** How many screenshots were stored. */
  images: number;
  /** The backup taken before rewriting, if anything needed rewriting. */
  backupKey: IDBValidKey | null;
  /** Why nothing was attempted, if so. */
  skipped: string | null;
};

type Options = {
  store?: ImageStore;
  storage?: Storage;
  log?: (message: string) => void;
};

const MAX_ATTEMPTS = 3;

const isDataUrl = (v: unknown): v is string => typeof v === "string" && v.startsWith("data:");

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Decode a `data:` URL without the network stack (fetch() on data: URLs is
 *  blocked by some CSPs and absent in some test DOMs). */
export function dataUrlToBlob(url: string): Blob {
  const comma = url.indexOf(",");
  if (!url.startsWith("data:") || comma < 0) throw new Error("not a data: URL");
  const meta = url.slice(5, comma).split(";");
  const type = meta[0] || "text/plain";
  const body = url.slice(comma + 1);
  if (meta.includes("base64")) {
    const bin = atob(body.replace(/\s/g, ""));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type });
  }
  return new Blob([new TextEncoder().encode(decodeURIComponent(body))], { type });
}

async function sameBytes(a: Blob, b: Blob): Promise<boolean> {
  if (a.size !== b.size || a.type !== b.type) return false;
  const [x, y] = await Promise.all([a.arrayBuffer(), b.arrayBuffer()]);
  const u = new Uint8Array(x);
  const v = new Uint8Array(y);
  for (let i = 0; i < u.length; i++) if (u[i] !== v[i]) return false;
  return true;
}

function hasDataScreenshot(doc: unknown): boolean {
  const frames = (doc as Partial<SetDoc> | null)?.frames;
  if (!Array.isArray(frames)) return false;
  return frames.some((f) => FRAME_IMAGE_FIELDS.some((field) => isDataUrl((f as SetFrame | null)?.[field])));
}

/** Store one data URL and prove it can be read back unchanged. A failure
 *  after the put carries the stored id, so the caller can drop the Blob. */
async function storeVerified(store: ImageStore, url: string): Promise<string> {
  const blob = dataUrlToBlob(url);
  const id = await store.putImage(blob);
  try {
    const back = await store.getImage(id);
    if (!back || !(await sameBytes(blob, back))) {
      throw new Error("the stored screenshot didn't read back intact");
    }
  } catch (e) {
    throw Object.assign(e instanceof Error ? e : new Error(String(e)), { id });
  }
  return id;
}

export async function migrateScreenshotsToImages(opts: Options = {}): Promise<MigrationReport> {
  const store = opts.store ?? imageStore;
  const log = opts.log ?? ((m: string) => console.warn(`[onstage] ${m}`));
  const report: MigrationReport = { migrated: [], failed: [], images: 0, backupKey: null, skipped: null };

  let storage: Storage;
  try {
    storage = opts.storage ?? localStorage;
  } catch {
    report.skipped = "localStorage is unavailable";
    return report;
  }

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    // Reset per attempt: a retry starts over from what is stored now.
    report.migrated = [];
    report.failed = [];
    report.images = 0;

    let raw: string | null;
    try {
      raw = storage.getItem(SET_DOCS_KEY);
    } catch {
      report.skipped = "localStorage is unavailable";
      return report;
    }
    // Cheap test first: no data URL anywhere means nothing to do.
    if (!raw || !raw.includes('"data:')) {
      report.skipped = "no data: screenshots";
      return report;
    }

    let docs: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not an object");
      docs = parsed as Record<string, unknown>;
    } catch (e) {
      report.skipped = `the stored sets are unreadable (${message(e)})`;
      log(`screenshot migration skipped: ${report.skipped}; nothing was changed`);
      return report;
    }

    const pending = Object.keys(docs).filter((id) => hasDataScreenshot(docs[id]));
    if (!pending.length) {
      report.skipped = "no data: screenshots";
      return report;
    }

    // 1. Back up the raw value and read it back before touching anything.
    //    If the newest backup already holds exactly this value (a document
    //    that failed last boot and is being retried), it is reused rather
    //    than stored again on every load. Distinct backups are never removed.
    try {
      const latest = await store.latestBackup(SET_DOCS_KEY);
      if (latest && latest.backup.raw === raw) {
        report.backupKey = latest.key;
      } else {
        const key = await store.putBackup(SET_DOCS_KEY, raw);
        const copy = await store.getBackup(key);
        if (copy?.raw !== raw) throw new Error("the backup didn't read back intact");
        report.backupKey = key;
      }
    } catch (e) {
      report.skipped = `couldn't back up the stored sets (${message(e)})`;
      log(`screenshot migration skipped: ${report.skipped}; nothing was changed`);
      return report;
    }

    // 2. Convert each document on its own; a failure keeps that one as it was.
    const created: string[] = [];
    const byUrl = new Map<string, string>(); // the same picture twice is stored once
    const next: Record<string, unknown> = { ...docs };
    for (const setId of pending) {
      const doc = docs[setId] as SetDoc;
      const mine: string[] = [];
      try {
        const frames: SetFrame[] = [];
        for (const frame of doc.frames) {
          let out = frame;
          for (const field of FRAME_IMAGE_FIELDS) {
            const value = frame?.[field];
            if (!isDataUrl(value)) continue;
            let id = byUrl.get(value);
            if (!id) {
              try {
                id = await storeVerified(store, value);
              } catch (e) {
                const orphan = (e as { id?: string }).id;
                if (orphan) mine.push(orphan);
                throw e;
              }
              byUrl.set(value, id);
              mine.push(id);
            }
            out = { ...out, [field]: toImageRef(id) };
          }
          frames.push(out);
        }
        next[setId] = { ...doc, frames };
        created.push(...mine);
        report.migrated.push(setId);
      } catch (e) {
        report.failed.push({ setId, reason: message(e) });
        log(`set "${setId}" kept its embedded screenshots: ${message(e)}`);
        // Blobs stored for a document that wasn't rewritten are referenced by
        // nothing; drop them so a retry on the next boot doesn't pile up
        // copies. Only ids created in this run, and not shared with a
        // document that did convert.
        for (const [url, id] of byUrl) if (mine.includes(id)) byUrl.delete(url);
        await store.deleteImages(mine).catch(() => {});
      }
    }
    report.images = created.length;

    if (!report.migrated.length) return report;

    // 3. Write back, unless someone (another tab) changed the value meanwhile —
    //    then this run's Blobs are unreferenced; drop them and start over.
    let current: string | null;
    try {
      current = storage.getItem(SET_DOCS_KEY);
    } catch {
      current = null;
    }
    if (current !== raw) {
      await store.deleteImages(created).catch(() => {});
      log(`stored sets changed during the screenshot migration; retrying (${attempt}/${MAX_ATTEMPTS})`);
      continue;
    }
    const out = JSON.stringify(next);
    try {
      storage.setItem(SET_DOCS_KEY, out);
      if (storage.getItem(SET_DOCS_KEY) !== out) throw new Error("the rewritten sets didn't read back intact");
    } catch (e) {
      // setItem either stored the whole value or nothing. If it stored
      // nothing, the old value (data URLs) is still there and this run's
      // Blobs are unreferenced. If something else is there now, keep the
      // Blobs — it may reference them — and rely on the backup.
      let after: string | null = null;
      try {
        after = storage.getItem(SET_DOCS_KEY);
      } catch {
        /* leave the Blobs */
      }
      if (after === raw) await store.deleteImages(created).catch(() => {});
      report.failed.push(...report.migrated.map((setId) => ({ setId, reason: message(e) })));
      report.migrated = [];
      report.images = 0;
      log(`screenshot migration couldn't save the converted sets: ${message(e)}`);
      return report;
    }
    return report;
  }

  report.migrated = [];
  report.images = 0;
  report.skipped = "the stored sets kept changing during the migration";
  log(`screenshot migration gave up: ${report.skipped}`);
  return report;
}
