import type { FluxyChatClient, FluxyChatEvent, FluxyChatMessage } from "./index";
import {
  FluxyAuthError,
  FluxyConnectionError,
  FluxySendError,
  FluxyTimeoutError,
  FLUXY_WS_CLOSE_NORMAL,
  computeReconnectBackoffMs,
  mapWebSocketCloseToError,
} from "./errors";

export type FluxyRoomConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected";

export interface FluxyRoomConnectionOptions {
  /** Max reconnect tries before staying disconnected (default 8). */
  maxReconnectAttempts?: number;
  /** First backoff step in ms (default 500). */
  baseBackoffMs?: number;
  /** Backoff cap in ms (default 20_000). */
  maxBackoffMs?: number;
  /** Refetch REST history after each successful reconnect (default true). */
  replayHistoryOnReconnect?: boolean;
  historyLimit?: number;
  onAuthError?: (error: FluxyAuthError) => void;
  onConnectionError?: (error: Error) => void;
  onStatusChange?: (status: FluxyRoomConnectionStatus) => void;
  /** Called when max reconnect attempts are exhausted (not on auth failure). */
  onReconnectFailed?: () => void;
}

type MessageListener = (event: FluxyChatEvent) => void;

export interface FluxyWaitForOptions {
  timeout?: number;
}

interface WaitForEntry {
  predicate: (event: FluxyChatEvent) => boolean;
  resolve: (message: FluxyChatMessage) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

const SEEN_IDS_MAX = 10_000;
const DEFAULT_WAIT_TIMEOUT_MS = 30_000;

export class FluxyChatRoomConnection {
  private readonly client: FluxyChatClient;
  private readonly roomId: string;
  private readonly options: Required<
    Pick<
      FluxyRoomConnectionOptions,
      | "maxReconnectAttempts"
      | "baseBackoffMs"
      | "maxBackoffMs"
      | "replayHistoryOnReconnect"
      | "historyLimit"
    >
  > &
    FluxyRoomConnectionOptions;

  private ws: WebSocket | null = null;
  private status: FluxyRoomConnectionStatus = "idle";
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionallyClosed = false;
  private hasConnectedOnce = false;
  private pendingHistoryReplay = false;
  private lastError: Error | null = null;
  private listeners: MessageListener[] = [];
  private waitForEntries: WaitForEntry[] = [];
  private seenIds: number[] = [];
  private seenIdsSet = new Set<number>();

  constructor(client: FluxyChatClient, roomId: string, options: FluxyRoomConnectionOptions = {}) {
    this.client = client;
    this.roomId = roomId;
    this.options = {
      maxReconnectAttempts: options.maxReconnectAttempts ?? 8,
      baseBackoffMs: options.baseBackoffMs ?? 500,
      maxBackoffMs: options.maxBackoffMs ?? 20_000,
      replayHistoryOnReconnect: options.replayHistoryOnReconnect ?? true,
      historyLimit: options.historyLimit ?? 50,
      ...options,
    };
  }

  get connectionStatus(): FluxyRoomConnectionStatus {
    return this.status;
  }

  get reconnectAttempts(): number {
    return this.reconnectAttempt;
  }

  getLastError(): Error | null {
    return this.lastError;
  }

  get readyState(): number {
    return this.ws?.readyState ?? WebSocket.CLOSED;
  }

  addEventListener(_type: "message", listener: MessageListener): void {
    this.listeners.push(listener);
  }

  removeEventListener(_type: "message", listener: MessageListener): void {
    this.listeners = this.listeners.filter((cb) => cb !== listener);
  }

  connect(): void {
    this.intentionallyClosed = false;
    this.openSocket();
  }

  close(code = FLUXY_WS_CLOSE_NORMAL): void {
    this.intentionallyClosed = true;
    this.rejectAllWaitFor(new FluxySendError("Connection closed."));
    this.clearReconnectTimer();
    if (this.ws) {
      try {
        this.ws.close(code);
      } catch {
        /* ignore */
      }
      this.ws = null;
    }
    this.setStatus("disconnected");
  }

  sendJson(payload: Record<string, unknown>): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new FluxySendError();
    }
    this.ws.send(JSON.stringify(payload));
  }

  /**
   * Resolves when an incoming event matches `predicate` (typically a `message` event).
   */
  waitFor(
    predicate: (event: FluxyChatEvent) => boolean,
    options: FluxyWaitForOptions = {},
  ): Promise<FluxyChatMessage> {
    const timeoutMs = options.timeout ?? DEFAULT_WAIT_TIMEOUT_MS;
    if (this.status !== "connected") {
      return Promise.reject(
        new FluxySendError("waitFor requires an open connection. Call connect() and wait until connected."),
      );
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waitForEntries = this.waitForEntries.filter((entry) => entry.timer !== timer);
        reject(new FluxyTimeoutError(timeoutMs));
      }, timeoutMs);

      this.waitForEntries.push({
        predicate,
        resolve,
        reject,
        timer,
      });
    });
  }

  private rejectAllWaitFor(error: Error): void {
    const entries = [...this.waitForEntries];
    this.waitForEntries = [];
    for (const entry of entries) {
      clearTimeout(entry.timer);
      entry.reject(error);
    }
  }

  private setStatus(next: FluxyRoomConnectionStatus): void {
    if (this.status === next) return;
    this.status = next;
    this.options.onStatusChange?.(next);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private openSocket(): void {
    this.clearReconnectTimer();
    this.setStatus(
      this.hasConnectedOnce && this.reconnectAttempt > 0 ? "reconnecting" : "connecting",
    );

    const ws = this.client.connect(this.roomId);
    this.ws = ws;

    ws.addEventListener("open", () => {
      this.hasConnectedOnce = true;
      this.reconnectAttempt = 0;
      this.lastError = null;
      this.setStatus("connected");
      if (this.pendingHistoryReplay && this.options.replayHistoryOnReconnect) {
        void this.replayHistory();
      }
      this.pendingHistoryReplay = false;
    });

    ws.addEventListener("message", (event) => {
      let data: FluxyChatEvent;
      try {
        data = JSON.parse(String(event.data)) as FluxyChatEvent;
      } catch {
        return;
      }
      if (data.type === "error") {
        // eslint-disable-next-line no-console
        console.error("[fluxychat] worker error:", data.message);
      }
      this.deliver(data);
    });

    ws.addEventListener("close", (event) => {
      this.ws = null;
      if (this.intentionallyClosed) {
        this.setStatus("disconnected");
        return;
      }

      const mapped = mapWebSocketCloseToError(event.code, event.reason || "");
      if (mapped instanceof FluxyAuthError) {
        this.lastError = mapped;
        this.options.onAuthError?.(mapped);
        this.options.onConnectionError?.(mapped);
        this.rejectAllWaitFor(mapped);
        this.setStatus("disconnected");
        return;
      }

      if (mapped) {
        this.lastError = mapped;
        this.options.onConnectionError?.(mapped);
      }

      this.scheduleReconnect();
    });
  }

  private scheduleReconnect(): void {
    this.pendingHistoryReplay = true;
    this.reconnectAttempt += 1;
    if (this.reconnectAttempt > this.options.maxReconnectAttempts) {
      this.setStatus("disconnected");
      this.rejectAllWaitFor(
        new FluxyConnectionError(0, "reconnect_failed", "WebSocket reconnect attempts exhausted."),
      );
      this.options.onReconnectFailed?.();
      return;
    }

    this.setStatus("reconnecting");
    const delay = computeReconnectBackoffMs(
      this.reconnectAttempt,
      this.options.baseBackoffMs,
      this.options.maxBackoffMs,
    );
    this.clearReconnectTimer();
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.intentionallyClosed) {
        this.openSocket();
      }
    }, delay);
  }

  private async replayHistory(): Promise<void> {
    try {
      const messages = await this.client.fetchMessages(this.roomId, this.options.historyLimit);
      this.deliver({ type: "history", messages });
    } catch {
      /* history replay is best-effort */
    }
  }

  private trackMessageId(id: number): void {
    if (!Number.isFinite(id) || this.seenIdsSet.has(id)) return;
    if (this.seenIds.length >= SEEN_IDS_MAX) {
      const evicted = this.seenIds.shift();
      if (evicted !== undefined) this.seenIdsSet.delete(evicted);
    }
    this.seenIds.push(id);
    this.seenIdsSet.add(id);
  }

  private deliver(event: FluxyChatEvent): void {
    if (event.type === "history") {
      this.seenIds = [];
      this.seenIdsSet.clear();
      for (const msg of event.messages) {
        if (Number.isFinite(msg.id)) this.trackMessageId(msg.id);
      }
    } else if (event.type === "message" && Number.isFinite(event.id)) {
      if (this.seenIdsSet.has(event.id) && !event.streaming) return;
      this.trackMessageId(event.id);
    }

    const satisfied: WaitForEntry[] = [];
    for (const entry of this.waitForEntries) {
      if (entry.predicate(event)) {
        satisfied.push(entry);
      }
    }
    if (satisfied.length > 0) {
      this.waitForEntries = this.waitForEntries.filter((entry) => !satisfied.includes(entry));
      for (const entry of satisfied) {
        clearTimeout(entry.timer);
        if (event.type === "message") {
          entry.resolve(event);
        } else {
          entry.reject(new Error(`waitFor matched non-message event type "${event.type}"`));
        }
      }
    }

    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        /* listener errors must not break the connection */
      }
    }
  }
}
