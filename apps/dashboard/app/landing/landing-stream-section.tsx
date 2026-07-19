"use client";

import React from "react";
import { Eye, MessageSquare, BarChart3, Shield, Gift, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

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

export function LandingStreamSection() {
  const sectionRef = React.useRef<HTMLElement>(null);
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); obs.disconnect(); }
    }, { threshold: 0.3 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

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
            polls, virtual gifts, and AI moderation — all in one room.
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

        <div className="mt-10 rounded-2xl border border-white/10 bg-gradient-to-br from-emerald-500/5 to-slate-900 p-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold text-white">Stream as a Room</h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">
                Every live stream is a FluxyChat room. Viewers are participants with profile avatars.
                They can raise their hand to come on stage via WebRTC, vote on interactive polls,
                and send reactions that float across the video.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Multi-angle & AI co-host</h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">
                Viewers choose their camera angle. An AI co-host answers questions, moderates chat,
                and generates real-time highlights. Live commerce integration shows buy buttons
                synced with products on screen.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
