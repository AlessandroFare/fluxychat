export interface DurableSessionEvent {
  id: string;
  type: string;
  data: unknown;
  timestamp: number;
  offset: number;
}

export interface DurableSession {
  id: string;
  userId: string;
  events: DurableSessionEvent[];
  lastOffset: number;
  metadata: Record<string, unknown>;
  createdAt: number;
  lastActiveAt: number;
}

export interface DurableAITransport {
  createSession(userId: string, metadata?: Record<string, unknown>): DurableSession;
  getSession(sessionId: string): DurableSession | undefined;
  appendEvent(sessionId: string, type: string, data: unknown): DurableSessionEvent;
  replay(sessionId: string, fromOffset?: number): DurableSessionEvent[];
  getEventsSince(sessionId: string, offset: number): DurableSessionEvent[];
  switchDevice(sessionId: string, newDeviceId: string): boolean;
  disconnect(sessionId: string): void;
  reconnect(userId: string, deviceId: string): DurableSession | undefined;
}

export function createDurableAITransport(): DurableAITransport {
  const sessions = new Map<string, DurableSession>();
  const userSessions = new Map<string, string[]>();
  let eventCounter = 0;
  let sessionCounter = 0;

  function touch(session: DurableSession) {
    session.lastActiveAt = Date.now();
  }

  return {
    createSession(userId, metadata = {}) {
      const id = `dur-session-${++sessionCounter}`;
      const session: DurableSession = {
        id, userId, events: [], lastOffset: 0,
        metadata: { ...metadata, deviceId: metadata.deviceId ?? "unknown" },
        createdAt: Date.now(), lastActiveAt: Date.now(),
      };
      sessions.set(id, session);
      if (!userSessions.has(userId)) userSessions.set(userId, []);
      userSessions.get(userId)!.push(id);
      return { ...session, events: [] };
    },

    getSession(sessionId) {
      const s = sessions.get(sessionId);
      return s ? { ...s, events: [...s.events] } : undefined;
    },

    appendEvent(sessionId, type, data) {
      const session = sessions.get(sessionId);
      if (!session) throw new Error(`Session "${sessionId}" not found`);
      const event: DurableSessionEvent = {
        id: `evt-${++eventCounter}`,
        type, data, timestamp: Date.now(),
        offset: ++session.lastOffset,
      };
      session.events.push(event);
      touch(session);
      return { ...event };
    },

    replay(sessionId, fromOffset = 0) {
      const session = sessions.get(sessionId);
      if (!session) throw new Error(`Session "${sessionId}" not found`);
      touch(session);
      return session.events.filter((e) => e.offset > fromOffset).map((e) => ({ ...e }));
    },

    getEventsSince(sessionId, offset) {
      const session = sessions.get(sessionId);
      if (!session) return [];
      return session.events.filter((e) => e.offset > offset).map((e) => ({ ...e }));
    },

    switchDevice(sessionId, newDeviceId) {
      const session = sessions.get(sessionId);
      if (!session) return false;
      session.metadata.deviceId = newDeviceId;
      touch(session);
      return true;
    },

    disconnect(sessionId) {
      const session = sessions.get(sessionId);
      if (session) touch(session);
    },

    reconnect(userId, deviceId) {
      const ids = userSessions.get(userId);
      if (!ids || ids.length === 0) return undefined;
      const lastId = ids[ids.length - 1];
      const session = sessions.get(lastId);
      if (!session) return undefined;
      session.metadata.deviceId = deviceId;
      touch(session);
      return { ...session, events: [...session.events] };
    },
  };
}
