/**
 * NW-100 — IndexedDB-backed outbox with in-memory fallback for tests/SSR.
 */
import type { OutboxEntry, OutboxStore } from "../outbox-lanes.js";

const DB_NAME = "fluxy-chat-outbox";
const DB_VERSION = 1;
const STORE_NAME = "entries";

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
        store.createIndex("createdAt", "createdAt", { unique: false });
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

/**
 * Persistent outbox — survives page reload. Falls back to memory when IDB unavailable.
 */
export async function createIndexedDbOutboxStore(): Promise<OutboxStore> {
  let db: IDBDatabase | null = null;
  try {
    db = await openDb();
  } catch {
    db = null;
  }

  if (!db) {
    const { createMemoryOutboxStore } = await import("../outbox-lanes.js");
    return createMemoryOutboxStore();
  }

  async function peekEntries(limit = 10): Promise<OutboxEntry[]> {
    const tx = db!.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const all = await new Promise<OutboxEntry[]>((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result as OutboxEntry[]) ?? []);
      req.onerror = () => reject(req.error);
    });
    await txDone(tx);
    return all
      .filter((e) => e.retryCount < e.maxRetries)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .slice(0, limit);
  }

  return {
    async push(entry) {
      const tx = db!.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(entry);
      await txDone(tx);
    },
    async peek(limit = 10) {
      return peekEntries(limit);
    },
    async remove(id) {
      const tx = db!.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(id);
      await txDone(tx);
    },
    async markFailed(id, error) {
      const tx = db!.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const entry = await new Promise<OutboxEntry | undefined>((resolve, reject) => {
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result as OutboxEntry | undefined);
        req.onerror = () => reject(req.error);
      });
      if (entry) {
        entry.retryCount += 1;
        entry.lastError = error;
        store.put(entry);
      }
      await txDone(tx);
    },
    async pendingCount() {
      const batch = await peekEntries(1000);
      return batch.length;
    },
    async clear() {
      const tx = db!.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).clear();
      await txDone(tx);
    },
  };
}
