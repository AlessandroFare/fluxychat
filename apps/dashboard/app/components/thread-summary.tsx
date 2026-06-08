"use client";

import React, { useCallback, useState } from "react";
import { ListCollapse, Loader2 } from "lucide-react";
import { useFluxyChatOptional } from "@fluxy-chat/sdk";
import { Button } from "../components/ui";

interface ThreadSummaryProps {
  roomId: string;
  messageId: number;
  replyCount: number;
  minReplies?: number;
  className?: string;
}

export function ThreadSummary({
  roomId,
  messageId,
  replyCount,
  minReplies = 2,
  className,
}: ThreadSummaryProps) {
  const fluxyClient = useFluxyChatOptional();
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const fetchSummary = useCallback(async () => {
    if (!fluxyClient) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fluxyClient.summarizeThread(messageId, roomId);
      setSummary(result?.summary ?? "");
      setExpanded(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to summarize thread");
      setExpanded(true);
    } finally {
      setLoading(false);
    }
  }, [fluxyClient, messageId, roomId]);

  if (!fluxyClient || replyCount < minReplies) return null;

  if (!expanded && !loading) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={className}
        data-testid="thread-summary-btn"
        onClick={() => void fetchSummary()}
      >
        <ListCollapse className="mr-1.5 h-3.5 w-3.5" aria-hidden />
        TL;DR ({replyCount} replies)
      </Button>
    );
  }

  if (loading) {
    return (
      <div className={`flex items-center gap-1.5 text-xs text-muted-foreground ${className ?? ""}`}>
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        Summarizing thread…
      </div>
    );
  }

  if (error) {
    return (
      <p className={`text-xs text-amber-700 ${className ?? ""}`} role="alert">
        {error}
      </p>
    );
  }

  return (
    <div
      className={`rounded-md border border-border/60 bg-muted/30 px-2.5 py-2 text-xs text-foreground ${className ?? ""}`}
      data-testid="thread-summary"
    >
      <p className="mb-1 font-medium text-muted-foreground">Thread TL;DR</p>
      <p className="whitespace-pre-wrap">{summary}</p>
      <button
        type="button"
        className="mt-1 text-[11px] text-muted-foreground hover:underline"
        onClick={() => void fetchSummary()}
      >
        Refresh
      </button>
    </div>
  );
}
