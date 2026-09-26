/**
 * Screenshot bytes, kept in this browser's IndexedDB (plan D1). localStorage
 * holds only the small JSON documents; a frame points here with `img:<id>`.
 *
 * Database `onstage` (the github.io origin is shared with other Pages sites,
 * so the name is namespaced like the `onstage:*:v1` localStorage keys):
 *  - `images`  — one Blob per screenshot, keyed by a random id. Ids are never
 *                content hashes, so two frames can hold the same picture
 *                independently and deleting one never touches the other.
 *  - `backups` — raw copies of stored documents taken before a migration
 *                rewrites them. Nothing ever deletes these.
 *
 * SUPABASE SEAM: a Storage bucket replaces this module — `putImage` uploads
 * and returns the object key, `getImage` downloads it, `deleteImages` removes
 * objects. The backup store has no server equivalent; it exists because the
 * local migration rewrites the only copy of the user's work.
 */

import { randomId } from "./ids";

const DB_NAME = "onstage";
const DB_VERSION = 1;
const IMAGES = "images";
const BACKUPS = "backups";

type StoreName = typeof IMAGES | typeof BACKUPS;

/** A raw copy of a stored value, taken before anything rewrote it. */
export type Backup = {
  /** Where the value came from, e.g. the localStorage key. */
  source: string;
  /** Epoch milliseconds. */
  savedAt: number;
  raw: string;
};

let dbPromise: Promise<IDBDatabase> | null = null;

/** Turn a DOMException from IndexedDB into something a person can read. */
function storageError(error: DOMException | null | undefined, doing: string): Error {
  if (error?.name === "QuotaExceededError") {
    return new Error(`This browser is out of storage space, so Onstage couldn't ${doing}.`);
  }
  const why = error?.message ? ` (${error.message})` : "";
  return new Error(`This browser refused to let Onstage ${doing}${why}.`);
}

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  const opening = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("This browser doesn't let Onstage store images (IndexedDB is unavailable)."));
      return;
    }
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (e) {
      reject(storageError(e instanceof DOMException ? e : null, "open its image storage"));
      return;
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IMAGES)) db.createObjectStore(IMAGES);
      if (!db.objectStoreNames.contains(BACKUPS)) {
        db.createObjectStore(BACKUPS, { autoIncrement: true });
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      // A newer version opened in another tab: step aside so its upgrade can
      // run, and reconnect on the next call.
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      db.onclose = () => {
        dbPromise = null;
      };
      resolve(db);
    };
    req.onerror = () => reject(storageError(req.error, "open its image storage"));
    req.onblocked = () =>
      reject(new Error("Another Onstage tab is holding the image storage open. Close it and try again."));
  });
  // A failed open is not cached, so the next call tries again.
  dbPromise = opening.catch((e) => {
    dbPromise = null;
    throw e;
  });
  return dbPromise;
}

/**
 * One request in its own transaction. Resolves when the transaction commits,
 * not when the request succeeds — a write isn't reported done until it is.
 * Writes ask for strict durability (flushed to disk before `complete`): the
 * migration rewrites the only other copy right after these resolve.
 */
async function run<T>(
  store: StoreName,
  mode: IDBTransactionMode,
  doing: string,
  op: (s: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | undefined> {
  const db = await openDb();
  return new Promise<T | undefined>((resolve, reject) => {
    let tx: IDBTransaction;
    try {
      tx = db.transaction(store, mode, mode === "readwrite" ? { durability: "strict" } : undefined);
    } catch (e) {
      reject(storageError(e instanceof DOMException ? e : null, doing));
      return;
    }
    let req: IDBRequest<T> | void;
    try {
      req = op(tx.objectStore(store));
    } catch (e) {
      tx.abort();
      reject(storageError(e instanceof DOMException ? e : null, doing));
      return;
    }
    tx.oncomplete = () => resolve(req ? req.result : undefined);
    tx.onabort = () => reject(storageError(tx.error ?? (req ? req.error : null), doing));
  });
}

/** Store a screenshot under a fresh random id and return the id. */
export async function putImage(blob: Blob): Promise<string> {
  const id = randomId();
  // `add`, not `put`: an id collision fails loudly instead of overwriting.
  await run(IMAGES, "readwrite", "store the screenshot", (s) => s.add(blob, id));
  return id;
}

/** The screenshot stored under `id`, or null if there is none. */
export async function getImage(id: string): Promise<Blob | null> {
  const value = await run<unknown>(IMAGES, "readonly", "read a screenshot", (s) => s.get(id));
  return value instanceof Blob ? value : null;
}

/** Remove screenshots. Callers must have checked that nothing references them. */
export async function deleteImages(ids: string[]): Promise<void> {
  if (!ids.length) return;
  await run(IMAGES, "readwrite", "delete screenshots", (s) => {
    for (const id of ids) s.delete(id);
  });
}

/** Keep a raw copy of a stored value; returns the backup's key. */
export async function putBackup(source: string, raw: string): Promise<IDBValidKey> {
  const record: Backup = { source, savedAt: Date.now(), raw };
  const key = await run<IDBValidKey>(BACKUPS, "readwrite", "back up your sets", (s) => s.add(record));
  if (key === undefined) throw new Error("This browser didn't confirm the backup of your sets.");
  return key;
}

export async function getBackup(key: IDBValidKey): Promise<Backup | null> {
  const value = await run<Backup | undefined>(BACKUPS, "readonly", "read a backup", (s) => s.get(key));
  return value ?? null;
}

/** The newest backup taken from `source`, and its key — reading only the
 *  records it has to (each can be several MB). */
export async function latestBackup(source: string): Promise<{ key: IDBValidKey; backup: Backup } | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    let tx: IDBTransaction;
    try {
      tx = db.transaction(BACKUPS, "readonly");
    } catch (e) {
      reject(storageError(e instanceof DOMException ? e : null, "read backups"));
      return;
    }
    let found: { key: IDBValidKey; backup: Backup } | null = null;
    const req = tx.objectStore(BACKUPS).openCursor(null, "prev");
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) return;
      const value = cursor.value as Backup;
      if (value?.source === source) found = { key: cursor.primaryKey, backup: value };
      else cursor.continue();
    };
    tx.oncomplete = () => resolve(found);
    tx.onabort = () => reject(storageError(tx.error ?? req.error, "read backups"));
  });
}

/** Every backup, oldest first. */
export async function listBackups(): Promise<Backup[]> {
  return (await run<Backup[]>(BACKUPS, "readonly", "read backups", (s) => s.getAll())) ?? [];
}

/** Drop the open connection, e.g. before deleting the database or between tests. */
export async function closeImageStore(): Promise<void> {
  const pending = dbPromise;
  dbPromise = null;
  if (!pending) return;
  try {
    (await pending).close();
  } catch {
    /* it never opened — nothing to close */
  }
}
