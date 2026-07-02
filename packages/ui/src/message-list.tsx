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
}: MessageListProps) {
  let lastDay = "";

  return (
    <MessageScrollerProvider autoScroll scrollPreviousItemPeek={64}>
      <MessageScroller className={cn("flex-1 scroll-fade-b", className)} data-testid={testId}>
        <MessageScrollerViewport className="p-3">
          <MessageScrollerContent className="gap-2">
            {messages.flatMap((m, idx) => {
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

              // Message row
              elements.push(
                <MessageScrollerItem
                  key={m.id ?? m.clientMessageId ?? idx}
                  messageId={m.id != null ? String(m.id) : undefined}
                  scrollAnchor={Boolean(m.userId)}
                  className={cn(m.streaming && "animate-in fade-in-0 duration-300")}
                >
                  {renderMessage(m, idx)}
                </MessageScrollerItem>
              );

              return elements;
            })}

            {footer ? (
              <MessageScrollerItem className="mt-2">{footer}</MessageScrollerItem>
            ) : null}
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton />
      </MessageScroller>
    </MessageScrollerProvider>
  );
}
