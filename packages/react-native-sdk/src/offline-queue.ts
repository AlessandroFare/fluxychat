/**
 * NW-114 — Persistent offline outbox for React Native (AsyncStorage-compatible).
 * Mirrors @fluxy-chat/sdk NW-100 OutboxStore protocol.
 */

export interface RnOutboxEntry {
  id: string;
  roomId: string;
  type: string;
  payload: Record<string, unknown>;
  createdAt: string;
  retryCount: number;
  maxRetries: number;
  lastError?: string;
}

export interface RnKeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem?(key: string): Promise<void>;
}

export interface RnOutboxStore {
  push(entry: RnOutboxEntry): Promise<void>;
  peek(limit?: number): Promise<RnOutboxEntry[]>;
  remove(id: string): Promise<void>;
  markFailed(id: string, error: string): Promise<void>;
  pendingCount(): Promise<number>;
  clear(): Promise<void>;
}

const DEFAULT_STORAGE_KEY = "fluxy-chat:rn-outbox:v1";

export function createMemoryRnOutboxStore(): RnOutboxStore {
  const entries: RnOutboxEntry[] = [];
  return {
    async push(entry) {
      entries.push(entry);
    },
    async peek(limit = 10) {
      return entries.filter((e) => e.retryCount < e.maxRetries).slice(0, limit);
    },
    async remove(id) {
      const idx = entries.findIndex((e) => e.id === id);
      if (idx >= 0) entries.splice(idx, 1);
    },
    async markFailed(id, error) {
      const e = entries.find((row) => row.id === id);
      if (e) {
        e.retryCount += 1;
        e.lastError = error;
      }
    },
    async pendingCount() {
      return entries.filter((e) => e.retryCount < e.maxRetries).length;
    },
    async clear() {
      entries.length = 0;
    },
  };
}

/**
 * Persist outbox entries via AsyncStorage (or any getItem/setItem KV).
 */
export function createAsyncStorageOutboxStore(
  storage: RnKeyValueStorage,
  storageKey = DEFAULT_STORAGE_KEY,
): RnOutboxStore {
  async function readAll(): Promise<RnOutboxEntry[]> {
    const raw = await storage.getItem(storageKey);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as RnOutboxEntry[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  async function writeAll(entries: RnOutboxEntry[]): Promise<void> {
    await storage.setItem(storageKey, JSON.stringify(entries));
  }

  return {
    async push(entry) {
      const all = await readAll();
      all.push(entry);
      await writeAll(all);
    },
    async peek(limit = 10) {
      const all = await readAll();
      return all.filter((e) => e.retryCount < e.maxRetries).slice(0, limit);
    },
    async remove(id) {
      const all = await readAll();
      await writeAll(all.filter((e) => e.id !== id));
    },
    async markFailed(id, error) {
      const all = await readAll();
      const e = all.find((row) => row.id === id);
      if (e) {
        e.retryCount += 1;
        e.lastError = error;
        await writeAll(all);
      }
    },
    async pendingCount() {
      const all = await readAll();
      return all.filter((e) => e.retryCount < e.maxRetries).length;
    },
    async clear() {
      if (storage.removeItem) await storage.removeItem(storageKey);
      else await storage.setItem(storageKey, "[]");
    },
  };
}

export interface RnOutboxProcessorOptions {
  store: RnOutboxStore;
  sender: (entry: RnOutboxEntry) => Promise<boolean>;
  batchSize?: number;
  retryDelayMs?: number;
  maxRetries?: number;
}

export function createRnOutboxProcessor(options: RnOutboxProcessorOptions) {
  const {
    store,
    sender,
    batchSize = 10,
    retryDelayMs = 2000,
    maxRetries = 5,
  } = options;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let active = false;
  let processing = false;

  async function flush() {
    if (processing) return;
    processing = true;
    try {
      const batch = await store.peek(batchSize);
      for (const entry of batch) {
        try {
          const ok = await sender(entry);
          if (ok) await store.remove(entry.id);
          else await store.markFailed(entry.id, "Send returned false");
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (entry.retryCount >= maxRetries) await store.remove(entry.id);
          else await store.markFailed(entry.id, msg);
        }
      }
    } finally {
      processing = false;
    }
    if (active) {
      const count = await store.pendingCount();
      if (count > 0) timer = setTimeout(() => void flush(), retryDelayMs);
    }
  }

  return {
    start() {
      if (active) return;
      active = true;
      void flush();
    },
    stop() {
      active = false;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    },
    async flushNow() {
      await flush();
    },
  };
}

export type RnSyncStatus = "synced" | "syncing" | "offline" | "pending";

export interface RnOfflineQueue {
  enqueue(input: {
    roomId: string;
    payload: Record<string, unknown>;
    type?: string;
    id?: string;
  }): Promise<void>;
  flush(): Promise<void>;
  start(): void;
  stop(): void;
  pendingCount(): Promise<number>;
  getStatus(): RnSyncStatus;
  setConnected(connected: boolean): void;
  onStatusChange(cb: (status: RnSyncStatus, pending: number) => void): () => void;
}

function createEntryId(): string {
  return `rn_outbox_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * High-level RN offline queue — wire AsyncStorage + reconnect flush.
 */
export function createRnOfflineQueue(options: {
  store?: RnOutboxStore;
  send: (entry: RnOutboxEntry) => Promise<boolean>;
  maxRetries?: number;
  retryDelayMs?: number;
}): RnOfflineQueue {
  const store = options.store ?? createMemoryRnOutboxStore();
  const maxRetries = options.maxRetries ?? 5;
  const listeners = new Set<(status: RnSyncStatus, pending: number) => void>();
  let connected = true;
  let status: RnSyncStatus = "synced";
  let pending = 0;

  function emit() {
    for (const cb of listeners) cb(status, pending);
  }

  async function refresh() {
    pending = await store.pendingCount();
    if (!connected) status = pending > 0 ? "pending" : "offline";
    else if (pending > 0) status = "syncing";
    else status = "synced";
    emit();
  }

  const processor = createRnOutboxProcessor({
    store,
    sender: async (entry) => {
      const ok = await options.send(entry);
      await refresh();
      return ok;
    },
    maxRetries,
    retryDelayMs: options.retryDelayMs,
  });

  return {
    async enqueue(input) {
      await store.push({
        id: input.id ?? createEntryId(),
        roomId: input.roomId,
        type: input.type ?? "message",
        payload: input.payload,
        createdAt: new Date().toISOString(),
        retryCount: 0,
        maxRetries,
      });
      await refresh();
      if (connected) await processor.flushNow();
    },
    flush: () => processor.flushNow().then(() => refresh()),
    start: () => processor.start(),
    stop: () => processor.stop(),
    pendingCount: () => store.pendingCount(),
    getStatus: () => status,
    setConnected(isConnected) {
      connected = isConnected;
      if (isConnected) {
        processor.start();
        void processor.flushNow().then(() => refresh());
      } else {
        void refresh();
      }
    },
    onStatusChange(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
  };
}
