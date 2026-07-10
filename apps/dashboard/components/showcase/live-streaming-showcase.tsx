"use client";

import React from "react";
import { Loader2, Eye, Heart, Flame } from "lucide-react";
import { useChat } from "@fluxy-chat/sdk";
import type { FluxyChatEvent } from "@fluxy-chat/sdk";
import {
  FeatureCodePanel,
  FeaturePreviewFrame,
  ShowcaseUnavailable,
  Kw,
  Ident,
  Str,
} from "./feature-code-panel";
import type { ShowcaseSession } from "./use-showcase-session";

interface FloatingReaction {
  id: number;
  emoji: string;
  left: number;
}

const REACTION_EMOJI: Record<string, string> = {
  heart: "\u2764\uFE0F",
  fire: "\uD83D\uDD25",
};

/**
 * Live Streaming showcase — room-scoped ephemeral pub/sub. One
 * `sendClientEvent` publish is delivered by the room Durable Object to its
 * connected subscribers; presence counts come from the same live room.
 */
export function LiveStreamingShowcase({ session }: { session: ShowcaseSession }) {
  return (
    <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
      <FeatureCodePanel
        title="Live streaming events, at any scale."
        description="Live streaming is a high fan-out problem: one publisher, and every viewer in the room needs it instantly. FluxyChat client events fan out every reaction to every connected subscriber in milliseconds, with live presence counts built in."
      >
        <Kw>const</Kw>
        {" { sendClientEvent, presenceMembers } = "}
        <Ident>useChat</Ident>
        {"({\n  roomId: "}
        <Str>{'"live:premiere-7"'}</Str>
        {",\n  onAnyEvent: (e) => e.type === "}
        <Str>{'"client_event"'}</Str>
        {" && render(e),\n});\n\n"}
        {"// one publish, delivered to every subscriber\n"}
        <Ident>sendClientEvent</Ident>
        {"("}
        <Str>{'"reaction"'}</Str>
        {", { emoji: "}
        <Str>{'"heart"'}</Str>
        {" });"}
      </FeatureCodePanel>

      <FeaturePreviewFrame label="Live streaming preview" className="min-h-[28rem]">
        {session.status === "loading" ? (
          <div className="flex h-full min-h-64 items-center justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />
            <span className="sr-only">Connecting to the live room</span>
          </div>
        ) : session.status === "unavailable" || !session.client || !session.roomId ? (
          <ShowcaseUnavailable error={session.error} onRetry={session.retry} />
        ) : (
          <LiveRoomPanel session={session} />
        )}
      </FeaturePreviewFrame>
    </div>
  );
}

function LiveRoomPanel({ session }: { session: ShowcaseSession }) {
  const [floating, setFloating] = React.useState<FloatingReaction[]>([]);
  const nextId = React.useRef(0);

  const spawnReaction = React.useCallback((emoji: string) => {
    const id = nextId.current++;
    setFloating((prev) => [
      ...prev.slice(-24),
      { id, emoji, left: 10 + Math.random() * 80 },
    ]);
    window.setTimeout(() => {
      setFloating((prev) => prev.filter((r) => r.id !== id));
    }, 1800);
  }, []);

  const onAnyEvent = React.useCallback(
    (event: FluxyChatEvent) => {
      if (event.type !== "client_event" || event.eventName !== "reaction") return;
      const data = event.data as { emoji?: string } | null;
      const emoji = data?.emoji && REACTION_EMOJI[data.emoji];
      if (emoji) spawnReaction(emoji);
    },
    [spawnReaction],
  );

  const {
    messages,
    connected,
    presenceMembers,
    subscriptionCount,
    sendClientEvent,
  } = useChat({
    roomId: session.roomId as string,
    client: session.client ?? undefined,
    historyLimit: 20,
    onAnyEvent,
  });

  const viewerCount = Math.max(
    subscriptionCount ?? 0,
    presenceMembers?.length ?? 0,
    connected ? 1 : 0,
  );

  const recent = messages.slice(-7);

  const react = (kind: "heart" | "fire") => {
    // Real fan-out publish: every connected subscriber receives this event.
    sendClientEvent("reaction", { emoji: kind });
    spawnReaction(REACTION_EMOJI[kind]);
  };

  return (
    <div className="relative flex h-full flex-col">
      {/* "Stream" header */}
      <div className="flex items-center justify-between border-b border-border bg-muted/50 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--fluxy-cta-color)] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white">
            <span className="size-1.5 rounded-full bg-white" aria-hidden />
            Live
          </span>
          <span className="text-xs text-muted-foreground">Worker demo room</span>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-0.5 text-xs font-medium text-foreground">
          <Eye className="size-3.5" aria-hidden />
          {viewerCount}
          <span className="sr-only">viewers connected</span>
        </span>
      </div>

      {/* Live message feed */}
      <div className="relative flex-1 overflow-hidden px-4 py-3">
        <ul className="flex h-full flex-col justify-end gap-1.5" aria-live="polite">
          {recent.length === 0 ? (
            <li className="text-xs text-muted-foreground">
              Waiting for live messages{"\u2026"} open this page in a second tab
              and react — events fan out to every subscriber.
            </li>
          ) : (
            recent.map((m) => (
              <li key={m.id} className="truncate text-xs leading-relaxed">
                <span className="font-semibold text-[var(--fluxy-cta-color)]">
                  {m.userId}
                </span>{" "}
                <span className="text-foreground">{m.content}</span>
              </li>
            ))
          )}
        </ul>

        {/* Floating reactions from real client events */}
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          {floating.map((r) => (
            <span
              key={r.id}
              className="absolute bottom-2 animate-[fluxy-float-up_1.8s_ease-out_forwards] text-xl motion-reduce:animate-none motion-reduce:opacity-0"
              style={{ left: `${r.left}%` }}
            >
              {r.emoji}
            </span>
          ))}
        </div>
      </div>

      {/* Reaction bar */}
      <div className="flex items-center gap-2 border-t border-border px-4 py-3">
        <button
          type="button"
          onClick={() => react("heart")}
          disabled={!connected}
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
        >
          <Heart className="size-3.5 text-[var(--fluxy-cta-color)]" aria-hidden />
          React
        </button>
        <button
          type="button"
          onClick={() => react("fire")}
          disabled={!connected}
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
        >
          <Flame className="size-3.5 text-[var(--fluxy-cta-color)]" aria-hidden />
          Hype
        </button>
        <span className="ml-auto text-[11px] text-muted-foreground">
          {connected ? "Connected via WebSocket" : "Connecting\u2026"}
        </span>
      </div>

      <style>{`
        @keyframes fluxy-float-up {
          0% { transform: translateY(0) scale(0.8); opacity: 0; }
          15% { opacity: 1; }
          100% { transform: translateY(-160px) scale(1.15); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
