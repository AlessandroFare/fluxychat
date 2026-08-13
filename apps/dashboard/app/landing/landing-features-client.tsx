"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";
import Link from "next/link";
import { Shield, Sparkles, Zap } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import {
  MARKETING_PLATFORM_FEATURES,
  MARKETING_USE_CASES,
  MARKETING_WHY,
} from "@/lib/marketing-landing";
import { MESSAGING_FLOW_ITEMS } from "~/components/marketing/flowing-menu";
import { type PillarBentoItem } from "~/components/marketing/pillars-bento";
import { HOSTED_COPY, HOSTED_PATHS, isClerkClientConfigured } from "@/lib/hosted-product";
import { cn } from "@/lib/utils";

const FlowingMenu = dynamic(
  () => import("~/components/marketing/flowing-menu").then((m) => ({ default: m.FlowingMenu })),
  { ssr: false },
);

const ProductStoryReel = dynamic(
  () =>
    import("~/components/marketing/product-story-reel").then((m) => ({ default: m.ProductStoryReel })),
  { ssr: false },
);

const TeamsStartFlow = dynamic(
  () => import("~/components/marketing/teams-start-flow").then((m) => ({ default: m.TeamsStartFlow })),
  { ssr: false },
);

const PillarsBento = dynamic(
  () => import("~/components/marketing/pillars-bento").then((m) => ({ default: m.PillarsBento })),
  { ssr: false },
);

const MiddlewarePipelineViz = dynamic(
  () =>
    import("~/components/marketing/middleware-pipeline-viz").then((m) => ({
      default: m.MiddlewarePipelineViz,
    })),
  { ssr: false },
);

function SectionFallback({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-muted/40", className)} aria-hidden />;
}

const PILLARS: readonly PillarBentoItem[] = [
  {
    icon: Zap,
    label: "Realtime",
    title: "Runs on your edge",
    body: "WebSockets and Durable Objects handle presence, typing, and delivery. One Room DO per room, so no socket fleet to babysit.",
  },
  {
    icon: Shield,
    label: "Trust",
    title: "GDPR & compliance tools included",
    body: "Export, erasure, audit trails, retention policies, and signed webhooks when you need to answer security questionnaires.",
  },
  {
    icon: Sparkles,
    label: "AI-native",
    title: "Agents and humans, one stream",
    body: "Tool events, streaming markdown, and MCP calls ride the same room WebSocket as user messages. Debug copilots without a second realtime pipe.",
  },
];

export function LandingFeaturesClient() {
  return (
    <>
      <section id="features" className="scroll-mt-20 border-b border-border bg-[#0e0e0e]">
        <div className="mx-auto max-w-6xl px-4 pt-14 pb-5 sm:px-6 sm:pt-16">
          <h2 className="mb-2 text-center font-heading text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Messaging basics, on the edge
          </h2>
          <p className="mx-auto max-w-2xl px-2 text-center text-sm text-zinc-300 sm:text-base">
            Channels, presence, mentions, and webhooks without bolting on another realtime vendor. Tap or hover a row on desktop.
          </p>
        </div>

        <div className="relative h-[min(448px,70svh)] min-h-[280px] w-full overflow-hidden">
          <Suspense fallback={<SectionFallback className="mx-auto h-full max-w-6xl" />}>
            <FlowingMenu
              items={MESSAGING_FLOW_ITEMS}
              speed={18}
              textColor="#9ca3af"
              bgColor="#0e0e0e"
              marqueeBgColor="#e8450a"
              marqueeTextColor="#ffffff"
              borderColor="rgba(255,255,255,0.07)"
            />
          </Suspense>
        </div>

        <div className="mx-auto max-w-6xl px-4 pb-10 pt-4 sm:px-6">
          <p className="text-center text-xs text-zinc-400">
            Threads, polls, and translation are up to your product layer. FluxyChat ships the realtime core: rooms, presence, typing, delivery, and AI agent events.
          </p>
        </div>
      </section>

      <Suspense fallback={<SectionFallback className="mx-auto my-8 h-48 max-w-6xl" />}>
        <ProductStoryReel />
      </Suspense>

      <section
        className="border-b border-border px-4 py-16 sm:px-6"
        style={{ backgroundColor: "var(--am-whisper-gray)" }}
      >
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-2 text-center font-heading text-3xl font-bold tracking-tight">
            What ships in the box
          </h2>
          <p className="mx-auto mb-4 max-w-2xl text-center text-base text-muted-foreground">
            Edge delivery, AI-native streaming, 14 platform adapters, and a console for day-two work. You own the UI; we handle rooms, delivery, agents, and ops hooks.
          </p>
          <p className="mx-auto mb-6 max-w-2xl text-center text-sm text-muted-foreground">{MARKETING_WHY.body}</p>
          <ul className="mx-auto mb-10 flex max-w-3xl flex-wrap justify-center gap-2">
            {MARKETING_PLATFORM_FEATURES.map((feature) => (
              <li
                key={feature}
                className="rounded-full border border-border bg-white/80 px-3 py-1.5 text-xs font-medium text-slate-700 sm:text-sm"
              >
                {feature}
              </li>
            ))}
          </ul>
          <p className="mx-auto mb-10 max-w-2xl text-center text-sm text-muted-foreground">
            Already set up?{" "}
            <Link href={HOSTED_PATHS.console} className="font-medium text-foreground underline-offset-4 hover:underline">
              Open the console
            </Link>{" "}
            for rooms, agents, and billing.
          </p>
          <Suspense fallback={<SectionFallback className="mx-auto h-64 max-w-6xl" />}>
            <PillarsBento items={PILLARS} />
          </Suspense>
        </div>
      </section>

      <section className="border-b border-border bg-[#0e0e0e] px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <p className="mb-6 text-center text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Built-in architecture
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "14 platform adapters", desc: "Slack, Discord, Telegram, WhatsApp, Teams, Email, SMS, Webhook, Matrix, and 5 more on one unified interface" },
              { label: "Streaming markdown", desc: "Table buffering, code fence tracking, inline marker healing for clean partial renders during AI streaming" },
              { label: "MCP client + tool calling", desc: "Consume any MCP-compatible tool server. Auto-convert to LLM function-calling format with HITL approval gates" },
              { label: "Card builder", desc: "Composable rich messaging with JSX or function API. Slack Block Kit and Teams Adaptive Card renderers built in" },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-white/10 bg-white/5 px-5 py-4">
                <p className="text-sm font-semibold text-white">{item.label}</p>
                <p className="mt-1 text-xs leading-relaxed text-zinc-400">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-white px-4 py-20 sm:px-6">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Middleware pipeline</p>
            <h2 className="font-heading text-3xl font-bold tracking-tight text-foreground">
              Transform messages and AI responses before they land
            </h2>
            <p className="mt-4 text-muted-foreground">
              Moderate, validate, enrich, and fan out from the edge. LLM middleware supports guardrails, caching, RAG injection, PII redaction, and logging via wrapGenerate / wrapStream / transformParams. Policy code stays on the data path, not in a sidecar you forget to deploy.
            </p>
          </div>
          <Suspense fallback={<SectionFallback className="h-72 w-full" />}>
            <MiddlewarePipelineViz />
          </Suspense>
        </div>
      </section>

      <section className="border-b border-border bg-[var(--am-whisper-gray)] px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 rounded-2xl border border-border bg-card p-8 shadow-[var(--shadow-sm)] sm:p-10">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Developers</p>
            <h2 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
              SDK, CLI, docs, and console in one repo
            </h2>
            <p className="mt-3 max-w-3xl text-muted-foreground">
              Auth, rooms, and retries sit behind hooks and route handlers. Scaffold a new project with create-fluxy-chat CLI. When you need keys, quotas, or billing, open the operator UI instead of wiring another admin surface.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild>
                <Link href={isClerkClientConfigured() ? HOSTED_PATHS.signUp : HOSTED_PATHS.getStarted}>
                  {HOSTED_COPY.startFree}
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={HOSTED_PATHS.docs}>{HOSTED_COPY.viewDocs}</Link>
              </Button>
            </div>
          </div>
          <div className="flex flex-col items-center text-center">
            <h3 id="where-teams-start" className="relative z-10 font-heading text-xl font-semibold tracking-tight">
              Where teams start
            </h3>
            <div className="relative z-0 w-full max-w-full overflow-x-auto">
              <Suspense fallback={<SectionFallback className="mx-auto h-40 w-full max-w-4xl" />}>
                <TeamsStartFlow />
              </Suspense>
            </div>
            <div className="mt-1 grid w-full gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {MARKETING_USE_CASES.map((u) => (
                <Card
                  key={u.title}
                  className={cn(
                    "border-black/[0.06] bg-white/95 shadow-[var(--shadow-subtle-2)]",
                    "transition duration-300 hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-md",
                  )}
                >
                  <CardContent className="min-h-[11rem] pt-7">
                    <h4 className="font-heading text-base font-semibold text-slate-900">{u.title}</h4>
                    <p className="mt-3 text-sm leading-relaxed text-slate-600">{u.body}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
