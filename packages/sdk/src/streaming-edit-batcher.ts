export interface StreamingEditUpdate {
  id: number;
  content: string;
  editedAt: string;
  streaming?: boolean;
  /** Present on worker `edit` frames — used to upsert if `message` not applied yet. */
  roomId?: string;
  userId?: string;
}

/**
 * Apply a streaming edit. Upserts when the inbound `message` frame is still pending
 * (async E2E decrypt can defer `message` after rapid `edit` events).
 */
export function mergeStreamingEditIntoMessages<
  T extends {
    id: number;
    roomId: string;
    userId: string;
    content: string;
    createdAt: string;
    editedAt?: string;
    streaming?: boolean;
  },
>(messages: T[], edit: StreamingEditUpdate, sort: (rows: T[]) => T[]): T[] {
  const idx = messages.findIndex((m) => m.id === edit.id);
  const streaming = edit.streaming ?? false;
  if (idx >= 0) {
    const next = [...messages];
    next[idx] = {
      ...next[idx],
      content: edit.content,
      editedAt: edit.editedAt,
      streaming,
    };
    return sort(next);
  }
  if (!edit.roomId || !edit.userId) return messages;
  const stub = {
    id: edit.id,
    roomId: edit.roomId,
    userId: edit.userId,
    content: edit.content,
    createdAt: edit.editedAt,
    editedAt: edit.editedAt,
    streaming,
  } as T;
  return sort([...messages, stub]);
}

export interface StreamingEditBatcherOptions {
  /** Minimum delay between batched UI updates (default 80ms). */
  intervalMs?: number;
  /** Force flush after this wall time since first queued edit (default 200ms). */
  maxWaitMs?: number;
}

/**
 * Coalesce rapid streaming `edit` events into fewer React updates (my-chat-web queue pattern).
 */
export function createStreamingEditBatcher(
  apply: (updates: StreamingEditUpdate[]) => void,
  options: StreamingEditBatcherOptions = {},
) {
  const intervalMs = options.intervalMs ?? 80;
  const maxWaitMs = options.maxWaitMs ?? 200;
  const pending = new Map<number, StreamingEditUpdate>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let firstQueuedAt = 0;

  function flush() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (pending.size === 0) {
      firstQueuedAt = 0;
      return;
    }
    const batch = Array.from(pending.values());
    pending.clear();
    firstQueuedAt = 0;
    apply(batch);
  }

  function schedule() {
    const now = Date.now();
    if (!firstQueuedAt) firstQueuedAt = now;
    const elapsed = now - firstQueuedAt;
    const delay = elapsed >= maxWaitMs ? 0 : intervalMs;
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, delay);
  }

  return {
    push(update: StreamingEditUpdate) {
      pending.set(update.id, update);
      schedule();
    },
    flush,
  };
}
