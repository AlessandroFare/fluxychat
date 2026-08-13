import { FluxyAuthError, FluxyConnectionError, FluxySendError, FluxyTimeoutError, computeReconnectBackoffMs, mapWebSocketCloseToError } from './errors';
import { dispatchInboundWsFrame } from '@fluxy-chat/protocol';
import type { FluxyChatClient, FluxyChatEvent, FluxyChatMessage, FluxyWebSocketConnectOptions } from './index';
import {
  createRnOfflineQueue,
  type RnOfflineQueue,
  type RnOutboxStore,
  type RnSyncStatus,
} from './offline-queue';

export type FluxyRoomConnectionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

export interface FluxyRoomConnectionOptions {
  maxReconnectAttempts?: number;
  baseBackoffMs?: number;
  maxBackoffMs?: number;
  replayHistoryOnReconnect?: boolean;
  historyLimit?: number;
  wsReplay?: FluxyWebSocketConnectOptions['replay'];
  presenceInfo?: Record<string, unknown>;
  wsCache?: FluxyWebSocketConnectOptions['cache'];
  heartbeatIntervalMs?: number;
  heartbeatTimeoutMs?: number;
  maxOutboundQueue?: number;
  maxOutboundQueueAgeMs?: number;
  /** NW-114 — persist unsent frames across app restarts (AsyncStorage-backed store recommended). */
  persistentOutbox?: RnOutboxStore;
  onSyncStatusChange?: (status: RnSyncStatus, pending: number) => void;
  onAuthError?: (error: FluxyAuthError) => void;
  onConnectionError?: (error: Error) => void;
  onStatusChange?: (status: FluxyRoomConnectionStatus) => void;
  onReconnectFailed?: () => void;
}

export interface FluxyWaitForOptions { timeout?: number; }

const SEEN_IDS_MAX = 10_000;
const DEFAULT_WAIT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_OUTBOUND_QUEUE = 100;
const DEFAULT_MAX_OUTBOUND_QUEUE_AGE_MS = 5 * 60_000;
const DEFAULT_HEARTBEAT_INTERVAL_MS = 25_000;
const DEFAULT_HEARTBEAT_TIMEOUT_MS = 45_000;
export const FLUXY_WS_CLOSE_HEARTBEAT = 4000;

type MessageListener = (event: FluxyChatEvent) => void;

interface OutboundFrame { payload: Record<string, unknown>; enqueuedAt: number; }
interface WaitForEntry { predicate: (e: FluxyChatEvent) => boolean; resolve: (m: FluxyChatMessage) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout>; }

export class FluxyRoomConnection {
  private readonly client: FluxyChatClient;
  private readonly roomId: string;
  private readonly options: Required<Pick<FluxyRoomConnectionOptions, 'maxReconnectAttempts' | 'baseBackoffMs' | 'maxBackoffMs' | 'replayHistoryOnReconnect' | 'historyLimit' | 'heartbeatIntervalMs' | 'heartbeatTimeoutMs' | 'maxOutboundQueue' | 'maxOutboundQueueAgeMs'>> & FluxyRoomConnectionOptions;
  private ws: WebSocket | null = null;
  private status: FluxyRoomConnectionStatus = 'idle';
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionallyClosed = false;
  private hasConnectedOnce = false;
  private pendingHistoryReplay = false;
  private lastError: Error | null = null;
  private nextReconnectAtMs: number | null = null;
  private scheduledReconnectDelayMs = 0;
  private listeners: MessageListener[] = [];
  private anyListeners: MessageListener[] = [];
  private waitForEntries: WaitForEntry[] = [];
  private seenIds: number[] = [];
  private seenIdsSet = new Set<number>();
  private outboundQueue: OutboundFrame[] = [];
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private lastPongAtMs = 0;
  private wsSnapshotReceived = false;
  private offlineQueue: RnOfflineQueue | null = null;
  private offlineQueueUnsub: (() => void) | null = null;

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
    if (options.persistentOutbox) {
      this.offlineQueue = createRnOfflineQueue({
        store: options.persistentOutbox,
        send: async (entry) => {
          if (entry.roomId !== this.roomId) return false;
          if (!this.canSendImmediately()) return false;
          try {
            this.ws!.send(JSON.stringify(entry.payload));
            return true;
          } catch {
            return false;
          }
        },
      });
      this.offlineQueueUnsub = this.offlineQueue.onStatusChange((status, pending) => {
        this.options.onSyncStatusChange?.(status, pending);
      });
      this.offlineQueue.start();
    }
  }

  getSyncStatus(): RnSyncStatus {
    return this.offlineQueue?.getStatus() ?? 'synced';
  }

  pendingOutboxCount(): Promise<number> {
    return this.offlineQueue?.pendingCount() ?? Promise.resolve(0);
  }

  get connectionStatus(): FluxyRoomConnectionStatus { return this.status; }
  get reconnectAttempts(): number { return this.reconnectAttempt; }
  getLastError(): Error | null { return this.lastError; }
  getOutboundQueueDepth(): number { return this.outboundQueue.length; }
  getNextReconnectAt(): Date | null { return this.nextReconnectAtMs != null ? new Date(this.nextReconnectAtMs) : null; }
  getScheduledReconnectDelayMs(): number { return this.scheduledReconnectDelayMs; }
  get readyState(): number { return this.ws?.readyState ?? WebSocket.CLOSED; }

  addEventListener(_type: 'message', listener: MessageListener): void { this.listeners.push(listener); }
  removeEventListener(_type: 'message', listener: MessageListener): void { this.listeners = this.listeners.filter((cb) => cb !== listener); }
  onAnyEvent(listener: MessageListener): void { this.anyListeners.push(listener); }
  offAnyEvent(listener: MessageListener): void { this.anyListeners = this.anyListeners.filter((cb) => cb !== listener); }

  connect(): void { this.intentionallyClosed = false; this.openSocket(); }

  close(code = 1000): void {
    this.intentionallyClosed = true;
    this.rejectAllWaitFor(new FluxySendError('Connection closed.'));
    this.clearReconnectTimer();
    this.stopHeartbeat();
    this.clearOutboundQueue();
    this.offlineQueue?.stop();
    this.offlineQueueUnsub?.();
    this.offlineQueueUnsub = null;
    if (this.ws) { try { this.ws.close(code); } catch {} this.ws = null; }
    this.setStatus('disconnected');
  }

  sendJson(payload: Record<string, unknown>): void {
    if (this.canSendImmediately()) { this.ws!.send(JSON.stringify(payload)); return; }
    if (this.canQueueOutbound()) { this.enqueueOutbound(payload); return; }
    if (this.offlineQueue) {
      void this.offlineQueue.enqueue({
        roomId: this.roomId,
        payload,
        type: String(payload.type ?? 'message'),
      });
      return;
    }
    throw new FluxySendError('Cannot send: WebSocket is not open.');
  }

  waitFor(predicate: (event: FluxyChatEvent) => boolean, options: FluxyWaitForOptions = {}): Promise<FluxyChatMessage> {
    const timeoutMs = options.timeout ?? DEFAULT_WAIT_TIMEOUT_MS;
    if (this.status !== 'connected') return Promise.reject(new FluxySendError('waitFor requires an open connection.'));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waitForEntries = this.waitForEntries.filter((e) => e.timer !== timer);
        reject(new FluxyTimeoutError(timeoutMs));
      }, timeoutMs);
      this.waitForEntries.push({ predicate, resolve, reject, timer });
    });
  }

  private canSendImmediately(): boolean { return Boolean(this.ws && this.ws.readyState === WebSocket.OPEN); }
  private canQueueOutbound(): boolean { return this.status === 'connecting' || this.status === 'reconnecting'; }

  private enqueueOutbound(payload: Record<string, unknown>): void {
    const now = Date.now();
    this.pruneOutboundQueue(now);
    if (this.outboundQueue.length >= this.options.maxOutboundQueue) { this.outboundQueue.shift(); }
    this.outboundQueue.push({ payload, enqueuedAt: now });
  }

  private pruneOutboundQueue(now = Date.now()): void {
    this.outboundQueue = this.outboundQueue.filter((f) => now - f.enqueuedAt <= this.options.maxOutboundQueueAgeMs);
  }

  private flushOutboundQueue(): void {
    if (!this.canSendImmediately()) return;
    this.pruneOutboundQueue();
    while (this.outboundQueue.length > 0 && this.canSendImmediately()) {
      const frame = this.outboundQueue.shift()!;
      this.ws!.send(JSON.stringify(frame.payload));
    }
  }

  private clearOutboundQueue(): void { this.outboundQueue = []; }

  private rejectAllWaitFor(error: Error): void {
    for (const entry of this.waitForEntries) { clearTimeout(entry.timer); entry.reject(error); }
    this.waitForEntries = [];
  }

  private setStatus(next: FluxyRoomConnectionStatus): void {
    if (this.status === next) return;
    const previous = this.status;
    this.status = next;
    if (next === 'connected') {
      this.nextReconnectAtMs = null;
      this.scheduledReconnectDelayMs = 0;
      this.offlineQueue?.setConnected(true);
    } else if (next === 'disconnected' || next === 'reconnecting' || next === 'connecting') {
      this.offlineQueue?.setConnected(false);
    }
    this.options.onStatusChange?.(next);
    this.emitAnyOnly({ type: 'state_change', roomId: this.roomId, previous, current: next } as any);
  }

  private clearReconnectTimer(): void { if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; } }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    const intervalMs = this.options.heartbeatIntervalMs;
    if (intervalMs <= 0) return;
    this.lastPongAtMs = Date.now();
    this.heartbeatTimer = setInterval(() => {
      if (!this.canSendImmediately()) return;
      const timeoutMs = this.options.heartbeatTimeoutMs;
      if (timeoutMs > 0 && Date.now() - this.lastPongAtMs > timeoutMs) {
        try { this.ws?.close(FLUXY_WS_CLOSE_HEARTBEAT, 'heartbeat_timeout'); } catch {}
        return;
      }
      try { this.ws!.send(JSON.stringify({ type: 'ping' })); } catch {}
    }, intervalMs);
  }

  private stopHeartbeat(): void { if (this.heartbeatTimer) { clearInterval(this.heartbeatTimer); this.heartbeatTimer = null; } }

  private handleInboundRaw(raw: string): void {
    dispatchInboundWsFrame(raw, {
      onPong: () => { this.lastPongAtMs = Date.now(); },
      onReplay: (messages) => {
        this.wsSnapshotReceived = true;
        this.deliver({ type: 'history', messages: messages as unknown as FluxyChatMessage[] } as unknown as FluxyChatEvent);
      },
      onHistoryMarker: () => { this.wsSnapshotReceived = true; },
      onWorkerError: () => {},
      onEvent: (event) => { this.deliver(event as unknown as FluxyChatEvent); },
    });
  }

  private openSocket(): void {
    this.clearReconnectTimer();
    this.setStatus(this.hasConnectedOnce && this.reconnectAttempt > 0 ? 'reconnecting' : 'connecting');
    const wsConnect: Record<string, unknown> = { roomId: this.roomId, token: '', replay: this.options.wsReplay ?? 'connect', replayLimit: this.options.historyLimit, presenceInfo: this.options.presenceInfo, cache: this.options.wsCache };
    if (this.options.wsReplay === 'off') wsConnect.replay = 'off';
    const ws = this.client.connect(this.roomId, wsConnect);
    this.ws = ws;
    this.wsSnapshotReceived = false;

    ws.addEventListener('open', () => {
      this.hasConnectedOnce = true;
      this.reconnectAttempt = 0;
      this.lastError = null;
      this.setStatus('connected');
      this.startHeartbeat();
      this.flushOutboundQueue();
      const needsRestReplay = this.pendingHistoryReplay && this.options.replayHistoryOnReconnect;
      this.pendingHistoryReplay = false;
      if (needsRestReplay) { queueMicrotask(() => { if (!this.wsSnapshotReceived) void this.replayHistory(); }); }
    });

    ws.addEventListener('message', (event) => { this.handleInboundRaw(String(event.data)); });

    ws.addEventListener('close', (event) => {
      this.ws = null;
      this.stopHeartbeat();
      if (this.intentionallyClosed) { this.setStatus('disconnected'); return; }
      const mapped = mapWebSocketCloseToError(event.code, event.reason || '');
      if (mapped instanceof FluxyAuthError) { this.lastError = mapped; this.clearOutboundQueue(); this.options.onAuthError?.(mapped); this.options.onConnectionError?.(mapped); this.rejectAllWaitFor(mapped); this.setStatus('disconnected'); return; }
      if (mapped) { this.lastError = mapped; this.options.onConnectionError?.(mapped); }
      this.scheduleReconnect();
    });
  }

  private scheduleReconnect(): void {
    this.pendingHistoryReplay = true;
    this.reconnectAttempt += 1;
    if (this.reconnectAttempt > this.options.maxReconnectAttempts) {
      this.setStatus('disconnected');
      this.rejectAllWaitFor(new FluxyConnectionError(0, 'reconnect_failed', 'WebSocket reconnect attempts exhausted.'));
      this.options.onReconnectFailed?.();
      return;
    }
    this.setStatus('reconnecting');
    const delay = computeReconnectBackoffMs(this.reconnectAttempt, this.options.baseBackoffMs, this.options.maxBackoffMs);
    this.scheduledReconnectDelayMs = delay;
    this.nextReconnectAtMs = Date.now() + delay;
    this.clearReconnectTimer();
    this.reconnectTimer = setTimeout(() => { this.reconnectTimer = null; if (!this.intentionallyClosed) this.openSocket(); }, delay);
  }

  private async replayHistory(): Promise<void> {
    try { const messages = await this.client.fetchMessages(this.roomId, { limit: this.options.historyLimit }); this.deliver({ type: 'history', messages: messages as unknown as FluxyChatMessage[] } as unknown as FluxyChatEvent); } catch {}
  }

  private trackMessageId(id: number): void {
    if (!Number.isFinite(id) || this.seenIdsSet.has(id)) return;
    if (this.seenIds.length >= SEEN_IDS_MAX) { const evicted = this.seenIds.shift(); if (evicted !== undefined) this.seenIdsSet.delete(evicted); }
    this.seenIds.push(id);
    this.seenIdsSet.add(id);
  }

  private deliver(event: FluxyChatEvent): void {
    if (event.type === 'history') {
      this.seenIds = [];
      this.seenIdsSet.clear();
      for (const msg of (event as any).messages) { if (Number.isFinite(msg.id)) this.trackMessageId(msg.id); }
    } else if (event.type === 'message' && Number.isFinite((event as any).id)) {
      if (this.seenIdsSet.has((event as any).id) && !(event as any).streaming) return;
      this.trackMessageId((event as any).id);
    }

    const satisfied: WaitForEntry[] = [];
    for (const entry of this.waitForEntries) { if (entry.predicate(event)) satisfied.push(entry); }
    if (satisfied.length > 0) {
      this.waitForEntries = this.waitForEntries.filter((e) => !satisfied.includes(e));
      for (const entry of satisfied) {
        clearTimeout(entry.timer);
        if (event.type === 'message') entry.resolve(event as unknown as FluxyChatMessage);
        else entry.reject(new Error(`waitFor matched non-message event type "${event.type}"`));
      }
    }

    for (const listener of this.listeners) { try { listener(event); } catch {} }
  }

  private emitOnly(event: FluxyChatEvent): void { for (const listener of this.listeners) { try { listener(event); } catch {} } }
  private emitAnyOnly(event: FluxyChatEvent): void { for (const listener of this.anyListeners) { try { listener(event); } catch {} } }
}
