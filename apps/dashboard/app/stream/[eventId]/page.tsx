"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Eye, Hand, ThumbsUp, Loader2, AlertCircle } from "lucide-react";
import { ConsoleShell } from "@/app/components/console-shell";
import { useDashboardSession } from "@/app/components/dashboard-session";
import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { cn } from "@/lib/utils";
import { StreamPlayer } from "@/components/stream/stream-player";
import { FluxyChat } from "@/components/chat";
import dynamic from "next/dynamic";

const WORKER_URL = getPublicWorkerUrl();

interface LiveEvent {
  id: string; projectId: string; roomId: string; title: string;
  description: string | null; status: string; streamUrl: string | null;
  thumbnailUrl: string | null; category: string | null;
  startedAt: string | null; endedAt: string | null;
  peakViewers: number; totalViewers: number; totalMessages: number;
}

export default function StreamViewerPage() {
  const params = useParams();
  const eventId = params.eventId as string;
  const { adminJwt, memberJwt } = useDashboardSession();
  const token = adminJwt.trim() || memberJwt.trim();

  const [event, setEvent] = useState<LiveEvent | null>(null);
  const [viewerCount, setViewerCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [handRaised, setHandRaised] = useState(false);
  const [showChat, setShowChat] = useState(true);

  useEffect(() => {
    if (!token || !eventId) return;
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch(`${WORKER_URL}/api/live/events/${eventId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("not_found");
        const data = await res.json();
        if (!cancelled) setEvent(data);
      } catch {
        if (!cancelled) setError("Stream not found");
      }
      if (!cancelled) setLoading(false);
    };

    const pollViewers = async () => {
      try {
        const res = await fetch(`${WORKER_URL}/api/live/events/${eventId}/viewer-count`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setViewerCount(data.count ?? 0);
        }
      } catch { /* noop */ }
    };

    void load();
    void pollViewers();
    const interval = setInterval(pollViewers, 10000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [eventId, token]);

  const handleRaiseHand = async () => {
    if (!token || !eventId) return;
    setHandRaised(!handRaised);
    try {
      const endpoint = handRaised ? "leave" : "join";
      await fetch(`${WORKER_URL}/api/live/events/${eventId}/${endpoint}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
    } catch { /* noop */ }
  };

  if (loading) {
    return (
      <ConsoleShell>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </ConsoleShell>
    );
  }

  if (error || !event) {
    return (
      <ConsoleShell>
        <div className="flex flex-col items-center gap-3 py-24">
          <AlertCircle className="size-8 text-destructive" />
          <p className="text-sm text-muted-foreground">{error || "Stream not found"}</p>
        </div>
      </ConsoleShell>
    );
  }

  const isLive = event.status === "live";

  return (
    <ConsoleShell>
      <div className="flex h-full flex-col">
        {/* Stream header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-2">
          <div className="flex items-center gap-3">
            {isLive && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/20 px-2.5 py-0.5 text-[11px] font-semibold text-red-600 dark:text-red-400">
                <span className="relative flex size-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500/80" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-red-600" />
                </span>
                LIVE
              </span>
            )}
            <h1 className="text-sm font-medium text-foreground">{event.title || "Untitled stream"}</h1>
            {event.category && (
              <span className="text-[11px] text-muted-foreground">{event.category}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isLive && (
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-0.5 text-xs font-medium">
                <Eye className="size-3" />
                <span className="tabular-nums">{viewerCount}</span>
              </span>
            )}
            <button
              type="button"
              onClick={() => setShowChat(!showChat)}
              className="rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted lg:hidden"
            >
              {showChat ? "Hide chat" : "Show chat"}
            </button>
          </div>
        </div>

        {/* Stream content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Video player */}
          <div className={cn("flex-1", showChat ? "max-lg:hidden" : "")}>
            <StreamPlayer
              streamUrl={event.streamUrl}
              isLive={isLive}
              title={event.title}
            />
          </div>

          {/* Chat overlay panel */}
          <div className={cn(
            "w-full border-l border-border lg:w-96",
            !showChat && "max-lg:hidden",
          )}>
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between border-b border-border px-3 py-2">
                <span className="text-xs font-medium text-foreground">Stream chat</span>
                <span className="text-[10px] text-muted-foreground">{event.totalMessages} messages</span>
              </div>
              <div className="flex-1 overflow-hidden">
                <FluxyChat
                  roomId={event.roomId}
                  variant="onboarding"
                  className="h-full"
                />
              </div>
              <div className="flex items-center gap-2 border-t border-border p-2">
                <button
                  type="button"
                  onClick={handleRaiseHand}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                    handRaised
                      ? "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400"
                      : "bg-muted text-muted-foreground hover:bg-muted/80",
                  )}
                >
                  <Hand className="size-3" />
                  {handRaised ? "Lower hand" : "Raise hand"}
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted/80"
                >
                  <ThumbsUp className="size-3" />
                  Like
                </button>
                {isLive && (
                  <a
                    href={`/stream/${event.id}/broadcast`}
                    className="ml-auto text-[10px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
                  >
                    Broadcaster view
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </ConsoleShell>
  );
}
