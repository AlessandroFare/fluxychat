"use client";

import React from "react";
import { Loader2, Eye, Heart, Flame } from "lucide-react";
import { useChat } from "@fluxy-chat/react";
import type { FluxyChatEvent } from "@fluxy-chat/sdk";
import {
  FeatureCodePanel,
  FeaturePreviewFrame,
  ShowcaseUnavailable,
} from "./feature-code-panel";
import { getRealtimeFeature } from "./realtime-feature-content";
import type { ShowcaseSession } from "./use-showcase-session";

const feature = getRealtimeFeature("streaming");

interface FloatingReaction {
  id: number;
  emoji: string;
  left: number;
  drift: number;
  rotate: number;
}

const REACTION_EMOJI: Record<string, string> = {
  heart: "\u2764\uFE0F",
  fire: "\uD83D\uDD25",
};

export function LiveStreamingShowcase({ session }: { session: ShowcaseSession }) {
  return (
    <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
      <FeatureCodePanel feature={feature} />

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

/**
 * Illustrated host avatar — blinks, breathes, sways gently, raises an eyebrow
 * while talking, and wears a headset/boom mic so the video area reads as a
 * real streamer mid-broadcast rather than a static placeholder.
 */
function StreamerAvatar({ speaking, size = 76 }: { speaking: boolean; size?: number }) {
  const [blink, setBlink] = React.useState(false);

  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        setBlink(true);
        setTimeout(() => setBlink(false), 120);
        schedule();
      }, 2400 + Math.random() * 2200);
    };
    schedule();
    return () => clearTimeout(timer);
  }, []);

  return (
    <span
      className={`inline-block transition-transform duration-300 ease-out motion-reduce:!transform-none ${speaking ? "scale-[1.035]" : ""}`}
      style={{ animation: "fluxy-avatar-sway 4.8s ease-in-out infinite" }}
    >
      <svg viewBox="0 0 120 142" width={size} height={(size * 142) / 120} className="overflow-visible motion-reduce:[&_*]:!animate-none" aria-hidden>
        <defs>
          <radialGradient id="fluxy-avatar-skin" cx="42%" cy="34%" r="72%">
            <stop offset="0%" stopColor="#ffd2a6" />
            <stop offset="55%" stopColor="#f0b98a" />
            <stop offset="100%" stopColor="#d99a68" />
          </radialGradient>
          <linearGradient id="fluxy-avatar-hair" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3a2c20" />
            <stop offset="100%" stopColor="#221a12" />
          </linearGradient>
          <linearGradient id="fluxy-avatar-shirt" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#414d63" />
            <stop offset="100%" stopColor="#232b38" />
          </linearGradient>
        </defs>

        <g style={{ transformBox: "fill-box", transformOrigin: "50% 100%", animation: "fluxy-avatar-breathe 3.6s ease-in-out infinite" }}>
          <path d="M6 144 Q6 90 60 90 Q114 90 114 144 Z" fill="url(#fluxy-avatar-shirt)" />
          <path d="M6 144 Q6 90 60 90 Q114 90 114 144" fill="none" stroke="#151b26" strokeWidth="1" opacity="0.4" />
          {/* headset band + boom mic */}
          <path d="M20 46 Q60 5 100 46" fill="none" stroke="#111827" strokeWidth="3.5" strokeLinecap="round" />
          <circle cx="20" cy="49" r="4.5" fill="#111827" />
          <circle cx="100" cy="49" r="4.5" fill="#111827" />
          <path d="M100 49 Q109 60 78 67" fill="none" stroke="#111827" strokeWidth="2.6" strokeLinecap="round" />
          <circle cx="78" cy="67" r="3.2" fill="#111827" />
        </g>

        <rect x="49" y="70" width="22" height="26" rx="8" fill="#e3a476" />
        <rect x="49" y="80" width="22" height="12" rx="6" fill="#d4915f" opacity="0.45" />

        <ellipse cx="60" cy="52" rx="35" ry="36" fill="url(#fluxy-avatar-skin)" />
        <ellipse cx="24" cy="53" rx="5" ry="7" fill="#eab787" />
        <ellipse cx="96" cy="53" rx="5" ry="7" fill="#eab787" />

        <path d="M23 48 Q20 8 60 8 Q100 8 97 48 Q97 22 60 20 Q23 22 23 48 Z" fill="url(#fluxy-avatar-hair)" />
        <path d="M23 46 Q60 -2 97 46" fill="none" stroke="#19120c" strokeWidth="4" strokeLinecap="round" />

        <path
          d="M40 40 Q47 36 54 39"
          fill="none"
          stroke="#241b13"
          strokeWidth="2.3"
          strokeLinecap="round"
          style={{ transition: "transform 200ms ease-out", transformBox: "fill-box", transformOrigin: "center", transform: speaking ? "translateY(-1.4px)" : "translateY(0)" }}
        />
        <path
          d="M66 39 Q73 36 80 40"
          fill="none"
          stroke="#241b13"
          strokeWidth="2.3"
          strokeLinecap="round"
          style={{ transition: "transform 200ms ease-out", transformBox: "fill-box", transformOrigin: "center", transform: speaking ? "translateY(-1.4px)" : "translateY(0)" }}
        />

        <ellipse cx="48" cy="50" rx="3.5" ry={blink ? 0.5 : 3.5} fill="#241b13" style={{ transition: "ry 90ms ease-out" }} />
        <ellipse cx="72" cy="50" rx="3.5" ry={blink ? 0.5 : 3.5} fill="#241b13" style={{ transition: "ry 90ms ease-out" }} />
        <circle cx="49.1" cy="48.6" r="0.9" fill="#fff" opacity={blink ? 0 : 0.85} />
        <circle cx="73.1" cy="48.6" r="0.9" fill="#fff" opacity={blink ? 0 : 0.85} />

        <path d="M60 50 Q58 58 60 60.5 Q62 59.5 61 56.5" fill="none" stroke="#d4915f" strokeWidth="1.5" strokeLinecap="round" />
        <ellipse cx="40" cy="62" rx="6" ry="3.2" fill="#f0916a" opacity="0.18" />
        <ellipse cx="80" cy="62" rx="6" ry="3.2" fill="#f0916a" opacity="0.18" />

        <ellipse
          cx="60"
          cy="67"
          rx="9.5"
          ry="6"
          fill="#8a3f2f"
          style={{
            transformBox: "fill-box",
            transformOrigin: "center",
            transform: speaking ? undefined : "scaleY(0.26)",
            animation: speaking ? "fluxy-avatar-talk 0.32s ease-in-out infinite" : undefined,
          }}
        />
        <path d="M50.5 67 Q60 71 69.5 67" fill="none" stroke="#5c2418" strokeWidth="0.8" opacity={speaking ? 0 : 1} />
      </svg>

      <style>{`
        @keyframes fluxy-avatar-talk {
          0%, 100% { transform: scaleY(0.26); }
          50% { transform: scaleY(1); }
        }
        @keyframes fluxy-avatar-sway {
          0%, 100% { transform: rotate(0deg) translateY(0); }
          50% { transform: rotate(1deg) translateY(-1px); }
        }
        @keyframes fluxy-avatar-breathe {
          0%, 100% { transform: scaleY(1); }
          50% { transform: scaleY(1.015); }
        }
      `}</style>
    </span>
  );
}

function LiveRoomPanel({ session }: { session: ShowcaseSession }) {
  const [floating, setFloating] = React.useState<FloatingReaction[]>([]);
  const [speaking, setSpeaking] = React.useState(true);
  const nextId = React.useRef(0);
  const cleanupTimers = React.useRef(new Set<number>());
  const seenReactionIds = React.useRef(new Map<string, number>());

  React.useEffect(() => {
    const speakTimer = window.setInterval(() => setSpeaking((s) => !s), 900);
    return () => window.clearInterval(speakTimer);
  }, []);

  React.useEffect(
    () => () => {
      for (const timer of cleanupTimers.current) window.clearTimeout(timer);
      cleanupTimers.current.clear();
    },
    [],
  );

  const spawnReaction = React.useCallback((emoji: string) => {
    const id = nextId.current++;
    setFloating((prev) => [
      ...prev.slice(-24),
      {
        id,
        emoji,
        left: 10 + Math.random() * 80,
        drift: -24 + Math.random() * 48,
        rotate: -18 + Math.random() * 36,
      },
    ]);
    const timer = window.setTimeout(() => {
      cleanupTimers.current.delete(timer);
      setFloating((prev) => prev.filter((r) => r.id !== id));
    }, 1800);
    cleanupTimers.current.add(timer);
  }, []);

  const onAnyEvent = React.useCallback(
    (event: FluxyChatEvent) => {
      if (
        event.type !== "client_event" ||
        !["reaction", "client-reaction"].includes(event.eventName)
      ) return;
      const data = event.data as { emoji?: string; reactionId?: string } | null;
      const emoji = data?.emoji && REACTION_EMOJI[data.emoji];
      if (!emoji) return;

      const now = Date.now();
      for (const [id, seenAt] of seenReactionIds.current) {
        if (now - seenAt > 10_000) seenReactionIds.current.delete(id);
      }
      if (data?.reactionId && seenReactionIds.current.has(data.reactionId)) return;
      if (data?.reactionId) seenReactionIds.current.set(data.reactionId, now);
      spawnReaction(emoji);
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

  const [viewerBump, setViewerBump] = React.useState(false);
  const prevViewerCount = React.useRef(viewerCount);
  React.useEffect(() => {
    if (prevViewerCount.current !== viewerCount) {
      prevViewerCount.current = viewerCount;
      setViewerBump(true);
      const t = window.setTimeout(() => setViewerBump(false), 220);
      return () => window.clearTimeout(t);
    }
  }, [viewerCount]);

  const recent = messages.slice(-5);

  const [pressed, setPressed] = React.useState<"heart" | "fire" | null>(null);
  const react = (kind: "heart" | "fire") => {
    if (!connected) return;
    const reactionId = crypto.randomUUID();
    seenReactionIds.current.set(reactionId, Date.now());
    sendClientEvent("reaction", { emoji: kind, reactionId });
    spawnReaction(REACTION_EMOJI[kind]);
    setPressed(kind);
    const timer = window.setTimeout(() => {
      cleanupTimers.current.delete(timer);
      setPressed(null);
    }, 220);
    cleanupTimers.current.add(timer);
  };

  return (
    <div className="relative flex h-full flex-col">
      {/* Video / host area */}
      <div className="relative aspect-video shrink-0 overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-orange-950">
        {/* soft webcam vignette so the avatar reads as a lit camera feed */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(ellipse at 50% 62%, rgba(255,255,255,0.08) 0%, rgba(0,0,0,0) 45%, rgba(0,0,0,0.35) 100%)" }}
          aria-hidden
        />
        <div className="absolute inset-0 flex items-end justify-center pb-3">
          <div className="relative">
            <div
              className={`absolute inset-0 -m-3 rounded-full bg-[var(--fluxy-cta-color)]/25 blur-md transition-opacity duration-300 ${
                speaking ? "opacity-100" : "opacity-40"
              }`}
            />
            <StreamerAvatar speaking={speaking} />
          </div>
        </div>

        <div className="absolute bottom-2 left-2 right-2 flex h-5 items-end gap-0.5 opacity-60" aria-hidden>
          {Array.from({ length: 28 }).map((_, i) => (
            <span
              key={i}
              className="flex-1 rounded-sm bg-[var(--fluxy-cta-color)]/80 transition-all duration-300"
              style={{ height: speaking ? `${18 + Math.sin(i * 0.8) * 10 + (i % 3) * 4}%` : "16%" }}
            />
          ))}
        </div>

        <span className="absolute left-2 top-2 inline-flex items-center gap-1.5 rounded-full bg-[var(--fluxy-cta-color)] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white">
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/80 opacity-75 motion-reduce:animate-none" />
            <span className="relative inline-flex size-1.5 rounded-full bg-white" />
          </span>
          Live
        </span>

        <span
          className={`absolute right-2 top-2 inline-flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-0.5 text-xs font-medium text-white backdrop-blur-sm transition-transform duration-200 ${
            viewerBump ? "scale-110" : ""
          }`}
        >
          <Eye className="size-3.5" aria-hidden />
          <span key={viewerCount} className="tabular-nums animate-in fade-in-0 zoom-in-95 duration-200">
            {viewerCount}
          </span>
          <span className="sr-only">viewers connected</span>
        </span>

        <div className="pointer-events-none absolute inset-0" aria-hidden>
          {floating.map((r) => (
            <span
              key={r.id}
              className="absolute bottom-8 animate-[fluxy-float-up_1.8s_cubic-bezier(0.16,1,0.3,1)_forwards] text-xl motion-reduce:animate-none motion-reduce:opacity-0"
              style={{
                left: `${r.left}%`,
                // @ts-expect-error custom property consumed by the keyframe
                "--fluxy-drift": `${r.drift}px`,
                "--fluxy-rotate": `${r.rotate}deg`,
              }}
            >
              {r.emoji}
            </span>
          ))}
        </div>
      </div>

      {/* Chat overlay */}
      <div className="relative flex-1 overflow-hidden border-b border-border px-4 py-3">
        <ul className="flex h-full flex-col justify-end gap-1.5" aria-live="polite">
          {recent.length === 0 ? (
            <li className="text-xs text-muted-foreground">
              Waiting for live messages{"\u2026"} open this page in a second tab
              and react — events fan out to every subscriber.
            </li>
          ) : (
            recent.map((m) => (
              <li
                key={m.id}
                className="animate-in fade-in-0 slide-in-from-bottom-1 duration-300 truncate text-xs leading-relaxed"
              >
                <span className="font-semibold text-[var(--fluxy-cta-color)]">
                  {m.userId}
                </span>{" "}
                <span className="text-foreground">{m.content}</span>
              </li>
            ))
          )}
        </ul>
      </div>

      <div className="flex items-center gap-2 px-4 py-3">
        <button
          type="button"
          onClick={() => react("heart")}
          disabled={!connected}
          className={`inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-all duration-150 hover:bg-muted active:scale-95 disabled:opacity-50 ${
            pressed === "heart" ? "scale-105 bg-muted" : ""
          }`}
        >
          <Heart className="size-3.5 text-[var(--fluxy-cta-color)]" aria-hidden />
          React
        </button>
        <button
          type="button"
          onClick={() => react("fire")}
          disabled={!connected}
          className={`inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-all duration-150 hover:bg-muted active:scale-95 disabled:opacity-50 ${
            pressed === "fire" ? "scale-105 bg-muted" : ""
          }`}
        >
          <Flame className="size-3.5 text-[var(--fluxy-cta-color)]" aria-hidden />
          Hype
        </button>
        <span
          key={connected ? "on" : "off"}
          className="ml-auto animate-in fade-in-0 duration-300 text-[11px] text-muted-foreground"
        >
          {connected ? "Connected via WebSocket" : "Connecting\u2026"}
        </span>
      </div>

      <style>{`
        @keyframes fluxy-float-up {
          0% { transform: translate(0, 0) scale(0.7) rotate(0deg); opacity: 0; }
          15% { opacity: 1; }
          100% {
            transform: translate(var(--fluxy-drift, 0px), -120px) scale(1.2)
              rotate(var(--fluxy-rotate, 0deg));
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}