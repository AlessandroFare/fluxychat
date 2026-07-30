export type ConcurrencyStrategy = 'drop' | 'queue' | 'debounce' | 'burst' | 'concurrent';

export interface ConcurrencyConfig {
  strategy: ConcurrencyStrategy;
  debounceMs?: number;
  maxConcurrent?: number;
  maxQueueSize?: number;
  onQueueFull?: 'drop-oldest' | 'drop-newest';
  queueEntryTtlMs?: number;
}

export interface QueueEntry {
  enqueuedAt: number;
  expiresAt: number;
  message: any;
}

export interface ConcurrencyStrategyInstance {
  enqueue<T>(message: any, handler: () => Promise<T>): Promise<T | null>;
  pending(): number;
  isBusy(): boolean;
  drain(): Promise<void>;
}

function createQueue(maxSize: number, onQueueFull: 'drop-oldest' | 'drop-newest', ttlMs: number) {
  const queue: Array<{ handler: () => Promise<any>; resolve: (v: any) => void; reject: (e: any) => void; expiresAt: number }> = [];

  function prune() {
    const now = Date.now();
    while (queue.length > 0 && queue[0].expiresAt <= now) {
      const entry = queue.shift()!;
      entry.reject(new Error('Queue entry expired'));
    }
  }

  return {
    enqueue<T>(handler: () => Promise<T>): Promise<T> {
      const p = new Promise<T>((resolve, reject) => {
        prune();
        if (queue.length >= maxSize) {
          if (onQueueFull === 'drop-newest') {
            reject(new Error('Queue full'));
            return;
          }
          const dropped = queue.shift()!;
          dropped.reject(new Error('Queue full - dropped oldest'));
        }
        queue.push({ handler, resolve, reject, expiresAt: Date.now() + ttlMs });
      });
      p.catch(() => {});
      return p;
    },
    dequeue(): { handler: () => Promise<any>; resolve: (v: any) => void; reject: (e: any) => void } | null {
      prune();
      return queue.shift() ?? null;
    },
    size(): number {
      prune();
      return queue.length;
    },
    clear() {
      queue.splice(0);
    },
  };
}

function concurrentStrategy(): ConcurrencyStrategyInstance {
  return {
    enqueue: async <T>(_message: any, handler: () => Promise<T>): Promise<T | null> => handler(),
    pending: () => 0,
    isBusy: () => false,
    drain: async () => {},
  };
}

function dropStrategy(): ConcurrencyStrategyInstance {
  let busy = false;
  return {
    enqueue: async <T>(_message: any, handler: () => Promise<T>): Promise<T | null> => {
      if (busy) return null;
      busy = true;
      try {
        return await handler();
      } finally {
        busy = false;
      }
    },
    pending: () => (busy ? 1 : 0),
    isBusy: () => busy,
    drain: async () => { busy = false; },
  };
}

function queueStrategy(maxQueueSize: number, onQueueFull: 'drop-oldest' | 'drop-newest', ttlMs: number): ConcurrencyStrategyInstance {
  const q = createQueue(maxQueueSize, onQueueFull, ttlMs);
  let running = false;

  async function processNext() {
    if (running) return;
    running = true;
    while (true) {
      const entry = q.dequeue();
      if (!entry) break;
      try {
        const result = await entry.handler();
        entry.resolve(result);
      } catch (e) {
        entry.reject(e);
      }
    }
    running = false;
  }

  return {
    enqueue: async <T>(_message: any, handler: () => Promise<T>): Promise<T> => {
      const promise = q.enqueue(handler);
      processNext();
      return promise;
    },
    pending: () => q.size() + (running ? 1 : 0),
    isBusy: () => running || q.size() > 0,
    drain: async () => {
      q.clear();
      running = false;
    },
  };
}

function debounceStrategy(debounceMs: number): ConcurrencyStrategyInstance {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pendingHandler: (() => Promise<any>) | null = null;
  let pendingResolve: ((v: any) => void) | null = null;
  let pendingReject: ((e: any) => void) | null = null;

  async function flush() {
    const h = pendingHandler;
    const r = pendingResolve;
    const rej = pendingReject;
    pendingHandler = null;
    pendingResolve = null;
    pendingReject = null;
    if (h && r) {
      try {
        const result = await h();
        r(result);
      } catch (e) {
        rej?.(e);
      }
    }
  }

  return {
    enqueue: async <T>(_message: any, handler: () => Promise<T>): Promise<T> => {
      if (timer) clearTimeout(timer);
      return new Promise<T>((resolve, reject) => {
        pendingHandler = handler;
        pendingResolve = resolve;
        pendingReject = reject;
        timer = setTimeout(() => {
          timer = null;
          flush();
        }, debounceMs);
      });
    },
    pending: () => (timer ? 1 : 0),
    isBusy: () => timer !== null,
    drain: async () => {
      if (timer) clearTimeout(timer);
      timer = null;
      await flush();
    },
  };
}

function burstStrategy(maxConcurrent: number, maxQueueSize: number, onQueueFull: 'drop-oldest' | 'drop-newest', ttlMs: number): ConcurrencyStrategyInstance {
  const q = createQueue(maxQueueSize, onQueueFull, ttlMs);
  let active = 0;

  async function processNext() {
    while (active < maxConcurrent) {
      const entry = q.dequeue();
      if (!entry) break;
      active++;
      entry.handler()
        .then(entry.resolve)
        .catch(entry.reject)
        .finally(() => {
          active--;
          processNext();
        });
    }
  }

  return {
    enqueue: async <T>(_message: any, handler: () => Promise<T>): Promise<T> => {
      if (active < maxConcurrent) {
        active++;
        try {
          return await handler();
        } finally {
          active--;
          processNext();
        }
      }
      const promise = q.enqueue(handler);
      processNext();
      return promise;
    },
    pending: () => q.size() + active,
    isBusy: () => active > 0 || q.size() > 0,
    drain: async () => {
      q.clear();
      active = 0;
    },
  };
}

export function createConcurrencyStrategy(config: ConcurrencyConfig): ConcurrencyStrategyInstance {
  const {
    strategy,
    debounceMs = 1500,
    maxConcurrent = Infinity,
    maxQueueSize = 10,
    onQueueFull = 'drop-oldest',
    queueEntryTtlMs = 90000,
  } = config;

  switch (strategy) {
    case 'concurrent':
      return concurrentStrategy();
    case 'drop':
      return dropStrategy();
    case 'queue':
      return queueStrategy(maxQueueSize, onQueueFull, queueEntryTtlMs);
    case 'debounce':
      return debounceStrategy(debounceMs);
    case 'burst':
      return burstStrategy(maxConcurrent, maxQueueSize, onQueueFull, queueEntryTtlMs);
    default:
      throw new Error(`Unknown concurrency strategy: ${strategy}`);
  }
}
