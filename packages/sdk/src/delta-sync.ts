export type DeltaSyncStage = "accepted" | "persisted" | "delivered" | "read";

export interface DeltaCursor {
  version: "fluxy.reliability.v1";
  roomId: string;
  sequence: number;
  snapshotId?: string;
}

export interface DeltaChange<T = unknown> {
  eventId: string;
  sequence: number;
  roomId: string;
  occurredAt: string;
  type: "create" | "update" | "delete";
  payload: T;
  stage: DeltaSyncStage;
}

export interface DeltaSnapshot<T = unknown> {
  cursor: DeltaCursor;
  changes: DeltaChange<T>[];
  hasMore: boolean;
}

export interface DeltaStore {
  append(roomId: string, change: DeltaChange): Promise<void>;
  query(roomId: string, cursor: DeltaCursor, limit?: number): Promise<DeltaSnapshot>;
  prune(roomId: string, olderThanMs: number): Promise<number>;
}

export interface DeltaSyncOptions {
  store: DeltaStore;
  onChanges: (changes: DeltaChange[], cursor: DeltaCursor) => void;
  batchIntervalMs?: number;
}

export function createDeltaPoller(options: DeltaSyncOptions) {
  const { store, onChanges, batchIntervalMs = 100 } = options;
  let cursor: DeltaCursor | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let active = false;

  async function poll() {
    if (!active) return;
    try {
      const cur = cursor ?? { version: "fluxy.reliability.v1" as const, roomId: "", sequence: 0 };
      const snapshot = await store.query(cur.roomId, cur);
      if (snapshot.changes.length > 0) {
        cursor = snapshot.cursor;
        onChanges(snapshot.changes, snapshot.cursor);
      }
    } catch {
      /* poll errors are non-fatal */
    }
    if (active) {
      timer = setTimeout(poll, batchIntervalMs);
    }
  }

  return {
    start() {
      if (active) return;
      active = true;
      poll();
    },
    stop() {
      active = false;
      if (timer) { clearTimeout(timer); timer = null; }
    },
    getCursor: () => cursor,
    setCursor(c: DeltaCursor) { cursor = c; },
  };
}

export function createMemoryDeltaStore(): DeltaStore {
  const rooms = new Map<string, DeltaChange[]>();
  return {
    async append(roomId, change) {
      let changes = rooms.get(roomId);
      if (!changes) { changes = []; rooms.set(roomId, changes); }
      changes.push(change);
    },
    async query(roomId, cursor, limit = 100) {
      const changes = (rooms.get(roomId) ?? []).filter((c) => c.sequence > cursor.sequence).slice(0, limit);
      const lastSeq = changes.length > 0 ? changes[changes.length - 1].sequence : cursor.sequence;
      return {
        cursor: { version: "fluxy.reliability.v1" as const, roomId, sequence: lastSeq },
        changes,
        hasMore: (rooms.get(roomId)?.length ?? 0) > cursor.sequence + limit,
      };
    },
    async prune(roomId, olderThanMs) {
      const cutoff = Date.now() - olderThanMs;
      const changes = rooms.get(roomId);
      if (!changes) return 0;
      const before = changes.length;
      rooms.set(roomId, changes.filter((c) => new Date(c.occurredAt).getTime() > cutoff));
      return before - (rooms.get(roomId)?.length ?? 0);
    },
  };
}

export interface PresenceLease {
  roomId: string;
  userId: string;
  agentId?: string;
  online: boolean;
  lastSeenAt: string;
  leaseExpiresAt: string;
  metadata?: Record<string, unknown>;
}

export interface PresenceLeaseOptions {
  ttlMs: number;
  renewBeforeMs: number;
  onExpired?: (lease: PresenceLease) => void;
}

export function createPresenceLeaseManager(options: PresenceLeaseOptions) {
  const { ttlMs, renewBeforeMs, onExpired } = options;
  const leases = new Map<string, PresenceLease>();
  let expiryTimer: ReturnType<typeof setInterval> | null = null;

  function key(roomId: string, userId: string) {
    return `${roomId}:${userId}`;
  }

  function start() {
    if (expiryTimer) return;
    expiryTimer = setInterval(() => {
      const now = Date.now();
      for (const [k, lease] of leases) {
        if (new Date(lease.leaseExpiresAt).getTime() <= now) {
          leases.delete(k);
          onExpired?.(lease);
        }
      }
    }, 5000);
  }

  function stop() {
    if (expiryTimer) { clearInterval(expiryTimer); expiryTimer = null; }
  }

  return {
    start,
    stop,
    renew(roomId: string, userId: string, opts?: { agentId?: string; metadata?: Record<string, unknown> }): PresenceLease {
      const k = key(roomId, userId);
      const now = new Date().toISOString();
      const lease = leases.get(k);
      if (lease) {
        lease.lastSeenAt = now;
        lease.leaseExpiresAt = new Date(Date.now() + ttlMs).toISOString();
        if (opts?.metadata) lease.metadata = opts.metadata;
        return lease;
      }
      const newLease: PresenceLease = {
        roomId, userId, online: true, lastSeenAt: now,
        leaseExpiresAt: new Date(Date.now() + ttlMs).toISOString(),
        ...(opts?.agentId ? { agentId: opts.agentId } : {}),
        ...(opts?.metadata ? { metadata: opts.metadata } : {}),
      };
      leases.set(k, newLease);
      return newLease;
    },
    expire(roomId: string, userId: string) {
      const k = key(roomId, userId);
      const lease = leases.get(k);
      if (lease) {
        lease.online = false;
        lease.leaseExpiresAt = new Date(0).toISOString();
        onExpired?.(lease);
        leases.delete(k);
      }
    },
    get(roomId: string, userId: string): PresenceLease | null {
      return leases.get(key(roomId, userId)) ?? null;
    },
    list(roomId: string): PresenceLease[] {
      return [...leases.values()].filter((l) => l.roomId === roomId && l.online);
    },
    shouldRenew(lease: PresenceLease): boolean {
      return new Date(lease.leaseExpiresAt).getTime() - Date.now() < renewBeforeMs;
    },
    getAllLeases(): PresenceLease[] {
      return [...leases.values()];
    },
  };
}

export interface DurableAgentStream {
  streamId: string;
  roomId: string;
  agentId: string;
  runId: string;
  status: "active" | "paused" | "completed" | "failed";
  content: string;
  metadata?: Record<string, unknown>;
}

export interface DurableStreamStore {
  save(stream: DurableAgentStream): Promise<void>;
  get(streamId: string): Promise<DurableAgentStream | null>;
  updateStatus(streamId: string, status: DurableAgentStream["status"]): Promise<void>;
  appendContent(streamId: string, content: string): Promise<void>;
  getActiveForRoom(roomId: string): Promise<DurableAgentStream[]>;
  cleanup(maxAgeMs?: number): Promise<number>;
}

export function createMemoryDurableStreamStore(): DurableStreamStore {
  const streams = new Map<string, DurableAgentStream>();
  return {
    async save(stream) { streams.set(stream.streamId, { ...stream }); },
    async get(streamId) { return streams.get(streamId) ?? null; },
    async updateStatus(streamId, status) {
      const s = streams.get(streamId);
      if (s) s.status = status;
    },
    async appendContent(streamId, content) {
      const s = streams.get(streamId);
      if (s) s.content += content;
    },
    async getActiveForRoom(roomId) {
      return [...streams.values()].filter((s) => s.roomId === roomId && (s.status === "active" || s.status === "paused"));
    },
    async cleanup(maxAgeMs = 86_400_000) {
      let removed = 0;
      for (const [id, stream] of streams) {
        if (stream.status === "completed" || stream.status === "failed") {
          streams.delete(id); removed++;
        }
      }
      return removed;
    },
  };
}
