"use client";

import React from "react";
import type { FluxyChatClient, FluxyChatEvent, FluxyChatMessage, FluxySendMessageOptions } from "./index";
import { createFluxyRoomStore, syncRoomConnectionState, type FluxyRoomStore, type FluxyRoomStoreState } from "./room-store";
import { FluxyRoomConnection, type FluxyRoomConnectionOptions } from "./room-connection";
import { createOptimisticMessage, createClientMessageId, applyServerMessageAck, markMessageDeliveryFailed, tryMatchPendingByInbound } from "./message-delivery";
import { sortMessagesChronological, mergeMessagesChronological } from "./message-history";
import { createStreamingEditBatcher } from "./streaming-edit-batcher";

export type UseChatHistoryReplay = "connect" | "request";

export interface UseChatOptions {
  roomId: string;
  client?: FluxyChatClient;
  agentId?: string;
  historyLimit?: number;
  replay?: UseChatHistoryReplay;
  replayHistoryOnReconnect?: boolean;
  replayLimit?: number;
  markReadLatest?: boolean;
  presenceInfo?: Record<string, unknown>;
  wsCache?: "on" | "off";
  e2eKey?: string;
  onAnyEvent?: (event: FluxyChatEvent) => void;
}

export function useChat({
  roomId,
  client: clientProp,
  agentId,
  historyLimit = 50,
  replay = "connect",
  replayHistoryOnReconnect = true,
  markReadLatest = false,
  presenceInfo,
  wsCache,
  e2eKey,
  onAnyEvent,
}: UseChatOptions) {
  const ctxClient = React.useContext(React.createContext<FluxyChatClient | null>(null));
  const client = clientProp ?? ctxClient;
  const [state, setState] = React.useState<FluxyRoomStoreState>(() => {
    const store = createFluxyRoomStore();
    return store.getState();
  });
  const storeRef = React.useRef<FluxyRoomStore | null>(null);
  const connRef = React.useRef<FluxyRoomConnection | null>(null);
  const roomIdRef = React.useRef(roomId);
  roomIdRef.current = roomId;

  React.useEffect(() => {
    if (!client || !roomId.trim()) return;
    const store = createFluxyRoomStore();
    storeRef.current = store;
    const trimmedRoomId = roomId.trim();

    const unsub = store.subscribe((s) => setState(s));

    const conn = new (FluxyRoomConnection as any)(client, trimmedRoomId, {
      maxReconnectAttempts: 6,
      historyLimit,
      replayHistoryOnReconnect,
      presenceInfo,
      wsCache,
      wsReplay: replay === "connect" ? "connect" : "off",
      onStatusChange: (status: string) => {
        const patch: any = {};
        if (status === "connected") { patch.connectionStatus = "connected"; patch.connected = true; patch.reconnectAttempt = 0; patch.connectionError = null; }
        else if (status === "reconnecting") { patch.connectionStatus = "reconnecting"; patch.connected = false; patch.reconnectAttempt = conn.reconnectAttempts; }
        else if (status === "disconnected") { patch.connectionStatus = "disconnected"; patch.connected = false; }
        store.setState(syncRoomConnectionState(patch, store.getState()));
      },
    });

    conn.addEventListener("message", (event: FluxyChatEvent) => {
      const s = store.getState();
      if (event.type === "history") {
        store.setState({ messages: mergeMessagesChronological(s.messages, sortMessagesChronological(event.messages)), historyLoaded: true });
      } else if (event.type === "message") {
        const normalized = { ...event, userId: event.userId ?? (event as any).senderId };
        const withPending = client.userId === normalized.userId ? tryMatchPendingByInbound(s.messages, normalized, client.userId) : s.messages;
        const idx = withPending.findIndex((m: any) => m.id === event.id);
        if (idx >= 0) {
          const next = [...withPending]; next[idx] = { ...next[idx], ...normalized, deliveryStatus: "sent" };
          store.setState({ messages: sortMessagesChronological(next) });
        } else {
          store.setState({ messages: sortMessagesChronological([...withPending, { ...normalized, deliveryStatus: "sent" }]) });
        }
      } else if (event.type === "presence") {
        store.setState({ online: event.online, onlineUsers: event.users ?? [] });
      } else if (event.type === "typing") {
        store.setState({ typingUsers: { ...s.typingUsers, [event.userId]: event.isTyping } });
      } else if (event.type === "edit") {
        store.setState({ messages: s.messages.map((m: any) => m.id === event.id ? { ...m, content: event.content, editedAt: event.editedAt, streaming: event.streaming ?? false } : m) });
      } else if (event.type === "reaction") {
        const byMessage = { ...s.reactions };
        const current = { ...(byMessage[event.messageId] || {}) };
        current[event.emoji] = (current[event.emoji] || 0) + (event.op === "remove" ? -1 : 1);
        if (current[event.emoji] <= 0) delete current[event.emoji];
        byMessage[event.messageId] = current;
        store.setState({ reactions: byMessage });
      } else if (event.type === "delete") {
        store.setState({ messages: event.hard ? s.messages.filter((m: any) => m.id !== event.id) : s.messages.map((m: any) => m.id === event.id ? { ...m, content: "[deleted]", deletedAt: event.deletedAt } : m) });
      } else if (event.type === "agentTyping") {
        store.setState({ agentTyping: event.isTyping });
      }
      onAnyEvent?.(event);
    });

    conn.connect();
    connRef.current = conn;

    if (replay === "connect") {
      client.fetchMessages(trimmedRoomId, { limit: historyLimit }).then((initial) => {
        store.setState({ messages: initial, hasMore: initial.length >= historyLimit, historyLoaded: true });
      }).catch(() => {});
    }

    return () => { unsub(); conn.close(); storeRef.current = null; connRef.current = null; };
  }, [client, roomId, historyLimit, replay, replayHistoryOnReconnect, presenceInfo, wsCache]);

  const sendMessage = React.useCallback((content: string, replyTo?: number | null, attachments?: any[], options?: FluxySendMessageOptions) => {
    if (!client || !connRef.current) return;
    const clientMessageId = createClientMessageId();
    const optimistic = createOptimisticMessage({ roomId: roomIdRef.current, userId: client.userId, content, clientMessageId, parentId: replyTo ?? null });
    const s = storeRef.current?.getState();
    if (s) storeRef.current?.setState({ messages: sortMessagesChronological([...s.messages, optimistic]) });

    if (client.isAuthenticated()) {
      client.createMessage(roomIdRef.current, content, replyTo, attachments, clientMessageId, options).then((serverMessage) => {
        if (!serverMessage) return;
        const ackId = serverMessage.clientMessageId ?? clientMessageId;
        const curr = storeRef.current?.getState();
        if (curr) storeRef.current?.setState({ messages: applyServerMessageAck(curr.messages, serverMessage, ackId) });
      }).catch(() => {
        try { connRef.current?.sendJson({ type: "message", userId: client.userId, content, parentId: replyTo ?? null, attachments: attachments ?? [] }); } catch {}
      });
      return;
    }
    connRef.current.sendJson({ type: "message", userId: client.userId, content, parentId: replyTo ?? null, attachments: attachments ?? [] });
  }, [client]);

  const loadMore = React.useCallback(async () => {
    if (!client || !storeRef.current) return;
    const s = storeRef.current.getState();
    if (s.isLoadingMore || !s.hasMore) return;
    const oldest = sortMessagesChronological(s.messages)[0];
    if (!oldest?.createdAt) return;
    storeRef.current.setState({ isLoadingMore: true });
    try {
      const older = await client.fetchMessages(roomIdRef.current, { limit: historyLimit, before: oldest.createdAt });
      storeRef.current.setState((prev: any) => ({ messages: mergeMessagesChronological(prev.messages, older), hasMore: older.length >= historyLimit, isLoadingMore: false }));
    } catch { storeRef.current.setState({ isLoadingMore: false }); }
  }, [client, historyLimit]);

  return {
    messages: state.messages,
    hasMore: state.hasMore,
    isLoadingMore: state.isLoadingMore,
    online: state.online,
    typingUsers: state.typingUsers,
    connected: state.connected,
    connectionStatus: state.connectionStatus,
    connectionState: state.connectionState,
    agentTyping: state.agentTyping,
    reactions: state.reactions,
    sendMessage,
    loadMore,
    loadHistory: React.useCallback(async () => { /* TODO */ }, []),
    setTyping: React.useCallback((isTyping: boolean) => { connRef.current?.sendJson({ type: "typing", userId: client?.userId, isTyping }); }, [client]),
    editMessage: React.useCallback((messageId: number, content: string) => { connRef.current?.sendJson({ type: "edit", userId: client?.userId, messageId, content }); }, [client]),
    sendReaction: React.useCallback((messageId: number, emoji: string, op: "add" | "remove" = "add") => { connRef.current?.sendJson({ type: "reaction", userId: client?.userId, messageId, emoji, op }); }, [client]),
    sendReadReceipt: React.useCallback((messageId: number) => { connRef.current?.sendJson({ type: "read", userId: client?.userId, messageId }); }, [client]),
    deleteMessage: React.useCallback((messageId: number) => { connRef.current?.sendJson({ type: "delete", messageId }); }, []),
  };
}
