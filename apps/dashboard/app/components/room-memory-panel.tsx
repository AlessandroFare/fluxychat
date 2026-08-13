"use client";

import { useCallback, useEffect, useState } from "react";
import { Brain, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button, Section } from "./ui";
import {
  extractRoomMemory,
  fetchRoomMemory,
  memoryKindLabel,
  type RoomMemoryEntry,
} from "@/lib/room-intelligence-client";
import { messageFromUnknown } from "@/lib/error-message";

interface RoomMemoryPanelProps {
  roomId: string;
  memberJwt: string;
}

export function RoomMemoryPanel({ roomId, memberJwt }: RoomMemoryPanelProps) {
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [entries, setEntries] = useState<RoomMemoryEntry[]>([]);

  const load = useCallback(async () => {
    if (!memberJwt.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchRoomMemory(roomId, memberJwt);
      setEntries(data.entries ?? []);
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to load room memory"));
    } finally {
      setLoading(false);
    }
  }, [memberJwt, roomId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function extract() {
    if (!memberJwt.trim()) return;
    setExtracting(true);
    setError(null);
    setNotice(null);
    try {
      const result = await extractRoomMemory(roomId, memberJwt);
      if (result.error) {
        setError(result.error);
        return;
      }
      setNotice(
        result.message ??
          `Extracted ${result.extracted} entries (${result.inserted ?? 0} new, ${result.updated ?? 0} updated).`,
      );
      await load();
    } catch (err) {
      setError(messageFromUnknown(err, "Memory extraction failed (configure LLM on Worker)"));
    } finally {
      setExtracting(false);
    }
  }

  return (
    <Section
      title="Room memory"
      description="Operator-facing persistent facts extracted from the conversation (PH-132)."
    >
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" disabled={loading || extracting} onClick={() => void load()}>
          {loading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
          Refresh
        </Button>
        <Button type="button" size="sm" disabled={loading || extracting} onClick={() => void extract()}>
          {extracting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
          Extract from messages
        </Button>
      </div>

      {entries.length ? (
        <ul className="mt-4 space-y-2">
          {entries.map((entry) => (
            <li key={entry.id} className="rounded-lg border bg-background p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Brain className="h-3.5 w-3.5 text-muted-foreground" />
                <Badge variant="outline" className="text-[10px]">
                  {memoryKindLabel(entry.kind)}
                </Badge>
                {entry.confidence != null ? (
                  <span className="text-[10px] text-muted-foreground">
                    {Math.round(entry.confidence * 100)}% confidence
                  </span>
                ) : null}
              </div>
              <p className="mt-2 leading-relaxed">{entry.content}</p>
              {entry.sourceMessageIds?.length ? (
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Sources: messages {entry.sourceMessageIds.join(", ")}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          No memory entries yet. Run extract after a few messages, or wait for automation.
        </p>
      )}

      {notice ? <p className="mt-2 text-xs text-muted-foreground">{notice}</p> : null}
      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
    </Section>
  );
}
