"use client";

import type { FluxyChatMessage } from "@fluxy-chat/sdk";
import { MessageItem } from "@fluxy-chat/ui";
import { VoiceMessageBubble } from "~/components/voice/voice-message-bubble";
import { ThreadSummary } from "./thread-summary";

/**
 * Dashboard-specific adapter that maps the AgentRoomChat's prop contract onto
 * the shared `MessageItem` from `@fluxy-chat/ui`.
 *
 * The public props mirror the legacy AgentRoomMessage exactly, so callers
 * (agent-room-chat.tsx) and tests (agent-room-message.test.tsx) don't change.
 * Internally we delegate rendering to the single-source-of-truth MessageItem,
 * then layer the two dashboard-only concerns on top:
 *   - voice messages (VoiceMessageBubble, kind === "voice")
 *   - thread TL;DR (ThreadSummary for top-level messages)
 *
 * All data-testid / data-* selectors are preserved:
 *   agent-message | agent-message-streaming | data-streaming | data-message-id
 */
export interface AgentRoomMessageProps {
  message: FluxyChatMessage;
  agentId: string;
  localUserId?: string;
  roomId?: string;
  replyCount?: number;
  /** Parent message when this row is a reply. */
  parentMessage?: FluxyChatMessage | null;
  onReply?: (messageId: number) => void;
  onRetry?: (clientMessageId: string) => void;
  /** User IDs that have read this message (Area 5.5). */
  seenBy?: string[];
  /** Worker origin for relative attachment URLs. */
  mediaBaseUrl?: string;
}

export function AgentRoomMessage({
  message,
  agentId,
  localUserId,
  roomId,
  replyCount = 0,
  parentMessage,
  onReply,
  onRetry,
  seenBy,
  mediaBaseUrl,
}: AgentRoomMessageProps) {
  const author = message.userId?.trim() || "unknown";
  const isAgent = author === agentId;
  const isStreaming = Boolean(message.streaming);
  const isVoice = message.kind === "voice";
  const parentId = message.parentId ?? null;

  return (
    <div
      data-testid={isStreaming ? "agent-message-streaming" : "agent-message"}
      data-streaming={isStreaming ? "true" : undefined}
      data-message-id={message.id != null ? String(message.id) : undefined}
    >
      <MessageItem
        message={isVoice ? { ...message, content: "" } : message}
        variant={isAgent ? "agent" : "user"}
        agentLabel="agent"
        authorName={author}
        localUserId={localUserId}
        mediaBaseUrl={mediaBaseUrl}
        parentMessage={parentMessage}
        seenByUserIds={seenBy}
        onReply={onReply && message.id != null && !isStreaming ? () => onReply(message.id!) : undefined}
        onRetry={message.clientMessageId && onRetry ? onRetry : undefined}
        reactions={message.reactions}
        className="w-full"
      />

      {/* Voice messages render the custom player (dashboard-only) */}
      {isVoice ? (
        <div className="mt-1">
          <VoiceMessageBubble
            message={message}
            className={localUserId && author === localUserId ? "items-end" : "items-start"}
          />
        </div>
      ) : null}

      {/* Thread TL;DR â€” only for top-level, non-streaming messages with an id */}
      {roomId && message.id && !parentId && !isStreaming ? (
        <ThreadSummary
          roomId={roomId}
          messageId={message.id}
          replyCount={replyCount}
          className="mt-2"
        />
      ) : null}
    </div>
  );
}
