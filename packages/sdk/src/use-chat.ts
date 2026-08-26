"use client";

import React from "react";
import { createFluxyRoomStore } from "./fluxy-room-store";
import { startFluxyRoomSession } from "./room-session";
import { acquireFluxyRoomSession } from "./room-session-handle";
import { useFluxyRoomStoreState } from "./use-fluxy-room-store";
import { useFluxyChatOptional } from "./use-fluxy-chat";
import { describeConnectionError } from "./errors";
import { isDegradedConnectionStatus } from "./connection-state";
import { sessionTokenFingerprint } from "./session-token-refresh";

export type UseChatHistoryReplay = "connect" | "request";

/** When to auto-send read receipts for the latest visible message (Portal-style). */
export type UseChatReadOn = "mount" | "visible" | "manual";

export interface UseChatOptions {
  roomId: string;
  /** Omit when wrapped in `FluxyRealtimeProvider`. */
  client?: import("./index").FluxyChatClient;
  agentId?: string;
  /** Initial REST page size (default 50). */
  historyLimit?: number;
  /**
   * When to load message history (Portal-style replay).
   * - `connect` (default): REST fetch on mount + apply WS `history` events.
   * - `request`: skip auto-load; call `loadHistory()` when needed (heavy rooms).
   */
  replay?: UseChatHistoryReplay;
  /** Refetch REST history after WebSocket reconnect (default true). */
  replayHistoryOnReconnect?: boolean;
  /** Cap for WS replay snapshot (passed to room connection as historyLimit). */
  replayLimit?: number;
  /**
   * When to mark the latest message read automatically.
   * - `mount` (Portal default): on connect and when new messages arrive.
   * - `visible`: same as mount, but only while the document tab is visible.
   * - `manual`: call `sendReadReceipt` yourself.
   * @default "manual"
   */
  readOn?: UseChatReadOn;
  /**
   * @deprecated Use `readOn: "mount"` instead.
   */
  markReadLatest?: boolean;
  /** Presence profile on WS connect (Pusher-style `user_info`). */
  presenceInfo?: Record<string, unknown>;
  wsCache?: "on" | "off";
  /** Default `on` — Pusher-style cache replay on connect (Portal C-7). */
  e2eKey?: string;
  e2eAutoFetch?: boolean;
  /** Overlapping agent invoke strategy (Portal B-4). Default debounce 300ms. */
  concurrency?: import("./concurrency").ConcurrencyConfig;
  /** Yjs message-list merge on history load (default on). */
  crdtMessageList?: boolean;
  onAnyEvent?: (event: import("./index").FluxyChatEvent) => void;
  /** Worker vertical/labs fan-out (`server_event` frames on room WS). */
  onServerEvent?: import("./server-realtime").ServerEventHandler;
  /**
   * Isolate this hook from other `useChat` instances on the same room/user/token.
   * Two widgets on `/rooms` (Assistant panel + Live chat) must not share a session:
   * the second store would stay on "connecting" forever.
   */
  sessionScope?: string;
}

export function useChat({
  roomId,
  client: clientProp,
  agentId,
  historyLimit = 50,
  replay = "connect",
  replayHistoryOnReconnect = true,
  replayLimit,
  readOn,
  markReadLatest = false,
  presenceInfo,
  wsCache = "on",
  e2eKey,
  e2eAutoFetch,
  concurrency = { strategy: "debounce", debounceMs: 300 },
  crdtMessageList = true,
  onAnyEvent,
  onServerEvent,
  sessionScope,
}: UseChatOptions) {
  const effectiveHistoryLimit = replayLimit ?? historyLimit;
  const effectiveReadOn: UseChatReadOn = markReadLatest ? "mount" : (readOn ?? "manual");
  const realtime = useFluxyChatOptional();
  /** `null` from an explicit prop means no client; `undefined` falls back to provider. */
  const client =
    clientProp === undefined ? (realtime?.client ?? null) : clientProp;
  const instanceId = React.useId();
  const scope = sessionScope?.trim() || instanceId;

  const store = React.useMemo(
    () => createFluxyRoomStore(),
    [roomId],
  );

  const sessionKey = React.useMemo(
    () =>
      `${scope}:${client?.userId ?? "none"}:${roomId}:${sessionTokenFingerprint(realtime?.token ?? client?.token ?? null)}`,
    [scope, client?.userId, client?.token, roomId, realtime?.token],
  );

  const onAnyEventRef = React.useRef(onAnyEvent);
  onAnyEventRef.current = onAnyEvent;
  const onServerEventRef = React.useRef(onServerEvent);
  onServerEventRef.current = onServerEvent;
  const refreshSessionRef = React.useRef(realtime?.refreshSession);
  refreshSessionRef.current = realtime?.refreshSession;
  const presenceInfoRef = React.useRef(presenceInfo);
  presenceInfoRef.current = presenceInfo;
  const concurrencyRef = React.useRef(concurrency);
  concurrencyRef.current = concurrency;

  React.useEffect(() => {
    let released = false;
    const release = acquireFluxyRoomSession(sessionKey, () =>
      startFluxyRoomSession(store, {
        roomId,
        client,
        agentId,
        historyLimit: effectiveHistoryLimit,
        replay,
        replayHistoryOnReconnect,
        readOn: effectiveReadOn,
        presenceInfo: presenceInfoRef.current,
        wsCache,
        e2eKey,
        e2eAutoFetch,
        crdtMessageList,
        concurrency: concurrencyRef.current,
        onAnyEvent: (event) => onAnyEventRef.current?.(event),
        onServerEvent: (ev) => onServerEventRef.current?.(ev),
        onRefreshSession: (...args) => refreshSessionRef.current?.(...args),
      }),
    );
    return () => {
      if (released) return;
      released = true;
      release();
    };
  }, [
    sessionKey,
    store,
    roomId,
    client,
    agentId,
    effectiveHistoryLimit,
    replay,
    replayHistoryOnReconnect,
    effectiveReadOn,
    wsCache,
    e2eKey,
    e2eAutoFetch,
    crdtMessageList,
  ]);

  const state = useFluxyRoomStoreState(store);
  const connectionErrorInfo = React.useMemo(
    () => describeConnectionError(state.connectionError),
    [state.connectionError],
  );

  const pendingMessages = React.useMemo(
    () => state.messages.filter((m) => m.deliveryStatus === "pending"),
    [state.messages],
  );
  const failedMessages = React.useMemo(
    () => state.messages.filter((m) => m.deliveryStatus === "failed"),
    [state.messages],
  );

  return {
    messages: state.messages,
    hasMore: state.hasMore,
    isLoadingMore: state.isLoadingMore,
    historyLoaded: state.historyLoaded,
    loadHistory: state.loadHistory,
    loadMore: state.loadMore,
    loadLive: state.loadLive,
    live: state.liveSnapshot,
    online: state.online,
    typingUsers: state.typingUsers,
    typingIntents: state.typingIntents,
    seenBy: state.seenBy,
    onlineUsers: state.onlineUsers,
    connected: state.connected,
    connectionStatus: state.connectionStatus,
    connectionState: state.connectionState,
    reconnectAttempt: state.reconnectAttempt,
    connectionError: state.connectionError,
    connectionErrorInfo,
    connectionBlocked: connectionErrorInfo?.isTerminal ?? false,
    connectionDegraded: isDegradedConnectionStatus(state.connectionState.status),
    pendingMessages,
    failedMessages,
    retryMessage: state.retryMessage,
    agentTyping: state.agentTyping,
    typingAgentId: state.wsTypingAgentId ?? state.invokeTypingAgentId,
    reactions: state.reactions,
    sendMessage: state.sendMessage,
    setTyping: state.setTyping,
    editMessage: state.editMessage,
    sendReaction: state.sendReaction,
    sendReadReceipt: state.sendReadReceipt,
    deleteMessage: state.deleteMessage,
    branchRoomFromMessage: state.branchRoomFromMessage,
    invokeAgent: state.invokeAgent,
    stopAgentStream: state.stopAgentStream,
    toolThreadEvents: state.toolThreadEvents,
    clearToolThread: state.clearToolThread,
    debateSteps: state.debateSteps,
    debateSessionId: state.debateSessionId,
    clearDebateThread: state.clearDebateThread,
    voiceStage: state.voiceStage,
    joinVoiceStage: state.joinVoiceStage,
    leaveVoiceStage: state.leaveVoiceStage,
    promoteVoiceStageListener: state.promoteVoiceStageListener,
    sendVoiceStageVad: state.sendVoiceStageVad,
    sendClientEvent: state.sendClientEvent,
    sendCursor: state.sendCursor,
    sendPresencePatch: state.sendPresencePatch,
    liveCursors: state.liveCursors,
    livePresence: state.livePresence,
    lastClientEvent: state.lastClientEvent,
    presenceMembers: state.presenceMembers,
    subscriptionCount: state.subscriptionCount,
    socketId: state.socketId,
    lastAgentRun: state.lastAgentRun,
    syncStatus: state.syncStatus,
    pendingOutboxCount: state.pendingOutboxCount,
    /** Vanilla store for non-React consumers (Vue, Solid, etc.). */
    store,
  };
}
