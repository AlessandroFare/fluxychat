/**
 * P22-D3: Concurrency Strategy Types
 */

export type ConcurrencyStrategy = 'drop' | 'queue' | 'debounce' | 'burst' | 'concurrent';

export interface ConcurrencyConfig {
  /** The concurrency strategy to use */
  strategy: ConcurrencyStrategy;
  /** Debounce window in milliseconds (debounce/burst strategies). Default: 1500 */
  debounceMs?: number;
  /** Max concurrent handlers per thread (concurrent strategy). Default: Infinity */
  maxConcurrent?: number;
  /** Max queued messages per thread (queue/burst strategy). Default: 10 */
  maxQueueSize?: number;
  /** What to do when queue is full. Default: 'drop-oldest' */
  onQueueFull?: 'drop-oldest' | 'drop-newest';
  /** TTL for queued entries in milliseconds. Default: 90000 (90s) */
  queueEntryTtlMs?: number;
}

export interface QueueEntry {
  /** When this entry was enqueued (Unix ms) */
  enqueuedAt: number;
  /** When this entry expires (Unix ms) */
  expiresAt: number;
  /** The queued message */
  message: any;
}

export interface ConcurrencyStrategyInstance {
  enqueue<T>(message: any, handler: () => Promise<T>): Promise<T | null>;
  pending(): number;
  isBusy(): boolean;
  drain(): Promise<void>;
}
