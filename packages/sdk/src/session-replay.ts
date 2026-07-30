export type RedactionLevel = "none" | "metadata_only" | "content_safe" | "full";

export interface RedactionRule {
  pattern: string;
  replacement: string;
  applyTo: ("content" | "metadata" | "participant")[];
}

export interface ReplaySession {
  sessionId: string;
  originalId: string;
  timeline: ReplayEvent[];
  redactionLevel: RedactionLevel;
  consent: { recording: boolean; playback: boolean; retentionDays: number };
  createdAt: string;
  expiresAt: string;
}

export interface ReplayEvent {
  eventId: string;
  type: string;
  data: Record<string, unknown>;
  redacted: boolean;
  timestamp: string;
}

export interface ReplayProtocol {
  protocolVersion: string;
  events: ReplayEvent[];
  sessionId: string;
  checksum: string;
}

export interface SessionReplayManager {
  createReplaySession(originalId: string, redactionLevel: RedactionLevel, retentionDays: number): ReplaySession;
  recordEvent(sessionId: string, type: string, data: Record<string, unknown>): ReplayEvent;
  redactSession(sessionId: string, rules?: RedactionRule[]): ReplaySession;
  getSession(sessionId: string): ReplaySession | null;
  exportProtocol(sessionId: string): ReplayProtocol;
  setConsent(sessionId: string, recording: boolean, playback: boolean): void;
  deleteSession(sessionId: string): void;
}

function generateChecksum(events: ReplayEvent[], sessionId: string): string {
  let hash = 0;
  const input = sessionId + events.length;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash) + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, "0");
}

const DEFAULT_REDACTION_RULES: RedactionRule[] = [
  { pattern: "\\b\\d{3}-\\d{2}-\\d{4}\\b", replacement: "[SSN]", applyTo: ["content"] },
  { pattern: "\\b[\\w.-]+@[\\w.-]+\\.\\w{2,}\\b", replacement: "[EMAIL]", applyTo: ["content"] },
  { pattern: "\\b\\d{4}[ -]?\\d{4}[ -]?\\d{4}[ -]?\\d{4}\\b", replacement: "[CC]", applyTo: ["content"] },
];

export function createSessionReplayManager(): SessionReplayManager {
  const sessions = new Map<string, ReplaySession>();

  return {
    createReplaySession(originalId: string, redactionLevel: RedactionLevel, retentionDays: number): ReplaySession {
      const id = `replay-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const now = Date.now();
      const session: ReplaySession = {
        sessionId: id,
        originalId,
        timeline: [],
        redactionLevel,
        consent: { recording: true, playback: false, retentionDays },
        createdAt: new Date(now).toISOString(),
        expiresAt: new Date(now + retentionDays * 86400000).toISOString(),
      };
      sessions.set(id, session);
      return session;
    },

    recordEvent(sessionId: string, type: string, data: Record<string, unknown>): ReplayEvent {
      const session = sessions.get(sessionId);
      if (!session) throw new Error(`Session ${sessionId} not found.`);
      if (!session.consent.recording) throw new Error("Recording consent not granted.");

      const event: ReplayEvent = {
        eventId: `evt-${session.timeline.length + 1}`,
        type,
        data: { ...data },
        redacted: session.redactionLevel !== "none",
        timestamp: new Date().toISOString(),
      };

      session.timeline.push(event);
      return event;
    },

    redactSession(sessionId: string, rules: RedactionRule[] = DEFAULT_REDACTION_RULES): ReplaySession {
      const session = sessions.get(sessionId);
      if (!session) throw new Error(`Session ${sessionId} not found.`);

      for (const event of session.timeline) {
        if (!event.redacted) continue;
        for (const rule of rules) {
          for (const target of rule.applyTo) {
            if (target === "content" && typeof event.data.text === "string") {
              try {
                event.data.text = (event.data.text as string).replace(new RegExp(rule.pattern, "g"), rule.replacement);
              } catch { continue; }
            }
          }
        }
        event.redacted = true;
      }

      session.redactionLevel = "content_safe";
      return session;
    },

    getSession(sessionId: string) { return sessions.get(sessionId) ?? null; },

    exportProtocol(sessionId: string): ReplayProtocol {
      const session = sessions.get(sessionId);
      if (!session) throw new Error(`Session ${sessionId} not found.`);

      return {
        protocolVersion: "1.0",
        events: [...session.timeline],
        sessionId,
        checksum: generateChecksum(session.timeline, sessionId),
      };
    },

    setConsent(sessionId: string, recording: boolean, playback: boolean): void {
      const session = sessions.get(sessionId);
      if (!session) throw new Error(`Session ${sessionId} not found.`);
      session.consent.recording = recording;
      session.consent.playback = playback;
    },

    deleteSession(sessionId: string): void {
      sessions.delete(sessionId);
    },
  };
}
