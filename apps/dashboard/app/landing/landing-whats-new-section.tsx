import { Card, CardContent } from "~/components/ui/card";
import {
  ArrowRight,
  Boxes,
  Bot,
  Cpu,
  CreditCard,
  FileCode2,
  Gamepad2,
  GitBranch,
  Globe,
  Key,
  LayoutTemplate,
  MessageSquare,
  Mic,
  Network,
  Puzzle,
  Radio,
  ScrollText,
  Settings2,
  Shield,
  Slash,
  Store,
  Terminal,
  Workflow,
  Zap,
} from "lucide-react";

const AI_FEATURES = [
  {
    icon: Network,
    title: "Multi-platform adapters",
    description:
      "14 platform adapters (Slack, Teams, Discord, Telegram, WhatsApp, and more) behind a unified interface.",
  },
  {
    icon: ScrollText,
    title: "Streaming markdown",
    description:
      "Table buffering, code fence tracking, and inline marker healing for clean partial renders during AI streaming.",
  },
  {
    icon: CreditCard,
    title: "Card element builder",
    description:
      "Compose rich interactive messages with buttons, tables, and sections — JSX or function API, Slack Block Kit & Teams Adaptive Cards.",
  },
  {
    icon: Bot,
    title: "AI tool presets",
    description:
      "Reader, messenger, and moderator tool groups with per-tool approval gates for enterprise governance.",
  },
  {
    icon: GitBranch,
    title: "Stream resumption",
    description:
      "Reconnect to in-progress AI responses after page refresh or network drop — no lost tokens.",
  },
  {
    icon: Boxes,
    title: "MCP client",
    description:
      "Consume any MCP-compatible tool server. Auto-convert tools to LLM function-calling format.",
  },
  {
    icon: Settings2,
    title: "LLM middleware",
    description:
      "Pluggable pipeline: guardrails, caching, RAG injection, PII redaction, logging — wrapGenerate / wrapStream / transformParams.",
  },
  {
    icon: FileCode2,
    title: "DevTools web UI",
    description:
      "Visual inspector for LLM calls, tool executions, and token usage. OpenTelemetry with GenAI semantic conventions.",
  },
  {
    icon: Workflow,
    title: "WorkflowAgent",
    description:
      "Durable agent execution that survives deploys and restarts. State persisted to D1, automatic resume from last step.",
  },
  {
    icon: Shield,
    title: "Sandbox support",
    description:
      "Safely execute untrusted code in isolated environments with portable command execution.",
  },
  {
    icon: Mic,
    title: "Realtime voice",
    description:
      "Bidirectional voice-to-voice AI conversations with real-time tool calling and provider-agnostic abstraction.",
  },
  {
    icon: MessageSquare,
    title: "Conversation transcripts",
    description:
      "Per-user message persistence keyed by cross-platform identity. Append, list, filter by platform/thread/role, and delete — with configurable retention and capping.",
  },
  {
    icon: Slash,
    title: "Slash commands & regex routing",
    description:
      "Built-in slash command parser with positional/named args, aliases, and help. Regex-based message pattern matching for keyword triggers without @-mentions.",
  },
  {
    icon: Zap,
    title: "Ephemeral & chainable messages",
    description:
      "Post ephemeral messages with DM fallback. Chainable SentMessage with .edit(), .delete(), .addReaction(), .removeReaction().",
  },
  {
    icon: Radio,
    title: "And more",
    description:
      "Tool call streaming, multi-step loop control, structured output, AST markdown system, concurrency strategies, thread state, smoothStream, and 15+ additional features.",
  },
] as const;

const PLATFORM_EXTENSIONS = [
  {
    icon: Store,
    title: "App Marketplace",
    description: "Publish and install apps with OAuth scoped grants. App review, versioning, and tenant installation.",
    href: "/marketplace",
  },
  {
    icon: Globe,
    title: "Cross-Channel Continuity",
    description: "Unify user sessions across web, mobile, voice, and bot. Identity linking, channel switching, device replay.",
    href: "/cross-channel",
  },
  {
    icon: Boxes,
    title: "Spatial & Digital Twins",
    description: "Create 3D room scenes with entities, agent access grants, AR overlays, and spatial audio presences.",
    href: "/spatial",
  },
  {
    icon: Key,
    title: "Web3 Chat",
    description: "Wallet-based authentication, token-gated rooms, on-chain message commitments with hash verification.",
    href: "/web3",
  },
  {
    icon: Puzzle,
    title: "Agent Marketplace",
    description: "Browse and install pre-built agent skills by category. Community templates with versioning and config schemas.",
    href: "/marketplace",
  },
  {
    icon: Bot,
    title: "Chatbot Builder",
    description: "Visual trigger-action rule engine with conditions, priorities, and simulated event testing.",
    href: "/chatbot-builder",
  },
  {
    icon: Radio,
    title: "FluxyStream — Live Broadcasting",
    description: "Live video broadcast with AI moderation, multi-camera switching, virtual gifts, live commerce, sentiment dashboard, and AI co-host.",
    href: "/stream/demo",
  },
  {
    icon: Zap,
    title: "WebTransport Readiness",
    description: "Auto-negotiation WebTransport → WebSocket → SSE → Long Poll. Feature detection with automatic fallback chain.",
    href: "/transport",
  },
  {
    icon: Bot,
    title: "AI Agent Platform",
    description: "No-code agent builder, versioning, CI/CD deploy, sandbox testing, cost tracking, rate limiting, A/B testing, personality designer, emotional intelligence, cross-platform memory.",
    href: "/agents/platform",
  },
  {
    icon: Gamepad2,
    title: "FluxyGame — Multiplayer SDK",
    description: "Matchmaking, server-authoritative state sync @20fps, AI NPCs with memory, tournaments, replay system, party system. Game room = chat room.",
    href: "/game",
  },
  {
    icon: Cpu,
    title: "FluxyIoT — MQTT Bridge & Device Fleet",
    description: "Device provisioning, rule engine, device shadow (desired vs reported), OTA updates, geofencing, AI device doctor, device-as-room-member.",
    href: "/iot",
  },
] as const;

export function LandingWhatsNewSection() {
  return (
    <section
      id="whats-new"
      className="scroll-mt-20 border-b border-white/10 bg-gradient-to-b from-slate-950 to-slate-900 px-4 py-20 sm:px-6"
    >
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <span className="inline-flex items-center rounded-full bg-blue-500/10 px-3 py-1 text-sm font-medium text-blue-400 ring-1 ring-inset ring-blue-500/20">
            P22–P27 · New
          </span>
          <h2 className="mt-4 font-heading text-3xl font-bold tracking-tight text-white sm:text-4xl">
            AI-native architecture overhaul
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-slate-300">
            AI-native architecture inspired by the Vercel Chat SDK and AI SDK.
            Cleaner abstractions, richer streaming, MCP tool calling, LLM middleware,
            and durable agent execution — without losing the real-time, multi-tenant,
            enterprise depth FluxyChat is known for.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {AI_FEATURES.map(({ icon: Icon, title, description }) => (
            <Card
              key={title}
              className="border-white/10 bg-white/5 transition-colors hover:border-white/20 hover:bg-white/[0.07]"
            >
              <CardContent className="flex flex-col gap-3 p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 ring-1 ring-inset ring-blue-500/20">
                  <Icon className="h-5 w-5 text-blue-400" />
                </div>
                <h3 className="font-semibold text-white">{title}</h3>
                <p className="text-sm leading-relaxed text-slate-400">
                  {description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Platform Extensions */}
        <div className="mt-14">
          <div className="text-center mb-8">
            <span className="inline-flex items-center rounded-full bg-purple-500/10 px-3 py-1 text-sm font-medium text-purple-400 ring-1 ring-inset ring-purple-500/20">
              Platform Extensions
            </span>
            <h3 className="mt-3 font-heading text-2xl font-bold tracking-tight text-white">
              App Marketplace · Cross-Channel · Spatial · Web3
            </h3>
            <p className="mt-2 text-sm text-slate-400">
              Extend FluxyChat with apps, unify sessions across devices, build spatial experiences, and add Web3 auth.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PLATFORM_EXTENSIONS.map(({ icon: Icon, title, description, href }) => (
              <a key={title} href={href}
                className="group flex flex-col gap-3 rounded-xl border border-purple-500/15 bg-purple-500/5 p-5 transition-all hover:border-purple-500/30 hover:bg-purple-500/[0.08] hover:-translate-y-0.5"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10 ring-1 ring-inset ring-purple-500/20">
                  <Icon className="h-5 w-5 text-purple-400" />
                </div>
                <div>
                  <h4 className="font-semibold text-white group-hover:text-purple-300 transition-colors">{title}</h4>
                  <p className="mt-1 text-sm leading-relaxed text-slate-400">{description}</p>
                </div>
                <span className="mt-auto inline-flex items-center gap-1 text-xs font-medium text-purple-400 group-hover:text-purple-300">
                  Try it <ArrowRight className="h-3 w-3" />
                </span>
              </a>
            ))}
          </div>
        </div>

        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <a
            href="/devtools"
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-400 ring-1 ring-inset ring-blue-500/20 transition-colors hover:bg-blue-500/20"
          >
            <Terminal className="h-4 w-4" />
            Try DevTools Playground
          </a>
          <a
            href="/playground"
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-400 ring-1 ring-inset ring-blue-500/20 transition-colors hover:bg-blue-500/20"
          >
            <LayoutTemplate className="h-4 w-4" />
            Try Card Builder
          </a>
          <a
            href="/middleware"
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-400 ring-1 ring-inset ring-blue-500/20 transition-colors hover:bg-blue-500/20"
          >
            <Settings2 className="h-4 w-4" />
            Try Middleware Configurator
          </a>
        </div>

        <div className="mt-8 text-center">
          <a
            href="https://github.com/AlessandroFare/fluxychat/blob/main/docs/guides"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-blue-400 hover:text-blue-300"
          >
            Read the guides →
          </a>
        </div>
      </div>
    </section>
  );
}
