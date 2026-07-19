export interface ThreadState<T = Record<string, unknown>> {
  threadId: string;
  state: T;
  expiresAt?: Date;
}

export interface ThreadStateStore<T = Record<string, unknown>> {
  get(threadId: string): Promise<ThreadState<T> | null>;
  set(threadId: string, state: T, ttlMs?: number): Promise<void>;
  delete(threadId: string): Promise<void>;
}

export interface TypedThreadState<T = Record<string, unknown>> {
  readonly threadId: string;
  readonly state: Promise<T | null>;
  setState(state: Partial<T>, options?: { replace?: boolean }): Promise<void>;
}

export const THREAD_STATE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function createThreadState<T = Record<string, unknown>>(
  threadId: string,
  store: ThreadStateStore<T>,
  ttlMs: number = THREAD_STATE_TTL_MS
): TypedThreadState<T> {
  return {
    get threadId() { return threadId; },
    get state(): Promise<T | null> {
      return store.get(threadId).then(s => s?.state ?? null);
    },
    async setState(newState: Partial<T>, options?: { replace?: boolean }): Promise<void> {
      if (options?.replace) {
        await store.set(threadId, newState as T, ttlMs);
      } else {
        const existing = await store.get(threadId);
        const merged = { ...existing?.state, ...newState } as T;
        await store.set(threadId, merged, ttlMs);
      }
    },
  };
}

export function createThreadStateStore(kv?: KVNamespace): ThreadStateStore {
  if (kv) {
    return {
      async get<T>(threadId: string): Promise<ThreadState<T> | null> {
        const raw = await kv.get(threadId);
        if (!raw) return null;
        return JSON.parse(raw) as ThreadState<T>;
      },
      async set<T>(threadId: string, state: T, ttlMs?: number): Promise<void> {
        const entry: ThreadState<T> = {
          threadId,
          state,
          expiresAt: ttlMs ? new Date(Date.now() + ttlMs) : undefined,
        };
        const opts = ttlMs ? { expirationTtl: Math.ceil(ttlMs / 1000) } : undefined;
        await kv.put(threadId, JSON.stringify(entry), opts);
      },
      async delete(threadId: string): Promise<void> {
        await kv.delete(threadId);
      },
    };
  }

  const store = new Map<string, { state: Record<string, unknown>; expiresAt: number }>();

  const prune = () => {
    const now = Date.now();
    for (const [key, value] of store) {
      if (value.expiresAt <= now) store.delete(key);
    }
  };
  const timer = setInterval(prune, 60_000);
  if (typeof timer === 'object' && timer?.unref) timer.unref();

  return {
    async get<T>(threadId: string): Promise<ThreadState<T> | null> {
      prune();
      const entry = store.get(threadId);
      if (!entry) return null;
      return { threadId, state: entry.state as T, expiresAt: new Date(entry.expiresAt) };
    },
    async set<T>(threadId: string, state: T, ttlMs?: number): Promise<void> {
      const expiresAt = Date.now() + (ttlMs ?? THREAD_STATE_TTL_MS);
      store.set(threadId, { state: state as Record<string, unknown>, expiresAt });
    },
    async delete(threadId: string): Promise<void> {
      store.delete(threadId);
    },
  };
}

interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}
