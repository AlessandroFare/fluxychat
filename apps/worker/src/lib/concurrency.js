/**
 * P22-D3: Concurrency Strategies
 * Adapted from Vercel Chat SDK's concurrency patterns.
 *
 * Provides 5 message processing strategies:
 * - drop: Drop new messages when busy (high-frequency chat)
 * - queue: Queue messages for ordered processing
 * - debounce: Debounce rapid updates (keep only latest)
 * - burst: Allow burst of N concurrent messages, then queue
 * - concurrent: Unlimited concurrent processing (or limited by maxConcurrent)
 *
 * Usage:
 *   const strategy = createConcurrencyStrategy({ strategy: 'queue', maxQueueSize: 100 });
 *   await strategy.enqueue(message, () => processMessage(message));
 */

// =============================================================================
// Strategy Types
// =============================================================================

/** @typedef {'drop' | 'queue' | 'debounce' | 'burst' | 'concurrent'} ConcurrencyStrategy */

/**
 * @typedef {Object} ConcurrencyConfig
 * @property {ConcurrencyStrategy} strategy - The concurrency strategy to use
 * @property {number} [debounceMs] - Debounce window in ms (debounce/burst). Default: 1500
 * @property {number} [maxConcurrent] - Max concurrent handlers (concurrent). Default: Infinity
 * @property {number} [maxQueueSize] - Max queued messages (queue/burst). Default: 10
 * @property {'drop-oldest' | 'drop-newest'} [onQueueFull] - What to do when queue is full. Default: 'drop-oldest'
 * @property {number} [queueEntryTtlMs] - TTL for queued entries in ms. Default: 90000
 */

/**
 * @typedef {Object} QueueEntry
 * @property {number} enqueuedAt - When this entry was enqueued (Unix ms)
 * @property {number} expiresAt - When this entry expires (Unix ms)
 * @property {any} message - The queued message
 * @property {() => Promise<any>} handler - The handler to execute
 * @property {(value: any) => void} resolve - Promise resolve
 * @property {(error: any) => void} reject - Promise reject
 */

/**
 * @typedef {Object} ConcurrencyStrategyInstance
 * @property {(message: any, handler: () => Promise<any>) => Promise<any>} enqueue
 * @property {() => number} pending
 * @property {() => boolean} isBusy
 * @property {() => Promise<void>} drain
 */

// =============================================================================
// Drop Strategy
// =============================================================================

/**
 * Drop strategy: drops new messages when busy.
 * @param {ConcurrencyConfig} config
 * @returns {ConcurrencyStrategyInstance}
 */
function createDropStrategy(config) {
  let processing = 0;

  return {
    async enqueue(message, handler) {
      if (processing > 0) {
        // Drop message
        return null;
      }
      processing++;
      try {
        return await handler();
      } finally {
        processing--;
      }
    },
    pending() {
      return processing;
    },
    isBusy() {
      return processing > 0;
    },
    async drain() {
      // Nothing to drain - dropped messages are lost
    },
  };
}

// =============================================================================
// Queue Strategy
// =============================================================================

/**
 * Queue strategy: queues messages for ordered processing.
 * @param {ConcurrencyConfig} config
 * @returns {ConcurrencyStrategyInstance}
 */
function createQueueStrategy(config) {
  const maxQueueSize = config.maxQueueSize ?? 10;
  const onQueueFull = config.onQueueFull ?? 'drop-oldest';
  const queueEntryTtlMs = config.queueEntryTtlMs ?? 90000;

  /** @type {QueueEntry[]} */
  const queue = [];
  let processing = 0;

  async function processNext() {
    if (queue.length === 0 || processing > 0) return;

    // Clean up expired entries
    const now = Date.now();
    while (queue.length > 0 && queue[0].expiresAt < now) {
      queue.shift();
    }

    if (queue.length === 0) return;

    processing++;
    const entry = queue.shift()!;
    try {
      entry.resolve(await entry.handler());
    } catch (error) {
      entry.reject(error);
    } finally {
      processing--;
      processNext();
    }
  }

  return {
    async enqueue(message, handler) {
      return new Promise((resolve, reject) => {
        const now = Date.now();
        const entry: QueueEntry = {
          enqueuedAt: now,
          expiresAt: now + queueEntryTtlMs,
          message,
          handler,
          resolve,
          reject,
        };

        if (queue.length >= maxQueueSize) {
          if (onQueueFull === 'drop-oldest') {
            const dropped = queue.shift();
            if (dropped) {
              dropped.reject(new Error('Queue full, dropped oldest message'));
            }
          } else {
            // drop-newest - reject the new entry
            reject(new Error('Queue full, dropped newest message'));
            return;
          }
        }

        queue.push(entry);
        processNext();
      });
    },
    pending() {
      return queue.length + processing;
    },
    isBusy() {
      return processing > 0;
    },
    async drain() {
      while (queue.length > 0 || processing > 0) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    },
  };
}

// =============================================================================
// Debounce Strategy
// =============================================================================

/**
 * Debounce strategy: keeps only the latest message in a time window.
 * @param {ConcurrencyConfig} config
 * @returns {ConcurrencyStrategyInstance}
 */
function createDebounceStrategy(config) {
  const debounceMs = config.debounceMs ?? 1500;
  let processing = 0;
  /** @type {ReturnType<typeof setTimeout> | null} */
  let debounceTimer = null;
  /** @type {QueueEntry | null} */
  let pendingEntry = null;

  return {
    async enqueue(message, handler) {
      return new Promise((resolve, reject) => {
        // Clear existing debounce timer
        if (debounceTimer) {
          clearTimeout(debounceTimer);
        }

        // Store latest message
        const now = Date.now();
        pendingEntry = {
          enqueuedAt: now,
          expiresAt: now + 90000,
          message,
          handler,
          resolve,
          reject,
        };

        // Set new debounce timer
        debounceTimer = setTimeout(async () => {
          if (pendingEntry) {
            processing++;
            try {
              pendingEntry.resolve(await pendingEntry.handler());
            } catch (error) {
              pendingEntry.reject(error);
            } finally {
              processing--;
              pendingEntry = null;
            }
          }
        }, debounceMs);
      });
    },
    pending() {
      return processing + (pendingEntry ? 1 : 0);
    },
    isBusy() {
      return processing > 0;
    },
    async drain() {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      if (pendingEntry) {
        processing++;
        try {
          pendingEntry.resolve(await pendingEntry.handler());
        } finally {
          processing--;
          pendingEntry = null;
        }
      }
    },
  };
}

// =============================================================================
// Burst Strategy
// =============================================================================

/**
 * Burst strategy: allows burst of N concurrent messages, then queues.
 * @param {ConcurrencyConfig} config
 * @returns {ConcurrencyStrategyInstance}
 */
function createBurstStrategy(config) {
  const maxConcurrent = config.maxConcurrent ?? 5;
  const maxQueueSize = config.maxQueueSize ?? 10;
  const onQueueFull = config.onQueueFull ?? 'drop-oldest';
  const queueEntryTtlMs = config.queueEntryTtlMs ?? 90000;
  const debounceMs = config.debounceMs ?? 1500;

  let processing = 0;
  /** @type {QueueEntry[]} */
  const queue = [];
  /** @type {ReturnType<typeof setTimeout> | null} */
  let debounceTimer = null;

  async function processNext() {
    if (queue.length === 0 || processing >= maxConcurrent) return;

    // Clean up expired entries
    const now = Date.now();
    while (queue.length > 0 && queue[0].expiresAt < now) {
      queue.shift();
    }

    if (queue.length === 0) return;

    processing++;
    const entry = queue.shift()!;
    try {
      entry.resolve(await entry.handler());
    } catch (error) {
      entry.reject(error);
    } finally {
      processing--;
      processNext();
    }
  }

  return {
    async enqueue(message, handler) {
      return new Promise((resolve, reject) => {
        const now = Date.now();
        const entry: QueueEntry = {
          enqueuedAt: now,
          expiresAt: now + queueEntryTtlMs,
          message,
          handler,
          resolve,
          reject,
        };

        if (processing < maxConcurrent) {
          // Process immediately within burst
          processing++;
          handler()
            .then(resolve)
            .catch(reject)
            .finally(() => {
              processing--;
              processNext();
            });
        } else if (queue.length >= maxQueueSize) {
          if (onQueueFull === 'drop-oldest') {
            const dropped = queue.shift();
            if (dropped) {
              dropped.reject(new Error('Burst queue full, dropped oldest message'));
            }
          } else {
            reject(new Error('Burst queue full, dropped newest message'));
            return;
          }
          queue.push(entry);
        } else {
          queue.push(entry);
        }
      });
    },
    pending() {
      return queue.length + processing;
    },
    isBusy() {
      return processing >= maxConcurrent;
    },
    async drain() {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      while (queue.length > 0 || processing > 0) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    },
  };
}

// =============================================================================
// Concurrent Strategy
// =============================================================================

/**
 * Concurrent strategy: unlimited (or limited) concurrent processing.
 * @param {ConcurrencyConfig} config
 * @returns {ConcurrencyStrategyInstance}
 */
function createConcurrentStrategy(config) {
  const maxConcurrent = config.maxConcurrent ?? Infinity;
  let processing = 0;

  return {
    async enqueue(message, handler) {
      if (processing >= maxConcurrent) {
        // Wait for a slot
        await new Promise<void>((resolve) => {
          const check = () => {
            if (processing < maxConcurrent) {
              resolve();
            } else {
              setTimeout(check, 10);
            }
          };
          check();
        });
      }

      processing++;
      try {
        return await handler();
      } finally {
        processing--;
      }
    },
    pending() {
      return processing;
    },
    isBusy() {
      return false;
    },
    async drain() {
      while (processing > 0) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    },
  };
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Create a concurrency strategy based on configuration.
 * @param {ConcurrencyConfig | ConcurrencyStrategy} config
 * @returns {ConcurrencyStrategyInstance}
 */
export function createConcurrencyStrategy(config) {
  // Handle simple string config
  const strategy = typeof config === 'string' ? config : config.strategy;
  const fullConfig = typeof config === 'string' ? { strategy: config } : config;

  switch (strategy) {
    case 'drop':
      return createDropStrategy(fullConfig);
    case 'queue':
      return createQueueStrategy(fullConfig);
    case 'debounce':
      return createDebounceStrategy(fullConfig);
    case 'burst':
      return createBurstStrategy(fullConfig);
    case 'concurrent':
      return createConcurrentStrategy(fullConfig);
    default:
      return createQueueStrategy(fullConfig);
  }
}

/**
 * Default concurrency configuration per adapter.
 * @type {Record<string, ConcurrencyConfig>}
 */
export const ADAPTER_CONCURRENCY_DEFAULTS = {
  web: { strategy: 'concurrent' },
  slack: { strategy: 'queue', maxQueueSize: 50 },
  teams: { strategy: 'queue', maxQueueSize: 50 },
  discord: { strategy: 'queue', maxQueueSize: 100 },
  telegram: { strategy: 'queue', maxQueueSize: 50 },
  whatsapp: { strategy: 'debounce', debounceMs: 500 },
  'google-chat': { strategy: 'queue', maxQueueSize: 50 },
  github: { strategy: 'queue', maxQueueSize: 100 },
  matrix: { strategy: 'queue', maxQueueSize: 100 },
  irc: { strategy: 'concurrent' },
  twitch: { strategy: 'debounce', debounceMs: 1000 },
};
