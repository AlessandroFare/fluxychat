"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { FluxyChatClient } from "@fluxy-chat/sdk";
import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import {
  DemoTurnstile,
  isDemoTurnstileEnabled,
} from "@/components/demo-turnstile";
import { Loader2, Sparkles, ArrowRight, Bot, MessageSquare, Zap, Shield, Globe, Cpu } from "lucide-react";
import { FluxyChat } from "@/components/chat";
import { cn } from "@/lib/utils";

interface DemoSession {
  enabled: boolean;
  roomId: string;
  userId: string;
  token: string;
  expiresIn: number;
  readOnly?: boolean;
}

const SUGGESTED_PROMPTS = [
  "Tell me about FluxyChat",
  "What can your AI agents do?",
  "Explain the architecture in simple terms",
  "How is this different from Pusher?",
  "Can you write a quickstart example?",
  "Show me a demo of real-time features",
];

const SEED_MESSAGES = [
  {
    id: 1,
    userId: "fluxybot",
    content: "👋 Hey there! Welcome to the FluxyChat playground.",
    createdAt: new Date(Date.now() - 120000).toISOString(),
  },
  {
    id: 2,
    userId: "fluxybot",
    content: "I'm an AI agent running right here in this room. Try asking me anything about FluxyChat, real-time architecture, or how to build with our SDK.",
    createdAt: new Date(Date.now() - 110000).toISOString(),
  },
  {
    id: 3,
    userId: "fluxybot",
    content: "💡 **Tip**: You can ask me to generate images, do deep research, or search the web — just click the **+** button next to the composer.",
    createdAt: new Date(Date.now() - 105000).toISOString(),
  },
];

function FloatingOrb({ className, color = "from-blue-500/20 to-purple-500/20", size = 300 }: { className?: string; color?: string; size?: number }) {
  return (
    <div
      className={cn("absolute rounded-full bg-gradient-to-br blur-3xl animate-pulse", color, className)}
      style={{
        width: size,
        height: size,
        animationDuration: `${4 + Math.random() * 3}s`,
        animationDelay: `${Math.random() * 2}s`,
      }}
    />
  );
}

function DemoHeroSection() {
  return (
    <div className="relative overflow-hidden bg-slate-950 border-b border-white/10">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <FloatingOrb className="top-[-100px] left-[-100px]" size={400} />
        <FloatingOrb className="bottom-[-150px] right-[-100px] from-purple-500/10 to-pink-500/10" size={500} />
        <FloatingOrb className="top-1/2 left-1/3 from-cyan-500/10 to-blue-500/10" size={300} />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(59,130,246,0.06)_0%,transparent_70%)]" />
      </div>
      <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-500/10 px-4 py-1.5 text-xs font-medium text-blue-300">
            <Sparkles className="size-3.5" />
            Live Interactive Demo
          </div>
          <h1 className="font-heading text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
            Try FluxyChat
            <span className="block mt-2 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Right Now
            </span>
          </h1>
          <p className="mx-auto max-w-2xl text-balance leading-relaxed text-slate-400">
            No signup required. You&apos;re in a real room with an AI agent powered by Cloudflare Durable Objects.
            Ask questions, test features, see how it works.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-8 mt-6 text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><Bot className="size-3.5 text-blue-400" /> AI Agent</span>
            <span className="flex items-center gap-1.5"><MessageSquare className="size-3.5 text-blue-400" /> Real-time Chat</span>
            <span className="flex items-center gap-1.5"><Zap className="size-3.5 text-blue-400" /> WebSocket</span>
            <span className="flex items-center gap-1.5"><Globe className="size-3.5 text-blue-400" /> Cloudflare Edge</span>
            <span className="flex items-center gap-1.5"><Shield className="size-3.5 text-blue-400" /> No Signup</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DemoRoomPage() {
  const workerUrl = getPublicWorkerUrl();
  const [session, setSession] = useState<DemoSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSimulated, setShowSimulated] = useState(false);

  const [loadingTimeout, setLoadingTimeout] = useState(false);

  const loadDemoSession = useCallback(
    async (turnstileToken?: string) => {
      setError(null);
      setShowSimulated(false);
      try {
        const usePost = isDemoTurnstileEnabled();
        const res = await fetch(`${workerUrl}/demo/session`, {
          method: usePost ? "POST" : "GET",
          headers: usePost ? { "Content-Type": "application/json" } : undefined,
          body:
            usePost && turnstileToken
              ? JSON.stringify({ turnstileToken })
              : undefined,
        });
        const body = await res.json();
        if (!res.ok) {
          setError(body.error ?? "Demo not available on this deployment.");
          return;
        }
        setSession(body as DemoSession);
      } catch {
        setError("Could not reach the Worker demo endpoint.");
      }
    },
    [workerUrl],
  );

  useEffect(() => {
    if (isDemoTurnstileEnabled()) return;
    setLoadingTimeout(false);
    void loadDemoSession();
    const timer = setTimeout(() => setLoadingTimeout(true), 5000);
    return () => clearTimeout(timer);
  }, [loadDemoSession]);

  const showFallback = !session && !error && loadingTimeout;

  const client = useMemo(() => {
    if (!session?.token || !session.userId) return null;
    return new FluxyChatClient({
      baseUrl: workerUrl,
      userId: session.userId,
      token: session.token,
    });
  }, [session, workerUrl]);

  const readOnly = session?.readOnly === true;

  return (
    <main className="min-h-screen bg-slate-950">
      <DemoHeroSection />

      {/* Demo Chat Section */}
      <div className="relative border-b border-white/10 bg-slate-950/50 px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-4xl">
          {/* Loading State */}
          {!session && !error && !showFallback && (
            <div className="flex flex-col items-center justify-center gap-4 py-24">
              <div className="relative">
                <div className="absolute inset-0 animate-ping rounded-full bg-blue-400/20" />
                <div className="relative flex size-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600">
                  <Loader2 className="size-7 animate-spin text-white" />
                </div>
              </div>
              <p className="text-sm text-slate-400">Connecting to playground…</p>
            </div>
          )}

          {/* Error State */}
          {error && !showSimulated && (
            <div className="flex flex-col items-center gap-6 py-16 text-center">
              <div className="rounded-full bg-amber-500/10 p-4">
                <Bot className="size-8 text-amber-400" />
              </div>
              <div className="max-w-md">
                <h3 className="text-lg font-semibold text-white">Backend Demo Mode</h3>
                <p className="mt-2 text-sm text-slate-400">
                  {error === "demo_not_configured"
                    ? "The demo room isn't configured yet. Set DEMO_ROOM_ID and DEMO_API_KEY on the Worker to enable live mode."
                    : error}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSimulated(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-white transition-all hover:bg-white/10 hover:border-white/20"
              >
                <Zap className="size-4" />
                Show Live Demo Preview
              </button>
            </div>
          )}

          {/* Turnstile */}
          {isDemoTurnstileEnabled() && !session && !error && (
            <div className="mx-auto mt-8 max-w-sm space-y-3 rounded-xl border border-blue-400/20 bg-blue-500/5 p-6">
              <p className="text-center text-sm text-slate-300">
                Complete the check below to enter the demo room.
              </p>
              <DemoTurnstile
                onToken={(token) => void loadDemoSession(token)}
                onError={() => setError("Verification failed. Refresh and try again.")}
              />
            </div>
          )}

          {/* Demo Chat — Live */}
          {session?.enabled && !readOnly && (
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/80 shadow-2xl shadow-blue-500/5 backdrop-blur-sm">
              <div className="flex items-center gap-2 border-b border-white/10 bg-slate-900 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="relative flex size-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400/60" />
                    <span className="relative inline-flex size-2 rounded-full bg-green-400" />
                  </span>
                  <span className="text-xs font-medium text-green-400">Live</span>
                </div>
                <span className="text-xs text-slate-500">Playground Room</span>
              </div>
              <FluxyChat
                roomId={session.roomId}
                agentId=""
                agentName="FluxyBot"
                client={client}
                variant="demo"
                suggestedPrompts={SUGGESTED_PROMPTS}
                className="min-h-[500px]"
              />
            </div>
          )}

          {/* Demo Chat — Read Only */}
          {session?.enabled && readOnly && (
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/80 shadow-2xl shadow-blue-500/5 backdrop-blur-sm">
              <div className="flex items-center gap-2 border-b border-white/10 bg-slate-900 px-4 py-3">
                <span className="size-2 rounded-full bg-amber-400" />
                <span className="text-xs font-medium text-amber-400">Read Only</span>
                <span className="text-xs text-slate-500">Playground Room</span>
              </div>
              <FluxyChat
                roomId={session.roomId}
                agentId=""
                agentName="FluxyBot"
                client={client}
                variant="demo"
                suggestedPrompts={SUGGESTED_PROMPTS}
                className="min-h-[500px]"
              />
            </div>
          )}

          {/* Simulated Mode (fallback) */}
          {showSimulated && (
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/80 shadow-2xl shadow-blue-500/5 backdrop-blur-sm">
              <div className="flex items-center gap-2 border-b border-white/10 bg-slate-900 px-4 py-3">
                <span className="size-2 rounded-full bg-blue-400 animate-pulse" />
                <span className="text-xs font-medium text-blue-400">Preview</span>
                <span className="text-xs text-slate-500">FluxyChat Playground</span>
              </div>
              <div className="p-6 space-y-6">
                <div className="flex items-start gap-3">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600">
                    <Bot className="size-4 text-white" />
                  </div>
                  <div className="space-y-2">
                    {SEED_MESSAGES.map((msg) => (
                      <div key={msg.id} className="rounded-xl bg-slate-800/50 border border-white/5 px-4 py-3">
                        <p className="text-sm text-slate-300">{msg.content}</p>
                        <p className="mt-1 text-[10px] text-slate-600">
                          {new Date(msg.createdAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {SUGGESTED_PROMPTS.slice(0, 6).map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => {
                        setShowSimulated(false);
                        void loadDemoSession();
                      }}
                      className="rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2.5 text-left text-xs text-slate-400 transition-all hover:border-blue-400/20 hover:bg-blue-500/5 hover:text-slate-200"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
                <div className="flex justify-center pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowSimulated(false);
                      void loadDemoSession();
                    }}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-3 text-sm font-medium text-white transition-all hover:from-blue-500 hover:to-purple-500 hover:shadow-lg hover:shadow-blue-500/25"
                  >
                    <Sparkles className="size-4" />
                    Connect to Live Demo
                    <ArrowRight className="size-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Features Strip */}
      <div className="border-b border-white/10 px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {[
              {
                icon: Bot,
                title: "AI Agent Built In",
                desc: "Every room comes with an AI agent that responds to questions, generates images, and searches the web — all on the same WebSocket.",
              },
              {
                icon: Zap,
                title: "Real-time by Default",
                desc: "Messages stream in real-time over Cloudflare Durable Objects. No polling, no third-party services, no latency.",
              },
              {
                icon: Shield,
                title: "No Signup Required",
                desc: "Jump right in. Ephemeral guest sessions are rate-limited and auto-expire. Your privacy is respected.",
              },
            ].map((feature) => (
              <div key={feature.title} className="rounded-xl border border-white/5 bg-white/[0.02] p-6">
                <feature.icon className="size-6 text-blue-400" />
                <h3 className="mt-4 font-semibold text-white">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-heading text-2xl font-bold text-white">Ready to build?</h2>
          <p className="mt-3 text-sm text-slate-400">
            Deploy FluxyChat on your own Cloudflare account in minutes. Self-hosted or hosted — your choice.
          </p>
          <div className="mt-8 flex items-center justify-center gap-4">
            <Link
              href="/get-started"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-3 text-sm font-medium text-white transition-all hover:from-blue-500 hover:to-purple-500"
            >
              <Cpu className="size-4" />
              Get Started Free
            </Link>
            <Link
              href="/landing"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-medium text-white transition-all hover:bg-white/10"
            >
              Learn More
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
