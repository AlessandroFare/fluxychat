"use client";

import React, { useCallback, useRef, useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { useFluxyChatOptional } from "@fluxy-chat/sdk";
import { Button } from "../components/ui";

interface ReplySuggestionsProps {
  roomId: string;
  parentId?: number | null;
  onSelect: (suggestion: string) => void;
  className?: string;
}

const CACHE_TTL_MS = 30_000;

/** Per-room cache to avoid hammering the AI on repeated open/close. */
export const suggestCache = new Map<string, { suggestions: string[]; ts: number }>();

function cacheKey(roomId: string, parentId?: number | null): string {
  return parentId != null ? `${roomId}:${parentId}` : roomId;
}

export function ReplySuggestions({
  roomId,
  parentId,
  onSelect,
  className,
}: ReplySuggestionsProps) {
  const fluxyClient = useFluxyChatOptional();
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [shown, setShown] = useState(false);
  const abortRef = useRef(0);

  const fetchSuggestions = useCallback(async () => {
    if (!fluxyClient) return;
    const key = cacheKey(roomId, parentId);
    const cached = suggestCache.get(key);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      setSuggestions(cached.suggestions);
      setShown(true);
      return;
    }
    const seq = ++abortRef.current;
    setLoading(true);
    setError(null);
    try {
      const result = await fluxyClient.suggestReplies(roomId, parentId);
      if (seq !== abortRef.current) return;
      const sugs = Array.isArray(result) ? result : [];
      suggestCache.set(key, { suggestions: sugs, ts: Date.now() });
      setSuggestions(sugs);
      setShown(true);
    } catch (err: unknown) {
      if (seq !== abortRef.current) return;
      setError(err instanceof Error ? err.message : "Failed to get suggestions");
      setShown(true);
    } finally {
      if (seq === abortRef.current) setLoading(false);
    }
  }, [fluxyClient, roomId, parentId]);

  if (!fluxyClient) return null;

  if (!shown && !loading) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={className}
        data-testid="suggest-btn"
        onClick={() => void fetchSuggestions()}
      >
        <Sparkles className="mr-1.5 h-3.5 w-3.5" aria-hidden />
        Suggest replies
      </Button>
    );
  }

  if (loading) {
    return (
      <div className={`flex items-center gap-1.5 text-xs text-muted-foreground ${className ?? ""}`}>
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        Generating suggestions…
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

  if (!suggestions.length) {
    return (
      <p className={`text-xs text-muted-foreground ${className ?? ""}`}>
        No suggestions available.
      </p>
    );
  }

  return (
    <div className={`flex flex-wrap gap-1.5 ${className ?? ""}`} data-testid="reply-suggestions">
      {suggestions.map((s, i) => (
        <button
          key={`${s}-${i}`}
          type="button"
          className="rounded-full border border-border bg-muted/40 px-3 py-1 text-xs text-foreground transition-colors hover:bg-muted/80"
          onClick={() => onSelect(s)}
        >
          {s}
        </button>
      ))}
      <button
        type="button"
        className="text-xs text-muted-foreground hover:underline"
        onClick={() => void fetchSuggestions()}
      >
        Refresh
      </button>
    </div>
  );
}
