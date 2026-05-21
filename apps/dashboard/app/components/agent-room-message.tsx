"use client";

import type { FluxyChatMessage } from "@fluxy-chat/sdk";
import { CornerDownRight, Reply } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./ui";

export interface AgentRoomMessageProps {
  message: FluxyChatMessage;
  agentId: string;
  localUserId?: string;
  /** Parent message when this row is a reply. */
  parentMessage?: FluxyChatMessage | null;
  onReply?: (messageId: number) => void;
}

function displayUserId(message: FluxyChatMessage): string {
  return message.userId?.trim() || "unknown";
}

function quoteSnippet(content: string, maxLen = 120): string {
  const oneLine = content.replace(/\s+/g, " ").trim();
  if (oneLine.length <= maxLen) return oneLine;
  return `${oneLine.slice(0, maxLen)}…`;
}

export function AgentRoomMessage({
  message,
  agentId,
  localUserId,
  parentMessage,
  onReply,
}: AgentRoomMessageProps) {
  const author = displayUserId(message);
  const isAgent = author === agentId;
  const isSelf = Boolean(localUserId && author === localUserId);
  const isStreaming = Boolean(message.streaming);
  const parentId = message.parentId ?? null;

  return (
    <div
      className={cn(
        "group rounded-lg px-3 py-2 text-sm",
        isAgent ? "bg-brand/5 border border-brand/15" : "bg-background/80 border border-border/50",
        isSelf && !isAgent && "ml-4",
        isAgent && "mr-4",
      )}
      data-streaming={isStreaming ? "true" : undefined}
      data-testid={isStreaming ? "agent-message-streaming" : "agent-message"}
    >
      {parentId && parentMessage ? (
        <div
          className="mb-2 flex items-start gap-1.5 rounded-md border border-border/60 bg-muted/40 px-2 py-1.5 text-xs text-muted-foreground"
          data-testid="message-reply-quote"
        >
          <CornerDownRight className="mt-0.5 h-3 w-3 shrink-0 text-brand" aria-hidden />
          <span>
            <span className="font-medium text-foreground">{displayUserId(parentMessage)}</span>
            {": "}
            {quoteSnippet(parentMessage.content || "")}
          </span>
        </div>
      ) : null}
      <div className="mb-0.5 flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "font-medium",
            isAgent ? "text-brand" : "text-foreground",
          )}
        >
          {author}
        </span>
        {isAgent ? (
          <span className="rounded-full bg-brand/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-brand">
            agent
          </span>
        ) : null}
        {isStreaming ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand/60 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand" />
            </span>
            streaming
          </span>
        ) : null}
        {onReply && message.id && !isStreaming ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-auto h-6 gap-1 px-1.5 text-[10px] opacity-0 transition-opacity group-hover:opacity-100"
            onClick={() => onReply(message.id!)}
            aria-label="Reply to message"
          >
            <Reply className="h-3 w-3" aria-hidden />
            Reply
          </Button>
        ) : null}
      </div>
      <p className="whitespace-pre-wrap break-words text-foreground">
        {message.content || (isStreaming ? "" : "…")}
        {isStreaming ? (
          <span
            className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-brand align-middle"
            aria-hidden
          />
        ) : null}
      </p>
    </div>
  );
}
