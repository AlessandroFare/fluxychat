"use client";

import { useCallback, useEffect, useMemo, useRef, useState, Suspense, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createMemberFluxyClient } from "@/lib/fluxy-member-client";
import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import {
  DemoTurnstile,
  isDemoTurnstileEnabled,
} from "@/components/demo-turnstile";
import { Loader2, Sparkles, ArrowRight, Bot, MessageSquare, Zap, Shield, Globe, Cpu } from "lucide-react";
import { FluxyChat } from "@/components/chat";
import { cn } from "@/lib/utils";
import { HOSTED_PATHS } from "@/lib/hosted-product";
import { DemoWavesBackground } from "./demo-waves-background";

interface DemoSession {
  enabled: boolean;
  roomId: string;
  userId: string;
  token: string;
  expiresIn: number;
  readOnly?: boolean;
  agentId?: string | null;
  agentName?: string | null;
  agentHandle?: string | null;
}

interface DemoStatus {
  ok?: boolean;
  enabled: boolean;
  configured: boolean;
  ready: boolean;
  roomId: string | null;
  readOnly?: boolean;
  turnstileRequired?: boolean;
  agentName?: string;
}

const SUGGESTED_PROMPTS = [
  "Tell me about FluxyChat",
  "What can your AI agents do?",
  "Explain the architecture in simple terms",
  "How is this different from Pusher?",
  "Can you write a quickstart example?",
  "Show me a demo of real-time features",
];

function DemoChatShell({
  badge,
  badgeClass,
  title,
  children,
}: {
  badge: string;
  badgeClass: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl bg-card text-foreground shadow-xl">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--fluxy-header-bg)]/20 bg-[var(--fluxy-header-bg)] px-4 py-3 text-white">
        <div className="flex items-center gap-2">
          <span className={cn("relative flex size-2", badgeClass)}>
            {badge === "Live" ? (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-300/70 motion-reduce:animate-none" />
            ) : null}
            <span className="relative inline-flex size-2 rounded-full bg-current" />
          </span>
          <span className="text-xs font-semibold">{badge}</span>
          <span className="text-xs text-white/75">{title}</span>
        </div>
        <span className="hidden text-[10px] text-white/70 sm:inline">No signup · guest session</span>
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </div>
  );
}

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
    content: "💡 **Tip**: You can ask me to generate images, do deep research, or search the web. Just click the **+** button next to the composer.",
    createdAt: new Date(Date.now() - 105000).toISOString(),
  },
];

function DemoHeroSection() {
  return (
    <div className="relative border-b border-border">
      <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary">
            <Sparkles className="size-3.5" />
            Live Interactive Demo
          </div>
          <h1 className="font-heading text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            Try FluxyChat
            <span className="mt-2 block text-[var(--fluxy-cta-color)]">
              Right Now
            </span>
          </h1>
          <p className="mx-auto max-w-2xl text-balance leading-relaxed text-muted-foreground">
            No signup required. You&apos;re in a real room with an AI agent powered by Cloudflare Durable Objects.
            Ask questions, test features, see how it works.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-8 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><Bot className="size-3.5 text-primary" /> AI Agent</span>
            <span className="flex items-center gap-1.5"><MessageSquare className="size-3.5 text-primary" /> Real-time Chat</span>
            <span className="flex items-center gap-1.5"><Zap className="size-3.5 text-primary" /> WebSocket</span>
            <span className="flex items-center gap-1.5"><Globe className="size-3.5 text-primary" /> Cloudflare Edge</span>
            <span className="flex items-center gap-1.5"><Shield className="size-3.5 text-primary" /> No Signup</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DemoRoomPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-background">
          <Loader2 className="size-8 animate-spin text-primary" />
        </main>
      }
    >
      <DemoRoomPageContent />
    </Suspense>
  );
}

function DemoRoomPageContent() {
  const searchParams = useSearchParams();
  const roomHint = searchParams.get("room")?.trim() || "demo";
  const workerUrl = getPublicWorkerUrl();
  const [demoStatus, setDemoStatus] = useState<DemoStatus | null>(null);
  const [session, setSession] = useState<DemoSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSimulated, setShowSimulated] = useState(false);

  const [loadingTimeout, setLoadingTimeout] = useState(false);
  const sessionLoadedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`${workerUrl}/demo/status`);
        const body = (await res.json()) as DemoStatus;
        if (!cancelled) setDemoStatus(body);
      } catch {
        if (!cancelled) {
          setDemoStatus({
            enabled: false,
            configured: false,
            ready: false,
            roomId: null,
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workerUrl]);

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
              ? JSON.stringify({ turnstileToken, roomHint })
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
    [workerUrl, roomHint],
  );

  useEffect(() => {
    if (demoStatus === null) return;
    if (!demoStatus.ready) {
      if (!demoStatus.enabled) {
        setError("demo_disabled");
      } else if (!demoStatus.configured) {
        setError("demo_not_configured");
      }
      return;
    }
    if (isDemoTurnstileEnabled() || demoStatus.turnstileRequired) return;
    if (sessionLoadedRef.current) return;
    sessionLoadedRef.current = true;
    setLoadingTimeout(false);
    void loadDemoSession();
    const timer = setTimeout(() => setLoadingTimeout(true), 5000);
    return () => clearTimeout(timer);
  }, [demoStatus, loadDemoSession]);

  const showFallback = demoStatus?.ready && !session && !error && loadingTimeout;

  const client = useMemo(() => {
    if (!session?.token) return null;
    return createMemberFluxyClient({
      memberJwt: session.token,
      memberUserId: session.userId,
      workerUrl,
    });
  }, [session, workerUrl]);

  const readOnly = session?.readOnly === true;

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <DemoWavesBackground />
      <div className="relative z-10">
      <DemoHeroSection />

      {/* Demo Chat Section */}
      <div className="relative border-b border-border bg-background/70 px-4 py-12 sm:px-6 backdrop-blur-[2px]">
        <div className="mx-auto max-w-4xl">
          {/* Loading State */}
          {!session && !error && !showFallback && (demoStatus === null || demoStatus.ready) && (
            <div className="flex flex-col items-center justify-center gap-4 py-24">
              <div className="relative">
                <div className="absolute inset-0 animate-ping rounded-full bg-blue-400/20" />
                <div className="relative flex size-16 items-center justify-center rounded-full bg-primary">
                  <Loader2 className="size-7 animate-spin text-primary-foreground" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">Connecting to playground…</p>
            </div>
          )}

          {/* Error State */}
          {error && !showSimulated && (
            <div className="flex flex-col items-center gap-6 py-16 text-center">
              <div className="rounded-full bg-amber-500/10 p-4">
                <Bot className="size-8 text-amber-400" />
              </div>
              <div className="max-w-md">
                <h3 className="text-lg font-semibold text-foreground">Backend Demo Mode</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {error === "demo_not_configured"
                    ? "The demo room isn't configured yet. Set DEMO_ROOM_ID and DEMO_API_KEY on the Worker to enable live mode."
                    : error === "demo_disabled"
                      ? "The public demo is disabled on this deployment. Set DEMO_ENABLED=true on the Worker to enable it."
                      : error}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSimulated(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-card shadow-[var(--shadow-2)] px-5 py-3 text-sm font-medium text-foreground transition-all hover:bg-muted"
              >
                <Zap className="size-4" />
                Show Live Demo Preview
              </button>
            </div>
          )}

          {/* Turnstile */}
          {(isDemoTurnstileEnabled() || demoStatus?.turnstileRequired) &&
            demoStatus?.ready &&
            !session &&
            !error && (
            <div className="mx-auto mt-8 max-w-sm space-y-3 rounded-xl bg-card shadow-[var(--shadow-2)] p-6">
              <p className="text-center text-sm text-muted-foreground">
                Complete the check below to enter the demo room.
              </p>
              <DemoTurnstile
                onToken={(token) => void loadDemoSession(token)}
                onError={() => setError("Verification failed. Refresh and try again.")}
              />
            </div>
          )}

          {/* Demo Chat — Live */}
          {session?.enabled && !readOnly && client && (
            <DemoChatShell badge="Live" badgeClass="text-green-400" title="Playground Room">
              <p className="mb-3 rounded-lg border border-[var(--fluxy-banner-border)] bg-[var(--fluxy-banner-bg)] px-3 py-2 text-xs text-[var(--fluxy-banner-text)]">
                Public playground. Your messages appear on the right.{" "}
                {session.agentName ?? "FluxyBot"} replies automatically via AI.
                Sessions are rate-limited and expire after {Math.round((session.expiresIn ?? 1800) / 60)} minutes.
              </p>
              <FluxyChat
                roomId={session.roomId}
                agentId={session.agentId ?? ""}
                agentName={session.agentName ?? "FluxyBot"}
                agentHandle={session.agentHandle ?? "@assistant"}
                memberUserId={session.userId}
                memberJwt={session.token}
                client={client}
                variant="demo"
                coPilotConfirm={false}
                suggestedPrompts={SUGGESTED_PROMPTS}
                className="min-h-[520px]"
              />
            </DemoChatShell>
          )}

          {/* Demo Chat — Read Only */}
          {session?.enabled && readOnly && client && (
            <DemoChatShell badge="Read only" badgeClass="text-amber-400" title="Playground Room">
              <FluxyChat
                roomId={session.roomId}
                agentId={session.agentId ?? ""}
                agentName={session.agentName ?? "FluxyBot"}
                agentHandle={session.agentHandle ?? "@assistant"}
                memberUserId={session.userId}
                memberJwt={session.token}
                client={client}
                variant="demo"
                coPilotConfirm={false}
                suggestedPrompts={SUGGESTED_PROMPTS}
                className="min-h-[520px]"
              />
            </DemoChatShell>
          )}

          {/* Simulated Mode (fallback) */}
          {showSimulated && (
            <DemoChatShell badge="Preview" badgeClass="text-blue-400" title="FluxyChat Playground">
              <div className="space-y-6">
                <div className="flex items-start gap-3">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--fluxy-logo-color)] to-[var(--fluxy-cta-color)]">
                    <Bot className="size-4 text-white" />
                  </div>
                  <div className="space-y-2">
                    {SEED_MESSAGES.map((msg) => (
                      <div key={msg.id} className="rounded-xl border border-border bg-[var(--fluxy-bubble-received-bg)] px-4 py-3">
                        <p className="text-sm text-foreground">{msg.content}</p>
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          {new Date(msg.createdAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {SUGGESTED_PROMPTS.slice(0, 6).map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => {
                        setShowSimulated(false);
                        void loadDemoSession();
                      }}
                      className="rounded-xl border border-border bg-background px-3 py-2.5 text-left text-xs text-muted-foreground transition-all hover:border-[var(--fluxy-cta-color)]/30 hover:bg-[var(--fluxy-banner-bg)] hover:text-foreground"
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
                    className="inline-flex items-center gap-2 rounded-xl bg-[var(--fluxy-btn-primary-bg)] px-6 py-3 text-sm font-medium text-[var(--fluxy-btn-primary-text)] transition-all hover:bg-[var(--fluxy-btn-primary-hover-bg)]"
                  >
                    <Sparkles className="size-4" />
                    Connect to Live Demo
                    <ArrowRight className="size-4" />
                  </button>
                </div>
              </div>
            </DemoChatShell>
          )}
        </div>
      </div>

      {/* Features Strip */}
      <div className="border-b border-border px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {[
              {
                icon: Bot,
                title: "AI Agent Built In",
                desc: "Every room comes with an AI agent that responds to questions, generates images, and searches the web, all on the same WebSocket.",
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
              <div key={feature.title} className="rounded-xl bg-card shadow-[var(--shadow-2)] p-6">
                <feature.icon className="size-6 text-primary" />
                <h3 className="mt-4 font-semibold text-foreground">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-heading text-2xl font-bold text-foreground">Ready to build?</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Deploy FluxyChat on your own Cloudflare account in minutes. Self-hosted or hosted: your choice.
          </p>
          <div className="mt-8 flex items-center justify-center gap-4">
            <Link
              href="/get-started"
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--fluxy-btn-primary-bg)] px-6 py-3 text-sm font-medium text-[var(--fluxy-btn-primary-text)] transition-all hover:bg-[var(--fluxy-btn-primary-hover-bg)]"
            >
              <Cpu className="size-4" />
              Get Started Free
            </Link>
            <Link
              href={HOSTED_PATHS.landing}
              className="inline-flex items-center gap-2 rounded-xl bg-card shadow-[var(--shadow-2)] px-6 py-3 text-sm font-medium text-foreground transition-all hover:bg-muted"
            >
              Learn More
            </Link>
          </div>
        </div>
      </div>
      </div>
    </main>
  );
}
