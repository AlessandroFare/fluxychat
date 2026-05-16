import * as React from "react";
import type { FluxyChatAttachment, FluxyChatMessage } from "@fluxy-chat/sdk";
import { AgentTypingIndicator } from "./agent-typing-indicator";
import { ChannelList } from "./channel-list";
import { MessageInput } from "./message-input";
import { MessageItem } from "./message-item";
import { MessageList } from "./message-list";
import { PresenceList } from "./presence-list";
import { TypingUsersIndicator } from "./typing-users-indicator";

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
  onSend: (
    content: string,
    replyTo?: number | null,
    attachments?: FluxyChatAttachment[]
  ) => void;
  onTyping?: (isTyping: boolean) => void;
  onEditMessage?: (messageId: number, content: string) => void;
  onReact?: (messageId: number, emoji: string) => void;
  reactions?: Record<number, Record<string, number>>;
  onDeleteMessage?: (messageId: number) => void;
  /** When set, renders `ChannelList` above the transcript (wire to useRooms). */
  channels?: Array<{ id: string; name?: string; unreadCount?: number }>;
  activeChannelId?: string;
  onSelectChannel?: (roomId: string) => void;
  channelsDisabled?: boolean;
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
  onlineUserIds,
  agentTyping = false,
  agentTypingLabel,
  messageListVirtualization,
  mentionSuggestions = [],
  typingAgentId = null,
  uploadComposerFile,
}: ChatWindowProps) {
  const [draft, setDraft] = React.useState("");
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [editingText, setEditingText] = React.useState("");
  const [replyToId, setReplyToId] = React.useState<number | null>(null);
  const [replyToPreview, setReplyToPreview] = React.useState<string | null>(null);
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
    if (editingId !== null) {
      if (editingText.trim() && onEditMessage) onEditMessage(editingId, editingText.trim());
      setEditingId(null);
      setEditingText("");
      return;
    }
    if (!draft.trim()) return;
    onSend(draft.trim(), replyToId, pendingAttachments);
    setDraft("");
    setReplyToId(null);
    setReplyToPreview(null);
    setPendingAttachments([]);
    onTyping?.(false);
  }, [
    editingId,
    editingText,
    draft,
    replyToId,
    pendingAttachments,
    onSend,
    onEditMessage,
    onTyping,
  ]);

  const listFooter = (
    <>
      <AgentTypingIndicator visible={agentTyping} label={agentTypingLabel} />
      <TypingUsersIndicator typingUsers={typingUsers} />
    </>
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        border: "1px solid #ddd",
        borderRadius: 8,
        height: 400,
        maxWidth: 420,
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      <PresenceList onlineCount={online} userIds={onlineUserIds} />
      {channels && onSelectChannel ? (
        <div style={{ borderBottom: "1px solid #eee", maxHeight: 140, overflowY: "auto" }}>
          <ChannelList
            channels={channels}
            activeId={activeChannelId}
            disabled={channelsDisabled}
            onSelect={onSelectChannel}
          />
        </div>
      ) : null}
      <MessageList
        messages={messages}
        virtualization={messageListVirtualization}
        renderMessage={(m) => (
          <MessageItem
            message={m}
            reactions={reactions?.[m.id]}
            seenByUserIds={seenBy?.[m.id]}
            onReply={() => startReply(m)}
            onEdit={onEditMessage ? () => startEdit(m) : undefined}
            onDelete={onDeleteMessage ? () => onDeleteMessage(m.id) : undefined}
            onReact={onReact ? (emoji) => onReact(m.id, emoji) : undefined}
          />
        )}
        footer={listFooter}
      />
      <MessageInput
        value={draft}
        onChange={setDraft}
        onTyping={onTyping}
        editingMessageId={editingId}
        editingValue={editingText}
        onEditingChange={setEditingText}
        replyToId={replyToId}
        replyPreview={replyToPreview}
        onCancelReply={() => {
          setReplyToId(null);
          setReplyToPreview(null);
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
      />
    </div>
  );
}
