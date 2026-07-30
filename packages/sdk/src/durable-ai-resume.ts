import { createDurableTransport, type DurableTransportApi, type StreamChunkEntry } from "./durable-transport.js";

export interface ResumableAgentStreamOptions {
  /** Local in-memory transport (default). Pass for tests or offline-first mobile. */
  transport?: DurableTransportApi;
  deviceId: string;
  sessionId?: string;
  lastKnownOffset?: number;
  metadata?: Record<string, unknown>;
  /** Worker resume API — optional cloud-backed continuity. */
  worker?: {
    baseUrl: string;
    token: string;
    streamId?: string;
  };
}

export interface ResumableAgentStream {
  sessionId: string;
  offset: number;
  appendText(text: string): Promise<number>;
  reconnect(): Promise<{ missedChunks: StreamChunkEntry[]; offset: number }>;
  getMissedSince(fromOffset: number): StreamChunkEntry[];
  close(): void;
}

function createDeviceId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `device_${crypto.randomUUID().slice(0, 12)}`;
  }
  return `device_${Date.now()}`;
}

export function createResumableAgentStream(options: ResumableAgentStreamOptions): ResumableAgentStream {
  const transport = options.transport ?? createDurableTransport();
  const deviceId = options.deviceId || createDeviceId();

  let sessionId = options.sessionId;
  let offset = options.lastKnownOffset ?? -1;

  if (sessionId) {
    const existing = transport.getSession(sessionId);
    if (existing && options.lastKnownOffset != null) {
      const reconnected = transport.reconnect(sessionId, deviceId, options.lastKnownOffset);
      if (reconnected) {
        offset = reconnected.session.state.offset - 1;
      }
    }
  }

  if (!sessionId) {
    const created = transport.createSession(deviceId, options.metadata);
    sessionId = created.id;
    offset = -1;
  }

  const sid = sessionId;

  return {
    sessionId: sid,
    get offset() {
      const session = transport.getSession(sid);
      return session ? session.state.offset - 1 : offset;
    },

    async appendText(text: string) {
      const next = transport.appendChunk(sid, text);
      if (next >= 0) {
        offset = next;
        if (options.worker?.baseUrl && options.worker.token) {
          const streamId = options.worker.streamId ?? sid;
          try {
            await fetch(`${options.worker.baseUrl.replace(/\/$/, "")}/ai/streams/${encodeURIComponent(streamId)}/chunk`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${options.worker.token}`,
              },
              body: JSON.stringify({ text, offset: next, sessionId: sid }),
            });
          } catch {
            // Best-effort — local transport remains source of truth for UI.
          }
        }
      }
      return next;
    },

    async reconnect() {
      const result = transport.reconnect(sid, deviceId, offset);
      if (!result) {
        return { missedChunks: [], offset };
      }
      offset = result.session.state.offset - 1;

      if (options.worker?.baseUrl && options.worker.token) {
        const streamId = options.worker.streamId ?? sid;
        try {
          const res = await fetch(
            `${options.worker.baseUrl.replace(/\/$/, "")}/ai/streams/${encodeURIComponent(streamId)}/resume`,
            {
              headers: { Authorization: `Bearer ${options.worker.token}` },
            },
          );
          if (res.ok) {
            const body = (await res.json()) as { content?: string; fromOffset?: number };
            if (body.content && body.content.length > 0) {
              result.missedChunks.push({
                offset: body.fromOffset ?? offset + 1,
                data: body.content,
                timestamp: new Date().toISOString(),
              });
            }
          }
        } catch {
          // Local missed chunks still apply.
        }
      }

      return { missedChunks: result.missedChunks, offset };
    },

    getMissedSince(fromOffset: number) {
      return transport.getChunks(sid, fromOffset + 1);
    },

    close() {
      transport.closeSession(sid);
    },
  };
}
