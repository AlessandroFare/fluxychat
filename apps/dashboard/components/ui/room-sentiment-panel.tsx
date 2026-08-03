"use client";

import { useEffect, useState } from "react";
import { Loader2, Smile, Meh, Frown } from "lucide-react";
import type { FluxyChatClient, FluxyRoomSentiment } from "@fluxy-chat/sdk";
import { Panel } from "~/app/components/ui";

interface RoomSentimentPanelProps {
  client: FluxyChatClient | null;
  roomId: string;
  days?: number;
}

const MOOD_ICON = {
  positive: Smile,
  neutral: Meh,
  negative: Frown,
} as const;

const MOOD_COLOR = {
  positive: "text-green-600",
  neutral: "text-muted-foreground",
  negative: "text-red-600",
} as const;

export function RoomSentimentPanel({ client, roomId, days = 7 }: RoomSentimentPanelProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<FluxyRoomSentiment | null>(null);

  useEffect(() => {
    if (!client || !roomId.trim()) {
      setData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void client
      .getRoomSentiment(roomId.trim(), days)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load sentiment");
          setData(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [client, roomId, days]);

  if (!roomId.trim()) return null;

  const MoodIcon = data ? MOOD_ICON[data.aggregate.mood] : Meh;

  return (
    <Panel className="mb-4 p-4" title="Room mood">
      {loading ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
          Loading reaction mood…
        </p>
      ) : error ? (
        <p className="text-xs text-red-600">{error}</p>
      ) : !data || data.aggregate.total === 0 ? (
        <p className="text-xs text-muted-foreground">
          No reactions in the last {days} days — mood appears once members react to messages.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <MoodIcon className={`size-5 ${MOOD_COLOR[data.aggregate.mood]}`} aria-hidden />
            <div>
              <p className="text-sm font-medium capitalize">{data.aggregate.mood}</p>
              <p className="text-[11px] text-muted-foreground">
                {data.aggregate.total} reactions · score {data.aggregate.score.toFixed(2)} · last {data.days} days
              </p>
            </div>
          </div>
          {data.timeline.length > 0 ? (
            <div className="flex items-end gap-1 h-12" role="img" aria-label="Daily mood timeline">
              {data.timeline.map((day) => {
                const height = Math.max(8, Math.round(Math.abs(day.score) * 40 + 8));
                const barColor =
                  day.mood === "positive"
                    ? "bg-green-500/70"
                    : day.mood === "negative"
                      ? "bg-red-500/70"
                      : "bg-muted-foreground/40";
                return (
                  <div
                    key={day.day}
                    className="flex flex-1 flex-col items-center justify-end gap-0.5"
                    title={`${day.day}: ${day.mood} (${day.total} reactions)`}
                  >
                    <div className={`w-full rounded-sm ${barColor}`} style={{ height: `${height}px` }} />
                    <span className="text-[9px] text-muted-foreground">{day.day.slice(5)}</span>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      )}
    </Panel>
  );
}
