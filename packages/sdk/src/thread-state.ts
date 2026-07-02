/**
 * P22-F8: Thread state management (per-thread KV with TTL).
 * Provides typed interface for thread-local state.
 */

export interface ThreadState {
  threadId: string;
  state: Record<string, unknown>;
  expiresAt?: Date;
}

export interface ThreadStateStore {
  get(threadId: string): Promise<ThreadState | null>;
  set(threadId: string, state: Record<string, unknown>, ttlMs?: number): Promise<void>;
  delete(threadId: string): Promise<void>;
}

export declare function createThreadState(threadId: string, ttlMs?: number): ThreadState;
export declare function createThreadStateStore(kv: KVNamespace): ThreadStateStore;

interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}
