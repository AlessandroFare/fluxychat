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
import { createStreamingEditBatcher } from "./streaming-edit-batcher";
import type {
  FluxyChatAttachment,
  FluxyChatClient,
  FluxyChatEvent,
  FluxyChatMessage,
} from "./index";
import type { FluxySendMessageOptions } from "./message-template";
import type { UseChatHistoryReplay } from "./use-chat";
import {
  decryptE2eContent,
  encryptE2eContent,
  isE2eContentEnvelope,
} from "./room-e2e";

export interface StartFluxyRoomSessionOptions {
  roomId: string;
  client: FluxyChatClient | null;
  agentId?: string;
  historyLimit?: number;
  replay?: UseChatHistoryReplay;
  replayHistoryOnReconnect?: boolean;
  markReadLatest?: boolean;
  presenceInfo?: Record<string, unknown>;
  /** Pusher-style cache channel: `cache=1` on WS connect. */
  wsCache?: "on" | "off";
  /** Optional E2E encryption for message bodies (requires room `e2eEnabled`). */
  e2eKey?: string;
  /** When true, fetch GET /rooms/:id/e2e-key on session start if e2eKey is unset. */
  e2eAutoFetch?: boolean;
  onAnyEvent?: (event: FluxyChatEvent) => void;
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
    markReadLatest = false,
    presenceInfo,
    wsCache,
    e2eKey: e2eKeyOption,
    e2eAutoFetch = false,
    onAnyEvent,
    onRefreshSession,
  } = options;

  const { setState, getState } = store;
  const historyOnConnect = replay === "connect";

  let active = true;
  const trimmedRoomId = roomId.trim();
  let e2eKeyRef = e2eKeyOption?.trim() || null;
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

  async function maybeDecryptContent(content: string): Promise<string> {
    if (!e2eKeyRef || !isE2eContentEnvelope(content)) return content;
    try {
      return await decryptE2eContent(content, e2eKeyRef);
    } catch {
      return content;
    }
  }

  async function maybeEncryptContent(content: string): Promise<string> {
    if (!e2eKeyRef) return content;
    return encryptE2eContent(content, e2eKeyRef);
  }

  const appendToolThreadEvent = (entry: FluxyToolThreadEvent) => {
    setState((s) => {
      if (s.toolThreadEvents.some((e) => e.key === entry.key)) return s;
      return { toolThreadEvents: [...s.toolThreadEvents, entry] };
    });
  };

  let scheduleMarkLatest: () => void = () => {};

  const streamEditBatcher = createStreamingEditBatcher((updates) => {
    setState((s) => {
      let messages = s.messages;
      for (const data of updates) {
        messages = messages.map((m) =>
          m.id === data.id
            ? {
                ...m,
                content: data.content,
                editedAt: data.editedAt,
                streaming: data.streaming ?? false,
              }
            : m,
        );
      }
      return { messages };
    });
  });

  const handleEvent = (data: FluxyChatEvent) => {
    if (data.type === "history" || data.type === "replay") {
      if (!historyOnConnect && data.type === "history") return;
      setState((s) => ({
        messages: mergeMessagesChronological(
          s.messages,
          sortMessagesChronological(data.messages),
        ),
        historyLoaded: true,
        ...(data.reactions ? { reactions: { ...s.reactions, ...data.reactions } } : {}),
      }));
      scheduleMarkLatest();
    } else if (data.type === "streamState") {
      setState((s) => {
        const normalized = {
          id: data.messageId,
          roomId: data.roomId,
          userId: data.userId,
          content: data.content,
          createdAt: data.createdAt,
          parentId: data.parentId ?? null,
          streaming: data.streaming,
        };
        const idx = s.messages.findIndex((m) => m.id === normalized.id);
        if (idx >= 0) {
          const next = [...s.messages];
          next[idx] = { ...next[idx], ...normalized };
          return { messages: sortMessagesChronological(next) };
        }
        return {
          messages: sortMessagesChronological([...s.messages, normalized]),
        };
      });
    } else if (data.type === "message") {
      void (async () => {
        const decrypted = await maybeDecryptContent(data.content ?? "");
        const payload = { ...data, content: decrypted };
        setState((s) => {
          const normalized = {
            ...payload,
            userId:
              payload.userId ??
              ("senderId" in payload && typeof payload.senderId === "string"
                ? payload.senderId
                : undefined) ??
              s.messages.find((m) => m.id === payload.id)?.userId,
          };
          const withPending =
            client && normalized.userId === client.userId
              ? tryMatchPendingByInbound(s.messages, normalized, client.userId)
              : s.messages;
          const idx = withPending.findIndex((m) => m.id === payload.id);
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
        scheduleMarkLatest();
      })();
    } else if (data.type === "presence") {
      setState({
        online: data.online,
        ...(data.users ? { onlineUsers: data.users } : {}),
        ...(data.members ? { presenceMembers: data.members } : {}),
      });
    } else if (data.type === "subscription_succeeded") {
      setState({
        subscriptionCount: data.subscriptionCount,
        presenceMembers: data.members ?? [],
        socketId: data.socketId ?? null,
      });
    } else if (data.type === "subscription_count") {
      setState({ subscriptionCount: data.subscriptionCount });
    } else if (data.type === "member_joined") {
      setState((s) => {
        const existing = s.presenceMembers.filter((m) => m.userId !== data.userId);
        return {
          presenceMembers: [
            ...existing,
            { userId: data.userId, userInfo: data.userInfo },
          ],
        };
      });
    } else if (data.type === "member_left") {
      setState((s) => ({
        presenceMembers: s.presenceMembers.filter((m) => m.userId !== data.userId),
      }));
    } else if (data.type === "cache_snapshot") {
      const inner = data.event;
      if (inner && typeof inner === "object" && inner.type === "message") {
        handleEvent(inner as FluxyChatEvent);
      }
    } else if (data.type === "server_event") {
      /* app-level handlers can listen on connection; no default store mutation */
    } else if (data.type === "typing") {
      setState((s) => ({
        typingUsers: { ...s.typingUsers, [data.userId]: data.isTyping },
        typingIntents: {
          ...s.typingIntents,
          [data.userId]: data.intent ?? (data.isTyping ? "composing" : "idle"),
        },
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
      if (data.streaming) {
        streamEditBatcher.push({
          id: data.id,
          content: data.content,
          editedAt: data.editedAt,
          streaming: true,
        });
        return;
      }
      streamEditBatcher.flush();
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
    } else if (data.type === "message_expired") {
      setState((s) => ({
        messages: s.messages.map((m) =>
          m.id === data.id
            ? {
                ...m,
                content: "[expired]",
                deletedAt: data.expiredAt ?? data.deletedAt,
                expiresAt: data.expiredAt ?? m.expiresAt,
              }
            : m,
        ),
      }));
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
    } else if (data.type === "message_updated") {
      setState((s) => {
        let found = false;
        const next = s.messages.map((m) => {
          if (m.id !== data.id || (data.roomId && m.roomId && m.roomId !== data.roomId)) {
            return m;
          }
          found = true;
          const patch: Partial<FluxyChatMessage> = {};
          if (data.kind !== undefined) patch.kind = data.kind;
          if (data.transcription !== undefined) patch.transcription = data.transcription;
          if (data.transcriptionStatus !== undefined) {
            patch.transcriptionStatus = data.transcriptionStatus;
          }
          return { ...m, ...patch };
        });
        if (!found) return s;
        return { messages: sortMessagesChronological(next) };
      });
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

    void (async () => {
      const outboundContent = await maybeEncryptContent(content);
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
        try {
          const serverMessage = await client.createMessage(
            trimmedRoomId,
            outboundContent,
            replyTo,
            attachments,
            clientMessageId,
            options,
          );
          if (!serverMessage) {
            failOptimistic("empty_response");
            return;
          }
          const ackId = serverMessage.clientMessageId ?? clientMessageId;
          setState((s) => ({
            messages: applyServerMessageAck(s.messages, serverMessage, ackId),
          }));
        } catch (err) {
          const message = err instanceof Error ? err.message : "send_failed";
          try {
            connectionRef?.sendJson({
              type: "message",
              userId: client.userId,
              content: outboundContent,
              parentId: replyTo ?? null,
              attachments: attachments ?? [],
              ...(options?.expiresInSeconds != null
                ? { expiresInSeconds: options.expiresInSeconds }
                : {}),
              ...(options?.expiresAt ? { expiresAt: options.expiresAt } : {}),
              ...(options?.visibility ? { visibility: options.visibility } : {}),
              ...(options?.visibleTo?.length ? { visibleTo: options.visibleTo } : {}),
            });
          } catch (wsErr) {
            failOptimistic(message);
            if (!(wsErr instanceof FluxySendError)) throw wsErr;
          }
        }
        return;
      }

      try {
        connectionRef?.sendJson({
          type: "message",
          userId: client.userId,
          content: outboundContent,
          parentId: replyTo ?? null,
          attachments: attachments ?? [],
          ...(options?.expiresInSeconds != null
            ? { expiresInSeconds: options.expiresInSeconds }
            : {}),
          ...(options?.expiresAt ? { expiresAt: options.expiresAt } : {}),
          ...(options?.visibility ? { visibility: options.visibility } : {}),
          ...(options?.visibleTo?.length ? { visibleTo: options.visibleTo } : {}),
        });
      } catch (err) {
        if (err instanceof FluxySendError) {
          failOptimistic("not_connected");
          return;
        }
        throw err;
      }
    })();
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
      scheduleMarkLatest();
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

  const loadLive = async () => {
    if (!client || !trimmedRoomId) return;
    try {
      const snapshot = await client.getRoomLive(trimmedRoomId);
      setState({ liveSnapshot: snapshot });
    } catch {
      /* live snapshot is best-effort; DO may be cold */
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

  let lastMarkedReadId = 0;

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

  const sendClientEvent = (eventName: string, data: unknown) => {
    if (!client) return;
    const name = eventName.startsWith("client-") ? eventName : `client-${eventName}`;
    try {
      connectionRef?.sendJson({
        type: "client_event",
        eventName: name,
        data,
      });
    } catch {
      /* ignore */
    }
  };

  const maybeMarkLatestRead = (messages: FluxyChatMessage[]) => {
    if (!markReadLatest || !client) return;
    const sorted = [...messages]
      .filter((m) => typeof m.id === "number" && !m.deletedAt)
      .sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
    const latest = sorted.length > 0 ? sorted[sorted.length - 1] : undefined;
    if (!latest?.id || latest.id <= lastMarkedReadId) return;
    lastMarkedReadId = latest.id;
    sendReadReceipt(latest.id);
  };

  scheduleMarkLatest = () => {
    if (!markReadLatest) return;
    queueMicrotask(() => maybeMarkLatestRead(getState().messages));
  };

  setState({
    sendMessage,
    retryMessage,
    loadHistory,
    loadMore,
    loadLive,
    setTyping,
    editMessage,
    sendReaction,
    sendReadReceipt,
    deleteMessage,
    invokeAgent,
    clearToolThread,
    sendClientEvent,
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
      .then(async (initial) => {
        if (!active) return;
        const decrypted = await Promise.all(
          initial.map(async (m) => ({
            ...m,
            content: await maybeDecryptContent(m.content ?? ""),
          })),
        );
        setState({
          messages: decrypted,
          hasMore: initial.length >= historyLimit,
          historyLoaded: true,
        });
      })
      .catch(() => {});
  } else {
    setState({ messages: [], hasMore: false, historyLoaded: false });
  }

  if (e2eAutoFetch && client?.isAuthenticated() && !e2eKeyRef) {
    void client.getRoomE2eKey(trimmedRoomId).then((res) => {
      if (res?.e2eKey) e2eKeyRef = res.e2eKey;
    });
  }

  let connection: FluxyChatRoomConnection | null = null;

  void (async () => {
    let reconnectBackoff: { baseBackoffMs?: number; maxBackoffMs?: number } = {};
    try {
      const flags = await client.getFeatureFlags();
      reconnectBackoff = flags.reconnectBackoff;
    } catch {
      /* keep SDK defaults */
    }
    if (!active) return;

    connection = client.connectRoom(trimmedRoomId, {
      ...reconnectBackoff,
      maxReconnectAttempts: MAX_WS_RECONNECT_ATTEMPTS,
      historyLimit,
      presenceInfo,
      wsCache,
      wsReplay: historyOnConnect ? "connect" : "off",
      replayHistoryOnReconnect: historyOnConnect && replayHistoryOnReconnect,
      onStatusChange: (status) => {
        if (!active || !connection) return;
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
        if (!active || !connection) return;
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
    if (onAnyEvent) {
      connection.onAnyEvent((data) => {
        if (active) onAnyEvent(data);
      });
    }
    connectionRef = connection;
    connection.connect();
  })();

  return () => {
    active = false;
    streamEditBatcher.flush();
    stopPollingFallback();
    stopSSEFallback();
    connection?.close();
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

