export type ChannelType = "web" | "mobile" | "voice" | "bot" | "email" | "sms";

export interface ChannelIdentity {
  channel: ChannelType;
  externalId: string;
  displayName?: string;
}

export interface CrossChannelSession {
  id: string;
  userId: string;
  identities: ChannelIdentity[];
  activeChannel: ChannelType;
  metadata: Record<string, unknown>;
  createdAt: number;
  lastActivityAt: number;
}

export interface CrossChannelContinuity {
  getSession(sessionId: string): CrossChannelSession | undefined;
  getSessionByUser(userId: string): CrossChannelSession | undefined;
  createSession(userId: string, initialIdentity: ChannelIdentity): CrossChannelSession;
  linkIdentity(sessionId: string, identity: ChannelIdentity): CrossChannelSession;
  unlinkIdentity(sessionId: string, channel: ChannelType): CrossChannelSession;
  switchChannel(sessionId: string, channel: ChannelType): CrossChannelSession;
  getLinkedSessions(identity: ChannelIdentity): CrossChannelSession[];
  shareContext(fromSessionId: string, toSessionId: string, keys?: string[]): void;
}

export function createCrossChannelContinuity(): CrossChannelContinuity {
  const sessions = new Map<string, CrossChannelSession>();
  const identityIndex = new Map<string, Set<string>>();
  let sessionCounter = 0;

  function identityKey(identity: ChannelIdentity) {
    return `${identity.channel}:${identity.externalId}`;
  }

  function indexIdentity(sessionId: string, identity: ChannelIdentity) {
    const key = identityKey(identity);
    if (!identityIndex.has(key)) identityIndex.set(key, new Set());
    identityIndex.get(key)!.add(sessionId);
  }

  function unindexIdentity(sessionId: string, channel: ChannelType) {
    for (const [key, ids] of identityIndex) {
      if (key.startsWith(`${channel}:`) && ids.has(sessionId)) {
        ids.delete(sessionId);
        if (ids.size === 0) identityIndex.delete(key);
      }
    }
  }

  return {
    getSession(sessionId) {
      const s = sessions.get(sessionId);
      return s ? { ...s } : undefined;
    },

    getSessionByUser(userId) {
      const s = Array.from(sessions.values()).find((s) => s.userId === userId);
      return s ? { ...s } : undefined;
    },

    createSession(userId, initialIdentity) {
      const id = `session-${++sessionCounter}`;
      const session: CrossChannelSession = {
        id,
        userId,
        identities: [initialIdentity],
        activeChannel: initialIdentity.channel,
        metadata: {},
        createdAt: Date.now(),
        lastActivityAt: Date.now(),
      };
      sessions.set(id, session);
      indexIdentity(id, initialIdentity);
      return { ...session };
    },

    linkIdentity(sessionId, identity) {
      const session = sessions.get(sessionId);
      if (!session) throw new Error(`Session "${sessionId}" not found`);
      if (!session.identities.find((i) => identityKey(i) === identityKey(identity))) {
        session.identities.push(identity);
      }
      indexIdentity(sessionId, identity);
      session.lastActivityAt = Date.now();
      return { ...session };
    },

    unlinkIdentity(sessionId, channel) {
      const session = sessions.get(sessionId);
      if (!session) throw new Error(`Session "${sessionId}" not found`);
      session.identities = session.identities.filter((i) => i.channel !== channel);
      if (session.identities.length === 0) {
        sessions.delete(sessionId);
        throw new Error("Session deleted: no remaining identities");
      }
      if (session.activeChannel === channel) {
        session.activeChannel = session.identities[0].channel;
      }
      unindexIdentity(sessionId, channel);
      session.lastActivityAt = Date.now();
      return { ...session };
    },

    switchChannel(sessionId, channel) {
      const session = sessions.get(sessionId);
      if (!session) throw new Error(`Session "${sessionId}" not found`);
      if (!session.identities.find((i) => i.channel === channel)) {
        throw new Error(`No identity for channel "${channel}"`);
      }
      session.activeChannel = channel;
      session.lastActivityAt = Date.now();
      return { ...session };
    },

    getLinkedSessions(identity) {
      const ids = identityIndex.get(identityKey(identity));
      if (!ids) return [];
      return Array.from(ids).map((sid) => ({ ...sessions.get(sid)! }));
    },

    shareContext(fromSessionId, toSessionId, keys?: string[]) {
      const from = sessions.get(fromSessionId);
      const to = sessions.get(toSessionId);
      if (!from || !to) throw new Error("Session not found");
      if (keys) {
        for (const key of keys) {
          if (key in from.metadata) to.metadata[key] = from.metadata[key];
        }
      } else {
        Object.assign(to.metadata, from.metadata);
      }
    },
  };
}
