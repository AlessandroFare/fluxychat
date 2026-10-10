import type { FluxyChatEvent } from "./fluxy-chat-client";
import type { FluxyChatRoomConnection } from "./room-connection";
import { FluxyLockError } from "./structured-errors";
import { unableTo } from "./errors";
import { fluxySubscription, type FluxySubscription } from "./fluxy-subscription";

export type FluxyLockEvent = Extract<FluxyChatEvent, { type: "lock" }>;

export type FluxyLockStatus = "pending" | "locked" | "unlocked";

export type FluxyLockAttributes = Record<string, string | number | boolean>;

export interface FluxyLockRecord {
  lockId: string;
  owner: string | null;
  expiresAt: number;
  held: boolean;
  status: FluxyLockStatus;
  attributes?: FluxyLockAttributes;
}

export interface FluxyRoomLocks {
  acquire(
    lockId: string,
    options?: { ttlMs?: number; attributes?: Record<string, unknown> },
  ): void;
  release(lockId: string): void;
  get(lockId: string): FluxyLockRecord | undefined;
  getAll(): Promise<FluxyLockRecord[]>;
  getSelf(): Promise<FluxyLockRecord[]>;
  getOthers(): Promise<FluxyLockRecord[]>;
  subscribe(handler: (event: FluxyLockEvent) => void): FluxySubscription;
}

function asAttributes(value: unknown): FluxyLockAttributes | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const out: FluxyLockAttributes = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw === "string" || typeof raw === "number" || typeof raw === "boolean") {
      out[key] = raw;
    }
  }
  return Object.keys(out).length ? out : undefined;
}

function applyLockEvent(
  table: Map<string, FluxyLockRecord>,
  event: FluxyLockEvent,
): void {
  if (event.snapshot && Array.isArray(event.locks)) {
    table.clear();
    for (const row of event.locks) {
      if (!row?.lockId) continue;
      table.set(row.lockId, {
        lockId: row.lockId,
        owner: row.owner ?? null,
        expiresAt: Number(row.expiresAt) || 0,
        held: row.held !== false,
        status: row.held === false ? "unlocked" : "locked",
        ...(asAttributes(row.attributes) ? { attributes: asAttributes(row.attributes) } : {}),
      });
    }
    return;
  }
  const lockId = String(event.lockId || "").trim();
  if (!lockId) return;
  const existing = table.get(lockId);
  const attributes = asAttributes(event.attributes) ?? existing?.attributes;
  if (!event.held) {
    table.delete(lockId);
    return;
  }
  const locked = event.acquired !== false;
  if (existing?.status === "pending" && event.acquired === false) {
    table.set(lockId, {
      lockId,
      owner: event.owner ?? null,
      expiresAt: Number(event.expiresAt) || 0,
      held: false,
      status: "unlocked",
      ...(attributes ? { attributes } : {}),
    });
    return;
  }
  table.set(lockId, {
    lockId,
    owner: event.owner ?? null,
    expiresAt: Number(event.expiresAt) || 0,
    held: locked,
    status: locked ? "locked" : "unlocked",
    ...(attributes ? { attributes } : {}),
  });
}

export function bindRoomLocks(connection: FluxyChatRoomConnection): FluxyRoomLocks {
  const table = new Map<string, FluxyLockRecord>();
  connection.onLock((event) => applyLockEvent(table, event));
  return {
    acquire(lockId, options) {
      const id = lockId.trim();
      const current = table.get(id);
      if (current?.status === "pending" && current.owner === connection.userId) {
        throw new FluxyLockError(unableTo("acquire lock", "request exists"));
      }
      const attributes = asAttributes(options?.attributes);
      table.set(id, {
        lockId: id,
        owner: connection.userId,
        expiresAt: 0,
        held: false,
        status: "pending",
        ...(attributes ? { attributes } : {}),
      });
      connection.sendJson({
        type: "lock_acquire",
        lockId: id,
        ...(options?.ttlMs != null ? { ttlMs: options.ttlMs } : {}),
        ...(attributes ? { attributes } : {}),
      });
    },
    release(lockId) {
      connection.sendJson({ type: "lock_release", lockId });
    },
    get(lockId) {
      return table.get(lockId);
    },
    async getAll() {
      return [...table.values()].filter((row) => row.status === "locked");
    },
    async getSelf() {
      return [...table.values()].filter(
        (row) => row.status === "locked" && row.owner === connection.userId,
      );
    },
    async getOthers() {
      return [...table.values()].filter(
        (row) => row.status === "locked" && row.owner !== connection.userId,
      );
    },
    subscribe(handler) {
      return fluxySubscription(connection.onLock(handler));
    },
  };
}
