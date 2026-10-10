import * as React from "react";
import type {
  FluxyChatAttachment,
  FluxyChatMessage,
  FluxyConnectionStateStatus,
} from "@fluxy-chat/sdk";
import { getConnectionStatusLabel, useChatSettings } from "@fluxy-chat/sdk";
import { AgentTypingIndicator } from "./agent-typing-indicator";
import { ChannelList, type ChannelListRoom } from "./channel-list";
import { MessageInput } from "./message-input";
import { MessageItem } from "./message-item";
import { MessageList } from "./message-list";
import { PresenceList } from "./presence-list";
import { RoomInfo, type RoomInfoOccupancy } from "./room-info";
import { TypingUsersIndicator } from "./typing-users-indicator";
import { windowMessages } from "./window-messages";

export interface MentionSuggestionItem {
  handle: string;
  label?: string;
  /** When set, pairing with SDK `typingAgentId` boosts this row while the agent responds. */
  agentId?: string;
}

export interface ChatWindowProps {
  messages: FluxyChatMessage[];
  online: number;
  typingUsers: Record<string, boolean>;
  seenBy?: Record<number, string[]>;
  onSend?: (
    content: string,
    replyTo?: number | null,
    attachments?: FluxyChatAttachment[],
    extras?: { quotedMessageId?: number | null },
  ) => void | Promise<void>;
  onTyping?: (isTyping: boolean) => void;
  onEditMessage?: (messageId: number, content: string) => void;
  onReact?: (messageId: number, emoji: string) => void;
  reactions?: Record<number, Record<string, number>>;
  onDeleteMessage?: (messageId: number) => void;
  /** When set, renders `ChannelList` above the transcript (wire to useRooms). */
  channels?: ChannelListRoom[];
  activeChannelId?: string;
  onSelectChannel?: (roomId: string) => void;
  channelsDisabled?: boolean;
  onAddRoom?: () => void;
  onLeaveRoom?: (roomId: string) => void;
  channelsCollapsed?: boolean;
  onToggleChannelsCollapse?: () => void;
  /** From useChat.onlineUsers — shown as chips when provided. */
  onlineUserIds?: string[];
  /** From useChat.agentTyping — shows SPEC AgentTypingIndicator. */
  agentTyping?: boolean;
  agentTypingLabel?: string;
  /** Default true for long histories. */
  messageListVirtualization?: boolean;
  /** Extra @handles for the composer (e.g. bot handles from `listAgents`). Merged with online users & recent @mentions from messages. */
  mentionSuggestions?: MentionSuggestionItem[];
  /** Resolved agent id currently drafting (`useChat().typingAgentId`). */
  typingAgentId?: string | null;
  /** Wired to SDK `FluxyChatClient.uploadFile` for real uploads (JWT + Worker R2 binding). */
  uploadComposerFile?: (
    file: File,
    kindHint: "image" | "file" | "audio"
  ) => Promise<FluxyChatAttachment | null | void>;
  /** Current viewer — used so own bubbles and receipts line up. */
  localUserId?: string;
  /** Hide the composer (public share / spectator). */
  readOnly?: boolean;
  composerInputId?: string;
  /** Ably ChatWindow `onError.sendMessage`. */
  onError?: {
    sendMessage?: (error: Error) => void;
    discontinuity?: (error: Error) => void;
  };
  /** Ably `enableTypingIndicators` (default true). */
  enableTypingIndicators?: boolean;
  /** Ably `windowSize` — only the latest N messages are rendered. */
  windowSize?: number;
  customHeaderContent?: React.ReactNode;
  customFooterContent?: React.ReactNode;
  /** Ably ChatWindow + `RoomInfo` when no custom header is passed. */
  roomName?: string;
  occupancy?: RoomInfoOccupancy;
  /** Ably `autoEnterPresence` (default true). */
  autoEnterPresence?: boolean;
  onEnterPresence?: () => void;
  /** Ably ChatMessageList `onViewLatest`. */
  onViewLatest?: () => void;
  onLoadMoreHistory?: () => void;
  hasMoreHistory?: boolean;
  isLoadingHistory?: boolean;
  loadMoreThreshold?: number;
  onMessageInView?: (message: FluxyChatMessage) => void;
  /** Stream unread separator (`firstUnreadMessageId` from catch-up). */
  firstUnreadMessageId?: number | null;
  /** Ably ChatWindow room-reaction bursts (footer). */
  roomReactions?: Array<{ name: string; userId: string }>;
  onSendRoomReaction?: (name: string) => void;
  /** Latest discontinuity ErrorInfo; shows a banner and calls `onError.discontinuity`. */
  discontinuity?: Error | null;
  /** Ably ChatWindow connection chrome (hidden while connected). */
  connectionStatus?: FluxyConnectionStateStatus;
  nextRetryAt?: string | null;
}

/** Composite chat layout built from SPEC §8 primitives (`MessageList`, `MessageInput`, …). */
export function ChatWindow({
  messages,
  online,
  typingUsers,
  onSend,
  onTyping,
  seenBy,
  onEditMessage,
  onReact,
  reactions,
  onDeleteMessage,
  channels,
  activeChannelId,
  onSelectChannel,
  channelsDisabled,
  onAddRoom,
  onLeaveRoom,
  channelsCollapsed,
  onToggleChannelsCollapse,
  onlineUserIds,
  agentTyping = false,
  agentTypingLabel,
  messageListVirtualization,
  mentionSuggestions = [],
  typingAgentId = null,
  uploadComposerFile,
  localUserId,
  readOnly = false,
  composerInputId,
  onError,
  enableTypingIndicators = true,
  windowSize,
  customHeaderContent,
  customFooterContent,
  roomName,
  occupancy,
  autoEnterPresence = true,
  onEnterPresence,
  onViewLatest,
  onLoadMoreHistory,
  hasMoreHistory,
  isLoadingHistory,
  loadMoreThreshold,
  onMessageInView,
  firstUnreadMessageId,
  roomReactions,
  onSendRoomReaction,
  discontinuity,
  connectionStatus,
  nextRetryAt,
}: ChatWindowProps) {
  const { getEffectiveSettings } = useChatSettings();
  const chatSettings = getEffectiveSettings(roomName);
  const [sendError, setSendError] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState("");
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [editingText, setEditingText] = React.useState("");
  const [replyToId, setReplyToId] = React.useState<number | null>(null);
  const [replyToPreview, setReplyToPreview] = React.useState<string | null>(null);
  const [quoteToId, setQuoteToId] = React.useState<number | null>(null);
  const [quoteToPreview, setQuoteToPreview] = React.useState<string | null>(null);
  const [pendingAttachments, setPendingAttachments] = React.useState<FluxyChatAttachment[]>(
    []
  );

  const startEdit = React.useCallback((m: FluxyChatMessage) => {
    setEditingId(m.id);
    setEditingText(m.content);
  }, []);

  const startReply = React.useCallback((m: FluxyChatMessage) => {
    setReplyToId(m.id);
    setReplyToPreview(m.content.slice(0, 80));
    setQuoteToId(null);
    setQuoteToPreview(null);
  }, []);

  const startQuote = React.useCallback((m: FluxyChatMessage) => {
    setQuoteToId(m.id);
    setQuoteToPreview(m.content.slice(0, 80));
    setReplyToId(null);
    setReplyToPreview(null);
  }, []);

  const mergedMentionSuggestions = React.useMemo(() => {
    const map = new Map<string, MentionSuggestionItem>();
    for (const uid of onlineUserIds || []) {
      const h = uid.trim();
      if (h && !/[\s\n\r]/.test(h)) map.set(h.toLowerCase(), { handle: h, label: h });
    }
    for (const m of messages) {
      const content = typeof m.content === "string" ? m.content : "";
      const r = /@([\w-]{1,48})/g;
      let x: RegExpExecArray | null;
      while ((x = r.exec(content))) {
        const h = x[1];
        if (h.length) map.set(h.toLowerCase(), { handle: h, label: h });
      }
    }
    for (const s of mentionSuggestions) {
      if (!s.handle) continue;
      const item: MentionSuggestionItem = {
        handle: s.handle,
        label: s.label ?? s.handle,
        ...(s.agentId ? { agentId: s.agentId } : {}),
      };
      map.set(s.handle.toLowerCase(), item);
    }
    return [...map.values()];
  }, [messages, onlineUserIds, mentionSuggestions]);

  const firstContactNotice = React.useMemo(() => {
    const hit = messages.find(
      (m) => m.participantType === "ai" && m.metadata?.firstContactInRoom && m.metadata?.firstContactNotice,
    );
    return typeof hit?.metadata?.firstContactNotice === "string" ? hit.metadata.firstContactNotice : null;
  }, [messages]);

  const mentionPrioritizeHandles = React.useMemo(() => {
    const prio: string[] = [];
    for (const [uid, typing] of Object.entries(typingUsers)) {
      if (!typing) continue;
      const h = uid.trim();
      if (h && !/[\s\n\r]/.test(h)) prio.push(h.toLowerCase());
    }
    if (typingAgentId && mentionSuggestions.length) {
      const row = mentionSuggestions.find((s) => s.agentId === typingAgentId);
      if (row?.handle) prio.push(row.handle.replace(/^@/, "").toLowerCase());
    }
    const seen = new Set<string>();
    return prio.filter((k) => (seen.has(k) ? false : (seen.add(k), true)));
  }, [typingUsers, typingAgentId, mentionSuggestions]);

  const handleSubmit = React.useCallback(() => {
    const run = async () => {
      if (editingId !== null) {
        if (editingText.trim() && onEditMessage) onEditMessage(editingId, editingText.trim());
        setEditingId(null);
        setEditingText("");
        setSendError(null);
        return;
      }
      if (!draft.trim() || !onSend) return;
      await onSend(
        draft.trim(),
        replyToId,
        pendingAttachments,
        quoteToId != null ? { quotedMessageId: quoteToId } : undefined,
      );
      setDraft("");
      setReplyToId(null);
      setReplyToPreview(null);
      setQuoteToId(null);
      setQuoteToPreview(null);
      setPendingAttachments([]);
      onTyping?.(false);
      setSendError(null);
    };
    return run().catch((err: unknown) => {
      const error = err instanceof Error ? err : new Error(String(err));
      setSendError(error.message);
      onError?.sendMessage?.(error);
    });
  }, [
    editingId,
    editingText,
    draft,
    replyToId,
    quoteToId,
    pendingAttachments,
    onSend,
    onEditMessage,
    onTyping,
    onError,
  ]);

  const renderedMessages = React.useMemo(
    () => windowMessages(messages, windowSize),
    [messages, windowSize],
  );

  React.useEffect(() => {
    if (!autoEnterPresence) return;
    onEnterPresence?.();
  }, [autoEnterPresence, onEnterPresence]);

  React.useEffect(() => {
    if (!discontinuity) return;
    onError?.discontinuity?.(discontinuity);
  }, [discontinuity, onError]);

  const listFooter = (
    <>
      {enableTypingIndicators ? (
        <>
          <AgentTypingIndicator visible={agentTyping} label={agentTypingLabel} />
          <TypingUsersIndicator typingUsers={typingUsers} />
        </>
      ) : null}
    </>
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        border: "1px solid #5c5c5c",
        borderRadius: 8,
        height: 400,
        maxWidth: 420,
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      {customHeaderContent || roomName ? (
        <div data-testid="chat-window-header">
          {customHeaderContent ?? (
            <RoomInfo
              roomName={roomName ?? ""}
              occupancy={occupancy}
              connections={occupancy?.connections ?? online}
              presenceMembers={occupancy?.presenceMembers}
            />
          )}
        </div>
      ) : null}
      <PresenceList onlineCount={online} userIds={onlineUserIds} />
      {connectionStatus && connectionStatus !== "connected" && connectionStatus !== "idle" ? (
        <p
          role="status"
          data-testid="chat-window-connection"
          className="border-b border-border px-3 py-2 text-xs text-muted-foreground"
        >
          {getConnectionStatusLabel(connectionStatus, { nextRetryAt })}
        </p>
      ) : null}
      {discontinuity ? (
        <p
          role="alert"
          data-testid="chat-window-discontinuity"
          className="border-b border-border px-3 py-2 text-xs text-destructive"
        >
          {discontinuity.message || "Connection skipped messages. Reload history."}
        </p>
      ) : null}
      {firstContactNotice ? (
        <p
          className="border-b border-border px-3 py-2 text-xs text-muted-foreground"
          data-testid="art50-first-contact"
          role="status"
        >
          {firstContactNotice}
        </p>
      ) : null}
      {channels && onSelectChannel ? (
        <div style={{ borderBottom: "1px solid #5c5c5c", maxHeight: 140, overflowY: "auto" }}>
          <ChannelList
            channels={channels}
            activeId={activeChannelId}
            disabled={channelsDisabled}
            onSelect={onSelectChannel}
            onAddRoom={onAddRoom}
            onLeaveRoom={onLeaveRoom}
            isCollapsed={channelsCollapsed}
            onToggleCollapse={onToggleChannelsCollapse}
          />
        </div>
      ) : null}
      <MessageList
        messages={renderedMessages}
        onViewLatest={onViewLatest}
        onLoadMoreHistory={onLoadMoreHistory}
        hasMoreHistory={hasMoreHistory}
        isLoading={isLoadingHistory}
        loadMoreThreshold={loadMoreThreshold}
        onMessageInView={onMessageInView}
        firstUnreadMessageId={firstUnreadMessageId}
        renderMessage={(m) => (
          <MessageItem
            message={m}
            localUserId={localUserId}
            reactions={reactions?.[m.id]}
            seenByUserIds={seenBy?.[m.id]}
            parentMessage={(() => {
              const quotedId = m.quotedMessageId ?? (typeof m.metadata?.quotedMessageId === "number" ? m.metadata.quotedMessageId : null);
              const id = m.parentId ?? quotedId;
              return id != null ? renderedMessages.find((row) => row.id === id) ?? null : null;
            })()}
            onReply={readOnly ? undefined : () => startReply(m)}
            onQuote={readOnly ? undefined : () => startQuote(m)}
            onEdit={
              !readOnly &&
              onEditMessage &&
              (localUserId && m.userId === localUserId
                ? chatSettings.allowMessageUpdatesOwn
                : chatSettings.allowMessageUpdatesAny)
                ? () => startEdit(m)
                : undefined
            }
            onDelete={
              !readOnly &&
              onDeleteMessage &&
              (localUserId && m.userId === localUserId
                ? chatSettings.allowMessageDeletesOwn
                : chatSettings.allowMessageDeletesAny)
                ? () => {
                    if (!window.confirm("Delete this message?")) return;
                    onDeleteMessage(m.id);
                  }
                : undefined
            }
            onReact={
              !readOnly && onReact && chatSettings.allowMessageReactions
                ? (emoji) => onReact(m.id, emoji)
                : undefined
            }
          />
        )}
        footer={listFooter}
      />
      {readOnly ? (
        <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
          Read-only live view
        </p>
      ) : (
        <>
          {sendError ? (
            <p
              role="alert"
              data-testid="chat-window-send-error"
              className="border-t border-border px-3 py-1 text-xs text-destructive"
            >
              {sendError}
            </p>
          ) : null}
          <MessageInput
            value={draft}
            onChange={setDraft}
            onTyping={enableTypingIndicators ? onTyping : undefined}
            enableTyping={enableTypingIndicators}
            onSendError={(error) => {
              setSendError(error.message);
              onError?.sendMessage?.(error);
            }}
            editingMessageId={editingId}
            editingValue={editingText}
            onEditingChange={setEditingText}
            replyToId={replyToId}
            replyPreview={replyToPreview}
            onCancelReply={() => {
              setReplyToId(null);
              setReplyToPreview(null);
            }}
            quoteToId={quoteToId}
            quotePreview={quoteToPreview}
            onCancelQuote={() => {
              setQuoteToId(null);
              setQuoteToPreview(null);
            }}
            pendingAttachments={pendingAttachments}
            onRemoveAttachment={(idx) =>
              setPendingAttachments((prev) => prev.filter((_, i) => i !== idx))
            }
            onAppendAttachments={(next) =>
              setPendingAttachments((prev) => [...prev, ...next])
            }
            onSubmit={handleSubmit}
            mentionSuggestions={mergedMentionSuggestions}
            mentionPrioritizeHandles={mentionPrioritizeHandles}
            uploadComposerFile={uploadComposerFile}
            composerInputId={composerInputId}
          />
          {roomReactions?.length || onSendRoomReaction ? (
            <div
              data-testid="room-reaction-bursts"
              className="flex flex-wrap items-center gap-1 border-t border-border px-2 py-1"
            >
              {(roomReactions ?? []).slice(-8).map((burst, index) => (
                <span key={`${burst.userId}-${burst.name}-${index}`} className="text-sm" title={burst.userId}>
                  {burst.name}
                </span>
              ))}
              {onSendRoomReaction ? (
                <button
                  type="button"
                  className="ml-auto text-sm"
                  aria-label="Send room reaction"
                  onClick={() => onSendRoomReaction("👏")}
                >
                  👏
                </button>
              ) : null}
            </div>
          ) : null}
          {customFooterContent ? (
            <div data-testid="chat-window-footer">{customFooterContent}</div>
          ) : null}
        </>
      )}
    </div>
  );
}

