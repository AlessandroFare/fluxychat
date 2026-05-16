"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  AtSign,
  BookOpen,
  Bot,
  Check,
  Copy,
  Cpu,
  Eye,
  Globe,
  Layers,
  MessageSquare,
  Search,
  Shield,
  ShieldBan,
  Sparkles,
  Webhook,
  Zap,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { PUBLIC_PLAN_CATALOG } from "~/lib/plan-catalog";
import { Grainient } from "~/components/marketing/grainient";
import { HeroCodeInboxDemo } from "~/components/marketing/hero-code-inbox-demo";
import { ProductStoryReel } from "~/components/marketing/product-story-reel";
import { SpotlightCard } from "~/components/marketing/spotlight-card";
import { TeamsStartFlow } from "~/components/marketing/teams-start-flow";
import { FlowingMenu, MESSAGING_FLOW_ITEMS } from "~/components/marketing/flowing-menu";
import { PillarsBento, type PillarBentoItem } from "~/components/marketing/pillars-bento";
import { MiddlewarePipelineViz } from "~/components/marketing/middleware-pipeline-viz";
import { ConsoleEntryLink } from "../components/console-entry-link";
import { LandingHeroAuthCta, LandingNavAuthCta } from "../components/landing-auth-cta";
import { FluxychatIcon, FluxychatLogotype } from "@/components/FluxychatLogo";
import { HOSTED_COPY, HOSTED_PATHS, isClerkClientConfigured } from "@/lib/hosted-product";
import { formatNumber } from "@/lib/format-number";
import { cn } from "@/lib/utils";

const INSTALL_CMD = "pnpm add @fluxychat/sdk";

const STACK_LOGOS = [
  "Next.js",
  "React",
  "Vue",
  "Vite",
  "Node",
  "Workers",
  "React Native",
  "Svelte",
  "Remix",
  "TanStack",
  "Express",
  "Fastify",
] as const;

const PILLARS: readonly PillarBentoItem[] = [
  {
    icon: Zap,
    label: "Realtime",
    title: "Runs on your edge",
    body: "WebSockets and Durable Objects handle presence, typing, and delivery. No socket fleet to babysit.",
  },
  {
    icon: Shield,
    label: "Trust",
    title: "GDPR tools included",
    body: "Export, erasure, audit trails, and signed webhooks when you need to answer security questionnaires.",
  },
  {
    icon: Sparkles,
    label: "Automate",
    title: "Agents and webhooks",
    body: "Invoke AI in rooms, retry webhook delivery, and fall back to SSE when WebSockets are blocked.",
  },
];

const COMPARE_ROWS: {
  label: string;
  stream: string;
  ably: string;
  pusher: string;
  fluxy: string;
}[] = [
  {
    label: "Edge-native (Cloudflare-style) deployment",
    stream: "Managed cloud",
    ably: "Managed cloud",
    pusher: "Managed cloud",
    fluxy: "Designed for Workers + DO + D1",
  },
  {
    label: "Operator dashboard (projects, keys, billing hooks)",
    stream: "Separate product area",
    ably: "Console + APIs",
    pusher: "Channels dashboard",
    fluxy: "First-party console in this repo",
  },
  {
    label: "SDK focus (drop-in hooks, minimal ceremony)",
    stream: "Strong SDKs",
    ably: "Strong SDKs",
    pusher: "Channels SDKs",
    fluxy: "Opinionated @fluxychat/sdk + examples",
  },
  {
    label: "Self-host / fork friendliness (MIT-style workflow)",
    stream: "Proprietary stack",
    ably: "Managed-first",
    pusher: "Managed-first",
    fluxy: "Monorepo you can run end-to-end",
  },
];

const LANDING_STATS = [
  {
    icon: Globe,
    value: "Edge-first",
    label: "Workers, Durable Objects, and D1 keep chat logic next to your data.",
  },
  {
    icon: Cpu,
    value: "Hooks + REST",
    label: "Build UI with @fluxychat/sdk. Manage keys and quotas in the dashboard.",
  },
  {
    icon: Layers,
    value: "Multi-tenant",
    label: "Many projects and rooms on one deployment, with per-project billing hooks.",
  },
] as const;


const USE_CASE_ROWS = [
  {
    title: "Marketplaces and community",
    body: "Buyer-seller threads, dispute rooms, and mod views your ops team can actually use.",
  },
  {
    title: "Support and ops",
    body: "Chat beside orders or tickets. Send webhooks to your helpdesk or AI pipeline.",
  },
  {
    title: "SaaS in-app messaging",
    body: "Install the SDK, mint JWTs, open a room, and keep your own UI components.",
  },
] as const;

const FAQ_ITEMS = [
  {
    q: "What is the chat API vs the SDK?",
    a: "Your backend calls the Worker over HTTP. The browser uses @fluxychat/sdk to subscribe, send, and render. Same product, two surfaces.",
  },
  {
    q: "How is this different from a fully managed vendor?",
    a: "You can run the Worker and D1 in your Cloudflare account. Data stays where you deploy it, and you control upgrades. Hosted cloud is there when you want to skip infra on day one.",
  },
  {
    q: "Can I add moderation and webhooks?",
    a: "Yes. Run middleware on the edge, sign webhooks for downstream systems, and use the console for admin tasks.",
  },
  {
    q: "Where should I start?",
    a: "Copy the install command, run the quickstart wizard for a JWT and first room, then use the console for projects, agents, and billing.",
  },
  {
    q: "Does a public dashboard mean public spend?",
    a: "No. Billable calls need your JWTs and API keys on the Worker. Enable DASHBOARD_ACCESS_MODE=ack (and optional CONSOLE_GATE_SECRET) so console routes require a one-time acknowledgment first.",
  },
] as const;

export function LandingView() {
  const [navDocked, setNavDocked] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    function onScroll() {
      const next = window.scrollY > 100;
      setNavDocked((prev) => (prev === next ? prev : next));
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const onCopy = useCallback(() => {
    void navigator.clipboard.writeText(INSTALL_CMD);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }, []);

  const planEntries = Object.entries(PUBLIC_PLAN_CATALOG);

  const navLinkClass = "text-slate-600 transition-colors hover:text-slate-900";
  const navLinkClassDock = "text-slate-600 transition-colors hover:text-slate-900 text-xs sm:text-sm";

  return (
    <div id="fc-marketing-root" className="flex min-h-screen flex-col bg-background text-foreground">
      <header
        className={cn(
          "fixed z-50 transition-[top,left,right,width,transform,border-radius,box-shadow,padding,border-width] duration-300 ease-out",
          navDocked
            ? "left-1/2 right-auto top-3 w-[min(100%-1.25rem,44rem)] -translate-x-1/2 rounded-full border border-black/[0.06] bg-white/85 py-2 pl-3 pr-2 shadow-[0_12px_40px_-8px_rgba(17,17,17,0.16)] backdrop-blur-xl sm:top-5 sm:pl-5 sm:pr-3"
            : "left-0 right-0 top-0 border-b border-black/[0.06] bg-white/90 py-0 backdrop-blur-md",
        )}
      >
        <div
          className={cn(
            "mx-auto flex max-w-6xl items-center justify-between gap-2 sm:gap-3",
            navDocked ? "px-1 sm:px-2" : "h-16 px-4 sm:px-6",
          )}
        >
          <Link
            href="/landing"
            className={cn("shrink-0 text-slate-900", navDocked ? "scale-[0.92] sm:scale-100" : "")}
            aria-label="Fluxychat"
          >
            <FluxychatLogotype size={navDocked ? 26 : 30} />
          </Link>
          <nav
            className={cn(
              "hidden items-center font-medium md:flex",
              navDocked ? "gap-3 lg:gap-4" : "gap-6 text-sm",
            )}
          >
            <Link href={HOSTED_PATHS.docs} className={navDocked ? navLinkClassDock : navLinkClass}>
              Docs
            </Link>
            <a href="#pricing" className={navDocked ? navLinkClassDock : navLinkClass}>
              Pricing
            </a>
            <a href="#compare" className={navDocked ? navLinkClassDock : navLinkClass}>
              Compare
            </a>
            <a href="#faq" className={navDocked ? navLinkClassDock : navLinkClass}>
              FAQ
            </a>
          </nav>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <LandingNavAuthCta navDocked={navDocked} />
          </div>
        </div>
      </header>

      <section className="relative min-h-[min(92svh,880px)] overflow-hidden border-b border-border pt-24 pb-16 sm:pb-24">
 
 {/* Grainient — base neutra; tinta lavanda (sx) e pesca (dx); centro chiaro */}
 <Grainient
   className="z-0"
   color1="#ebe4ff"
   color2="#faf8f5"
   color3="#fdeee6"
   grainAnimated
   grainAmount={0.13}
   grainScale={1.55}
   timeSpeed={0.1}
   warpSpeed={0.75}
   saturation={0.68}
   contrast={1.04}
   gamma={0.98}
   zoom={0.88}
   centerX={0}
   centerY={-0.06}
   blendAngle={18}
   blendSoftness={0.42}
 />

 {/* Wash laterali + accenti bassi sx/dx — centro libero per headline */}
 <div className="pointer-events-none absolute inset-0 z-[1] overflow-hidden" aria-hidden>
   <div
     className="landing-hero-blob landing-hero-blob--b absolute"
     style={{
       top: "8%",
       left: "-12%",
       width: "clamp(320px, 42vw, 560px)",
       height: "clamp(280px, 38vw, 480px)",
       borderRadius: "50%",
       background:
         "radial-gradient(circle at 55% 45%, rgba(196,181,253,0.42) 0%, rgba(226,221,253,0.22) 38%, transparent 72%)",
       filter: "blur(40px)",
     }}
   />
   <div
     className="landing-hero-blob landing-hero-blob--c absolute"
     style={{
       top: "12%",
       right: "-10%",
       width: "clamp(300px, 40vw, 520px)",
       height: "clamp(260px, 36vw, 440px)",
       borderRadius: "50%",
       background:
         "radial-gradient(circle at 45% 50%, rgba(255,200,175,0.38) 0%, rgba(255,228,210,0.18) 42%, transparent 70%)",
       filter: "blur(38px)",
     }}
   />
   <div
     className="landing-hero-blob landing-hero-blob--a absolute"
     style={{
       bottom: "-18%",
       left: "-16%",
       width: "clamp(400px, 50vw, 640px)",
       height: "clamp(340px, 46vw, 580px)",
       borderRadius: "50%",
       background: [
         "radial-gradient(",
         "  circle at 42% 40%,",
         "  rgba(215,55,8,0.72) 0%,",
         "  rgba(235,90,25,0.48) 24%,",
         "  rgba(248,140,70,0.22) 48%,",
         "  transparent 74%",
         ")",
       ].join(""),
       filter: "blur(42px)",
     }}
   />
   <div
     className="absolute"
     style={{
       bottom: "-14%",
       right: "-12%",
       width: "clamp(340px, 44vw, 560px)",
       height: "clamp(300px, 40vw, 500px)",
       borderRadius: "50%",
       background: [
         "radial-gradient(",
         "  circle at 58% 42%,",
         "  rgba(139,92,246,0.28) 0%,",
         "  rgba(255,149,128,0.16) 36%,",
         "  transparent 70%",
         ")",
       ].join(""),
       filter: "blur(44px)",
     }}
   />
 </div>

 {/*
   Overlay: quasi nessun bianco in basso-sinistra (così il blob emerge),
   ma abbastanza bianco al centro-top per leggibilità testo.
 */}
 <div
   className="pointer-events-none absolute inset-0 z-[1]"
   style={{
     background: [
       "radial-gradient(",
       "  ellipse 75% 55% at 50% 0%,",
       "  rgba(255,255,255,0.88) 0%,",
       "  rgba(255,255,255,0.40) 45%,",
       "  transparent 68%",
       ")",
     ].join(""),
   }}
   aria-hidden
 />
 {/* Fade bianco solo in alto per navbar */}
 <div
   className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-24"
   style={{ background: "linear-gradient(to bottom, rgba(255,255,255,0.7) 0%, transparent 100%)" }}
   aria-hidden
 />

 <div className="relative z-[2] mx-auto max-w-6xl px-4 sm:px-6">
   <div className="mx-auto flex max-w-4xl flex-col items-center text-center">

     {/* Pill */}
     <Link
       href={isClerkClientConfigured() ? HOSTED_PATHS.signUp : HOSTED_PATHS.getStarted}
       className="am-focus mb-5 inline-flex max-w-full items-center justify-center gap-2 rounded-full border border-black/[0.08] bg-white/80 px-3 py-1.5 text-xs font-medium text-slate-800 shadow-[var(--shadow-subtle-2)] backdrop-blur-md transition hover:border-black/12 hover:bg-white/95 sm:text-sm"
     >
       <span className="shrink-0 rounded-md bg-[#111111] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
         New
       </span>
       <span className="truncate text-left sm:text-center">
         Free hosted tier — SDK live in minutes →
       </span>
     </Link>

     <p className="mb-4 text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
       In-app chat for Cloudflare
     </p>

     {/* Headline */}
     <h1 className="font-heading flex flex-wrap items-baseline justify-center gap-x-[0.18em] gap-y-1 text-4xl font-bold leading-[1.05] tracking-[-0.035em] text-[#111111] sm:text-6xl md:text-7xl">
       <span>Ship in-app chat</span>
       <span className="am-text-gradient--hero am-text-gradient--hero-glow">today</span>
       <span className="text-[#111111]">.</span>
     </h1>

     <p className="mt-5 max-w-2xl text-balance text-lg text-slate-600 sm:text-xl">
       Sign up, add @fluxychat/sdk, and run rooms, agents, and webhooks on hosted cloud. No Worker deploy required to
       start.
     </p>
     <p className="mt-2 max-w-2xl text-balance text-sm text-slate-500 sm:text-base">
       Later, deploy the Worker in your own Cloudflare account from the monorepo.
     </p>

     {/* Install bar — copy nero + CTA brand */}
     <div className="mt-8 flex w-full max-w-2xl flex-col gap-3 sm:flex-row sm:items-stretch">
       <div
         className={cn(
           "flex min-h-[52px] flex-1 items-center gap-2 rounded-xl border px-4 py-2.5 font-mono text-sm sm:text-base",
           "border-[#111]/80 bg-[#111111] text-slate-100 shadow-md",
         )}
       >
         <span className="min-w-0 flex-1 truncate text-left">{INSTALL_CMD}</span>
         <button
           type="button"
           onClick={onCopy}
           className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-white/20 sm:text-sm"
         >
           {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
           {copied ? "Copied" : "Copy"}
         </button>
       </div>
       <LandingHeroAuthCta />
     </div>

     <p className="mt-4 max-w-xl text-xs text-slate-500 sm:text-sm">
       Works with npm and yarn too — same package name{" "}
       <code className="rounded border border-black/[0.06] bg-white/85 px-1.5 py-0.5 font-mono text-slate-700">
         @fluxychat/sdk
       </code>
       .
     </p>
   </div>

   {/* SpotlightCard */}
   <SpotlightCard
     className="mx-auto mt-12 max-w-5xl border-black/[0.14] bg-white p-5 shadow-[0_8px_40px_-8px_rgba(0,0,0,0.18),0_2px_8px_-2px_rgba(0,0,0,0.08)] sm:p-6 md:mt-14"
     spotlightColor="rgba(232, 69, 10, 0.2)"
   >
     <HeroCodeInboxDemo />
   </SpotlightCard>
 </div>
</section>
      

      {/* Logo strip — CSS marquee */}
      <section className="border-b border-border bg-white py-10">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="mb-2 text-center text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Works with stacks you already use
          </p>
          <p className="mb-8 text-center text-sm text-muted-foreground">
            One SDK across common frontends and runtimes. Fork the repo when you want full control.
          </p>
          <div className="landing-logo-marquee overflow-hidden py-2" aria-label="Frameworks and runtimes compatible with Fluxychat">
            <div className="landing-logo-marquee__track flex w-max gap-3 sm:gap-4">
              {[0, 1].map((copy) => (
                <div key={copy} className="flex shrink-0 gap-3 sm:gap-4">
                  {STACK_LOGOS.map((name) => (
                    <span
                      key={`${copy}-${name}`}
                      className="inline-flex max-w-[10rem] items-center truncate rounded-full border border-border bg-muted/50 px-4 py-2 text-sm font-semibold text-foreground sm:max-w-none"
                    >
                      {name}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-b border-border bg-white px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <p className="mx-auto mb-10 max-w-2xl text-center text-sm text-muted-foreground">
            Deploy in your account. Quotas live in D1. Console access can require a one-time ack — usage still runs
            through your Worker with your keys.
          </p>
          <div className="grid gap-10 md:grid-cols-3">
            {LANDING_STATS.map((s) => (
              <div key={s.value} className="text-center md:text-left">
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-muted/40">
                  <s.icon className="h-6 w-6 text-primary" aria-hidden />
                </div>
                <p className="font-heading text-2xl font-bold tracking-tight text-foreground">{s.value}</p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Messaging essentials */}
      <section className="border-b border-border" style={{ backgroundColor: "#0e0e0e" }}>
        <div className="mx-auto max-w-6xl px-4 pt-14 pb-5 sm:px-6 sm:pt-16">
          <h2 className="mb-2 text-center font-heading text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Messaging basics, on the edge
          </h2>
          <p className="mx-auto max-w-2xl text-center text-sm text-zinc-400 sm:text-base">
            Hover a row to preview it. Channels, presence, mentions, webhooks, and AI hooks without a separate
            realtime stack.
          </p>
        </div>
 
        {/* 7 items × 64px each = 448px */}
        <div style={{ height: "448px", position: "relative" }}>
          <FlowingMenu
            items={MESSAGING_FLOW_ITEMS}
            speed={18}
            textColor="#9ca3af"
            bgColor="#0e0e0e"
            marqueeBgColor="#e8450a"
            marqueeTextColor="#ffffff"
            borderColor="rgba(255,255,255,0.07)"
          />
        </div>
 
        <div className="mx-auto max-w-6xl px-4 pb-10 pt-4 sm:px-6">
          <p className="text-center text-xs text-zinc-600">
            Threads, polls, and translation are up to your product layer. Fluxychat ships the realtime core.
          </p>
        </div>
      </section>

      <ProductStoryReel />

      {/* Pillars — light gray */}
      <section className="border-b border-border px-4 py-16 sm:px-6" style={{ backgroundColor: "var(--am-whisper-gray)" }}>
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-2 text-center font-heading text-3xl font-bold tracking-tight">
            What ships in the box
          </h2>
          <p className="mx-auto mb-4 max-w-2xl text-center text-base text-muted-foreground">
            Edge delivery, clear quotas, and a console for the day-two work. You own the UI; we handle rooms, delivery,
            and ops hooks.
          </p>
          <p className="mx-auto mb-10 max-w-2xl text-center text-sm text-muted-foreground">
            Already set up?{" "}
            <Link href="/" className="font-medium text-foreground underline-offset-4 hover:underline">
              Open the console
            </Link>{" "}
            for rooms, agents, and billing.
          </p>
          <PillarsBento items={PILLARS} />
        </div>
      </section>

      {/* Middleware — light */}
      <section className="border-b border-border bg-white px-4 py-20 sm:px-6">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Middleware</p>
            <h2 className="font-heading text-3xl font-bold tracking-tight text-foreground">
              Transform messages before they land
            </h2>
            <p className="mt-4 text-muted-foreground">
              Moderate, validate, enrich, and fan out from the edge. Policy code stays on the data path, not in a
              sidecar you forget to deploy.
            </p>
          </div>
          <MiddlewarePipelineViz />
        </div>
      </section>

      {/* Developers + use cases */}
      <section className="border-b border-border bg-[var(--am-whisper-gray)] px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 rounded-2xl border border-border bg-card p-8 shadow-[var(--shadow-sm)] sm:p-10">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Developers</p>
            <h2 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
              SDK, docs, and console in one repo
            </h2>
            <p className="mt-3 max-w-3xl text-muted-foreground">
              Auth, rooms, and retries sit behind hooks and route handlers. When you need keys, quotas, or billing, open
              the operator UI instead of wiring another admin surface.
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
            <TeamsStartFlow />
            <div className="mt-1 grid w-full gap-6 md:grid-cols-3">
                {USE_CASE_ROWS.map((u) => (
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

      {/* Pricing — dark */}
      <section
        id="pricing"
        className="scroll-mt-20 border-b border-white/10 bg-slate-950 px-4 py-20 sm:px-6"
      >
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center font-heading text-3xl font-bold tracking-tight text-white">Pricing</h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-slate-400">
            Monthly limits for messages, agent invokes, and webhook deliveries. Each project stores enforcement in D1.
          </p>
          <p className="mx-auto mt-2 max-w-xl text-center text-xs text-slate-500">
            Console routes can require a one-time ack on your dashboard host. Billable usage still needs your Worker
            credentials.
          </p>
          <div className="mt-12 grid gap-8 lg:grid-cols-3">
            {planEntries.map(([key, plan]) => {
              const isFeatured = key === "starter";
              return (
                <div
                  key={key}
                  className={cn(
                    "relative flex flex-col rounded-2xl border p-8",
                    isFeatured
                      ? "border-primary bg-slate-900/80 shadow-[0_0_0_1px_rgba(255,115,94,0.35)]"
                      : "border-white/10 bg-slate-900/40",
                  )}
                >
                  {isFeatured ? (
                    <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground">
                      Most popular
                    </Badge>
                  ) : null}
                  <h3 className="font-heading text-xl font-semibold text-white">{plan.label}</h3>
                  <div className="mt-2 text-4xl font-bold text-white">{plan.price}</div>
                  <p className="mt-3 text-sm text-slate-400">{plan.tagline}</p>
                  <div className="mt-6 flex flex-1 flex-col">
                    <ul className="flex flex-col gap-3 text-sm text-slate-300">
                    <li className="flex gap-2">
                      <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                      {plan.messages === -1
                        ? "Unlimited messages (fair use)"
                        : `${formatNumber(plan.messages)} messages / month`}
                    </li>
                    <li className="flex gap-2">
                      <Bot className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                      {plan.agents === -1
                        ? "Unlimited agent invokes (fair use)"
                        : `${formatNumber(plan.agents)} agent invokes / month`}
                    </li>
                    <li className="flex gap-2">
                      <Webhook className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                      {plan.webhooks === -1
                        ? "Unlimited webhook deliveries (fair use)"
                        : `${formatNumber(plan.webhooks)} webhook deliveries / month`}
                    </li>
                  </ul>
                  <ul className="mt-4 space-y-3 border-t border-white/10 pt-4 text-sm text-slate-300">
                    {plan.bullets.map((b) => (
                      <li key={b} className="flex gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
                        {b}
                      </li>
                    ))}
                  </ul>
                  </div>
                  <Button
                    asChild
                    className={cn("mt-8 w-full", isFeatured ? "" : "bg-white/10 text-white hover:bg-white/20")}
                    variant={isFeatured ? "default" : "secondary"}
                  >
                    <Link
                      href={
                        isClerkClientConfigured()
                          ? HOSTED_PATHS.signUp
                          : HOSTED_PATHS.getStarted
                      }
                    >
                      {key === "free"
                        ? HOSTED_COPY.startFree
                        : isClerkClientConfigured()
                          ? key === "starter"
                            ? "Choose Starter"
                            : "Choose Pro"
                          : HOSTED_COPY.connectAccount}
                    </Link>
                  </Button>
                </div>
              );
            })}
          </div>
          <p className="mt-10 text-center text-xs text-slate-500">
            Need enterprise SSO, VPC-style isolation, or custom SLOs? Email{" "}
            <a className="text-slate-300 underline underline-offset-2" href="mailto:fluxychat@outlook.com">
              fluxychat@outlook.com
            </a>
            .
          </p>
        </div>
      </section>

      {/* Compare — light */}
      <section
        id="compare"
        className="scroll-mt-20 border-b border-border bg-white px-4 py-20 sm:px-6"
      >
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center font-heading text-3xl font-bold tracking-tight">Why Fluxychat</h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-muted-foreground">
            Rough positioning, not a shootout. Check each row against what you actually need.
          </p>
          <div className="mt-10 overflow-x-auto rounded-2xl border border-border shadow-sm">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm leading-relaxed">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-[1.125rem] font-semibold">Capability</th>
                  <th className="px-4 py-[1.125rem] font-medium text-muted-foreground">Typical stream APIs</th>
                  <th className="px-4 py-[1.125rem] font-medium text-muted-foreground">Typical Ably-style</th>
                  <th className="px-4 py-[1.125rem] font-medium text-muted-foreground">Typical Channels (Pusher-style)</th>
                  <th className="px-4 py-[1.125rem] font-semibold text-primary">Fluxychat</th>
                </tr>
              </thead>
              <tbody>
                {COMPARE_ROWS.map((row) => (
                  <tr key={row.label} className="border-b border-border last:border-0">
                    <td className="px-4 py-[1.125rem] font-medium">{row.label}</td>
                    <td className="px-4 py-[1.125rem] text-muted-foreground">{row.stream}</td>
                    <td className="px-4 py-[1.125rem] text-muted-foreground">{row.ably}</td>
                    <td className="px-4 py-[1.125rem] text-muted-foreground">{row.pusher}</td>
                    <td className="px-4 py-[1.125rem] font-medium text-foreground">{row.fluxy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-24 border-b border-border bg-white px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-2 text-center font-heading text-2xl font-bold tracking-tight">FAQs</h2>
          <p className="mb-8 text-center text-sm text-muted-foreground">
            Questions we hear when teams compare hosted chat APIs and edge deployments.
          </p>
          <div className="space-y-3">
            {FAQ_ITEMS.map((item) => (
              <details
                key={item.q}
                className="group rounded-xl border border-border bg-card px-4 py-3 shadow-sm open:shadow-md"
              >
                <summary className="cursor-pointer list-none font-medium text-foreground [&::-webkit-details-marker]:hidden">
                  <span className="flex items-center justify-between gap-3">
                    {item.q}
                    <span className="text-muted-foreground transition group-open:rotate-180">▾</span>
                  </span>
                </summary>
                <p className="mt-3 border-t border-border pt-3 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA — light gray */}
      <section className="border-b border-border px-4 py-16 sm:px-6" style={{ backgroundColor: "var(--am-whisper-gray)" }}>
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-6 text-center sm:flex-row sm:text-left">
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-border bg-card"
          >
            <BookOpen className="h-7 w-7 text-foreground" aria-hidden />
          </div>
          <div>
            <h2 className="font-heading text-xl font-semibold">Read the guides</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Auth, SDK setup, and self-host notes are on{" "}
              <Link href={HOSTED_PATHS.docs} className="font-medium text-primary underline-offset-2 hover:underline">
                /docs
              </Link>
              . After sign-up, the quickstart wizard walks you through JWT and your first room.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-3 sm:justify-start">
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
        </div>
      </section>

      <footer className="border-t border-border bg-[#111111] px-4 py-12 text-slate-400 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-white">
            <FluxychatIcon size={28} />
            <span className="font-heading text-sm font-semibold">Fluxychat</span>
          </div>
          <nav className="flex flex-wrap gap-6 text-sm">
            <ConsoleEntryLink className="hover:text-white">
              {HOSTED_COPY.console}
            </ConsoleEntryLink>
            <a href="#pricing" className="hover:text-white">
              Pricing
            </a>
            <a href="#faq" className="hover:text-white">
              FAQ
            </a>
            <a href="mailto:fluxychat@outlook.com" className="hover:text-white">
              fluxychat@outlook.com
            </a>
            <a href="https://github.com/AlessandroFare/fluxychat" target="_blank" rel="noreferrer" className="hover:text-white">
              GitHub
            </a>
          </nav>
          <p className="text-xs">© {new Date().getFullYear()} Fluxychat</p>
        </div>
      </footer>
    </div>
  );
}
