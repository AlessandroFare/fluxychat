"use client";

import React, { useCallback, useEffect, useState } from "react";
import type { FluxyChatClient, FluxyChatMessage, FluxyRoomCatchUp } from "@fluxy-chat/sdk";
import { Button } from "./ui";

export interface ChatCatchUpBannerProps {
  client: FluxyChatClient | null;
  roomId: string;
  messages: FluxyChatMessage[];
  listRef: React.RefObject<HTMLDivElement | null>;
  loadMore?: () => Promise<void>;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onMarkRead?: (messageId: number) => void;
}

export function ChatCatchUpBanner({
  client,
  roomId,
  messages,
  listRef,
  loadMore,
  hasMore = false,
  isLoadingMore = false,
  onMarkRead,
}: ChatCatchUpBannerProps) {
  const [catchUp, setCatchUp] = useState<FluxyRoomCatchUp | null>(null);
  const [digestLoading, setDigestLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [jumping, setJumping] = useState(false);

  const trimmedRoomId = roomId.trim();

  useEffect(() => {
    setDismissed(false);
    setCatchUp(null);
    if (!client?.isAuthenticated() || !trimmedRoomId) return;
    let cancelled = false;
    void client.getRoomCatchUpDigest(trimmedRoomId).then((data) => {
      if (!cancelled) setCatchUp(data);
    }).catch(() => {
      if (!cancelled) {
        void client.getRoomCatchUp(trimmedRoomId).then((data) => {
          if (!cancelled) setCatchUp(data);
        }).catch(() => {
          if (!cancelled) setCatchUp(null);
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [client, trimmedRoomId]);

  const scrollToMessageId = useCallback((messageId: number) => {
    const root = listRef.current;
    if (!root) return false;
    const el = root.querySelector(`[data-message-id="${messageId}"]`);
    if (!el) return false;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    return true;
  }, [listRef]);

  const jumpToFirstUnread = useCallback(async () => {
    const targetId = catchUp?.firstUnreadMessageId;
    if (!targetId || !loadMore) {
      if (targetId) scrollToMessageId(targetId);
      return;
    }
    setJumping(true);
    try {
      let guard = 0;
      while (guard < 12) {
        if (messages.some((m) => m.id === targetId)) {
          scrollToMessageId(targetId);
          return;
        }
        if (!hasMore || isLoadingMore) break;
        await loadMore();
        guard += 1;
      }
      scrollToMessageId(targetId);
    } finally {
      setJumping(false);
    }
  }, [
    catchUp?.firstUnreadMessageId,
    hasMore,
    isLoadingMore,
    loadMore,
    messages,
    scrollToMessageId,
  ]);

  if (dismissed || !catchUp || catchUp.unreadCount <= 0) return null;

  const label =
    catchUp.unreadCount === 1
      ? "1 new message while you were away"
      : `${catchUp.unreadCount} new messages while you were away`;

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-brand/30 bg-brand/10 px-3 py-2 text-xs text-foreground"
      role="status"
      data-testid="chat-catch-up-banner"
    >
      <span>{label}</span>
      {catchUp.digest ? (
        <p className="mt-1 w-full whitespace-pre-wrap text-[11px] text-muted-foreground">{catchUp.digest}</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {!catchUp.digest ? (
          <Button
            type="button"
            variant="outline"
            className="h-7 px-2 text-xs"
            disabled={digestLoading}
            onClick={() => {
              if (!client) return;
              setDigestLoading(true);
              void client.getRoomCatchUpDigest(trimmedRoomId).then(setCatchUp).finally(() => setDigestLoading(false));
            }}
          >
            {digestLoading ? "Summarizing…" : "Summarize missed"}
          </Button>
        ) : null}
        {catchUp.firstUnreadMessageId != null ? (
          <Button
            type="button"
            variant="outline"
            className="h-7 px-2 text-xs"
            disabled={jumping}
            onClick={() => void jumpToFirstUnread()}
          >
            {jumping ? "Loading…" : "Jump to first unread"}
          </Button>
        ) : null}
        {onMarkRead ? (
          <Button
            type="button"
            variant="outline"
            className="h-7 px-2 text-xs"
            onClick={() => {
              const latest = [...messages]
                .filter((m) => typeof m.id === "number")
                .sort((a, b) => (a.id ?? 0) - (b.id ?? 0))
                .at(-1);
              if (latest?.id) onMarkRead(latest.id);
              setDismissed(true);
              setCatchUp((prev) =>
                prev ? { ...prev, unreadCount: 0, firstUnreadMessageId: null } : prev,
              );
            }}
          >
            Mark read
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          className="h-7 px-2 text-xs"
          onClick={() => setDismissed(true)}
        >
          Dismiss
        </Button>
      </div>
    </div>
  );
}
