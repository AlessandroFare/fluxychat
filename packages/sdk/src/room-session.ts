import { FluxyAuthError, FluxySendError } from "./errors";
import {
  createFluxyRoomStore,
  syncRoomConnectionState,
  type FluxyRoomStore,
  type FluxyToolThreadEvent,
} from "./fluxy-room-store";
import {
  applyServerMessageAck,
  createClientMessageId,
  createOptimisticMessage,
  markMessageDeliveryFailed,
  tryMatchPendingByInbound,
} from "./message-delivery";
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
import type { FluxySendMessageOptions } from "./message-template";
import type { UseChatHistoryReplay } from "./use-chat";

export interface StartFluxyRoomSessionOptions {
  roomId: string;
  client: FluxyChatClient | null;
  agentId?: string;
  historyLimit?: number;
  replay?: UseChatHistoryReplay;
  replayHistoryOnReconnect?: boolean;
  onRefreshSession?: () => void;
}

export function startFluxyRoomSession(
  store: FluxyRoomStore,
  options: StartFluxyRoomSessionOptions,
): () => void {
  const {
    roomId,
    client,
    agentId,
    historyLimit = 50,
    replay = "connect",
    replayHistoryOnReconnect = true,
    onRefreshSession,
  } = options;

  const { setState, getState } = store;
  const historyOnConnect = replay === "connect";

  let active = true;
  const trimmedRoomId = roomId.trim();
  const MAX_WS_RECONNECT_ATTEMPTS = 6;
  const POLL_INTERVAL_MS = 4000;

  let connectionRef: FluxyChatRoomConnection | null = null;
  let sseRef: EventSource | null = null;
  let pollTimerRef: ReturnType<typeof setInterval> | null = null;

  const patchConnection = (
    patch: Parameters<typeof syncRoomConnectionState>[0],
  ) => {
    const current = getState();
    setState(syncRoomConnectionState(patch, current));
  };

  const appendToolThreadEvent = (entry: FluxyToolThreadEvent) => {
    setState((s) => {
      if (s.toolThreadEvents.some((e) => e.key === entry.key)) return s;
      return { toolThreadEvents: [...s.toolThreadEvents, entry] };
    });
  };

  const handleEvent = (data: FluxyChatEvent) => {
    if (data.type === "history") {
      if (!historyOnConnect) return;
      setState((s) => ({
        messages: mergeMessagesChronological(
          s.messages,
          sortMessagesChronological(data.messages),
        ),
        historyLoaded: true,
      }));
    } else if (data.type === "message") {
      setState((s) => {
        const normalized = {
          ...data,
          userId:
            data.userId ??
            ("senderId" in data && typeof data.senderId === "string"
              ? data.senderId
              : undefined) ??
            s.messages.find((m) => m.id === data.id)?.userId,
        };
        const withPending =
          client && normalized.userId === client.userId
            ? tryMatchPendingByInbound(s.messages, normalized, client.userId)
            : s.messages;
        const idx = withPending.findIndex((m) => m.id === data.id);
        if (idx >= 0) {
          const next = [...withPending];
          next[idx] = {
            ...next[idx],
            ...normalized,
            deliveryStatus: "sent",
            deliveryError: undefined,
          };
          return { messages: sortMessagesChronological(next) };
        }
        return {
          messages: sortMessagesChronological([
            ...withPending,
            { ...normalized, deliveryStatus: "sent" },
          ]),
        };
      });
    } else if (data.type === "presence") {
      setState({
        online: data.online,
        ...(data.users ? { onlineUsers: data.users } : {}),
      });
    } else if (data.type === "typing") {
      setState((s) => ({
        typingUsers: { ...s.typingUsers, [data.userId]: data.isTyping },
      }));
    } else if (data.type === "agentTyping") {
      setState({
        agentTyping: data.isTyping,
        wsTypingAgentId: data.isTyping ? data.agentId : null,
      });
    } else if (data.type === "tool_call") {
      appendToolThreadEvent({
        key: `${data.runId}:${data.toolCallId}:call`,
        kind: "tool_call",
        runId: data.runId,
        toolCallId: data.toolCallId,
        name: data.name,
        arguments: data.arguments,
      });
    } else if (data.type === "tool_result") {
      let preview: string | null = null;
      try {
        preview =
          data.result != null ? JSON.stringify(data.result).slice(0, 160) : null;
      } catch {
        preview = String(data.result);
      }
      appendToolThreadEvent({
        key: `${data.runId}:${data.toolCallId}:result`,
        kind: "tool_result",
        runId: data.runId,
        toolCallId: data.toolCallId,
        name: data.name,
        resultPreview: preview,
      });
    } else if (data.type === "tool_error") {
      appendToolThreadEvent({
        key: `${data.runId}:${data.toolCallId}:error`,
        kind: "tool_error",
        runId: data.runId,
        toolCallId: data.toolCallId,
        name: data.name,
        error: data.error ?? "tool_failed",
      });
    } else if (data.type === "agentRun") {
      setState({ lastAgentRun: data.run });
    } else if (data.type === "edit") {
      setState((s) => ({
        messages: s.messages.map((m) =>
          m.id === data.id
            ? {
                ...m,
                content: data.content,
                editedAt: data.editedAt,
                streaming: data.streaming ?? false,
              }
            : m,
        ),
      }));
    } else if (data.type === "reaction") {
      setState((s) => {
        const byMessage = { ...s.reactions };
        const current = { ...(byMessage[data.messageId] || {}) };
        const existingCount = current[data.emoji] || 0;
        if (data.op === "remove") {
          const nextCount = Math.max(existingCount - 1, 0);
          if (nextCount === 0) delete current[data.emoji];
          else current[data.emoji] = nextCount;
        } else {
          current[data.emoji] = existingCount + 1;
        }
        if (Object.keys(current).length === 0) delete byMessage[data.messageId];
        else byMessage[data.messageId] = current;
        return { reactions: byMessage };
      });
    } else if (data.type === "read") {
      setState((s) => {
        const existing = s.seenBy[data.messageId] || [];
        if (existing.includes(data.userId)) return s;
        return {
          seenBy: {
            ...s.seenBy,
            [data.messageId]: [...existing, data.userId],
          },
        };
      });
    } else if (data.type === "delete") {
      if (data.hard) {
        setState((s) => ({
          messages: s.messages.filter((m) => m.id !== data.id),
        }));
      } else {
        setState((s) => ({
          messages: s.messages.map((m) =>
            m.id === data.id
              ? { ...m, content: "[deleted]", deletedAt: data.deletedAt }
              : m,
          ),
        }));
      }
    }
  };

  const stopPollingFallback = () => {
    if (pollTimerRef) {
      clearInterval(pollTimerRef);
      pollTimerRef = null;
    }
  };

  const stopSSEFallback = () => {
    if (sseRef) {
      sseRef.close();
      sseRef = null;
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
          setState({
            messages: next,
            hasMore: next.length >= historyLimit,
          });
        }
      } catch {
        /* ignore */
      }
    };
    void tick();
    pollTimerRef = setInterval(tick, POLL_INTERVAL_MS);
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
    sseRef = es;
    patchConnection({ connectionStatus: "sse", connected: false });

    es.addEventListener("message", (event: MessageEvent) => {
      if (!active) return;
      try {
        handleEvent(JSON.parse(event.data) as FluxyChatEvent);
      } catch {
        /* ignore */
      }
    });

    es.addEventListener("error", () => {
      if (!active) return;
      stopSSEFallback();
      startPollingFallback();
      patchConnection({ connectionStatus: "polling", connected: false });
    });
  };

  const sendMessage = (
    content: string,
    replyTo?: number | null,
    attachments?: FluxyChatAttachment[],
    options?: FluxySendMessageOptions,
  ) => {
    if (!client || !trimmedRoomId) return;

    const clientMessageId = createClientMessageId();
    const displayContent = options?.templateId
      ? content || `[template:${options.templateId}]`
      : content;
    const optimistic = createOptimisticMessage({
      roomId: trimmedRoomId,
      userId: client.userId,
      content: displayContent,
      clientMessageId,
      parentId: replyTo ?? null,
      attachments,
    });
    setState((s) => ({
      messages: sortMessagesChronological([...s.messages, optimistic]),
    }));

    const failOptimistic = (errorMessage: string) => {
      setState((s) => ({
        messages: markMessageDeliveryFailed(s.messages, clientMessageId, errorMessage),
      }));
    };

    if (client.isAuthenticated()) {
      void client
        .createMessage(trimmedRoomId, content, replyTo, attachments, clientMessageId, {
          templateId: options?.templateId,
          templateVars: options?.templateVars,
        })
        .then((serverMessage) => {
          if (!serverMessage) {
            failOptimistic("empty_response");
            return;
          }
          const ackId = serverMessage.clientMessageId ?? clientMessageId;
          setState((s) => ({
            messages: applyServerMessageAck(s.messages, serverMessage, ackId),
          }));
        })
        .catch((err) => {
          const message = err instanceof Error ? err.message : "send_failed";
          try {
            connectionRef?.sendJson({
              type: "message",
              userId: client.userId,
              content,
              parentId: replyTo ?? null,
              attachments: attachments ?? [],
            });
          } catch (wsErr) {
            failOptimistic(message);
            if (!(wsErr instanceof FluxySendError)) throw wsErr;
          }
        });
      return;
    }

    try {
      connectionRef?.sendJson({
        type: "message",
        userId: client.userId,
        content,
        parentId: replyTo ?? null,
        attachments: attachments ?? [],
      });
    } catch (err) {
      if (err instanceof FluxySendError) {
        failOptimistic("not_connected");
        return;
      }
      throw err;
    }
  };

  const retryMessage = (clientMessageId: string) => {
    const failed = getState().messages.find(
      (m) =>
        m.clientMessageId === clientMessageId && m.deliveryStatus === "failed",
    );
    if (!failed) return;
    setState((s) => ({
      messages: s.messages.filter((m) => m.clientMessageId !== clientMessageId),
    }));
    sendMessage(failed.content, failed.parentId ?? null, failed.attachments);
  };

  const loadHistory = async () => {
    if (!client || !trimmedRoomId) return;
    try {
      const initial = await client.fetchMessages(trimmedRoomId, { limit: historyLimit });
      setState({
        messages: initial,
        hasMore: initial.length >= historyLimit,
        historyLoaded: true,
      });
    } catch {
      /* best-effort */
    }
  };

  const loadMore = async () => {
    const s = getState();
    if (!client || s.isLoadingMore || !s.hasMore || !trimmedRoomId) return;
    const chronological = sortMessagesChronological(s.messages);
    const oldest = chronological[0];
    if (!oldest?.createdAt) return;

    setState({ isLoadingMore: true });
    try {
      const older = await client.fetchMessages(trimmedRoomId, {
        limit: historyLimit,
        before: oldest.createdAt,
      });
      setState((prev) => ({
        messages: mergeMessagesChronological(prev.messages, older),
        hasMore: older.length >= historyLimit,
        isLoadingMore: false,
      }));
    } catch {
      setState({ isLoadingMore: false });
    }
  };

  const setTyping = (isTyping: boolean) => {
    if (!client) return;
    try {
      connectionRef?.sendJson({
        type: "typing",
        userId: client.userId,
        isTyping,
      });
    } catch {
      /* ignore */
    }
  };

  const editMessage = (messageId: number, content: string) => {
    if (!client) return;
    const tryWsEdit = () => {
      try {
        connectionRef?.sendJson({
          type: "edit",
          userId: client.userId,
          messageId,
          content,
        });
      } catch {
        /* ignore */
      }
    };
    if (client.isAuthenticated()) {
      void client.editMessageRest(messageId, content).catch(() => tryWsEdit());
      return;
    }
    tryWsEdit();
  };

  const sendReaction = (
    messageId: number,
    emoji: string,
    op: "add" | "remove" = "add",
  ) => {
    if (!client) return;
    if (client.isAuthenticated()) {
      void client.sendReactionRest(messageId, emoji, op).catch(() => {
        try {
          connectionRef?.sendJson({
            type: "reaction",
            userId: client.userId,
            messageId,
            emoji,
            op,
          });
        } catch {
          /* ignore */
        }
      });
      return;
    }
    try {
      connectionRef?.sendJson({
        type: "reaction",
        userId: client.userId,
        messageId,
        emoji,
        op,
      });
    } catch {
      /* ignore */
    }
  };

  const sendReadReceipt = (messageId: number) => {
    if (!client) return;
    if (client.isAuthenticated()) {
      void client.markReadRest(trimmedRoomId, messageId).catch(() => {
        try {
          connectionRef?.sendJson({
            type: "read",
            userId: client.userId,
            messageId,
          });
        } catch {
          /* ignore */
        }
      });
      return;
    }
    try {
      connectionRef?.sendJson({
        type: "read",
        userId: client.userId,
        messageId,
      });
    } catch {
      /* ignore */
    }
  };

  const deleteMessage = (messageId: number) => {
    if (!client) return;
    const tryWsDelete = () => {
      try {
        connectionRef?.sendJson({ type: "delete", messageId });
      } catch {
        /* ignore */
      }
    };
    if (client.isAuthenticated()) {
      void client.deleteMessageRest(messageId).catch(() => tryWsDelete());
      return;
    }
    tryWsDelete();
  };

  const invokeAgent = async (
    content: string,
    invokeOptions?: { agentId?: string; replyTo?: number | null },
  ) => {
    if (!client) {
      throw new Error("Fluxy room session requires a FluxyChatClient");
    }
    const targetAgentId = invokeOptions?.agentId || agentId;
    if (!targetAgentId) {
      throw new Error("invokeAgent requires an agentId");
    }
    setState({ agentTyping: true, invokeTypingAgentId: targetAgentId });
    try {
      return await client.invokeAgentRest(targetAgentId, trimmedRoomId, content, {
        replyTo: invokeOptions?.replyTo,
      });
    } finally {
      setState({ agentTyping: false, invokeTypingAgentId: null });
    }
  };

  const clearToolThread = () => {
    setState({ toolThreadEvents: [], lastAgentRun: null });
  };

  setState({
    sendMessage,
    retryMessage,
    loadHistory,
    loadMore,
    setTyping,
    editMessage,
    sendReaction,
    sendReadReceipt,
    deleteMessage,
    invokeAgent,
    clearToolThread,
  });

  if (!client || !trimmedRoomId || !client.isAuthenticated()) {
    setState({
      messages: [],
      hasMore: false,
      ...syncRoomConnectionState(
        { connectionStatus: "disconnected", connected: false },
        getState(),
      ),
    });
    return () => {
      active = false;
    };
  }

  if (historyOnConnect) {
    void client
      .fetchMessages(trimmedRoomId, { limit: historyLimit })
      .then((initial) => {
        if (!active) return;
        setState({
          messages: initial,
          hasMore: initial.length >= historyLimit,
          historyLoaded: true,
        });
      })
      .catch(() => {});
  } else {
    setState({ messages: [], hasMore: false, historyLoaded: false });
  }

  const connection = client.connectRoom(trimmedRoomId, {
    maxReconnectAttempts: MAX_WS_RECONNECT_ATTEMPTS,
    historyLimit,
    replayHistoryOnReconnect: historyOnConnect && replayHistoryOnReconnect,
    onStatusChange: (status) => {
      if (!active) return;
      if (status === "connected") {
        stopPollingFallback();
        stopSSEFallback();
        patchConnection({
          connectionStatus: "connected",
          connected: true,
          reconnectAttempt: 0,
          connectionError: null,
          reconnectDelayMs: 0,
        });
      } else if (status === "connecting") {
        patchConnection({
          connectionStatus: "connecting",
          connected: false,
        });
      } else if (status === "reconnecting") {
        patchConnection({
          connectionStatus: "reconnecting",
          connected: false,
          reconnectAttempt: connection.reconnectAttempts,
          reconnectDelayMs: connection.getScheduledReconnectDelayMs(),
        });
      } else if (status === "disconnected") {
        patchConnection({
          connectionStatus: "disconnected",
          connected: false,
        });
      }
    },
    onAuthError: (err) => {
      if (!active) return;
      patchConnection({
        connectionStatus: "disconnected",
        connected: false,
        connectionError: err,
      });
      onRefreshSession?.();
    },
    onConnectionError: (err) => {
      if (!active || err instanceof FluxyAuthError) return;
      patchConnection({ connectionError: err });
    },
    onReconnectFailed: () => {
      if (!active) return;
      patchConnection({
        reconnectAttempt: connection.reconnectAttempts,
      });
      if (client.isAuthenticated()) startSSEFallback();
      else startPollingFallback();
    },
  });

  connection.addEventListener("message", (data) => {
    if (active) handleEvent(data);
  });
  connectionRef = connection;
  connection.connect();

  return () => {
    active = false;
    stopPollingFallback();
    stopSSEFallback();
    connection.close();
    connectionRef = null;
    patchConnection({ connectionStatus: "disconnected", connected: false });
  };
}

/** Create store + start session (Vue/Solid/Node — no React). */
export function createFluxyRoomSession(
  options: StartFluxyRoomSessionOptions,
): { store: FluxyRoomStore; stop: () => void } {
  const store = createFluxyRoomStore();
  const stop = startFluxyRoomSession(store, options);
  return { store, stop };
}
