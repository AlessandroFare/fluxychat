export interface OutboxEntry {
  id: string;
  roomId: string;
  type: string;
  payload: Record<string, unknown>;
  createdAt: string;
  retryCount: number;
  maxRetries: number;
  lastError?: string;
}

export interface OutboxStore {
  push(entry: OutboxEntry): Promise<void>;
  peek(limit?: number): Promise<OutboxEntry[]>;
  remove(id: string): Promise<void>;
  markFailed(id: string, error: string): Promise<void>;
  pendingCount(): Promise<number>;
  clear(): Promise<void>;
}

export interface OutboxOptions {
  store: OutboxStore;
  sender: (entry: OutboxEntry) => Promise<boolean>;
  batchSize?: number;
  retryDelayMs?: number;
  maxRetries?: number;
}

export function createMemoryOutboxStore(): OutboxStore {
  const entries: OutboxEntry[] = [];
  return {
    async push(entry) { entries.push(entry); },
    async peek(limit = 10) { return entries.filter((e) => e.retryCount < e.maxRetries).slice(0, limit); },
    async remove(id) { const idx = entries.findIndex((e) => e.id === id); if (idx >= 0) entries.splice(idx, 1); },
    async markFailed(id, error) { const e = entries.find((e) => e.id === id); if (e) { e.retryCount++; e.lastError = error; } },
    async pendingCount() { return entries.filter((e) => e.retryCount < e.maxRetries).length; },
    async clear() { entries.length = 0; },
  };
}

export function createOutboxProcessor(options: OutboxOptions) {
  const { store, sender, batchSize = 10, retryDelayMs = 2000, maxRetries = 5 } = options;
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
          if (ok) {
            await store.remove(entry.id);
          } else {
            await store.markFailed(entry.id, "Send returned false");
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (entry.retryCount >= maxRetries) {
            await store.remove(entry.id);
          } else {
            await store.markFailed(entry.id, msg);
          }
        }
      }
    } finally {
      processing = false;
    }
    if (active) {
      const count = await store.pendingCount();
      if (count > 0) {
        timer = setTimeout(flush, retryDelayMs);
      }
    }
  }

  return {
    start() {
      if (active) return;
      active = true;
      flush();
    },
    stop() {
      active = false;
      if (timer) { clearTimeout(timer); timer = null; }
    },
    async flushNow() { await flush(); },
    isProcessing: () => processing,
  };
}

export type LaneType = "transient" | "durable";

export interface LaneMessage<T = unknown> {
  id: string;
  lane: LaneType;
  roomId: string;
  payload: T;
  priority: number;
  createdAt: string;
}

export interface LaneProcessor<T = unknown> {
  enqueue(msg: LaneMessage<T>): void;
  enqueueBatch(msgs: LaneMessage<T>[]): void;
  registerHandler(lane: LaneType, handler: (msg: LaneMessage<T>) => Promise<void>): void;
  start(): void;
  stop(): void;
  getQueueDepth(lane?: LaneType): number;
}

export function createLaneProcessor<T = unknown>(outboxStore?: OutboxStore): LaneProcessor<T> {
  const transient: LaneMessage<T>[] = [];
  const durable: LaneMessage<T>[] = [];
  const handlers = new Map<LaneType, (msg: LaneMessage<T>) => Promise<void>>();
  let timer: ReturnType<typeof setInterval> | null = null;
  let active = false;

  function insertSorted(queue: LaneMessage<T>[], msg: LaneMessage<T>) {
    let i = queue.length;
    while (i > 0 && queue[i - 1].priority < msg.priority) i--;
    queue.splice(i, 0, msg);
  }

  async function processLane(lane: LaneType) {
    const handler = handlers.get(lane);
    if (!handler) return;
    const queue = lane === "transient" ? transient : durable;
    while (queue.length > 0) {
      const msg = queue.shift()!;
      try {
        await handler(msg);
      } catch {
        if (lane === "durable" && outboxStore) {
          await outboxStore.push({
            id: msg.id,
            roomId: msg.roomId,
            type: "lane_message",
            payload: msg.payload as Record<string, unknown>,
            createdAt: msg.createdAt,
            retryCount: 0,
            maxRetries: 5,
          });
        }
      }
    }
  }

  async function tick() {
    await Promise.all([processLane("transient"), processLane("durable")]);
  }

  return {
    enqueue(msg: LaneMessage<T>) {
      if (msg.lane === "transient") {
        insertSorted(transient, msg);
      } else {
        insertSorted(durable, msg);
      }
    },
    enqueueBatch(msgs: LaneMessage<T>[]) {
      for (const msg of msgs) this.enqueue(msg);
    },
    registerHandler(lane: LaneType, handler: (msg: LaneMessage<T>) => Promise<void>) {
      handlers.set(lane, handler);
    },
    start() {
      if (active) return;
      active = true;
      tick();
      timer = setInterval(tick, 100);
    },
    stop() {
      active = false;
      if (timer) { clearInterval(timer); timer = null; }
    },
    getQueueDepth(lane?: LaneType) {
      if (lane === "transient") return transient.length;
      if (lane === "durable") return durable.length;
      return transient.length + durable.length;
    },
  };
}

export interface ChaosConfig {
  failureRate?: number;
  latencyMs?: [number, number];
  disconnectAfter?: number;
  maxReconnectDelay?: number;
}

export interface ChaosEvent {
  type: "send_failure" | "latency" | "disconnect" | "reconnect" | "queue_drop";
  detail: string;
  timestamp: string;
}

export function createChaosHarness(sender: (msg: unknown) => Promise<boolean>, config: ChaosConfig = {}) {
  let failureRate = config.failureRate ?? 0;
  const latencyMs: [number, number] = [config.latencyMs?.[0] ?? 0, config.latencyMs?.[1] ?? 0];
  const disconnectAfter = config.disconnectAfter ?? Infinity;
  const maxReconnectDelay = config.maxReconnectDelay ?? 5000;
  const events: ChaosEvent[] = [];
  let sentCount = 0;
  let disconnected = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  function record(type: ChaosEvent["type"], detail: string) {
    events.push({ type, detail, timestamp: new Date().toISOString() });
  }

  async function chaoticSend(msg: unknown): Promise<boolean> {
    if (disconnected) {
      record("send_failure", "Disconnected");
      return false;
    }
    sentCount++;
    if (failureRate > 0 && Math.random() < failureRate) {
      record("send_failure", `Random failure (rate=${failureRate})`);
      return false;
    }
    if (latencyMs[1] > 0) {
      const delay = latencyMs[0] + Math.random() * (latencyMs[1] - latencyMs[0]);
      record("latency", `${delay.toFixed(0)}ms`);
      await new Promise((r) => setTimeout(r, delay));
    }
    if (sentCount >= disconnectAfter) {
      disconnected = true;
      record("disconnect", `After ${sentCount} sends`);
      reconnectTimer = setTimeout(() => {
        disconnected = false;
        record("reconnect", "Reconnected");
      }, maxReconnectDelay);
    }
    try {
      return await sender(msg);
    } catch (e) {
      record("send_failure", e instanceof Error ? e.message : String(e));
      return false;
    }
  }

  return {
    send: chaoticSend,
    getEvents: () => [...events],
    getSentCount: () => sentCount,
    isDisconnected: () => disconnected,
    reset() {
      sentCount = 0;
      disconnected = false;
      events.length = 0;
      if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    },
    setFailureRate(rate: number) { failureRate = rate; },
  };
}
