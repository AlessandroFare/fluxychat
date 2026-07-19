"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Eye, Plus, Video, Loader2 } from "lucide-react";
import { ConsoleShell } from "@/app/components/console-shell";
import { ConsolePageHeader } from "@/app/components/console-page-header";
import { useDashboardSession } from "@/app/components/dashboard-session";
import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { cn } from "@/lib/utils";
import { CreateStreamDialog } from "@/components/stream/create-stream-dialog";

const WORKER_URL = getPublicWorkerUrl();

interface LiveEvent {
  id: string;
  projectId: string;
  roomId: string;
  title: string;
  description: string | null;
  status: "scheduled" | "pre_live" | "live" | "post_live" | "ended";
  streamUrl: string | null;
  thumbnailUrl: string | null;
  category: string | null;
  startedAt: string | null;
  endedAt: string | null;
  peakViewers: number;
  totalViewers: number;
  totalMessages: number;
  createdAt: string;
}

function statusColor(status: string) {
  switch (status) {
    case "live": return "bg-red-500/15 text-red-600 dark:text-red-400";
    case "pre_live": return "bg-amber-500/15 text-amber-600 dark:text-amber-400";
    case "scheduled": return "bg-blue-500/15 text-blue-600 dark:text-blue-400";
    case "post_live": return "bg-purple-500/15 text-purple-600 dark:text-purple-400";
    case "ended": return "bg-muted text-muted-foreground";
    default: return "bg-muted text-muted-foreground";
  }
}

export default function StreamPage() {
  const { adminJwt, memberJwt } = useDashboardSession();
  const token = adminJwt.trim() || memberJwt.trim();
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  const loadEvents = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${WORKER_URL}/api/live/events`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setEvents(Array.isArray(data) ? data : []);
      }
    } catch { /* noop */ }
    setLoading(false);
  }, [token]);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  const liveEvents = events.filter((e) => e.status === "live");
  const otherEvents = events.filter((e) => e.status !== "live");

  return (
    <ConsoleShell>
      <ConsolePageHeader
        title="FluxyStream"
        description="Live video broadcasting with integrated chat, polls & viewer analytics"
        actions={
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--fluxy-cta-color)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
          >
            <Plus className="size-3.5" /> New stream
          </button>
        }
      />

      <div className="flex flex-1 flex-col gap-4 p-4 pt-2">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Interactive demo with all FluxyStream features →
          </p>
          <a href="/stream/demo" className="text-xs font-medium text-brand underline underline-offset-2">
            Open demo
          </a>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <Video className="size-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No streams yet</p>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--fluxy-cta-color)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
            >
              <Plus className="size-3.5" /> Create your first stream
            </button>
          </div>
        ) : (
          <>
            {liveEvents.length > 0 && (
              <section>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Live now
                </h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {liveEvents.map((ev) => (
                    <StreamCard key={ev.id} event={ev} />
                  ))}
                </div>
              </section>
            )}
            <section>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                All streams
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {otherEvents.map((ev) => (
                  <StreamCard key={ev.id} event={ev} />
                ))}
              </div>
            </section>
          </>
        )}
      </div>

      <CreateStreamDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => { setCreateOpen(false); void loadEvents(); }}
        token={token}
      />
    </ConsoleShell>
  );
}

function StreamCard({ event }: { event: LiveEvent }) {
  const isLive = event.status === "live";
  return (
    <Link
      href={`/stream/${event.id}`}
      className={cn(
        "group rounded-xl border bg-white p-4 shadow-sm transition-all hover:shadow-md dark:bg-gray-900",
        isLive && "ring-1 ring-green-500/30",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider", statusColor(event.status))}>
              {isLive && <span className="size-1.5 rounded-full bg-current animate-pulse" />}
              {event.status}
            </span>
            {event.category && (
              <span className="text-[10px] text-muted-foreground">{event.category}</span>
            )}
          </div>
          <h4 className="truncate text-sm font-medium text-foreground">{event.title || "Untitled"}</h4>
          {event.description && (
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{event.description}</p>
          )}
        </div>
      </div>
      <div className="mt-3 flex items-center gap-3 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Eye className="size-3" /> {event.peakViewers}
        </span>
        <span>{event.totalMessages} messages</span>
        {event.startedAt && (
          <span>{new Date(event.startedAt).toLocaleDateString()}</span>
        )}
      </div>
    </Link>
  );
}
