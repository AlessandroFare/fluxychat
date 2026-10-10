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
import { buildPresencePatchOutbound, type FluxyPresence } from "./presence-patch";
import { FLUXY_ERROR_CODES } from "@fluxy-chat/protocol";
import { resumeLogEventToClientEvent } from "./seq-resume";
import { FluxyResumeGapWalker } from "./resume-gap";
import {
  occupancyFromEvent,
  occupancyFromLive,
  type FluxyOccupancyData,
} from "./occupancy";
import { buildCursorOutbound, parseLiveCursorEvent, type LiveCursor, type LiveCursorPublishInput } from "./live-cursors";
import { FLUXY_LEAVER_TTL_MS } from "./presence-avatars";

export type FluxyRoomConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "suspended"
  | "failed"
  | "disconnected";

const ROOM_OPTION_FINGERPRINT_SKIP = new Set([
  "onAuthError",
  "onConnectionError",
  "onStatusChange",
  "onReconnectFailed",
  "onOutboundQueueDrop",
]);

export function fingerprintRoomOptions(options?: FluxyRoomConnectionOptions): string | null {
  if (!options) return null;
  const entries = Object.entries(options)
    .filter(([key, value]) => value !== undefined && !ROOM_OPTION_FINGERPRINT_SKIP.has(key))
    .sort(([left], [right]) => left.localeCompare(right));
  if (entries.length === 0) return null;
  return JSON.stringify(Object.fromEntries(entries));
}

export interface FluxyRoomConnectionOptions {
  /** Max reconnect tries before `failed` (default 8). */
  maxReconnectAttempts?: number;
  /** After this many retries, status is `suspended` while we still retry (default 3). */
  suspendedAfterAttempts?: number;
  /** Give up filling a seq hole after this many ms (default 2_000). */
  gapFillTimeoutMs?: number;
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
  /**
   * Live occupancy frames. Default on: occupancy rides the same socket.
   * Pass `{ occupancy: { enableEvents: false } }` to ignore inbound occupancy
   * (Ably CHA-O3 gate; they pay for a second channel so theirs defaults off).
   */
  occupancy?: { enableEvents?: boolean };
  /** CHA-T10: min ms between outbound typing.started (default 10_000). */
  typing?: { heartbeatThrottleMs?: number };
  /** Inbound presence_patch / member join-leave. Default on. */
  presence?: { enableEvents?: boolean };
  /** Raw per-user reaction frames (`subscribeRaw`). Default off (Ably CHA). */
  messages?: {
    rawMessageReactions?: boolean;
    defaultMessageReactionType?: "unique" | "distinct" | "multiple";
  };
  /** Spaces avatar stack: ms before a leaver emits `remove` (default 120_000). */
  members?: { offlineTimeoutMs?: number };
}

type MessageListener = (event: FluxyChatEvent) => void;
type AnyEventListener = (event: FluxyChatEvent) => void;
type OccupancyListener = (event: Extract<FluxyChatEvent, { type: "occupancy" }>) => void;
type LockListener = (event: Extract<FluxyChatEvent, { type: "lock" }>) => void;
type RoomReactionListener = (event: Extract<FluxyChatEvent, { type: "room_reaction" }>) => void;

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
      | "suspendedAfterAttempts"
      | "gapFillTimeoutMs"
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
  private occupancyListeners: OccupancyListener[] = [];
  private lastOccupancy: FluxyOccupancyData | null = null;
  private lastDerived: Record<string, unknown> = {};
  private lockListeners: LockListener[] = [];
  private roomReactionListeners: RoomReactionListener[] = [];
  private connectionStatusListeners: Array<(status: FluxyRoomConnectionStatus) => void> = [];
  private serverEventListeners: ServerEventHandler[] = [];
  private waitForEntries: WaitForEntry[] = [];
  private seenIds: number[] = [];
  private seenIdsSet = new Set<number>();
  private outboundQueue: OutboundFrame[] = [];
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private lastPongAtMs = 0;
  private pingWaiters: Array<{
    started: number;
    resolve: (ms: number) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }> = [];
  /** R6: visibilitychange listener while connected (browser only). */
  private visibilityHandler: (() => void) | null = null;
  private wsSnapshotReceived = false;
  /** Last applied character offset per in-flight stream message id. */
  streamOffsets: Record<string, number> = {};
  private readonly gapWalker: FluxyResumeGapWalker<FluxyChatEvent>;
  private gapFillTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(client: FluxyChatClient, roomId: string, options: FluxyRoomConnectionOptions = {}) {
    this.client = client;
    this.roomId = roomId;
    this.options = {
      maxReconnectAttempts: options.maxReconnectAttempts ?? 8,
      suspendedAfterAttempts: options.suspendedAfterAttempts ?? 3,
      gapFillTimeoutMs: options.gapFillTimeoutMs ?? 2_000,
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
    this.gapWalker = new FluxyResumeGapWalker(roomId);
  }

  /** Highest contiguous room seq applied on this connection. */
  get lastSeq(): number {
    return this.gapWalker.currentSeq;
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

  onOccupancy(handler: OccupancyListener): () => void {
    this.occupancyListeners.push(handler);
    return () => {
      this.occupancyListeners = this.occupancyListeners.filter((cb) => cb !== handler);
    };
  }

  get occupancyEventsEnabled(): boolean {
    return this.options.occupancy?.enableEvents !== false;
  }

  get presenceEventsEnabled(): boolean {
    return this.options.presence?.enableEvents !== false;
  }

  get rawMessageReactionsEnabled(): boolean {
    return this.options.messages?.rawMessageReactions === true;
  }

  get defaultMessageReactionType(): "unique" | "distinct" | "multiple" {
    const type = this.options.messages?.defaultMessageReactionType;
    if (type === "unique" || type === "multiple") return type;
    return "distinct";
  }

  get typingHeartbeatThrottleMs(): number {
    const raw = this.options.typing?.heartbeatThrottleMs;
    if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) return Math.floor(raw);
    return 10_000;
  }

  get membersOfflineTimeoutMs(): number {
    const raw = this.options.members?.offlineTimeoutMs;
    if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return Math.floor(raw);
    return FLUXY_LEAVER_TTL_MS;
  }

  get occupancyCurrent(): FluxyOccupancyData | null {
    return this.lastOccupancy;
  }

  get derivedCurrent(): Record<string, unknown> {
    return this.lastDerived;
  }

  sendDerivedSet(state: Record<string, unknown>): void {
    this.sendJson({ type: "derived_set", state });
  }

  sendCursor(input: LiveCursorPublishInput): void {
    this.sendJson(buildCursorOutbound(input));
  }

  get userId(): string {
    return this.client.userId;
  }

  getClientReactions(messageId: number, userId?: string) {
    return this.client.getClientReactionsRest(messageId, userId ?? this.client.userId);
  }

  getReactionSummary(messageId: number) {
    return this.client.getReactionSummaryRest(messageId);
  }

  onRoomReaction(handler: RoomReactionListener): () => void {
    this.roomReactionListeners.push(handler);
    return () => {
      this.roomReactionListeners = this.roomReactionListeners.filter((cb) => cb !== handler);
    };
  }

  sendTyping(isTyping: boolean, parentId?: number | null): void {
    this.sendJson({
      type: "typing",
      userId: this.client.userId,
      isTyping,
      intent: isTyping ? "composing" : "idle",
      ...(parentId != null && Number.isFinite(parentId) && parentId >= 1
        ? { parentId: Math.floor(parentId) }
        : {}),
    });
  }

  sendRoomReaction(
    name: string,
    extras?: { metadata?: Record<string, unknown>; headers?: Record<string, string> },
  ): void {
    const trimmed = name.trim().slice(0, 32);
    if (!trimmed) return;
    this.sendJson({
      type: "room_reaction",
      name: trimmed,
      ...(extras?.metadata ? { metadata: extras.metadata } : {}),
      ...(extras?.headers ? { headers: extras.headers } : {}),
    });
  }

  sendPresencePatch(patch: Partial<FluxyPresence>): void {
    const frame = buildPresencePatchOutbound(patch);
    if (!frame) return;
    this.sendJson(frame);
  }

  sendPresenceLeave(data?: Partial<FluxyPresence>): void {
    const encoded = data && Object.keys(data).length ? JSON.stringify(data) : "";
    this.sendJson({
      type: "presence_leave",
      ...(encoded && encoded.length <= 2048 ? { data } : {}),
    });
  }

  sendMessageText(
    content: string,
    extras?: {
      metadata?: Record<string, unknown>;
      headers?: Record<string, string>;
      replyTo?: number | null;
      quotedMessageId?: number | null;
    },
  ) {
    return this.client.createMessage(
      this.roomId,
      content,
      extras?.replyTo ?? null,
      undefined,
      undefined,
      extras,
    );
  }

  async getMessageById(messageId: number) {
    const message = await this.client.getMessageRest(messageId);
    if (message.roomId && message.roomId !== this.roomId) {
      throw new Error("unable to get message; not in this room");
    }
    return message;
  }

  editMessageText(
    messageId: number,
    content: string,
    extras?: {
      metadata?: Record<string, unknown>;
      headers?: Record<string, string>;
      description?: string;
      operationMetadata?: Record<string, unknown>;
    },
  ) {
    return this.client.editMessageRest(messageId, content, extras);
  }

  deleteMessage(messageId: number, details?: { description?: string; metadata?: Record<string, unknown> }) {
    return this.client.deleteMessageRest(messageId, details);
  }

  sendMessageReaction(
    messageId: number,
    emoji: string,
    op: "add" | "remove" = "add",
    extras?: { type?: "unique" | "distinct" | "multiple"; count?: number },
  ) {
    return this.client.sendReactionRest(messageId, emoji, op, extras);
  }

  fetchHistory(options?: import("./fluxy-chat-client").FetchMessagesOptions) {
    return this.client.fetchMessages(this.roomId, options ?? {});
  }

  getMessageVersions(messageId: number) {
    return this.client.getMessageVersionsRest(this.roomId, messageId);
  }

  async fetchLiveMembers() {
    const live = await this.client.getRoomLive(this.roomId);
    return live.members;
  }

  onConnectionStatus(handler: (status: FluxyRoomConnectionStatus) => void): () => void {
    this.connectionStatusListeners.push(handler);
    return () => {
      this.connectionStatusListeners = this.connectionStatusListeners.filter((cb) => cb !== handler);
    };
  }

  async fetchOccupancy(): Promise<FluxyOccupancyData> {
    const live = await this.client.getRoomLive(this.roomId);
    const data = occupancyFromLive(live);
    this.lastOccupancy = data;
    return data;
  }

  async fetchCursorHistory(): Promise<LiveCursor[]> {
    const live = await this.client.getRoomLive(this.roomId);
    const rows = [...(live.cursorHistory ?? []), ...(live.cursors ?? [])];
    return rows
      .map((row) => parseLiveCursorEvent({ type: "cursor", ...row }))
      .filter((row): row is LiveCursor => row != null);
  }

  ping(timeoutMs = 10_000): Promise<number> {
    if (!this.canSendImmediately()) {
      return Promise.reject(new FluxySendError("unable to ping; not connected"));
    }
    const started = Date.now();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pingWaiters = this.pingWaiters.filter((row) => row.timer !== timer);
        reject(new FluxyTimeoutError(timeoutMs));
      }, timeoutMs);
      this.pingWaiters.push({ started, resolve, reject, timer });
      try {
        this.sendJson({ type: "ping" });
      } catch (err) {
        this.pingWaiters = this.pingWaiters.filter((row) => row.timer !== timer);
        clearTimeout(timer);
        reject(err instanceof Error ? err : new FluxySendError("unable to ping; send failed"));
      }
    });
  }

  private resolvePingWaiters(): void {
    const now = Date.now();
    const waiters = this.pingWaiters;
    this.pingWaiters = [];
    for (const waiter of waiters) {
      clearTimeout(waiter.timer);
      waiter.resolve(Math.max(0, now - waiter.started));
    }
  }

  private rejectPingWaiters(error: Error): void {
    const waiters = this.pingWaiters;
    this.pingWaiters = [];
    for (const waiter of waiters) {
      clearTimeout(waiter.timer);
      waiter.reject(error);
    }
  }

  onLock(handler: LockListener): () => void {
    this.lockListeners.push(handler);
    return () => {
      this.lockListeners = this.lockListeners.filter((cb) => cb !== handler);
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
    this.rejectPingWaiters(new FluxySendError("Connection closed."));
    this.clearReconnectTimer();
    this.clearGapFillTimer();
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
    return (
      this.status === "connecting" ||
      this.status === "reconnecting" ||
      this.status === "suspended"
    );
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
    for (const listener of this.connectionStatusListeners) {
      try {
        listener(next);
      } catch {
        /* ignore */
      }
    }
    const retryIn =
      next === "reconnecting" || next === "suspended" ? this.scheduledReconnectDelayMs : undefined;
    this.emitAnyOnly({
      type: "state_change",
      roomId: this.roomId,
      previous,
      current: next,
      ...(this.lastError ? { error: this.lastError.message } : {}),
      ...(retryIn ? { retryIn } : {}),
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

  private statusWhileOpening(): FluxyRoomConnectionStatus {
    if (!this.hasConnectedOnce || this.reconnectAttempt <= 0) return "connecting";
    return this.reconnectAttempt > this.options.suspendedAfterAttempts ? "suspended" : "reconnecting";
  }

  private frameSeq(event: unknown): number | undefined {
    if (event == null || typeof event !== "object") return undefined;
    const n = Number((event as { seq?: unknown }).seq);
    if (Number.isSafeInteger(n) && n >= 1) return n;
    return undefined;
  }

  private clearGapFillTimer(): void {
    if (this.gapFillTimer) {
      clearTimeout(this.gapFillTimer);
      this.gapFillTimer = null;
    }
  }

  private requestGapFill(resumeFrom: number): void {
    this.clearGapFillTimer();
    try {
      this.sendJson({
        type: "resume",
        lastSeq: resumeFrom,
        streamOffsets: { ...this.streamOffsets },
      });
    } catch {
      /* socket may be mid-reconnect; timeout will discontinuity */
    }
    this.gapFillTimer = setTimeout(() => {
      this.gapFillTimer = null;
      this.emitDiscontinuity(this.gapWalker.abandonGap());
    }, this.options.gapFillTimeoutMs);
  }

  private emitDiscontinuity(jump: {
    expectedSeq: number;
    receivedSeq: number;
    events: FluxyChatEvent[];
  }): void {
    this.deliver({
      type: "discontinuity",
      roomId: this.roomId,
      code: FLUXY_ERROR_CODES.discontinuity,
      expectedSeq: jump.expectedSeq,
      receivedSeq: jump.receivedSeq,
    });
    for (const event of jump.events) this.deliver(event);
  }

  private routeSequenced(event: FluxyChatEvent): void {
    const result = this.gapWalker.observe(this.frameSeq(event), event);
    if (result.kind === "duplicate" || result.kind === "hold") return;
    if (result.kind === "deliver") {
      for (const item of result.events) this.deliver(item);
      return;
    }
    if (result.kind === "gap") {
      this.requestGapFill(result.resumeFrom);
      return;
    }
    this.emitDiscontinuity(result);
  }

  private handleInboundRaw(raw: string): void {
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(raw) as unknown;
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
        this.resolvePingWaiters();
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
        this.routeSequenced(event);
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
      const frames = [];
      for (const event of (parsed as { events: unknown[] }).events) {
        const framed = resumeLogEventToClientEvent(event);
        if (!framed) continue;
        const seq = Number((event as { seq?: unknown }).seq);
        frames.push({
          seq: Number.isSafeInteger(seq) && seq >= 1 ? seq : 0,
          event: framed as FluxyChatEvent,
        });
      }
      if (this.gapWalker.isFilling) {
        const caughtUp = this.gapWalker.applyMissed(frames);
        if (!this.gapWalker.isFilling) this.clearGapFillTimer();
        for (const item of caughtUp) this.deliver(item);
      } else {
        for (const frame of frames) this.routeSequenced(frame.event);
      }
    }
  }

  private openSocket(): void {
    this.clearReconnectTimer();
    this.setStatus(this.statusWhileOpening());

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
        this.setStatus("failed");
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
      this.lastError = new FluxyConnectionError(
        0,
        "reconnect_failed",
        "WebSocket reconnect attempts exhausted.",
      );
      this.setStatus("failed");
      this.rejectAllWaitFor(this.lastError);
      this.options.onReconnectFailed?.();
      return;
    }

    const delay = computeReconnectBackoffMs(
      this.reconnectAttempt,
      this.options.baseBackoffMs,
      this.options.maxBackoffMs,
    );
    this.scheduledReconnectDelayMs = delay;
    this.nextReconnectAtMs = Date.now() + delay;
    this.setStatus(
      this.reconnectAttempt > this.options.suspendedAfterAttempts ? "suspended" : "reconnecting",
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
      const content = typeof event.content === "string" ? event.content : "";
      if (this.seenIdsSet.has(event.id) && !event.streaming && !content) return;
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

    if (event.type === "derived" && event.state && typeof event.state === "object") {
      this.lastDerived = event.state;
    }

    if (event.type === "occupancy" && this.occupancyEventsEnabled) {
      this.lastOccupancy = occupancyFromEvent(event);
      for (const listener of this.occupancyListeners) {
        try {
          listener(event);
        } catch {
          /* ignore */
        }
      }
    }

    if (event.type === "lock") {
      for (const listener of this.lockListeners) {
        try {
          listener(event);
        } catch {
          /* ignore */
        }
      }
    }

    if (event.type === "room_reaction") {
      for (const listener of this.roomReactionListeners) {
        try {
          listener(event);
        } catch {
          /* ignore */
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
