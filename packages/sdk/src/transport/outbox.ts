import {
  createMemoryOutboxStore,
  createOutboxProcessor,
  type OutboxEntry,
  type OutboxOptions,
  type OutboxStore,
} from "../outbox-lanes.js";

export type { OutboxEntry, OutboxStore, OutboxOptions };

export interface ReconnectSource {
  on(event: "open", handler: () => void): void;
  off?(event: "open", handler: () => void): void;
}

export interface MessageOutboxSendOptions {
  roomId: string;
  type?: string;
  payload: Record<string, unknown>;
  id?: string;
}

export interface MessageOutboxOptions {
  store?: OutboxStore;
  send: (entry: OutboxEntry) => Promise<boolean>;
  batchSize?: number;
  retryDelayMs?: number;
  maxRetries?: number;
  autoStart?: boolean;
}

export interface MessageOutbox {
  enqueue(options: MessageOutboxSendOptions): Promise<void>;
  flush(): Promise<void>;
  start(): void;
  stop(): void;
  pendingCount(): Promise<number>;
  bindReconnect(connection: ReconnectSource): () => void;
}

function createEntryId(): string {
  return `outbox_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function createMessageOutbox(options: MessageOutboxOptions): MessageOutbox {
  const store = options.store ?? createMemoryOutboxStore();
  const maxRetries = options.maxRetries ?? 5;
  const processor = createOutboxProcessor({
    store,
    sender: options.send,
    batchSize: options.batchSize,
    retryDelayMs: options.retryDelayMs,
    maxRetries,
  });

  if (options.autoStart !== false) {
    processor.start();
  }

  return {
    async enqueue(msg) {
      await store.push({
        id: msg.id ?? createEntryId(),
        roomId: msg.roomId,
        type: msg.type ?? "message",
        payload: msg.payload,
        createdAt: new Date().toISOString(),
        retryCount: 0,
        maxRetries,
      });
      if (options.autoStart !== false) {
        await processor.flushNow();
      }
    },
    flush: () => processor.flushNow(),
    start: () => processor.start(),
    stop: () => processor.stop(),
    pendingCount: () => store.pendingCount(),
    bindReconnect(connection) {
      const onOpen = () => {
        processor.start();
        void processor.flushNow();
      };
      connection.on("open", onOpen);
      return () => connection.off?.("open", onOpen);
    },
  };
}

export { createMemoryOutboxStore, createOutboxProcessor };
