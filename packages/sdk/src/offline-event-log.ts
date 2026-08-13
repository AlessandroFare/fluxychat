/**
 * NW-100 — offline WS event log for reconnect delta replay.
 */
import type { FluxyChatEvent } from "./index.js";

const DB_NAME = "fluxy-chat-events";
const DB_VERSION = 1;
const STORE_NAME = "events";
const MAX_EVENTS_PER_ROOM = 500;

export interface OfflineEventRecord {
  id: string;
  roomId: string;
  event: FluxyChatEvent;
  receivedAt: string;
}

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("roomId", "roomId", { unique: false });
        store.createIndex("receivedAt", "receivedAt", { unique: false });
      }
    };
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export interface OfflineEventLog {
  append(roomId: string, event: FluxyChatEvent): Promise<void>;
  getSince(roomId: string, sinceIso: string): Promise<OfflineEventRecord[]>;
  clearRoom(roomId: string): Promise<void>;
}

/** In-memory fallback for Node/tests. */
export function createMemoryEventLog(): OfflineEventLog {
  const records: OfflineEventRecord[] = [];
  return {
    async append(roomId, event) {
      records.push({
        id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        roomId,
        event,
        receivedAt: new Date().toISOString(),
      });
      const roomRecords = records.filter((r) => r.roomId === roomId);
      if (roomRecords.length > MAX_EVENTS_PER_ROOM) {
        const excess = roomRecords.length - MAX_EVENTS_PER_ROOM;
        for (let i = 0; i < excess; i++) {
          const idx = records.findIndex((r) => r.roomId === roomId);
          if (idx >= 0) records.splice(idx, 1);
        }
      }
    },
    async getSince(roomId, sinceIso) {
      return records
        .filter((r) => r.roomId === roomId && r.receivedAt > sinceIso)
        .sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));
    },
    async clearRoom(roomId) {
      for (let i = records.length - 1; i >= 0; i--) {
        if (records[i].roomId === roomId) records.splice(i, 1);
      }
    },
  };
}

export async function createOfflineEventLog(): Promise<OfflineEventLog> {
  let db: IDBDatabase | null = null;
  try {
    db = await openDb();
  } catch {
    db = null;
  }
  if (!db) return createMemoryEventLog();

  return {
    async append(roomId, event) {
      const record: OfflineEventRecord = {
        id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        roomId,
        event,
        receivedAt: new Date().toISOString(),
      };
      const tx = db!.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(record);
      await txDone(tx);
    },
    async getSince(roomId, sinceIso) {
      const tx = db!.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const index = store.index("roomId");
      const all = await new Promise<OfflineEventRecord[]>((resolve, reject) => {
        const req = index.getAll(roomId);
        req.onsuccess = () => resolve((req.result as OfflineEventRecord[]) ?? []);
        req.onerror = () => reject(req.error);
      });
      await txDone(tx);
      return all
        .filter((r) => r.receivedAt > sinceIso)
        .sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));
    },
    async clearRoom(roomId) {
      const tx = db!.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const index = store.index("roomId");
      const all = await new Promise<OfflineEventRecord[]>((resolve, reject) => {
        const req = index.getAll(roomId);
        req.onsuccess = () => resolve((req.result as OfflineEventRecord[]) ?? []);
        req.onerror = () => reject(req.error);
      });
      for (const r of all) store.delete(r.id);
      await txDone(tx);
    },
  };
}
