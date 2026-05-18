"use client";

import React from "react";
import { FluxyAuthError, FluxySendError } from "./errors";
import {
  mergeMessagesChronological,
  sortMessagesChronological,
} from "./message-history";
import { FluxyChatRoomConnection } from "./room-connection";
import type {
  FluxyChatAttachment,
  FluxyChatClient,
  FluxyChatEvent,
  FluxyChatMessage,
} from "./index";
import { useFluxyChatOptional } from "./use-fluxy-chat";

export interface UseChatOptions {
  roomId: string;
  /** Omit when wrapped in `FluxyRealtimeProvider`. */
  client?: FluxyChatClient;
  agentId?: string;
  /** Initial REST page size (default 50). */
  historyLimit?: number;
}

export function useChat({ roomId, client: clientProp, agentId, historyLimit = 50 }: UseChatOptions) {
  const realtime = useFluxyChatOptional();
  const client = clientProp ?? realtime?.client ?? null;

  const [messages, setMessages] = React.useState<FluxyChatMessage[]>([]);
  const [hasMore, setHasMore] = React.useState(false);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [online, setOnline] = React.useState(0);
  const [typingUsers, setTypingUsers] = React.useState<Record<string, boolean>>({});
  const [seenBy, setSeenBy] = React.useState<Record<number, string[]>>({});
  const [onlineUsers, setOnlineUsers] = React.useState<string[]>([]);
  const [connected, setConnected] = React.useState(false);
  const [connectionStatus, setConnectionStatus] = React.useState<
    "connecting" | "connected" | "reconnecting" | "disconnected" | "polling" | "sse"
  >("connecting");
  const [reconnectAttempt, setReconnectAttempt] = React.useState(0);
  const [connectionError, setConnectionError] = React.useState<Error | null>(null);
  const [agentTyping, setAgentTyping] = React.useState(false);
  const [wsTypingAgentId, setWsTypingAgentId] = React.useState<string | null>(null);
  const [invokeTypingAgentId, setInvokeTypingAgentId] = React.useState<string | null>(null);
  const [reactions, setReactions] = React.useState<Record<number, Record<string, number>>>({});
  const connectionRef = React.useRef<FluxyChatRoomConnection | null>(null);
  const sseRef = React.useRef<EventSource | null>(null);
  const pollTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const loadMore = React.useCallback(async () => {
    if (!client || isLoadingMore || !hasMore) return;
    const trimmedRoomId = roomId.trim();
    if (!trimmedRoomId) return;

    const chronological = sortMessagesChronological(messages);
    const oldest = chronological[0];
    if (!oldest?.createdAt) return;

    setIsLoadingMore(true);
    try {
      const older = await client.fetchMessages(trimmedRoomId, {
        limit: historyLimit,
        before: oldest.createdAt,
      });
      setMessages((prev) => mergeMessagesChronological(prev, older));
      setHasMore(older.length >= historyLimit);
    } catch {
      /* keep existing list */
    } finally {
      setIsLoadingMore(false);
    }
  }, [client, hasMore, historyLimit, isLoadingMore, messages, roomId]);

  React.useEffect(() => {
    let active = true;
    const trimmedRoomId = roomId.trim();
    const MAX_WS_RECONNECT_ATTEMPTS = 6;
    const POLL_INTERVAL_MS = 4000;

    const stopPollingFallback = () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };

    const stopSSEFallback = () => {
      if (sseRef.current) {
        sseRef.current.close();
        sseRef.current = null;
      }
    };

    const startPollingFallback = () => {
      if (!client) return;
      stopPollingFallback();
      stopSSEFallback();
      const tick = async () => {
        if (!active || !client) return;
        try {
          const next = await client.fetchMessages(trimmedRoomId, { limit: historyLimit });
          if (active) {
            setMessages(next);
            setHasMore(next.length >= historyLimit);
          }
        } catch {
          /* ignore transient poll errors */
        }
      };
      void tick();
      pollTimerRef.current = setInterval(tick, POLL_INTERVAL_MS);
    };

    const startSSEFallback = () => {
      if (!client) return;
      stopPollingFallback();
      stopSSEFallback();
      const es = client.connectSSE(trimmedRoomId);
      if (!es) {
        startPollingFallback();
        return;
      }
      sseRef.current = es;
      setConnectionStatus("sse");

      es.addEventListener("message", (event: MessageEvent) => {
        if (!active) return;
        try {
          const data: FluxyChatEvent = JSON.parse(event.data);
          handleEvent(data);
        } catch {
          /* ignore malformed SSE events */
        }
      });

      es.addEventListener("error", () => {
        if (!active) return;
        stopSSEFallback();
        startPollingFallback();
        setConnectionStatus("polling");
      });
    };

    const handleEvent = (data: FluxyChatEvent) => {
      if (data.type === "history") {
        setMessages((prev) =>
          mergeMessagesChronological(prev, sortMessagesChronological(data.messages)),
        );
      } else if (data.type === "message") {
        setMessages((prev) => {
          const idx = prev.findIndex((m) => m.id === data.id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = { ...next[idx], ...data };
            return sortMessagesChronological(next);
          }
          return sortMessagesChronological([...prev, data]);
        });
      } else if (data.type === "presence") {
        setOnline(data.online);
        if (data.users) setOnlineUsers(data.users);
      } else if (data.type === "typing") {
        setTypingUsers((prev) => ({
          ...prev,
          [data.userId]: data.isTyping,
        }));
      } else if (data.type === "agentTyping") {
        setAgentTyping(data.isTyping);
        setWsTypingAgentId(data.isTyping ? data.agentId : null);
      } else if (data.type === "edit") {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === data.id
              ? {
                  ...m,
                  content: data.content,
                  editedAt: data.editedAt,
                  streaming: data.streaming ?? false,
                }
              : m,
          ),
        );
      } else if (data.type === "reaction") {
        setReactions((prev) => {
          const byMessage = { ...prev };
          const current = { ...(byMessage[data.messageId] || {}) };
          const existingCount = current[data.emoji] || 0;
          if (data.op === "remove") {
            const nextCount = Math.max(existingCount - 1, 0);
            if (nextCount === 0) {
              delete current[data.emoji];
            } else {
              current[data.emoji] = nextCount;
            }
          } else {
            current[data.emoji] = existingCount + 1;
          }
          if (Object.keys(current).length === 0) {
            delete byMessage[data.messageId];
          } else {
            byMessage[data.messageId] = current;
          }
          return byMessage;
        });
      } else if (data.type === "read") {
        setSeenBy((prev) => {
          const existing = prev[data.messageId] || [];
          if (existing.includes(data.userId)) return prev;
          return {
            ...prev,
            [data.messageId]: [...existing, data.userId],
          };
        });
      } else if (data.type === "delete") {
        if (data.hard) {
          setMessages((prev) => prev.filter((m) => m.id !== data.id));
        } else {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === data.id
                ? { ...m, content: "[deleted]", deletedAt: data.deletedAt }
                : m,
            ),
          );
        }
      }
    };

    if (!client || !trimmedRoomId || !client.isAuthenticated()) {
      setMessages([]);
      setHasMore(false);
      setConnected(false);
      setConnectionStatus("disconnected");
      return () => {
        active = false;
        stopPollingFallback();
        stopSSEFallback();
        connectionRef.current?.close();
        connectionRef.current = null;
      };
    }

    client
      .fetchMessages(trimmedRoomId, { limit: historyLimit })
      .then((initial) => {
        if (!active) return;
        setMessages(initial);
        setHasMore(initial.length >= historyLimit);
      })
      .catch(() => {
        /* history load is best-effort until member JWT + room are ready */
      });

    const connection = client.connectRoom(trimmedRoomId, {
      maxReconnectAttempts: MAX_WS_RECONNECT_ATTEMPTS,
      historyLimit,
      onStatusChange: (status) => {
        if (!active) return;
        if (status === "connected") {
          setConnected(true);
          setConnectionStatus("connected");
          setReconnectAttempt(0);
          setConnectionError(null);
          stopPollingFallback();
          stopSSEFallback();
        } else if (status === "connecting") {
          setConnectionStatus("connecting");
          setConnected(false);
        } else if (status === "reconnecting") {
          setConnectionStatus("reconnecting");
          setConnected(false);
          setReconnectAttempt(connection.reconnectAttempts);
        } else if (status === "disconnected") {
          setConnected(false);
          setConnectionStatus("disconnected");
        }
      },
      onAuthError: (err) => {
        if (!active) return;
        setConnectionError(err);
        setConnected(false);
        setConnectionStatus("disconnected");
        realtime?.refreshSession();
      },
      onConnectionError: (err) => {
        if (!active) return;
        if (!(err instanceof FluxyAuthError)) {
          setConnectionError(err);
        }
      },
      onReconnectFailed: () => {
        if (!active) return;
        setReconnectAttempt(connection.reconnectAttempts);
        if (client.isAuthenticated()) {
          startSSEFallback();
        } else {
          startPollingFallback();
        }
      },
    });

    connection.addEventListener("message", (data) => {
      if (!active) return;
      handleEvent(data);
    });
    connectionRef.current = connection;
    connection.connect();

    return () => {
      active = false;
      stopPollingFallback();
      stopSSEFallback();
      connection.close();
      connectionRef.current = null;
      setConnected(false);
      setConnectionStatus("disconnected");
    };
  }, [roomId, client, historyLimit, realtime?.refreshSession]);

  const sendMessage = (
    content: string,
    replyTo?: number | null,
    attachments?: FluxyChatAttachment[],
  ) => {
    if (!client) return;
    if (client.isAuthenticated()) {
      void client
        .createMessage(roomId, content, replyTo, attachments)
        .catch((err) =>
          // eslint-disable-next-line no-console
          console.error("[fluxychat] REST sendMessage failed, falling back to WS:", err),
        );
      return;
    }
    try {
      connectionRef.current?.sendJson({
        type: "message",
        userId: client.userId,
        content,
        parentId: replyTo ?? null,
        attachments: attachments ?? [],
      });
    } catch (err) {
      if (err instanceof FluxySendError) return;
      throw err;
    }
  };

  const setTyping = (isTyping: boolean) => {
    if (!client) return;
    try {
      connectionRef.current?.sendJson({
        type: "typing",
        userId: client.userId,
        isTyping,
      });
    } catch {
      /* socket not open */
    }
  };

  const editMessage = (messageId: number, content: string) => {
    if (!client) return;
    const tryWsEdit = () => {
      try {
        connectionRef.current?.sendJson({
          type: "edit",
          userId: client.userId,
          messageId,
          content,
        });
      } catch {
        /* socket not open */
      }
    };

    if (client.isAuthenticated()) {
      void client.editMessageRest(messageId, content).catch((err) => {
        // eslint-disable-next-line no-console
        console.error("[fluxychat] REST editMessage failed, falling back to WS:", err);
        tryWsEdit();
      });
      return;
    }
    tryWsEdit();
  };

  const sendReaction = (messageId: number, emoji: string, op: "add" | "remove" = "add") => {
    if (!client) return;
    if (client.isAuthenticated()) {
      void client
        .sendReactionRest(messageId, emoji, op)
        .catch((err) =>
          // eslint-disable-next-line no-console
          console.error("[fluxychat] REST sendReaction failed, falling back to WS:", err),
        );
      return;
    }
    try {
      connectionRef.current?.sendJson({
        type: "reaction",
        userId: client.userId,
        messageId,
        emoji,
        op,
      });
    } catch {
      /* socket not open */
    }
  };

  const sendReadReceipt = (messageId: number) => {
    if (!client) return;
    if (client.isAuthenticated()) {
      void client
        .markReadRest(roomId, messageId)
        .catch((err) =>
          // eslint-disable-next-line no-console
          console.error("[fluxychat] REST sendReadReceipt failed, falling back to WS:", err),
        );
      return;
    }
    try {
      connectionRef.current?.sendJson({
        type: "read",
        userId: client.userId,
        messageId,
      });
    } catch {
      /* socket not open */
    }
  };

  const deleteMessage = (messageId: number) => {
    if (!client) return;
    const tryWsDelete = () => {
      try {
        connectionRef.current?.sendJson({ type: "delete", messageId });
      } catch {
        /* socket not open */
      }
    };

    if (client.isAuthenticated()) {
      void client.deleteMessageRest(messageId).catch((err) => {
        // eslint-disable-next-line no-console
        console.error("[fluxychat] REST deleteMessage failed, falling back to WS:", err);
        tryWsDelete();
      });
      return;
    }
    tryWsDelete();
  };

  const invokeAgent = async (
    content: string,
    options?: {
      agentId?: string;
      replyTo?: number | null;
    },
  ) => {
    if (!client) {
      throw new Error("useChat requires a FluxyChatClient or FluxyRealtimeProvider");
    }
    const targetAgentId = options?.agentId || agentId;
    if (!targetAgentId) {
      throw new Error("invokeAgent requires an agentId in hook options or call options");
    }
    setAgentTyping(true);
    try {
      return await client.invokeAgentRest(targetAgentId, roomId, content, {
        replyTo: options?.replyTo,
      });
    } finally {
      setAgentTyping(false);
    }
  };

  return {
    messages,
    hasMore,
    isLoadingMore,
    loadMore,
    online,
    typingUsers,
    seenBy,
    onlineUsers,
    connected,
    connectionStatus,
    reconnectAttempt,
    connectionError,
    agentTyping,
    typingAgentId: wsTypingAgentId ?? invokeTypingAgentId,
    reactions,
    sendMessage,
    setTyping,
    editMessage,
    sendReaction,
    sendReadReceipt,
    deleteMessage,
    invokeAgent,
  };
}
