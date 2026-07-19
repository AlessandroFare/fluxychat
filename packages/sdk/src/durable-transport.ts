export interface SessionState {
  sessionId: string;
  offset: number;
  createdAt: string;
  lastActiveAt: string;
  deviceIds: string[];
  metadata?: Record<string, unknown>;
}

export interface StreamChunkEntry {
  offset: number;
  data: string;
  timestamp: string;
}

export interface DurableSession {
  id: string;
  state: SessionState;
  chunks: StreamChunkEntry[];
  isActive: boolean;
}

export interface ReconnectResult {
  session: DurableSession;
  missedChunks: StreamChunkEntry[];
  liveStream: boolean;
}

export interface DurableTransportConfig {
  maxChunks?: number;
  ttlMs?: number;
  appId?: string;
}

export interface DurableTransportApi {
  createSession(deviceId: string, metadata?: Record<string, unknown>): DurableSession;
  getSession(sessionId: string): DurableSession | null;
  appendChunk(sessionId: string, data: string): number;
  reconnect(sessionId: string, deviceId: string, lastKnownOffset: number): ReconnectResult | null;
  getChunks(sessionId: string, fromOffset: number): StreamChunkEntry[];
  listSessions(): DurableSession[];
  closeSession(sessionId: string): void;
  cleanup(): number;
}

let sessionCounter = 0;

export function createDurableTransport(config?: DurableTransportConfig): DurableTransportApi {
  const maxChunks = config?.maxChunks ?? 5000;
  const ttlMs = config?.ttlMs ?? 30 * 60 * 1000;
  const sessions = new Map<string, DurableSession>();

  function now(): string {
    return new Date().toISOString();
  }

  return {
    createSession(deviceId, metadata) {
      const id = `sess_${++sessionCounter}_${Date.now()}`;
      const session: DurableSession = {
        id,
        state: { sessionId: id, offset: 0, createdAt: now(), lastActiveAt: now(), deviceIds: [deviceId], metadata },
        chunks: [],
        isActive: true,
      };
      sessions.set(id, session);
      return session;
    },

    getSession(sessionId) {
      return sessions.get(sessionId) ?? null;
    },

    appendChunk(sessionId, data) {
      const session = sessions.get(sessionId);
      if (!session) return -1;
      const offset = session.state.offset++;
      session.chunks.push({ offset, data, timestamp: now() });
      session.state.lastActiveAt = now();
      if (session.chunks.length > maxChunks) session.chunks.shift();
      return offset;
    },

    reconnect(sessionId, deviceId, lastKnownOffset) {
      const session = sessions.get(sessionId);
      if (!session || !session.isActive) return null;
      if (!session.state.deviceIds.includes(deviceId)) {
        session.state.deviceIds.push(deviceId);
      }
      session.state.lastActiveAt = now();
      const missedChunks = session.chunks.filter((c) => c.offset > lastKnownOffset);
      return { session, missedChunks, liveStream: session.isActive };
    },

    getChunks(sessionId, fromOffset) {
      const session = sessions.get(sessionId);
      if (!session) return [];
      return session.chunks.filter((c) => c.offset >= fromOffset);
    },

    listSessions() {
      return [...sessions.values()];
    },

    closeSession(sessionId) {
      const session = sessions.get(sessionId);
      if (session) session.isActive = false;
    },

    cleanup() {
      const cutoff = Date.now() - ttlMs;
      let removed = 0;
      for (const [id, session] of sessions) {
        if (new Date(session.state.lastActiveAt).getTime() < cutoff) {
          sessions.delete(id);
          removed++;
        }
      }
      return removed;
    },
  };
}
