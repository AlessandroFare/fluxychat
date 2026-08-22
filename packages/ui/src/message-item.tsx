import * as React from "react";
import type { FluxyChatAttachment, FluxyChatMessage } from "@fluxy-chat/sdk";
import {
  Message,
  MessageHeader,
  MessageContent,
  MessageFooter,
  MessageHoverToolbar,
  messageToolbarButtonClass,
} from "./primitives/message";
import {
  Bubble,
  BubbleContent,
  BubbleReactions,
} from "./primitives/bubble";
import { Attachment, AttachmentMedia, AttachmentContent, AttachmentTitle, AttachmentDescription } from "./primitives/attachment";
import { Marker, MarkerIcon, MarkerContent } from "./primitives/marker";
import { cn } from "./lib/utils";
import { renderContentWithMentions } from "./render-content-with-mentions";
import { safeUrl } from "./safe-url";
import { resolveMediaUrl } from "./resolve-media-url";

// ─── Icon helpers (avoid a hard dependency on lucide-react at the primitive level) ───

/** Small file icon SVG — used when lucide-react is not in the bundle. */
function FileIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
    </svg>
  );
}

function ImageIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </svg>
  );
}

function ReplyIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="9 17 4 12 9 7" />
      <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
    </svg>
  );
}

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  );
}

function CornerDownRightIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="9 10 4 15 9 20" />
      <path d="M20 4v7a4 4 0 0 1-4 4H4" />
    </svg>
  );
}

// ─── OG Preview card ───

function OgPreviewCard({ preview }: { preview: NonNullable<FluxyChatMessage["preview"]> }) {
  const safeHref = safeUrl(preview.url);
  const safeImageHref = safeUrl(preview.imageUrl, { allowData: true });
  let hostname = safeHref ?? "";
  if (safeHref) {
    try { hostname = new URL(safeHref).hostname; } catch { /* keep raw */ }
  }
  if (!safeHref) return null;
  return (
    <a
      href={safeHref}
      target="_blank"
      rel="noreferrer"
      className="mt-2 block max-w-xs rounded-lg border border-border bg-card p-1.5 no-underline text-foreground transition-colors hover:bg-muted/50"
    >
      <div className="flex gap-2">
        {safeImageHref ? (
          <img src={safeImageHref} alt={preview.title ?? ""} className="h-12 w-12 shrink-0 rounded-md object-cover" />
        ) : null}
        <div className="min-w-0 flex-1">
          {preview.title ? <div className="truncate text-xs font-semibold">{preview.title}</div> : null}
          {preview.description ? <div className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{preview.description}</div> : null}
          <div className="mt-0.5 text-[10px] text-muted-foreground">{hostname}</div>
        </div>
      </div>
    </a>
  );
}

// ─── Attachment renderer ───

function AttachmentCard({
  attachment,
  mediaBaseUrl,
}: {
  attachment: FluxyChatAttachment;
  mediaBaseUrl?: string;
}) {
  const kind = attachment.kind as string;
  if (kind === "image") {
    const src = safeUrl(resolveMediaUrl(attachment.url, mediaBaseUrl), { allowData: true });
    if (!src) return null;
    return (
      <Attachment size="sm" className="mt-2">
        <AttachmentMedia variant="image">
          <img src={src} alt={attachment.name} className="aspect-square w-full object-cover" />
        </AttachmentMedia>
        <AttachmentContent>
          <AttachmentTitle>{attachment.name}</AttachmentTitle>
          {attachment.sizeBytes ? (
            <AttachmentDescription>{(attachment.sizeBytes / 1024).toFixed(0)} KB</AttachmentDescription>
          ) : null}
        </AttachmentContent>
      </Attachment>
    );
  }
  if (kind === "audio") {
    const src = safeUrl(resolveMediaUrl(attachment.url, mediaBaseUrl), { allowData: true });
    if (!src) return null;
    return (
      <Attachment size="sm" className="mt-2">
        <AttachmentMedia variant="icon">🎵</AttachmentMedia>
        <AttachmentContent>
          <AttachmentTitle>{attachment.name}</AttachmentTitle>
          <audio controls src={src} className="mt-1 max-w-full" />
        </AttachmentContent>
      </Attachment>
    );
  }
  if (kind === "location") {
    const href = safeUrl(resolveMediaUrl(attachment.url, mediaBaseUrl));
    if (!href) return null;
    return (
      <a href={href} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-primary underline underline-offset-2">
        📍 {attachment.name || "View location"}
      </a>
    );
  }
  // Generic file
  const href = safeUrl(resolveMediaUrl(attachment.url, mediaBaseUrl));
  if (!href) return null;
  return (
    <Attachment size="sm" className="mt-2" state="done">
      <AttachmentMedia>
        <FileIcon className="size-4" />
      </AttachmentMedia>
      <AttachmentContent>
        <AttachmentTitle>{attachment.name}</AttachmentTitle>
        {attachment.sizeBytes ? (
          <AttachmentDescription>{(attachment.sizeBytes / 1024).toFixed(0)} KB</AttachmentDescription>
        ) : null}
      </AttachmentContent>
    </Attachment>
  );
}

// ─── Reply quote ───

function quoteSnippet(content: string, maxLen = 120): string {
  const oneLine = content.replace(/\s+/g, " ").trim();
  if (oneLine.length <= maxLen) return oneLine;
  return `${oneLine.slice(0, maxLen)}…`;
}

// ─── Main MessageItem ───

export interface MessageItemProps {
  message: FluxyChatMessage;
  /** When "agent" or when senderId !== userId, renders agent chrome (label + variant). */
  variant?: "user" | "agent";
  /** Label shown on agent badge (default: "agent"). */
  agentLabel?: string;
  /** Custom display name for the message author. Defaults to `message.userId`. */
  authorName?: string;
  /** Resolved parent message — rendered as a styled quote block when present. */
  parentMessage?: FluxyChatMessage | null;
  /** Emoji reaction tallies keyed by emoji. */
  reactions?: Record<string, number>;
  /** User IDs that have read this message. */
  seenByUserIds?: string[];
  /** Local user ID — used to detect "self" for alignment and seen-by filtering. */
  localUserId?: string;
  /** Base URL for resolving relative attachment paths (Worker origin). */
  mediaBaseUrl?: string;
  // ── Action callbacks ──
  onReply?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onReact?: (emoji: string) => void;
  /** Retry sending a failed optimistic message. Receives the clientMessageId. */
  onRetry?: (clientMessageId: string) => void;
  // ── Custom class names ──
  className?: string;
  /** Extra data attributes forwarded to the outermost element (e.g. data-testid). */
  "data-testid"?: string;
  /** Extra data-streaming attribute forwarded to the outermost element. */
  "data-streaming"?: string;
  /** Extra data-message-id attribute forwarded to the outermost element. */
  "data-message-id"?: string;
}

/**
 * Single chat message bubble built on shadcn `Message` + `Bubble` primitives.
 * Supports: reply threading (resolved parent), streaming indicator (pulse+cursor),
 * delivery status (pending/failed/retry), attachments, OG preview, reactions,
 * seen-by, edit/delete actions, mention rendering, and agent/user alignment.
 */
export function MessageItem({
  message: m,
  variant = "user",
  agentLabel = "agent",
  authorName,
  parentMessage,
  reactions,
  seenByUserIds,
  localUserId,
  mediaBaseUrl,
  onReply,
  onEdit,
  onDelete,
  onReact,
  onRetry,
  className,
  "data-testid": testId,
  "data-streaming": dataStreaming,
  "data-message-id": dataMessageId,
}: MessageItemProps) {
  const isAgent =
    variant === "agent" || (m.senderId != null && m.senderId !== m.userId);
  const isSelf = Boolean(localUserId && m.userId === localUserId);
  const isStreaming = Boolean(m.streaming);
  const parentId = m.parentId ?? null;

  // Agent rooms: user on the right, agent + others on the left.
  const align: "start" | "end" = isSelf ? "end" : "start";
  const bubbleVariant = isSelf ? "sent" : isAgent ? "secondary" : "received";

  // Seen-by: filter out local user (only meaningful for messages you sent)
  const seenByOthers = isSelf
    ? (seenByUserIds ?? []).filter((uid) => uid && uid !== localUserId)
    : [];

  // Header: author name + agent badge + delivery status
  const displayName = authorName || m.userId;
  const hasReactions = Boolean(reactions && Object.keys(reactions).length > 0);

  return (
    <Message align={align} className={cn("gap-1", className)} data-testid={testId} data-streaming={dataStreaming} data-message-id={dataMessageId}>
      <MessageContent>
        <MessageHeader className={cn("px-0", align === "end" ? "justify-end text-right" : "justify-start")}>
          <span className={cn("text-xs font-medium", isAgent ? "text-brand" : "text-card-foreground")}>
            {displayName}
          </span>
          {isAgent ? (
            <span className="rounded-full bg-brand/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-brand ring-1 ring-brand/20">
              {agentLabel}
            </span>
          ) : null}
          {m.deliveryStatus === "pending" ? (
            <span className="text-[10px] text-muted-foreground">Sending…</span>
          ) : null}
          {m.deliveryStatus === "failed" ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-destructive">
              Failed to send
              {m.clientMessageId && onRetry ? (
                <button
                  type="button"
                  className="ml-0.5 rounded px-1 text-[10px] text-destructive hover:bg-destructive/10"
                  onClick={() => onRetry(m.clientMessageId!)}
                >
                  Retry
                </button>
              ) : null}
            </span>
          ) : null}
          {isStreaming ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
              </span>
              streaming
            </span>
          ) : null}
        </MessageHeader>

        {/* ── Reply quote ── */}
        {parentId && parentMessage ? (
          <Marker variant="default" className="mb-1.5 rounded-md bg-muted/40 px-2.5 py-1.5" data-testid="message-reply-quote">
            <MarkerIcon className="mt-0.5 shrink-0 text-primary">
              <CornerDownRightIcon className="size-3" />
            </MarkerIcon>
            <MarkerContent>
              <span className="font-medium text-foreground">{authorName || parentMessage.userId || parentMessage.userId}</span>
              {": "}
              {quoteSnippet(parentMessage.content || "")}
            </MarkerContent>
          </Marker>
        ) : null}

        {/* ── Bubble ── */}
        <Bubble variant={bubbleVariant} align={align} className={hasReactions ? "mb-5" : undefined}>
          {onReply && m.id && !isStreaming ? (
            <MessageHoverToolbar align={align}>
              <button type="button" onClick={onReply} className={messageToolbarButtonClass} aria-label="Reply to message">
                <ReplyIcon className="size-3" />
                Reply
              </button>
            </MessageHoverToolbar>
          ) : null}
          <BubbleContent>
            {/* ── Message body ── */}
            <p className={cn("whitespace-pre-wrap break-words", isSelf ? "text-primary-foreground" : "text-foreground")}>
              {renderContentWithMentions(m.content)}
              {m.content || isStreaming ? null : "…"}
              {isStreaming ? (
                <span
                  className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-primary align-middle"
                  aria-hidden
                />
              ) : null}
            </p>

            {/* ── Edited label ── */}
            {m.editedAt && !isStreaming ? (
              <div className="mt-1 text-[10px] text-muted-foreground">edited</div>
            ) : null}
          </BubbleContent>

          {/* ── Reactions ── */}
          {hasReactions ? (
            <BubbleReactions align={align === "end" ? "end" : "start"} side="bottom">
              {Object.entries(reactions!).map(([emoji, count]) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => onReact?.(emoji)}
                  className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[13px] text-slate-700 transition-colors hover:bg-slate-100"
                >
                  <span>{emoji}</span>
                  <span className="text-slate-500">{count}</span>
                </button>
              ))}
            </BubbleReactions>
          ) : null}
        </Bubble>

        {/* ── Attachments ── */}
        {m.attachments && m.attachments.length > 0 ? (
          <div className="mt-1 flex flex-col gap-2">
            {m.attachments.map((a) => (
              <AttachmentCard key={a.url} attachment={a} mediaBaseUrl={mediaBaseUrl} />
            ))}
          </div>
        ) : null}

        {/* ── OG preview ── */}
        {m.preview ? <OgPreviewCard preview={m.preview} /> : null}
      </MessageContent>

      {/* ── Footer: seen-by + action buttons ── */}
      {(seenByOthers.length > 0 || onEdit || onDelete || onReact) ? (
        <MessageFooter className="mt-0.5 flex-wrap items-center gap-2">
          {/* Edit / Delete / React */}
          <span className="inline-flex items-center gap-1">
            {onReact ? (
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground"
                onClick={() => onReact("👍")}
                aria-label="React"
              >
                👍
              </button>
            ) : null}
            {onEdit ? (
              <button
                type="button"
                className="inline-flex items-center gap-0.5 rounded px-1 text-[10px] text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                onClick={onEdit}
              >
                <PencilIcon className="size-3" />
                edit
              </button>
            ) : null}
            {onDelete ? (
              <button
                type="button"
                className="inline-flex items-center gap-0.5 rounded px-1 text-[10px] text-destructive hover:bg-destructive/10"
                onClick={onDelete}
              >
                <TrashIcon className="size-3" />
                delete
              </button>
            ) : null}
          </span>

          {/* Seen-by */}
          {seenByOthers.length > 0 ? (
            <span className="ml-auto text-[10px] text-muted-foreground" title={seenByOthers.length <= 3 ? `Seen by ${seenByOthers.join(", ")}` : undefined}>
              Seen by {seenByOthers.length <= 3 ? seenByOthers.join(", ") : `${seenByOthers.length} people`}
            </span>
          ) : null}
        </MessageFooter>
      ) : null}
    </Message>
  );
}
