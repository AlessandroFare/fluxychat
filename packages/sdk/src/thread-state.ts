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

export function createThreadState(threadId: string, ttlMs?: number): ThreadState {
  throw new Error("createThreadState not implemented in SDK - use worker runtime");
}
export function createThreadStateStore(kv: KVNamespace): ThreadStateStore {
  throw new Error("createThreadStateStore not implemented in SDK - use worker runtime");
}

interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}
