"use client";

import React from "react";
import { Eye, Flame, Heart, Radio } from "lucide-react";
import { useChat, useServerEvents } from "@fluxy-chat/react";
import { createWorkerFluxyStreamClient } from "@fluxy-chat/sdk";
import { Button } from "@/components/ui/button";
import type { ShowcaseSession } from "../use-showcase-session";

export function FluxyStreamShowcasePanel({ session }: { session: ShowcaseSession }) {
  const client = session.client!;
  const roomId = session.roomId!;
  const [viewers, setViewers] = React.useState(1);
  const [eventTitle, setEventTitle] = React.useState<string | null>(null);
  const [eventId, setEventId] = React.useState<string | null>(null);
  const [isLive, setIsLive] = React.useState(false);
  const [log, setLog] = React.useState<string[]>([]);
  const [floating, setFloating] = React.useState<Array<{ id: number; emoji: string; left: number }>>([]);

  const { sendClientEvent, presenceMembers } = useChat({
    roomId,
    client,
    replay: "connect",
  });

  const { lastEvent, connected: wsConnected } = useServerEvents({
    client,
    roomId,
    filter: (name) => name.startsWith("live."),
  });

  React.useEffect(() => {
    let cancelled = false;
    const stream = createWorkerFluxyStreamClient(client);
    void (async () => {
      try {
        const existing = await stream.listEvents({ status: "live", limit: 1 });
        let event = existing.find((e) => e.roomId === roomId) ?? existing[0];
        if (!event) {
          event = await stream.createEvent({
            title: "FluxyStream premiere",
            roomId,
            category: "showcase",
          });
          await stream.goLive(event.id);
        }
        if (cancelled) return;
        setEventId(event.id);
        setEventTitle(event.title);
        setIsLive(event.status === "live");
        setViewers(event.peakViewers ?? event.totalViewers ?? 1);
        await stream.join(event.id);
      } catch {
        if (!cancelled) setEventTitle("FluxyStream premiere (local)");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client, roomId]);

  React.useEffect(() => {
    if (!lastEvent) return;
    if (lastEvent.name === "live.viewer_joined" || lastEvent.name === "live.viewer_left") {
      const count = Number(lastEvent.data.viewerCount);
      if (Number.isFinite(count)) setViewers(count);
    }
    if (lastEvent.name === "live.event_live") setIsLive(true);
    if (lastEvent.name === "live.event_ended") setIsLive(false);
    if (lastEvent.name === "live.chat_message") {
      const user = String(lastEvent.data.username ?? "viewer");
      const content = String(lastEvent.data.content ?? "");
      setLog((prev) => [`${user}: ${content}`, ...prev].slice(0, 6));
    }
  }, [lastEvent]);

  function pushReaction(emoji: string, name: string) {
    void sendClientEvent("reaction", { emoji, name });
    setFloating((prev) => [...prev, { id: Date.now() + Math.random(), emoji, left: 10 + Math.random() * 80 }]);
    setLog((prev) => [`${name} sent ${emoji}`, ...prev].slice(0, 6));
  }

  return (
    <div className="flex h-full min-h-[26rem] flex-col bg-slate-950 text-white">
      <div className="relative flex min-h-44 flex-1 items-end overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-orange-950/40 p-4">
        <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "radial-gradient(circle at 20% 20%, #fb923c 0%, transparent 45%)" }} />
        {floating.map((item) => (
          <span
            key={item.id}
            className="pointer-events-none absolute bottom-8 animate-bounce text-2xl"
            style={{ left: `${item.left}%`, animationDuration: "1.2s" }}
            onAnimationEnd={() => setFloating((prev) => prev.filter((f) => f.id !== item.id))}
          >
            {item.emoji}
          </span>
        ))}
        <div className="relative z-10 w-full">
          <div className={`mb-2 inline-flex items-center gap-2 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${isLive ? "bg-red-600/90" : "bg-slate-600/90"}`}>
            <Radio className="size-3" aria-hidden />
            {isLive ? "Live" : "Scheduled"}
          </div>
          <h4 className="text-lg font-semibold">{eventTitle ?? "Loading stream…"}</h4>
          <p className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-300">
            <span className="inline-flex items-center gap-1">
              <Eye className="size-3.5" aria-hidden />
              {Math.max(viewers, presenceMembers.length)} watching
            </span>
            <span>room · {roomId}</span>
            {wsConnected ? <span className="text-emerald-400">WS live</span> : null}
            {eventId ? <span className="text-slate-500">{eventId}</span> : null}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-white/10 p-4">
        <Button type="button" size="sm" variant="secondary" onClick={() => pushReaction("❤️", "heart")}>
          <Heart className="mr-1 size-3.5" aria-hidden />
          Heart
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={() => pushReaction("🔥", "fire")}>
          <Flame className="mr-1 size-3.5" aria-hidden />
          Fire
        </Button>
      </div>

      {log.length > 0 ? (
        <ul className="space-y-1 border-t border-white/10 px-4 py-3 text-[11px] text-slate-400">
          {log.map((line, index) => (
            <li key={`${line}-${index}`}>{line}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
