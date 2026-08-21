"use client";

import Link from "next/link";
import { ArrowRight, Bot, Sparkles, MessageSquare, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";

const FLOATING_MESSAGES = [
  { text: "Tell me about FluxyChat", align: "left", delay: 0 },
  { text: "Real-time chat, AI agents, streaming, whiteboards, multiplayer, and IoT on one SDK on Cloudflare.", align: "right", delay: 1.5 },
  { text: "How is it different from Pusher?", align: "left", delay: 3 },
  { text: "Same worker for chat and platform modules. Self-host or hosted. Lower cost at similar message volume.", align: "right", delay: 4.5 },
  { text: "Can you write a quickstart example?", align: "left", delay: 6 },
  { text: "pnpm add @fluxy-chat/sdk, then FluxyChatClient + useChat with a roomId and member JWT from your backend.", align: "right", delay: 7.5 },
];

function TypewriterText({ text, delay, onComplete }: { text: string; delay: number; onComplete?: () => void }) {
  const [displayed, setDisplayed] = useState("");
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setStarted(true), delay * 1000);
    return () => clearTimeout(timer);
  }, [delay]);

  useEffect(() => {
    if (!started) return;
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(interval);
        onComplete?.();
      }
    }, 20 + Math.random() * 30);
    return () => clearInterval(interval);
  }, [started, text, onComplete]);

  if (!started) return null;
  return (
    <span>
      {displayed}
      {displayed.length < text.length && (
        <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-blue-400" />
      )}
    </span>
  );
}

function ChatBubble({ message, index }: { message: typeof FLOATING_MESSAGES[0]; index: number }) {
  const isLeft = message.align === "left";
  const isCode = message.text.startsWith("```");

  return (
    <div
      className={cn(
        "flex items-start gap-3 opacity-0 transition-all duration-700",
        isLeft ? "justify-start" : "justify-end",
      )}
      style={{
        animation: `fadeInUp 0.6s ease-out ${message.delay + 0.3}s forwards`,
      }}
    >
      {isLeft && (
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-zinc-700">
          <Bot className="size-4 text-white" />
        </div>
      )}
      <div
        className={cn(
          "max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
          isLeft
            ? "rounded-tl-sm bg-zinc-800 text-zinc-100"
            : "rounded-tr-sm bg-zinc-200 text-zinc-900",
          isCode && "font-mono text-xs",
        )}
      >
        {isCode ? (
          <pre className="whitespace-pre-wrap">{message.text.replace(/```/g, "").trim()}</pre>
        ) : (
          <TypewriterText text={message.text} delay={message.delay} />
        )}
      </div>
    </div>
  );
}

export function LandingDemoSection() {
  const [visible, setVisible] = useState(false);
  const [cycle, setCycle] = useState(0);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    const timer = setInterval(() => setCycle((c) => c + 1), 18000);
    return () => clearInterval(timer);
  }, [visible]);

  return (
    <section
      ref={ref}
      id="demo"
      className="scroll-mt-20 border-b border-white/10 px-4 py-20 sm:px-6"
    >
      <div className="mx-auto max-w-6xl">
        {/* Section Header */}
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--mkt-brand)]/30 bg-[var(--mkt-brand)]/15 px-4 py-1.5 text-xs font-medium text-[var(--mkt-brand-soft)]">
            <Sparkles className="size-3.5" />
            Live Playground
          </div>
          <h2 className="text-balance font-heading text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Try it right now.
            <span className="mt-1 block text-[var(--mkt-brand-soft)]">
              No signup required.
            </span>
          </h2>
          <p className="mx-auto mt-2 max-w-2xl text-pretty leading-relaxed text-slate-400">
            Jump into a live room with an AI agent. Ask questions, test real-time messaging, see how
            Durable Objects work. Everything runs on Cloudflare&apos;s edge network.
          </p>
        </div>

        {/* Animated Chat Preview */}
        {visible && (
          <div className="relative mx-auto mt-12 max-w-2xl">
            {/* Background glow */}
            <div className="pointer-events-none absolute -inset-4 rounded-3xl bg-[var(--mkt-brand)]/10" />

            {/* Chat Window */}
            <div key={cycle} className="relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/90 shadow-xl">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-white/10 bg-slate-900/50 px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex size-8 items-center justify-center rounded-full bg-[var(--mkt-brand)]">
                    <Bot className="size-4 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">FluxyBot</p>
                    <p className="flex items-center gap-1 text-[10px] text-green-400">
                      <span className="relative flex size-1.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400/60" />
                        <span className="relative inline-flex size-1.5 rounded-full bg-green-400" />
                      </span>
                      Online
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Zap className="size-3.5 text-[var(--mkt-brand-soft)]" />
                  Cloudflare Edge
                </div>
              </div>

              {/* Messages */}
              <div className="space-y-4 p-4 min-h-[300px]">
                {FLOATING_MESSAGES.map((msg, i) => (
                  <ChatBubble key={i} message={msg} index={i} />
                ))}
              </div>

              {/* Composer */}
              <div className="border-t border-white/10 bg-slate-900/50 px-4 py-3">
                <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-800/50 px-4 py-2.5">
                  <input
                    type="text"
                    readOnly
                    placeholder="Ask FluxyBot anything..."
                    className="flex-1 bg-transparent text-sm text-slate-300 placeholder:text-slate-600 outline-none"
                  />
                  <span className="flex size-8 items-center justify-center rounded-lg bg-[var(--mkt-brand)]">
                    <ArrowRight className="size-4 text-white" />
                  </span>
                </div>
              </div>
            </div>

            {/* CTA */}
            <div className="mt-8 flex items-center justify-center gap-4">
              <Link
                href="/demo"
                className="group inline-flex items-center gap-2 rounded-xl bg-[var(--mkt-brand)] px-6 py-3 text-sm font-medium text-white transition hover:opacity-90"
              >
                <MessageSquare className="size-4 transition-transform group-hover:scale-110" />
                Open Playground
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/guides"
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-medium text-slate-300 transition-all hover:bg-white/10 hover:text-white"
              >
                Read the Docs
              </Link>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
