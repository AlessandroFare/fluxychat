/**
 * NW-100 — client sync status for offline-first SDK.
 */
import type { OutboxStore } from "./outbox-lanes.js";
import { createOutboxProcessor } from "./outbox-lanes.js";
import { createMessageOutbox, type MessageOutbox } from "./transport/outbox.js";
import { createIndexedDbOutboxStore } from "./transport/indexed-db-outbox.js";
import { createOfflineEventLog, type OfflineEventLog } from "./offline-event-log.js";
import type { FluxyChatEvent } from "./index.js";

export type FluxySyncStatus = "synced" | "syncing" | "offline" | "pending";

export interface OfflineSyncController {
  status: FluxySyncStatus;
  pendingCount: number;
  outbox: MessageOutbox;
  eventLog: OfflineEventLog;
  onStatusChange: (cb: (status: FluxySyncStatus, pending: number) => void) => () => void;
  recordEvent: (roomId: string, event: FluxyChatEvent) => Promise<void>;
  setConnected: (connected: boolean) => void;
  flush: () => Promise<void>;
}

export interface CreateOfflineSyncOptions {
  store?: OutboxStore;
  send: (entry: {
    roomId: string;
    type: string;
    payload: Record<string, unknown>;
    id: string;
  }) => Promise<boolean>;
}

export async function createOfflineSyncController(
  options: CreateOfflineSyncOptions,
): Promise<OfflineSyncController> {
  const store = options.store ?? (await createIndexedDbOutboxStore());
  const eventLog = await createOfflineEventLog();
  const listeners = new Set<(status: FluxySyncStatus, pending: number) => void>();
  let connected = true;
  let status: FluxySyncStatus = "synced";
  let pendingCount = 0;

  function emit() {
    for (const cb of listeners) cb(status, pendingCount);
  }

  async function refreshPending() {
    pendingCount = await store.pendingCount();
    if (!connected) {
      status = pendingCount > 0 ? "pending" : "offline";
    } else if (pendingCount > 0) {
      status = "syncing";
    } else {
      status = "synced";
    }
    emit();
  }

  const baseOutbox = createMessageOutbox({
    store,
    send: async (entry) => {
      const ok = await options.send({
        roomId: entry.roomId,
        type: entry.type,
        payload: entry.payload,
        id: entry.id,
      });
      await refreshPending();
      return ok;
    },
    autoStart: false,
  });

  const outbox: MessageOutbox = {
    ...baseOutbox,
    async enqueue(msg) {
      await baseOutbox.enqueue(msg);
      await refreshPending();
    },
  };

  return {
    get status() {
      return status;
    },
    get pendingCount() {
      return pendingCount;
    },
    outbox,
    eventLog,
    onStatusChange(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    async recordEvent(roomId, event) {
      await eventLog.append(roomId, event);
    },
    setConnected(isConnected) {
      connected = isConnected;
      if (isConnected) {
        outbox.start();
        void outbox.flush().then(() => refreshPending());
      } else {
        void refreshPending();
      }
    },
    async flush() {
      status = "syncing";
      emit();
      await outbox.flush();
      await refreshPending();
    },
  };
}
