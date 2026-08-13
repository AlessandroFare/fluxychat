"use client";

import { useCallback, useEffect, useState } from "react";
import { BarChart3, Loader2, RefreshCw } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button, Section } from "./ui";
import {
  fetchAudienceScore,
  scoreTone,
  type AudienceScore,
} from "@/lib/room-intelligence-client";
import { messageFromUnknown } from "@/lib/error-message";

interface RoomAudienceScorePanelProps {
  roomId: string;
  memberJwt: string;
}

export function RoomAudienceScorePanel({ roomId, memberJwt }: RoomAudienceScorePanelProps) {
  const [windowMinutes, setWindowMinutes] = useState("15");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [score, setScore] = useState<AudienceScore | null>(null);

  const load = useCallback(async () => {
    if (!memberJwt.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAudienceScore(
        roomId,
        memberJwt,
        Math.max(1, Number(windowMinutes) || 15),
      );
      setScore(data);
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to load audience score"));
    } finally {
      setLoading(false);
    }
  }, [memberJwt, roomId, windowMinutes]);

  useEffect(() => {
    void load();
  }, [load]);

  const tone = score ? scoreTone(score.score) : "neutral";

  return (
    <Section
      title="Audience score"
      description="Rolling reaction rollup for live debate and prep scorecards (PH-112)."
    >
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-muted-foreground">
          Window (minutes)
          <input
            type="number"
            min={1}
            max={120}
            className="mt-1 block w-24 rounded-md border bg-background px-2 py-1 text-sm"
            value={windowMinutes}
            onChange={(e) => setWindowMinutes(e.target.value)}
          />
        </label>
        <Button type="button" size="sm" variant="outline" disabled={loading} onClick={() => void load()}>
          {loading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
          Refresh
        </Button>
      </div>

      {score ? (
        <div className="mt-4 rounded-lg border bg-muted/20 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <BarChart3 className="h-5 w-5 text-muted-foreground" />
            <span className="text-3xl font-semibold tabular-nums">{score.score}</span>
            <Badge
              variant={tone === "positive" ? "default" : tone === "negative" ? "destructive" : "secondary"}
            >
              {tone === "positive" ? "Positive" : tone === "negative" ? "Negative" : "Mixed"}
            </Badge>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {score.positive} positive · {score.negative} negative · {score.total} total reactions in the last{" "}
            {score.windowMinutes} minutes.
          </p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-emerald-500 transition-all"
              style={{ width: `${Math.max(0, Math.min(100, score.score))}%` }}
            />
          </div>
        </div>
      ) : !loading && !error ? (
        <p className="mt-3 text-sm text-muted-foreground">No reactions in this window yet.</p>
      ) : null}

      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
    </Section>
  );
}
