import { FluxySendError } from './errors';
import type { FluxyRoomConnection } from './room-connection';

const DEFAULT_FLUSH_MS = 120;

export interface FluxyMessageStreamOptions {
  flushIntervalMs?: number;
  parentId?: number | null;
}

export class FluxyMessageStream {
  private readonly connection: FluxyRoomConnection;
  private readonly agentId: string;
  private readonly flushIntervalMs: number;
  private readonly parentId: number | null;
  private buffer = "";
  private messageId: number | null = null;
  private closed = false;
  private started = false;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private lastFlushMs = 0;

  constructor(connection: FluxyRoomConnection, agentId: string, options: FluxyMessageStreamOptions = {}) {
    this.connection = connection;
    this.agentId = agentId;
    this.flushIntervalMs = options.flushIntervalMs ?? DEFAULT_FLUSH_MS;
    this.parentId = options.parentId ?? null;
  }

  get activeMessageId(): number | null { return this.messageId; }

  push(chunk: string): void {
    this.assertOpen("push");
    if (!chunk) return;
    this.buffer += chunk;
    if (!this.started) {
      this.started = true;
      this.connection.sendJson({ type: "stream", op: "start", userId: this.agentId, content: this.buffer, parentId: this.parentId });
    }
    this.scheduleFlush();
  }

  end(): void {
    this.assertOpen("end");
    this.closed = true;
    this.clearFlushTimer();
    if (!this.started) return;
    this.flush(true);
  }

  abort(): void {
    if (this.closed) return;
    this.closed = true;
    this.clearFlushTimer();
    if (!this.messageId) return;
    try { this.connection.sendJson({ type: "stream", op: "abort", userId: this.agentId, messageId: this.messageId }); } catch {}
    this.messageId = null;
    this.buffer = "";
  }

  private scheduleFlush(): void {
    if (this.closed) return;
    const elapsed = Date.now() - this.lastFlushMs;
    if (elapsed >= this.flushIntervalMs) { this.flush(false); return; }
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => { this.flushTimer = null; this.flush(false); }, this.flushIntervalMs - elapsed);
  }

  private flush(isFinal: boolean): void {
    if (!this.started || this.messageId == null) return;
    try {
      this.connection.sendJson({ type: "stream", op: isFinal ? "end" : "delta", userId: this.agentId, messageId: this.messageId, content: this.buffer });
      this.lastFlushMs = Date.now();
    } catch {}
    if (isFinal) { this.buffer = ""; this.messageId = null; this.started = false; }
  }

  private clearFlushTimer(): void { if (this.flushTimer) { clearTimeout(this.flushTimer); this.flushTimer = null; } }
  private assertOpen(op: string): void { if (this.closed) throw new FluxySendError(`Cannot call ${op}() on a closed FluxyMessageStream.`); }
}
