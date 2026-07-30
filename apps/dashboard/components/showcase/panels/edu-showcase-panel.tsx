"use client";

import React from "react";
import Link from "next/link";
import { GraduationCap, Plus } from "lucide-react";
import { useChat } from "@fluxy-chat/react";
import { Button } from "@/components/ui/button";
import type { ShowcaseSession } from "../use-showcase-session";

export function EduShowcasePanel({ session }: { session: ShowcaseSession }) {
  const client = session.client!;
  const roomId = session.roomId!;
  const [serverEvents, setServerEvents] = React.useState<string[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);

  const { connectionStatus } = useChat({
    roomId,
    client,
    replay: "connect",
    onServerEvent: (ev) => {
      if (!ev.name.startsWith("poll.") && !ev.name.startsWith("edu.")) return;
      setServerEvents((prev) => [ev.name, ...prev].slice(0, 6));
    },
  });

  async function createDemoPoll() {
    setBusy(true);
    setNotice(null);
    try {
      await client.createPoll(roomId, {
        question: "What should we cover in the live session?",
        options: ["Polls & quizzes", "Breakout rooms", "Stage go-live"],
      });
      setNotice("Poll created — watch for poll.* server events.");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Failed to create poll");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full min-h-64 flex-col gap-4 p-2">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <GraduationCap className="size-4 text-emerald-600" aria-hidden />
        FluxyEdu · live classroom events
      </div>
      <p className="text-xs text-muted-foreground">
        Polls and breakouts fan out as <code className="rounded bg-muted px-1">server_event</code> frames on the room WebSocket.
        Connection: <span className="font-medium text-foreground">{connectionStatus}</span>
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={busy} onClick={() => void createDemoPoll()}>
          <Plus className="mr-1 size-3.5" aria-hidden />
          Create demo poll
        </Button>
        <Link
          href="/edu"
          className="inline-flex h-7 items-center justify-center rounded-[min(var(--radius-md),12px)] border border-[color:color-mix(in_oklab,var(--am-midnight-ink)_10%,transparent)] bg-[var(--am-canvas-white)] px-2.5 text-[0.8rem] font-medium text-[var(--am-deep-indigo)] shadow-[var(--shadow-subtle)] transition-[transform,box-shadow,background-color,color,border-color,opacity] hover:bg-[var(--am-whisper-gray)] hover:-translate-y-px hover:shadow-[var(--shadow-subtle-2)]"
        >
          Open Edu studio →
        </Link>
      </div>
      {notice ? <p className="text-xs text-muted-foreground">{notice}</p> : null}
      <div className="min-h-0 flex-1 rounded-lg border border-border bg-muted/30 p-3">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Recent server events
        </p>
        {serverEvents.length === 0 ? (
          <p className="text-xs text-muted-foreground">No edu/poll events yet — create a poll or open /edu.</p>
        ) : (
          <ul className="space-y-1 font-mono text-xs text-foreground">
            {serverEvents.map((name) => (
              <li key={name} className="rounded bg-background px-2 py-1">
                {name}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
