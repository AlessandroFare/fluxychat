import * as React from "react";
import type { FluxyChatMessage } from "@fluxy-chat/sdk";
import {
  MessageScroller,
  MessageScrollerProvider,
  MessageScrollerButton,
  MessageScrollerViewport,
  MessageScrollerContent,
  MessageScrollerItem,
} from "./primitives/message-scroller";
import { Marker, MarkerContent } from "./primitives/marker";
import { cn } from "./lib/utils";

/** Extract the calendar date (YYYY-MM-DD) from an ISO timestamp. */
function toDay(iso: string): string {
  try {
    return iso.slice(0, 10);
  } catch {
    return "";
  }
}

/** Format a date string for display in a separator (e.g. "Jun 28, 2026"). */
function formatDay(dateStr: string): string {
  try {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return dateStr;
  }
}

export interface MessageListProps {
  messages: FluxyChatMessage[];
  /** Render function for each message row. */
  renderMessage: (message: FluxyChatMessage, index: number) => React.ReactNode;
  /** Typing indicator, AgentTypingIndicator, or other trailing content. */
  footer?: React.ReactNode;
  /** Show date separators between messages on different calendar days. Default: true. */
  showDateSeparators?: boolean;
  /** className forwarded to the outer MessageScroller. */
  className?: string;
  /** Extra attributes forwarded to the outer MessageScroller. */
  "data-testid"?: string;
  /** Ably ChatMessageList `onViewLatest`. */
  onViewLatest?: () => void;
  onLoadMoreHistory?: () => void;
  isLoading?: boolean;
  hasMoreHistory?: boolean;
  loadMoreThreshold?: number;
  /** Ably ChatMessageList `onMessageInView`. */
  onMessageInView?: (message: FluxyChatMessage) => void;
  /** Ably empty transcript copy. */
  emptyState?: React.ReactNode;
  /** Stream unread separator — marker before this message id. */
  firstUnreadMessageId?: number | null;
}

function MessageInViewProbe({
  message,
  onMessageInView,
  children,
}: {
  message: FluxyChatMessage;
  onMessageInView: (message: FluxyChatMessage) => void;
  children: React.ReactNode;
}) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const cb = React.useRef(onMessageInView);
  cb.current = onMessageInView;
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) cb.current(message);
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [message]);
  return <div ref={ref}>{children}</div>;
}

/**
 * Scrollable message list built on shadcn `MessageScroller` primitives.
 * Features:
 *  - Smart auto-follow (stick-to-bottom while near the end)
 *  - Date separators between messages on different calendar days
 *  - Content-visibility optimization via MessageScrollerItem
 *  - Scroll-fade edge effect
 */
export function MessageList({
  messages,
  renderMessage,
  footer,
  showDateSeparators = true,
  className,
  "data-testid": testId,
  onViewLatest,
  onLoadMoreHistory,
  isLoading = false,
  hasMoreHistory = false,
  loadMoreThreshold = 150,
  onMessageInView,
  emptyState = "No messages yet",
  firstUnreadMessageId = null,
}: MessageListProps) {
  let lastDay = "";
  const viewportRef = React.useRef<HTMLDivElement | null>(null);
  const pendingScroll = React.useRef<{ height: number; top: number } | null>(null);

  React.useLayoutEffect(() => {
    if (isLoading) return;
    const el = viewportRef.current;
    const before = pendingScroll.current;
    if (!el || !before) return;
    el.scrollTop = before.top + (el.scrollHeight - before.height);
    pendingScroll.current = null;
  }, [isLoading, messages.length]);

  return (
    <MessageScrollerProvider autoScroll scrollPreviousItemPeek={64}>
      <MessageScroller
        className={cn("flex-1 scroll-fade-b", className)}
        data-testid={testId}
        role="log"
        aria-live="polite"
        aria-label="Messages"
      >
        <MessageScrollerViewport
          className="p-3"
          ref={viewportRef}
          onScroll={() => {
            const el = viewportRef.current;
            if (!el || !onLoadMoreHistory || !hasMoreHistory || isLoading) return;
            if (el.scrollTop < loadMoreThreshold) {
              pendingScroll.current = { height: el.scrollHeight, top: el.scrollTop };
              onLoadMoreHistory();
            }
          }}
        >
          <MessageScrollerContent className="gap-2">
            {messages.length === 0 && emptyState ? (
              <MessageScrollerItem>
                <p
                  data-testid="message-list-empty"
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  {emptyState}
                </p>
              </MessageScrollerItem>
            ) : null}
            {messages.flatMap((m, idx) => {
              const isLastMessage = idx === messages.length - 1;
              const elements: React.ReactNode[] = [];

              // Date separator
              if (showDateSeparators) {
                const day = toDay(m.createdAt);
                if (day && day !== lastDay) {
                  lastDay = day;
                  elements.push(
                    <MessageScrollerItem key={`date-${day}-${idx}`}>
                      <Marker variant="separator" className="my-1">
                        <MarkerContent>{formatDay(day)}</MarkerContent>
                      </Marker>
                    </MessageScrollerItem>
                  );
                }
              }

              if (firstUnreadMessageId != null && m.id === firstUnreadMessageId) {
                elements.push(
                  <MessageScrollerItem key={`unread-${m.id}`}>
                    <Marker variant="separator" className="my-1" data-testid="unread-separator">
                      <MarkerContent>New messages</MarkerContent>
                    </Marker>
                  </MessageScrollerItem>,
                );
              }

              // Message row
              elements.push(
                <MessageScrollerItem
                  key={m.id ?? m.clientMessageId ?? idx}
                  messageId={m.id != null ? String(m.id) : undefined}
                  scrollAnchor={isLastMessage}
                  className={cn(m.streaming && "animate-in fade-in-0 duration-300")}
                >
                  {onMessageInView ? (
                    <MessageInViewProbe message={m} onMessageInView={onMessageInView}>
                      {renderMessage(m, idx)}
                    </MessageInViewProbe>
                  ) : (
                    renderMessage(m, idx)
                  )}
                </MessageScrollerItem>
              );

              return elements;
            })}

            {footer ? (
              <MessageScrollerItem className="mt-2">{footer}</MessageScrollerItem>
            ) : null}
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton onClick={onViewLatest} />
      </MessageScroller>
    </MessageScrollerProvider>
  );
}
