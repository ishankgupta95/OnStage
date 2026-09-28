// Browser-backed data layer for the static portfolio (demo) build.
//
// The demo has no server, so this replaces every Supabase server action with
// IndexedDB-backed equivalents that keep the SAME names/signatures the editor
// components already import (Editor, Filmstrip, ExportController, ExportDialog,
// ScreenshotGrid, Canvas, NewProjectForm). Projects + screenshots live entirely
// in the visitor's browser; uploaded images are data URLs stored inside the doc
// (IndexedDB has ample quota, unlike localStorage). Nothing is shared or sent
// anywhere — each visitor gets their own sandbox.

import { DEFAULT_DOC, type BackgroundChoice, type EditorDoc } from "@/lib/editorDoc";
import { buildTemplateDocs, templateById, type Platform } from "@/lib/templates";
import { MAX_SET_SCREENSHOTS } from "@/lib/sizes";

// ── Records ──────────────────────────────────────────────────────────────────
export type ProjectRecord = { id: string; name: string; updatedAt: number; order: string[] };
export type ScreenshotRecord = {
  id: string;
  projectId: string;
  position: number;
  thumbnailUrl: string | null;
  doc: EditorDoc;
};
export type ProjectWithShots = { id: string; name: string; updatedAt: number; shots: ScreenshotRecord[] };
export type ProjectSummary = { id: string; name: string; updatedAt: number; count: number; cover: string | null };

// ── IndexedDB plumbing ───────────────────────────────────────────────────────
const DB_NAME = "onstage-demo";
const DB_VERSION = 1;
const PROJECTS = "projects";
const SHOTS = "screenshots";

function uuid(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `id_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
  );
}

let dbPromise: Promise<IDBDatabase> | null = null;
// The open connection, once available — for writeScreenshotDocNow, which must
// issue its write synchronously.
let openedDb: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB unavailable (not in a browser)"));
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(PROJECTS)) db.createObjectStore(PROJECTS, { keyPath: "id" });
        if (!db.objectStoreNames.contains(SHOTS)) db.createObjectStore(SHOTS, { keyPath: "id" });
      };
      req.onsuccess = () => {
        openedDb = req.result;
        resolve(req.result);
        requestPersistence();
      };
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

// Projects live only in this browser, so ask it to keep this site's storage
// instead of evicting it when space runs low. Chrome and Safari decide silently;
// Firefox would show a permission prompt, so it's skipped there.
function requestPersistence() {
  const storage = typeof navigator !== "undefined" ? navigator.storage : undefined;
  if (!storage?.persist || /firefox/i.test(navigator.userAgent)) return;
  storage
    .persisted()
    .then((already) => (already ? undefined : storage.persist()))
    .catch(() => {});
}

// One request per transaction — for a single-user demo we don't need cross-store
// atomicity, and this sidesteps IndexedDB's auto-commit-on-microtask pitfalls.
async function idbGet<T>(store: string, key: string): Promise<T | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const r = db.transaction(store, "readonly").objectStore(store).get(key);
    r.onsuccess = () => resolve(r.result as T | undefined);
    r.onerror = () => reject(r.error);
  });
}

async function idbGetAll<T>(store: string): Promise<T[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const r = db.transaction(store, "readonly").objectStore(store).getAll();
    r.onsuccess = () => resolve((r.result ?? []) as T[]);
    r.onerror = () => reject(r.error);
  });
}

async function idbPut<T>(store: string, value: T): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).put(value);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function idbDelete(store: string, key: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

// ── Internal helpers ─────────────────────────────────────────────────────────
const getProjectRecord = (id: string) => idbGet<ProjectRecord>(PROJECTS, id);
// Last-known screenshot records (every read and write goes through getShot /
// putShot), so writeScreenshotDocNow can save a doc without reading first.
const shotCache = new Map<string, ScreenshotRecord>();
const getShot = async (id: string) => {
  const s = await idbGet<ScreenshotRecord>(SHOTS, id);
  if (s) shotCache.set(id, s);
  return s;
};
async function putShot(s: ScreenshotRecord): Promise<void> {
  await idbPut<ScreenshotRecord>(SHOTS, s);
  shotCache.set(s.id, s);
}
async function deleteShot(id: string): Promise<void> {
  await idbDelete(SHOTS, id);
  shotCache.delete(id);
}
const cloneDoc = (doc: EditorDoc): EditorDoc =>
  typeof structuredClone === "function" ? structuredClone(doc) : (JSON.parse(JSON.stringify(doc)) as EditorDoc);

async function putProject(p: ProjectRecord): Promise<void> {
  await idbPut(PROJECTS, { ...p, updatedAt: Date.now() });
}

// ── Project queries (pages) ──────────────────────────────────────────────────
export async function listProjects(): Promise<ProjectSummary[]> {
  const projects = (await idbGetAll<ProjectRecord>(PROJECTS)).sort((a, b) => b.updatedAt - a.updatedAt);
  const out: ProjectSummary[] = [];
  for (const p of projects) {
    let cover: string | null = null;
    for (const sid of p.order) {
      const s = await getShot(sid);
      if (s?.thumbnailUrl) {
        cover = s.thumbnailUrl;
        break;
      }
    }
    out.push({ id: p.id, name: p.name, updatedAt: p.updatedAt, count: p.order.length, cover });
  }
  return out;
}

export async function getProject(id: string): Promise<ProjectWithShots | null> {
  const p = await getProjectRecord(id);
  if (!p) return null;
  const shots: ScreenshotRecord[] = [];
  // position is authoritative from order index, so it always matches the board.
  for (let i = 0; i < p.order.length; i++) {
    const s = await getShot(p.order[i]);
    if (s) shots.push({ ...s, position: i });
  }
  return { id: p.id, name: p.name, updatedAt: p.updatedAt, shots };
}

// ── Project mutations ────────────────────────────────────────────────────────
export type CreateProjectInput = {
  name: string;
  templateId: string;
  platform: Platform;
  background: BackgroundChoice;
};

export async function createProject(
  input: CreateProjectInput,
): Promise<{ projectId: string; firstScreenshotId: string }> {
  const template = templateById(input.templateId);
  const docs = buildTemplateDocs(template, input.platform, input.background);
  const projectId = uuid();
  const order: string[] = [];
  const seedDocs = docs.length ? docs : [cloneDoc(DEFAULT_DOC)];
  for (let i = 0; i < seedDocs.length; i++) {
    const id = uuid();
    order.push(id);
    await putShot({ id, projectId, position: i, thumbnailUrl: null, doc: seedDocs[i] });
  }
  await idbPut<ProjectRecord>(PROJECTS, {
    id: projectId,
    name: input.name.trim() || "Untitled app",
    updatedAt: Date.now(),
    order,
  });
  return { projectId, firstScreenshotId: order[0] };
}

export async function deleteProject(id: string): Promise<void> {
  const p = await getProjectRecord(id);
  if (p) for (const sid of p.order) await deleteShot(sid);
  await idbDelete(PROJECTS, id);
}

export async function renameProject(id: string, name: string): Promise<void> {
  const p = await getProjectRecord(id);
  if (p && name.trim()) await putProject({ ...p, name: name.trim() });
}

// ── Screenshot mutations (match the server-action signatures) ────────────────
export async function saveScreenshotConfig(
  id: string,
  doc: EditorDoc,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const s = await getShot(id);
    if (!s) return { ok: false, error: "Screenshot not found" };
    await putShot({ ...s, doc });
    const p = await getProjectRecord(s.projectId);
    if (p) await putProject(p); // bump updatedAt
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Save failed" };
  }
}

// Save a doc with ONE synchronously-issued write, for when the page is being
// hidden or closed: an async save's first read can finish after the page is
// gone, so its write would never start. Returns false (caller falls back to
// saveScreenshotConfig) if the record or connection isn't at hand.
export function writeScreenshotDocNow(id: string, doc: EditorDoc): boolean {
  const s = shotCache.get(id);
  if (!openedDb || !s) return false;
  try {
    const rec: ScreenshotRecord = { ...s, doc };
    const tx = openedDb.transaction(SHOTS, "readwrite");
    tx.objectStore(SHOTS).put(rec);
    tx.oncomplete = () => shotCache.set(id, rec);
    tx.commit?.();
    return true;
  } catch {
    return false;
  }
}

export async function addScreenshot(
  projectId: string,
): Promise<{ id: string; position: number; doc: EditorDoc } | null> {
  try {
    const p = await getProjectRecord(projectId);
    if (!p || p.order.length >= MAX_SET_SCREENSHOTS) return null;
    const id = uuid();
    const position = p.order.length;
    const doc = cloneDoc(DEFAULT_DOC);
    await putShot({ id, projectId, position, thumbnailUrl: null, doc });
    await putProject({ ...p, order: [...p.order, id] });
    return { id, position, doc };
  } catch {
    return null;
  }
}

export async function duplicateScreenshotInline(
  id: string,
  projectId: string,
): Promise<{ id: string; position: number; doc: EditorDoc } | null> {
  try {
    const p = await getProjectRecord(projectId);
    const src = await getShot(id);
    if (!p || !src || p.order.length >= MAX_SET_SCREENSHOTS) return null;
    const newId = uuid();
    const position = p.order.length;
    const doc = cloneDoc(src.doc);
    await putShot({
      id: newId,
      projectId,
      position,
      thumbnailUrl: src.thumbnailUrl,
      doc,
    });
    await putProject({ ...p, order: [...p.order, newId] });
    return { id: newId, position, doc };
  } catch {
    return null;
  }
}

export async function deleteScreenshotInline(id: string, projectId: string): Promise<{ ok: boolean }> {
  try {
    const p = await getProjectRecord(projectId);
    if (p) await putProject({ ...p, order: p.order.filter((x) => x !== id) });
    await deleteShot(id);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export async function reorderScreenshots(projectId: string, ids: string[]): Promise<void> {
  const p = await getProjectRecord(projectId);
  if (p) await putProject({ ...p, order: ids });
}

// Board (ScreenshotGrid) variants — same as the inline ones, named to match the
// old form-action imports so the swap is a one-line import change there too.
export const duplicateScreenshot = duplicateScreenshotInline;
export const deleteScreenshot = deleteScreenshotInline;
export const createScreenshot = addScreenshot;

export async function getProjectScreenshotConfigs(
  projectId: string,
): Promise<{ id: string; position: number; doc: EditorDoc }[]> {
  const proj = await getProject(projectId);
  return (proj?.shots ?? []).map((s) => ({ id: s.id, position: s.position, doc: s.doc }));
}

export async function saveThumbnail(
  id: string,
  dataUrl: string,
  _projectId?: string,
): Promise<{ ok: boolean }> {
  try {
    const s = await getShot(id);
    if (!s) return { ok: false };
    await putShot({ ...s, thumbnailUrl: dataUrl });
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

// ── Export tracking (no paywall on the demo) ─────────────────────────────────
// Kept as a no-op so ExportController's best-effort call stays a one-line swap.
export async function recordExport(_projectId: string, _count: number): Promise<{ ok: boolean }> {
  return { ok: true };
}

// ── First-run demo content ───────────────────────────────────────────────────
const SEED_KEY = "onstage:demo:seeded";

export async function seedDemoIfEmpty(): Promise<void> {
  try {
    if (typeof localStorage !== "undefined" && localStorage.getItem(SEED_KEY)) return;
    const existing = await idbGetAll<ProjectRecord>(PROJECTS);
    if (existing.length === 0) {
      await createProject({
        name: "Demo — Fitness app",
        templateId: "feature-showcase",
        platform: "ios",
        background: { kind: "gradient", id: "ocean" },
      });
      await createProject({
        name: "Demo — Finance app",
        templateId: "bold",
        platform: "ios",
        background: { kind: "gradient", id: "violet" },
      });
    }
    if (typeof localStorage !== "undefined") localStorage.setItem(SEED_KEY, "1");
  } catch {
    // best-effort — an empty dashboard is still usable
  }
}

// ── Project files (download / import) ────────────────────────────────────────
// A project as one JSON file, images included (they're data URLs in the docs),
// so a project can be backed up or moved to another browser. Importing always
// creates a new project; it never overwrites one.
export const PROJECT_FILE_FORMAT = "onstage-project";
export type ProjectFile = {
  format: typeof PROJECT_FILE_FORMAT;
  version: 1;
  name: string;
  screenshots: { doc: EditorDoc; thumbnailUrl: string | null }[];
};

export async function exportProjectFile(id: string): Promise<ProjectFile | null> {
  const proj = await getProject(id);
  if (!proj) return null;
  return {
    format: PROJECT_FILE_FORMAT,
    version: 1,
    name: proj.name,
    screenshots: proj.shots.map((s) => ({ doc: s.doc, thumbnailUrl: s.thumbnailUrl })),
  };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

// Check a parsed file is an Onstage project whose docs the editor can open.
// Throws an Error with a message fit to show the user.
export function parseProjectFile(data: unknown): ProjectFile {
  if (!isObj(data) || data.format !== PROJECT_FILE_FORMAT) throw new Error("This isn't an Onstage project file.");
  if (data.version !== 1) throw new Error("This project file comes from a newer version of Onstage.");
  if (!Array.isArray(data.screenshots) || data.screenshots.length === 0) {
    throw new Error("This project file has no screenshots.");
  }
  const screenshots = data.screenshots.map((s, i) => {
    const doc = isObj(s) ? s.doc : undefined;
    const ok =
      isObj(doc) &&
      typeof doc.device === "string" &&
      typeof doc.layout === "string" &&
      isObj(doc.background) &&
      typeof doc.background.kind === "string" &&
      Array.isArray(doc.frameImages) &&
      Array.isArray(doc.textLayers);
    if (!ok) throw new Error(`Screenshot ${i + 1} in this project file is damaged.`);
    const thumb = isObj(s) && typeof s.thumbnailUrl === "string" ? s.thumbnailUrl : null;
    return { doc: doc as unknown as EditorDoc, thumbnailUrl: thumb };
  });
  const name = typeof data.name === "string" && data.name.trim() ? data.name.trim() : "Imported app";
  return { format: PROJECT_FILE_FORMAT, version: 1, name, screenshots };
}

export async function importProjectFile(file: ProjectFile): Promise<{ projectId: string }> {
  const projectId = uuid();
  const order: string[] = [];
  for (let i = 0; i < file.screenshots.length; i++) {
    const id = uuid();
    order.push(id);
    const { doc, thumbnailUrl } = file.screenshots[i];
    await putShot({ id, projectId, position: i, thumbnailUrl, doc: cloneDoc(doc) });
  }
  await idbPut<ProjectRecord>(PROJECTS, { id: projectId, name: file.name, updatedAt: Date.now(), order });
  return { projectId };
}
