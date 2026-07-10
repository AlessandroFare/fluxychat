/**
 * P23-1: Stream Resumption
 * Reconnect to active AI streams after page refresh or disconnect.
 */

export interface StreamResumptionEntry {
  /** Unique stream identifier */
  streamId: string;
  /** Room ID where the stream is active */
  roomId: string;
  /** User ID of the stream owner */
  userId: string;
  /** Agent ID if this is an agent stream */
  agentId?: string;
  /** Run ID for the agent run */
  runId?: string;
  /** Current accumulated content */
  content: string;
  /** Whether the stream is still active */
  active: boolean;
  /** ISO timestamp when the stream started */
  startedAt: string;
  /** ISO timestamp of last activity */
  lastActivityAt: string;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

export interface StreamResumptionStore {
  /** Save a stream entry for later resumption */
  save(entry: StreamResumptionEntry): Promise<void>;
  /** Get a stream entry by ID */
  get(streamId: string): Promise<StreamResumptionEntry | null>;
  /** Mark a stream as inactive (completed/failed) */
  deactivate(streamId: string): Promise<void>;
  /** Get all active streams for a room */
  getActiveForRoom(roomId: string): Promise<StreamResumptionEntry[]>;
  /** Get all active streams for a user */
  getActiveForUser(userId: string): Promise<StreamResumptionEntry[]>;
  /** Clean up expired entries */
  cleanup(maxAgeMs?: number): Promise<number>;
}

export function createStreamResumptionStore(kv: KVNamespace): StreamResumptionStore {
  throw new Error("createStreamResumptionStore not implemented in SDK - use worker runtime");
}

interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: { prefix?: string }): Promise<{ keys: Array<{ name: string }> }>;
}
