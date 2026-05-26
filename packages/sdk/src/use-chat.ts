"use client";

import React from "react";
import { createFluxyRoomStore } from "./fluxy-room-store";
import { startFluxyRoomSession } from "./room-session";
import { useFluxyRoomStoreState } from "./use-fluxy-room-store";
import { useFluxyChatOptional } from "./use-fluxy-chat";

export type UseChatHistoryReplay = "connect" | "request";

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
}

export function useChat({
  roomId,
  client: clientProp,
  agentId,
  historyLimit = 50,
  replay = "connect",
  replayHistoryOnReconnect = true,
}: UseChatOptions) {
  const realtime = useFluxyChatOptional();
  const client = clientProp ?? realtime?.client ?? null;

  const store = React.useMemo(
    () => createFluxyRoomStore(),
    [roomId],
  );

  React.useEffect(() => {
    return startFluxyRoomSession(store, {
      roomId,
      client,
      agentId,
      historyLimit,
      replay,
      replayHistoryOnReconnect,
      onRefreshSession: realtime?.refreshSession,
    });
  }, [
    store,
    roomId,
    client,
    agentId,
    historyLimit,
    replay,
    replayHistoryOnReconnect,
    realtime?.refreshSession,
  ]);

  const state = useFluxyRoomStoreState(store);

  return {
    messages: state.messages,
    hasMore: state.hasMore,
    isLoadingMore: state.isLoadingMore,
    historyLoaded: state.historyLoaded,
    loadHistory: state.loadHistory,
    loadMore: state.loadMore,
    online: state.online,
    typingUsers: state.typingUsers,
    seenBy: state.seenBy,
    onlineUsers: state.onlineUsers,
    connected: state.connected,
    connectionStatus: state.connectionStatus,
    connectionState: state.connectionState,
    reconnectAttempt: state.reconnectAttempt,
    connectionError: state.connectionError,
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
    invokeAgent: state.invokeAgent,
    toolThreadEvents: state.toolThreadEvents,
    clearToolThread: state.clearToolThread,
    lastAgentRun: state.lastAgentRun,
    /** Vanilla store for non-React consumers (Vue, Solid, etc.). */
    store,
  };
}
