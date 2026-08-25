import type {
  FluxyChatClient,
  FluxyChatEvent,
  FluxyChatMessage,
  FluxyWebSocketConnectOptions,
} from "./index";
import {
  FluxyAuthError,
  FluxyConnectionError,
  FluxySendError,
  FluxyTimeoutError,
  FLUXY_WS_CLOSE_NORMAL,
  computeReconnectBackoffMs,
  mapWebSocketCloseToError,
} from "./errors";
import { dispatchInboundWsFrame } from "./ws-inbound";
import { isCapabilityRealtimeEvent } from "./capability-realtime";
import { isServerRealtimeEvent, type ServerEventHandler } from "./server-realtime";
import type { RoomEvent } from "./vertical-platform";
import { highestRoomSeq, resumeLogEventToClientEvent } from "./seq-resume";

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
  /** WS connect snapshot: `connect` uses `{ type: "replay" }` envelope; `off` skips server snapshot. */
  wsReplay?: FluxyWebSocketConnectOptions["replay"];
  /** Profile attached to presence (`presenceInfo` query on WS URL). */
  presenceInfo?: Record<string, unknown>;
  /** Pusher-style cache channel snapshot on connect. */
  wsCache?: FluxyWebSocketConnectOptions["cache"];
  /** Spectator WS: receive events, cannot send messages/tools/typing. */
  wsReadonly?: boolean;
  /** Delegate transport reconnect to partysocket (disables SDK reconnect scheduling). */
  usePartySocket?: boolean;
  /** Client ping interval in ms (default 25_000). Set 0 to disable. */
  heartbeatIntervalMs?: number;
  /** Force reconnect if no pong within this window (default 45_000). */
  heartbeatTimeoutMs?: number;
  /** Max queued outbound frames while socket is not OPEN (default 100). */
  maxOutboundQueue?: number;
  /** Drop queued frames older than this (default 5 min). */
  maxOutboundQueueAgeMs?: number;
  onAuthError?: (error: FluxyAuthError) => void;
  onConnectionError?: (error: Error) => void;
  onStatusChange?: (status: FluxyRoomConnectionStatus) => void;
  /** Called when max reconnect attempts are exhausted (not on auth failure). */
  onReconnectFailed?: () => void;
  /** Called when outbound queue drops frames (cap or age). */
  onOutboundQueueDrop?: (droppedCount: number) => void;
}

type MessageListener = (event: FluxyChatEvent) => void;
type AnyEventListener = (event: FluxyChatEvent) => void;

export interface FluxyWaitForOptions {
  timeout?: number;
}

interface WaitForEntry {
  predicate: (event: FluxyChatEvent) => boolean;
  resolve: (message: FluxyChatMessage) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

interface OutboundFrame {
  payload: Record<string, unknown>;
  enqueuedAt: number;
}

const SEEN_IDS_MAX = 10_000;
const DEFAULT_WAIT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_OUTBOUND_QUEUE = 100;
const DEFAULT_MAX_OUTBOUND_QUEUE_AGE_MS = 5 * 60_000;
const DEFAULT_HEARTBEAT_INTERVAL_MS = 25_000;
const DEFAULT_HEARTBEAT_TIMEOUT_MS = 45_000;
/** Application-defined close: heartbeat missed (triggers reconnect). */
export const FLUXY_WS_CLOSE_HEARTBEAT = 4000;

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
      | "heartbeatIntervalMs"
      | "heartbeatTimeoutMs"
      | "maxOutboundQueue"
      | "maxOutboundQueueAgeMs"
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
  private nextReconnectAtMs: number | null = null;
  private scheduledReconnectDelayMs = 0;
  private listeners: MessageListener[] = [];
  private anyListeners: AnyEventListener[] = [];
  private capabilityListeners: Array<(event: RoomEvent) => void> = [];
  private serverEventListeners: ServerEventHandler[] = [];
  private waitForEntries: WaitForEntry[] = [];
  private seenIds: number[] = [];
  private seenIdsSet = new Set<number>();
  private outboundQueue: OutboundFrame[] = [];
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private lastPongAtMs = 0;
  /** R6: visibilitychange listener while connected (browser only). */
  private visibilityHandler: (() => void) | null = null;
  private wsSnapshotReceived = false;
  /** Last applied character offset per in-flight stream message id. */
  streamOffsets: Record<string, number> = {};
  /** Highest room_message_events seq observed on this connection. */
  lastSeq = 0;

  constructor(client: FluxyChatClient, roomId: string, options: FluxyRoomConnectionOptions = {}) {
    this.client = client;
    this.roomId = roomId;
    this.options = {
      maxReconnectAttempts: options.maxReconnectAttempts ?? 8,
      baseBackoffMs: options.baseBackoffMs ?? 500,
      maxBackoffMs: options.maxBackoffMs ?? 20_000,
      replayHistoryOnReconnect: options.replayHistoryOnReconnect ?? true,
      historyLimit: options.historyLimit ?? 50,
      heartbeatIntervalMs: options.heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_INTERVAL_MS,
      heartbeatTimeoutMs: options.heartbeatTimeoutMs ?? DEFAULT_HEARTBEAT_TIMEOUT_MS,
      maxOutboundQueue: options.maxOutboundQueue ?? DEFAULT_MAX_OUTBOUND_QUEUE,
      maxOutboundQueueAgeMs: options.maxOutboundQueueAgeMs ?? DEFAULT_MAX_OUTBOUND_QUEUE_AGE_MS,
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

  /** Frames waiting to send while the socket is connecting or reconnecting. */
  getOutboundQueueDepth(): number {
    return this.outboundQueue.length;
  }

  /** When reconnecting, time of the next socket open attempt. */
  getNextReconnectAt(): Date | null {
    return this.nextReconnectAtMs != null ? new Date(this.nextReconnectAtMs) : null;
  }

  getScheduledReconnectDelayMs(): number {
    return this.scheduledReconnectDelayMs;
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

  /** Pusher-style `bind_global`: invoked for every inbound event (including `state_change`). */
  onAnyEvent(listener: AnyEventListener): void {
    this.anyListeners.push(listener);
  }

  offAnyEvent(listener: AnyEventListener): void {
    this.anyListeners = this.anyListeners.filter((cb) => cb !== listener);
  }

  /** Live vertical capability events broadcast by Worker DO fan-out. */
  onCapabilityEvent(handler: (event: RoomEvent) => void): () => void {
    this.capabilityListeners.push(handler);
    return () => {
      this.capabilityListeners = this.capabilityListeners.filter((cb) => cb !== handler);
    };
  }

  /** Labs/vertical server_event fan-out (game ticks, IoT readings, live stats, fleet GPS, polls). */
  onServerEvent(handler: ServerEventHandler): () => void {
    this.serverEventListeners.push(handler);
    return () => {
      this.serverEventListeners = this.serverEventListeners.filter((cb) => cb !== handler);
    };
  }

  connect(): void {
    this.intentionallyClosed = false;
    this.openSocket();
  }

  /**
   * Re-open the socket with the client's current credentials (after JWT refresh).
   * Preserves outbound queue and reconnect budget.
   */
  reconnectWithFreshCredentials(): void {
    if (this.intentionallyClosed) return;
    this.clearReconnectTimer();
    this.stopHeartbeat();
    if (this.ws) {
      try {
        this.ws.close(FLUXY_WS_CLOSE_NORMAL);
      } catch {
        /* ignore */
      }
      this.ws = null;
    }
    this.reconnectAttempt = 0;
    this.pendingHistoryReplay = true;
    this.openSocket();
  }

  noteStreamOffset(messageId: number | string, offset: number): void {
    const id = String(messageId);
    const next = Number(offset);
    if (!id || !Number.isFinite(next) || next < 0) return;
    this.streamOffsets[id] = next;
  }

  clearStreamOffset(messageId: number | string): void {
    delete this.streamOffsets[String(messageId)];
  }

  close(code = FLUXY_WS_CLOSE_NORMAL): void {
    this.intentionallyClosed = true;
    this.rejectAllWaitFor(new FluxySendError("Connection closed."));
    this.clearReconnectTimer();
    this.stopHeartbeat();
    this.detachVisibilityReporting();
    this.clearOutboundQueue();
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
    if (this.canSendImmediately()) {
      this.ws!.send(JSON.stringify(payload));
      return;
    }

    if (this.canQueueOutbound()) {
      this.enqueueOutbound(payload);
      return;
    }

    throw new FluxySendError(
      "Cannot send: WebSocket is not open. Call connect() and wait until connected.",
    );
  }

  /**
   * R6 presence-aware AI cost control: report tab visibility so the server can
   * skip speculative agent warmup / AI spend while the user cannot see it.
   * Fire-and-forget: silently ignored when disconnected (state is re-reported
   * on reconnect via visibilitychange or the next explicit call).
   */
  sendPresenceState(state: "active" | "background"): void {
    try {
      if (this.canSendImmediately()) {
        this.ws!.send(JSON.stringify({ type: "presence_state", state }));
      }
    } catch {
      /* never let telemetry break the connection */
    }
  }

  private attachVisibilityReporting(): void {
    if (typeof document === "undefined" || typeof document.addEventListener !== "function") {
      return; // non-browser runtime
    }
    if (this.visibilityHandler) return;
    this.visibilityHandler = () => {
      this.sendPresenceState(document.hidden ? "background" : "active");
    };
    document.addEventListener("visibilitychange", this.visibilityHandler);
  }

  private detachVisibilityReporting(): void {
    if (this.visibilityHandler && typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", this.visibilityHandler);
    }
    this.visibilityHandler = null;
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

  private canSendImmediately(): boolean {
    return Boolean(this.ws && this.ws.readyState === WebSocket.OPEN);
  }

  private canQueueOutbound(): boolean {
    return this.status === "connecting" || this.status === "reconnecting";
  }

  private enqueueOutbound(payload: Record<string, unknown>): void {
    const now = Date.now();
    this.pruneOutboundQueue(now);
    if (this.outboundQueue.length >= this.options.maxOutboundQueue) {
      const dropped = this.outboundQueue.shift();
      if (dropped) {
        this.options.onOutboundQueueDrop?.(1);
      }
    }
    this.outboundQueue.push({ payload, enqueuedAt: now });
  }

  private pruneOutboundQueue(now = Date.now()): void {
    const maxAge = this.options.maxOutboundQueueAgeMs;
    const before = this.outboundQueue.length;
    this.outboundQueue = this.outboundQueue.filter((frame) => now - frame.enqueuedAt <= maxAge);
    const dropped = before - this.outboundQueue.length;
    if (dropped > 0) {
      this.options.onOutboundQueueDrop?.(dropped);
    }
  }

  private flushOutboundQueue(): void {
    if (!this.canSendImmediately()) return;
    this.pruneOutboundQueue();
    while (this.outboundQueue.length > 0 && this.canSendImmediately()) {
      const frame = this.outboundQueue.shift()!;
      this.ws!.send(JSON.stringify(frame.payload));
    }
  }

  private clearOutboundQueue(): void {
    this.outboundQueue = [];
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
    const previous = this.status;
    this.status = next;
    if (next === "connected") {
      this.nextReconnectAtMs = null;
      this.scheduledReconnectDelayMs = 0;
    }
    this.options.onStatusChange?.(next);
    this.emitAnyOnly({
      type: "state_change",
      roomId: this.roomId,
      previous,
      current: next,
    });
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    const intervalMs = this.options.heartbeatIntervalMs;
    if (intervalMs <= 0) return;

    this.lastPongAtMs = Date.now();
    this.heartbeatTimer = setInterval(() => {
      if (!this.canSendImmediately()) return;

      const timeoutMs = this.options.heartbeatTimeoutMs;
      if (timeoutMs > 0 && Date.now() - this.lastPongAtMs > timeoutMs) {
        try {
          this.ws?.close(FLUXY_WS_CLOSE_HEARTBEAT, "heartbeat_timeout");
        } catch {
          /* ignore */
        }
        return;
      }

      try {
        this.ws!.send(JSON.stringify({ type: "ping" }));
      } catch {
        /* ignore */
      }
    }, intervalMs);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private bumpLastSeq(value: unknown): void {
    const next = highestRoomSeq(value);
    if (next > this.lastSeq) this.lastSeq = next;
  }

  private handleInboundRaw(raw: string): void {
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(raw) as unknown;
      this.bumpLastSeq(parsed);
      if (isCapabilityRealtimeEvent(parsed)) {
        for (const listener of this.capabilityListeners) {
          listener(parsed.event);
        }
      }
      if (isServerRealtimeEvent(parsed)) {
        for (const listener of this.serverEventListeners) {
          listener({
            roomId: parsed.roomId,
            name: parsed.name,
            data: parsed.data,
            userId: parsed.userId,
          });
        }
      }
    } catch {
      /* not json */
    }

    dispatchInboundWsFrame(raw, {
      onPong: () => {
        this.lastPongAtMs = Date.now();
      },
      onReplay: (messages) => {
        this.wsSnapshotReceived = true;
        this.deliver({ type: "history", messages });
      },
      onHistoryMarker: () => {
        this.wsSnapshotReceived = true;
      },
      onWorkerError: (message) => {
        // eslint-disable-next-line no-console
        console.error("[fluxychat] worker error:", message);
      },
      onDeliver: (event) => {
        this.deliver(event);
      },
      onUnknownFrame: (frame) => {
        this.emitAnyOnly(frame as FluxyChatEvent);
      },
    });

    if (
      parsed != null &&
      typeof parsed === "object" &&
      (parsed as { type?: string }).type === "replay" &&
      Array.isArray((parsed as { events?: unknown[] }).events)
    ) {
      for (const event of (parsed as { events: unknown[] }).events) {
        const framed = resumeLogEventToClientEvent(event);
        if (framed) this.deliver(framed as FluxyChatEvent);
      }
    }
  }

  private openSocket(): void {
    this.clearReconnectTimer();
    this.setStatus(
      this.hasConnectedOnce && this.reconnectAttempt > 0 ? "reconnecting" : "connecting",
    );

    const wsConnect: FluxyWebSocketConnectOptions = {
      replay: this.options.wsReplay ?? "connect",
      replayLimit: this.options.historyLimit,
      presenceInfo: this.options.presenceInfo,
      cache: this.options.wsCache,
      readonly: this.options.wsReadonly,
    };
    if (this.options.wsReplay === "off") {
      wsConnect.replay = "off";
    }
    const ws = this.client.connect(this.roomId, wsConnect);
    this.ws = ws;
    this.wsSnapshotReceived = false;

    ws.addEventListener("open", () => {
      const isReconnect = this.hasConnectedOnce;
      this.hasConnectedOnce = true;
      this.reconnectAttempt = 0;
      this.lastError = null;
      this.setStatus("connected");
      this.startHeartbeat();
      if (!this.options.wsReadonly) {
        this.attachVisibilityReporting();
        if (typeof document !== "undefined") {
          this.sendPresenceState(document.hidden ? "background" : "active");
        }
      }
      this.flushOutboundQueue();
      if (isReconnect) {
        this.sendJson({
          type: "resume",
          lastSeq: this.lastSeq,
          streamOffsets: { ...this.streamOffsets },
        });
      }
      const needsRestReplay =
        this.pendingHistoryReplay && this.options.replayHistoryOnReconnect;
      this.pendingHistoryReplay = false;
      if (needsRestReplay) {
        queueMicrotask(() => {
          if (!this.wsSnapshotReceived) {
            void this.replayHistory();
          }
        });
      }
    });

    ws.addEventListener("message", (event) => {
      this.handleInboundRaw(String(event.data));
    });

    ws.addEventListener("close", (event) => {
      this.ws = null;
      this.stopHeartbeat();
      if (this.intentionallyClosed) {
        this.setStatus("disconnected");
        return;
      }

      const mapped = mapWebSocketCloseToError(event.code, event.reason || "");
      if (mapped instanceof FluxyAuthError) {
        this.lastError = mapped;
        this.clearOutboundQueue();
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

      if (this.options.usePartySocket) {
        this.setStatus("reconnecting");
        return;
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
    this.scheduledReconnectDelayMs = delay;
    this.nextReconnectAtMs = Date.now() + delay;
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

    for (const listener of this.anyListeners) {
      try {
        listener(event);
      } catch {
        /* ignore */
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

  private emitAnyOnly(event: FluxyChatEvent): void {
    for (const listener of this.anyListeners) {
      try {
        listener(event);
      } catch {
        /* ignore */
      }
    }
  }
}
