/**
 * 보관함: 이 기기 안(IndexedDB)에만 저장. 서버/계정 없음.
 * 완성된 시트 JPEG 를 최근 순으로 최대 MAX_ITEMS 개 보관.
 */
import type { SheetOptions } from "./types";

const DB_NAME = "mini-polaroid";
const STORE = "sheets";
const MAX_ITEMS = 20;

export interface SavedSheet {
  id: string;
  createdAt: number;
  preset: string;
  orientation: SheetOptions["orientation"];
  dpi: number;
  photoCount: number;
  blob: Blob;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" }).createIndex("createdAt", "createdAt");
      }
    };
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T> {
  return openDb().then((db) => new Promise<T>((res, rej) => {
    const t = db.transaction(STORE, mode);
    const r = fn(t.objectStore(STORE));
    t.oncomplete = () => { db.close(); res((r as IDBRequest<T> | undefined)?.result as T); };
    t.onerror = () => { db.close(); rej(t.error); };
    t.onabort = () => { db.close(); rej(t.error); };
  }));
}

export async function saveSheet(blob: Blob, opt: SheetOptions, photoCount: number): Promise<SavedSheet> {
  const item: SavedSheet = {
    id: crypto.randomUUID(), createdAt: Date.now(),
    preset: opt.presetId, orientation: opt.orientation, dpi: opt.dpi, photoCount, blob,
  };
  await tx("readwrite", (s) => { s.put(item); });
  await trim();
  return item;
}

export async function listSheets(): Promise<SavedSheet[]> {
  const all = await tx<SavedSheet[]>("readonly", (s) => s.getAll());
  return (all ?? []).sort((a, b) => b.createdAt - a.createdAt);
}

export async function deleteSheet(id: string) {
  await tx("readwrite", (s) => { s.delete(id); });
}

export async function clearSheets() {
  await tx("readwrite", (s) => { s.clear(); });
}

async function trim() {
  const all = await listSheets();
  for (const old of all.slice(MAX_ITEMS)) await deleteSheet(old.id);
}

/** 저장 가능 용량이 넉넉한지 (iOS Safari 는 사이트당 수백 MB 수준) */
export async function storageInfo() {
  if (!navigator.storage?.estimate) return null;
  const { usage = 0, quota = 0 } = await navigator.storage.estimate();
  return { usageMB: usage / 1048576, quotaMB: quota / 1048576 };
}
