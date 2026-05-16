import type { FluxyChatEvent } from "./index";
import type { FluxyChatRoomConnection } from "./room-connection";
import { FluxySendError } from "./errors";

const DEFAULT_FLUSH_MS = 120;

export interface FluxyMessageStreamOptions {
  /** Min interval between delta frames (default 120ms). */
  flushIntervalMs?: number;
  parentId?: number | null;
}

/**
 * Streams text into a single persisted room message (Worker `type: "stream"`).
 * Throttles DB writes; clients receive `message` + `edit` events with `streaming: true|false`.
 */
export class FluxyMessageStream {
  private readonly connection: FluxyChatRoomConnection;
  private readonly agentId: string;
  private readonly flushIntervalMs: number;
  private readonly parentId: number | null;

  private buffer = "";
  private messageId: number | null = null;
  private closed = false;
  private started = false;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private lastFlushMs = 0;
  private captureBound = false;

  constructor(
    connection: FluxyChatRoomConnection,
    agentId: string,
    options: FluxyMessageStreamOptions = {},
  ) {
    this.connection = connection;
    this.agentId = agentId;
    this.flushIntervalMs = options.flushIntervalMs ?? DEFAULT_FLUSH_MS;
    this.parentId = options.parentId ?? null;
  }

  get activeMessageId(): number | null {
    return this.messageId;
  }

  push(chunk: string): void {
    this.assertOpen("push");
    if (!chunk) return;
    this.bindCapture();
    this.buffer += chunk;

    if (!this.started) {
      this.started = true;
      this.connection.sendJson({
        type: "stream",
        op: "start",
        userId: this.agentId,
        content: this.buffer,
        parentId: this.parentId,
      });
    }

    this.scheduleFlush();
  }

  end(): void {
    this.assertOpen("end");
    this.closed = true;
    this.clearFlushTimer();
    if (!this.started) return;
    void this.flush(true);
  }

  abort(): void {
    if (this.closed) return;
    this.closed = true;
    this.clearFlushTimer();
    if (!this.messageId) return;
    try {
      this.connection.sendJson({
        type: "stream",
        op: "abort",
        userId: this.agentId,
        messageId: this.messageId,
      });
    } catch {
      /* socket closed */
    }
    this.messageId = null;
    this.buffer = "";
  }

  private bindCapture(): void {
    if (this.captureBound) return;
    this.captureBound = true;
    this.connection.addEventListener("message", (event: FluxyChatEvent) => {
      if (this.messageId) return;
      if (event.type === "stream" && event.op === "started") {
        this.messageId = event.id;
        return;
      }
      if (
        event.type === "message" &&
        event.streaming &&
        event.userId === this.agentId &&
        Number.isFinite(event.id)
      ) {
        this.messageId = event.id;
      }
    });
  }

  private scheduleFlush(): void {
    if (this.closed) return;
    const elapsed = Date.now() - this.lastFlushMs;
    if (elapsed >= this.flushIntervalMs) {
      void this.flush(false);
      return;
    }
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      void this.flush(false);
    }, this.flushIntervalMs - elapsed);
  }

  private async flush(isFinal: boolean): Promise<void> {
    if (!this.started) return;

    const id = await this.resolveMessageId(isFinal);
    if (!id) return;

    try {
      this.connection.sendJson({
        type: "stream",
        op: isFinal ? "end" : "delta",
        userId: this.agentId,
        messageId: id,
        content: this.buffer,
      });
      this.lastFlushMs = Date.now();
    } catch {
      /* socket closed */
    }

    if (isFinal) {
      this.buffer = "";
      this.messageId = null;
      this.started = false;
    }
  }

  private async resolveMessageId(isFinal: boolean): Promise<number | null> {
    if (this.messageId) return this.messageId;
    const deadline = Date.now() + (isFinal ? 3000 : 500);
    while (!this.messageId && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    return this.messageId;
  }

  private clearFlushTimer(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
  }

  private assertOpen(op: string): void {
    if (this.closed) {
      throw new FluxySendError(`Cannot call ${op}() on a closed FluxyMessageStream.`);
    }
  }
}
