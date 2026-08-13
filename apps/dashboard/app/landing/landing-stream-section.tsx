"use client";

import React from "react";
import { Eye, MessageSquare, BarChart3, Shield, Gift, Sparkles, Mic, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { MarketingStreamerAvatar } from "~/components/marketing/streamer-avatar";

const STREAM_FEATURES = [
  {
    id: "live",
    title: "Live video broadcast",
    description: "WebRTC + Cloudflare Stream HLS relay with adaptive bitrate, DVR, and multi-resolution.",
    icon: Eye,
  },
  {
    id: "chat",
    title: "Chat overlay",
    description: "Integrated FluxyChat room inside the player. Viewers chat, react, and engage in real-time.",
    icon: MessageSquare,
  },
  {
    id: "polls",
    title: "Polls & quizzes",
    description: "Create polls and quizzes during the stream. Results update in real-time for everyone.",
    icon: BarChart3,
  },
  {
    id: "moderation",
    title: "AI moderation",
    description: "Automated content moderation powered by DLP and AI agents. Keep chat clean at scale.",
    icon: Shield,
  },
  {
    id: "gifts",
    title: "Virtual gifts & tipping",
    description: "Viewers send virtual gifts with physics animations. Stripe-powered tipping for creators.",
    icon: Gift,
  },
  {
    id: "highlights",
    title: "AI highlights",
    description: "Automatic highlight reels generated from chat spikes, reactions, and viewer sentiment.",
    icon: Sparkles,
  },
];

const LIVE_LINES = [
  "Welcome to the stream everyone! 🎉",
  "Today we're diving deep into real-time architecture.",
  "Let me show you the WebRTC setup...",
  "This is where FluxyStream handles fan-out.",
  "Questions? Drop them in chat!",
];

const CHAT_MSGS = [
  { user: "milo", text: "this is incredible 🔥", color: "text-blue-400" },
  { user: "reyna", text: "love the low-latency demo", color: "text-orange-400" },
  { user: "otisq", text: "how's the ABR working?", color: "text-emerald-400" },
  { user: "zaraa", text: "please share the docs link", color: "text-pink-400" },
  { user: "finch", text: "first time seeing this, wow", color: "text-blue-300" },
  { user: "talia", text: "the chat overlay is seamless", color: "text-orange-300" },
];

function StreamerAvatar({ speaking = true }: { speaking?: boolean }) {
  return (
    <div className="relative h-20 w-20">
      <MarketingStreamerAvatar speaking={speaking} />
    </div>
  );
}

export function LandingStreamSection() {
  const sectionRef = React.useRef<HTMLElement>(null);
  const [visible, setVisible] = React.useState(false);
  const [lineIdx, setLineIdx] = React.useState(0);
  const [viewerCount, setViewerCount] = React.useState(842);
  const [chatVisible, setChatVisible] = React.useState(0);
  const [hearts, setHearts] = React.useState<{ id: number; left: number }[]>([]);
  const [speaking, setSpeaking] = React.useState(true);
  const heartId = React.useRef(0);

  React.useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); obs.disconnect(); }
    }, { threshold: 0.3 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  React.useEffect(() => {
    if (!visible) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setLineIdx(LIVE_LINES.length - 1); setChatVisible(CHAT_MSGS.length); return; }

    let cancelled = false;
    const run = async () => {
      while (!cancelled) {
        for (let i = 0; i < LIVE_LINES.length; i++) {
          if (cancelled) return;
          setLineIdx(i);
          await new Promise((r) => setTimeout(r, 2200));
        }
        await new Promise((r) => setTimeout(r, 1500));
      }
    };
    void run();

    const chatTimer = setInterval(() => {
      setChatVisible((v) => (v >= CHAT_MSGS.length ? 1 : v + 1));
    }, 1800);

    const viewerTimer = setInterval(() => {
      setViewerCount((v) => v + Math.round(Math.random() * 7 - 1));
    }, 2500);

    const heartTimer = setInterval(() => {
      const id = heartId.current++;
      setHearts((prev) => [...prev.slice(-6), { id, left: 15 + Math.random() * 70 }]);
      setTimeout(() => setHearts((prev) => prev.filter((h) => h.id !== id)), 2200);
    }, 700);

    const speakTimer = setInterval(() => setSpeaking((s) => !s), 850);

    return () => {
      cancelled = true;
      clearInterval(chatTimer);
      clearInterval(viewerTimer);
      clearInterval(heartTimer);
      clearInterval(speakTimer);
    };
  }, [visible]);

  return (
    <section
      ref={sectionRef}
      id="streaming"
      className="scroll-mt-20 border-b border-white/10 bg-slate-950 px-4 py-20 sm:px-6"
    >
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">
            FluxyStream
          </p>
          <h2 className="text-balance font-heading text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Live streaming with real-time chat
          </h2>
          <p className="mx-auto max-w-2xl text-pretty leading-relaxed text-slate-300">
            Broadcast live video via WebRTC, RTMP, or OBS. Viewers watch with integrated chat,
            polls, virtual gifts, and AI moderation, all in one room.
          </p>
        </div>

        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {STREAM_FEATURES.map((feat, idx) => {
            const Icon = feat.icon;
            return (
              <div
                key={feat.id}
                className={cn(
                  "group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition-all duration-500",
                  visible && "animate-in fade-in-0 slide-in-from-bottom-4",
                  visible ? "opacity-100" : "opacity-0",
                )}
                style={{ animationDelay: `${idx * 100}ms`, animationFillMode: "both" }}
              >
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                    <Icon className="size-4" />
                  </div>
                </div>
                <h3 className="text-sm font-semibold text-white">{feat.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">{feat.description}</p>
              </div>
            );
          })}
        </div>

        <div className="mt-10 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-emerald-500/[0.04] to-slate-900">
          <div className="grid md:grid-cols-[1fr_1.2fr]">
            {/* Live preview */}
            <div className="relative flex flex-col items-center justify-center border-b border-white/10 p-6 md:border-b-0 md:border-r">
              <div className="relative mb-4 h-40 w-40">
                <div className="absolute inset-0 animate-[ls-pulse-ring_3s_ease-in-out_infinite] rounded-full border-2 border-emerald-500/30 motion-reduce:animate-none" />
                <div className="absolute inset-2 animate-[ls-pulse-ring_3s_ease-in-out_infinite_0.5s] rounded-full border-2 border-emerald-500/20 motion-reduce:animate-none" style={{ animationDelay: "0.5s" }} />
                <div className="relative flex h-full w-full items-center justify-center">
                  <StreamerAvatar speaking={speaking} />
                </div>
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-medium text-emerald-300 animate-in fade-in-0 slide-in-from-bottom-1 duration-300">
                  <Mic className="mr-1 inline size-2.5" aria-hidden />
                  LIVE
                </span>
              </div>
              <div className="h-16 text-center">
                <p key={lineIdx} className="animate-in fade-in-0 slide-in-from-bottom-2 duration-400 text-sm leading-relaxed text-slate-200 motion-reduce:animate-none">
                  {LIVE_LINES[lineIdx]}
                </p>
              </div>
              <div className="mt-3 flex items-center gap-4 text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  <Eye className="size-3.5" aria-hidden />
                  <span key={viewerCount} className="tabular-nums animate-in fade-in-0 duration-200">
                    {viewerCount.toLocaleString()}
                  </span>
                </span>
                <span className="flex items-center gap-1">
                  <Heart className="size-3.5 text-red-400" aria-hidden />
                  4.2K
                </span>
              </div>
              <div className="pointer-events-none absolute inset-0" aria-hidden>
                {hearts.map((h) => (
                  <span
                    key={h.id}
                    className="absolute bottom-20 text-lg motion-reduce:hidden"
                    style={{ left: `${h.left}%`, animation: "ls-float-up 2.2s cubic-bezier(0.16,1,0.3,1) forwards" }}
                  >
                    {h.id % 3 === 0 ? "❤️" : h.id % 3 === 1 ? "🔥" : "⭐"}
                  </span>
                ))}
              </div>
            </div>

            {/* Chat overlay */}
            <div className="flex flex-col p-4">
              <div className="mb-2 flex items-center gap-2 border-b border-white/10 pb-2">
                <span className="flex size-2">
                  <span className="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-emerald-400/60 motion-reduce:animate-none" />
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
                </span>
                <span className="text-xs font-semibold text-white">Stream chat</span>
                <span className="ml-auto text-[10px] text-slate-500">2.1K viewers</span>
              </div>
              <div className="flex min-h-40 flex-col justify-end gap-1.5">
                {CHAT_MSGS.slice(0, chatVisible).map((c, i) => (
                  <p key={`${c.user}-${i}-${chatVisible}`} className="animate-in fade-in-0 slide-in-from-bottom-1 duration-300 truncate text-xs leading-relaxed">
                    <span className={cn("font-semibold", c.color)}>{c.user}</span>{" "}
                    <span className="text-slate-300">{c.text}</span>
                  </p>
                ))}
                <div className="mt-2 flex items-center gap-1 text-[10px] text-slate-600">
                  <span className="flex gap-0.5">
                    <span className="size-1 animate-bounce rounded-full bg-slate-500 motion-reduce:animate-none" style={{ animationDelay: "0ms" }} />
                    <span className="size-1 animate-bounce rounded-full bg-slate-500 motion-reduce:animate-none" style={{ animationDelay: "120ms" }} />
                    <span className="size-1 animate-bounce rounded-full bg-slate-500 motion-reduce:animate-none" style={{ animationDelay: "240ms" }} />
                  </span>
                  4 more typing...
                </div>
              </div>
              <div className="mt-3 rounded-full border border-white/10 bg-slate-950/60 px-3 py-1.5 text-[11px] text-slate-600">
                Type a message...
              </div>
            </div>
          </div>
        </div>

        <style>{`
          @keyframes ls-pulse-ring {
            0% { transform: scale(1); opacity: 0.4; }
            50% { transform: scale(1.08); opacity: 0.1; }
            100% { transform: scale(1); opacity: 0.4; }
          }
          @keyframes ls-float-up {
            0% { transform: translateY(0) scale(0.6); opacity: 0; }
            15% { opacity: 1; }
            100% { transform: translateY(-140px) scale(1.2); opacity: 0; }
          }
        `}</style>
      </div>
    </section>
  );
}
