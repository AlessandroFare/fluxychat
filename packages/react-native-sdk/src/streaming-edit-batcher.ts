export interface StreamingEditUpdate {
  id: number;
  content: string;
  editedAt: string;
  streaming?: boolean;
}

export interface StreamingEditBatcherOptions {
  intervalMs?: number;
  maxWaitMs?: number;
}

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
    if (timer) { clearTimeout(timer); timer = null; }
    if (pending.size === 0) { firstQueuedAt = 0; return; }
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
    push(update: StreamingEditUpdate) { pending.set(update.id, update); schedule(); },
    flush,
  };
}
