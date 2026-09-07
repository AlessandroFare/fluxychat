"use client";

import { LandingCapabilityIndex } from "./landing-capability-index";
import { LandingPlatformIndex } from "./landing-platform-index";
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
  GraduationCap,
  Key,
  LayoutTemplate,
  MessageSquare,
  Sparkles,
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
    title: "Bridges",
    description:
      "Slack, Discord, Telegram, WhatsApp, Teams. You create the vendor app. Bindings live in one Worker table.",
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
      "Compose rich interactive messages with buttons, tables, and sections: JSX or function API, Slack Block Kit and Teams Adaptive Cards.",
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
      "Reconnect to in-progress AI responses after page refresh or network drop. No lost tokens.",
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
      "Pluggable pipeline: guardrails, caching, RAG injection, PII redaction, logging. wrapGenerate, wrapStream, transformParams.",
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
      "joinVoiceStage signaling on the room WebSocket. Media is LiveKit. STT/TTS is Workers AI when you enable it. Not an SFU.",
  },
  {
    icon: MessageSquare,
    title: "Conversation transcripts",
    description:
      "Per-user message persistence keyed by cross-platform identity. Append, list, filter by platform/thread/role, and delete, with configurable retention and capping.",
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
    title: "Platform modules",
    description:
      "Stream, game, IoT, spatial twins, cross-channel continuity, and marketplace apps — production modules on the same Worker.",
  },
] as const;

const PLATFORM_EXTENSIONS = [
  {
    icon: Store,
    title: "App Marketplace",
    description: "Publish and install apps with signed manifests, scoped grants, and tenant installs.",
    href: "/marketplace",
    readiness: "production" as const,
  },
  {
    icon: Globe,
    title: "Cross-Channel Continuity",
    description: "One identity across web, mobile, voice, and bot — handoff without dropping the room.",
    href: "/cross-channel",
    readiness: "production" as const,
  },
  {
    icon: Boxes,
    title: "Spatial & Digital Twins",
    description: "3D room scenes, entities, agent grants, and spatial presence on the same kernel.",
    href: "/spatial",
    readiness: "production" as const,
  },
  {
    icon: Key,
    title: "Web3 Chat",
    description: "Wallet authentication, token-gated rooms, and on-chain message commitments.",
    href: "/web3",
    readiness: "production" as const,
  },
  {
    icon: Puzzle,
    title: "Agent Marketplace",
    description: "Install pre-built agent skills with versioning and config schemas.",
    href: "/marketplace",
    readiness: "production" as const,
  },
  {
    icon: Bot,
    title: "Chatbot Builder",
    description: "Visual trigger-action rules with conditions, priorities, and simulated events.",
    href: "/chatbot-builder",
    readiness: "production" as const,
  },
  {
    icon: Radio,
    title: "FluxyStream: Live Broadcasting",
    description: "Events, ingest, HLS playback, and chat overlay on the room WebSocket.",
    href: "/stream/demo",
    readiness: "production" as const,
  },
  {
    icon: Zap,
    title: "WebTransport Readiness",
    description: "WebTransport → WebSocket → SSE → long-poll, negotiated in the SDK.",
    href: "/transport",
    readiness: "production" as const,
  },
  {
    icon: Bot,
    title: "AI Agent Platform",
    description: "No-code builder, versioning, sandbox, CI/CD, and invokeAgent on the timeline.",
    href: "/agents/platform",
    readiness: "production" as const,
  },
  {
    icon: Gamepad2,
    title: "FluxyGame: Multiplayer SDK",
    description: "Matchmaking, server-authoritative ticks, AI NPCs, tournaments, and party rooms.",
    href: "/game",
    readiness: "production" as const,
  },
  {
    icon: Cpu,
    title: "FluxyIoT: HTTP ingest and device fleet",
    description: "Provision devices, ingest readings, shadow, rules, and GPS fleet on the room stream.",
    href: "/iot",
    readiness: "production" as const,
  },
  {
    icon: GraduationCap,
    title: "FluxyEdu: Live classroom",
    description: "Polls, breakouts, attendance, and stage go-live on the room WebSocket.",
    href: "/edu",
    readiness: "production" as const,
  },
] as const;

const CAPABILITY_GROUPS = [
  {
    id: "messages",
    label: "Messages & Adapters",
    icon: MessageSquare,
    items: AI_FEATURES.filter((item) =>
      [
        "Bridges",
        "Card element builder",
        "Conversation transcripts",
        "Slash commands & regex routing",
        "Ephemeral & chainable messages",
      ].includes(item.title),
    ),
  },
  {
    id: "ai",
    label: "AI, Voice & Streams",
    icon: Sparkles,
    items: AI_FEATURES.filter((item) =>
      [
        "Streaming markdown",
        "AI tool presets",
        "Stream resumption",
        "MCP client",
        "LLM middleware",
        "Realtime voice",
      ].includes(item.title),
    ),
  },
  {
    id: "runtime",
    label: "Runtime & Modules",
    icon: Cpu,
    items: AI_FEATURES.filter((item) =>
      ["DevTools web UI", "WorkflowAgent", "Sandbox support", "Platform modules"].includes(item.title),
    ),
  },
] as const;

const FEATURED_EXTENSIONS = PLATFORM_EXTENSIONS.slice(0, 4);
const MORE_EXTENSIONS = PLATFORM_EXTENSIONS.slice(4);

export function LandingWhatsNewSection() {
  return (
    <section
      id="whats-new"
      className="scroll-mt-20 border-b border-[var(--mkt-border)] px-4 py-20 sm:px-6"
    >
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <span className="inline-flex items-center rounded-full bg-[var(--mkt-brand)]/10 px-3 py-1 text-sm font-medium text-[var(--mkt-brand)] ring-1 ring-inset ring-[var(--mkt-brand)]/25">
            Production ready
          </span>
          <h2 className="mt-4 font-heading text-3xl font-bold tracking-tight text-[var(--mkt-text)] sm:text-4xl">
            Live verticals, voice, and the server event bus
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-[var(--mkt-text-muted)]">
            Polls, breakouts, stage go-live, collab CRDT, fleet GPS, and hybrid check-in fan out as{" "}
            <code className="rounded bg-[var(--mkt-surface-2)] px-1 py-0.5 font-mono text-sm text-[var(--mkt-brand)]">server_event</code> frames on the
            room WebSocket. Voice AI, streaming AI, MCP tools, and durable agents sit on the same worker.
          </p>
        </div>

        <LandingCapabilityIndex groups={CAPABILITY_GROUPS} />

        <div className="mt-14">
          <div className="mb-2 text-center">
            <span className="inline-flex items-center rounded-full bg-[var(--mkt-brand)]/10 px-3 py-1 text-sm font-medium text-[var(--mkt-brand)] ring-1 ring-inset ring-[var(--mkt-brand)]/25">
              Platform extensions
            </span>
            <h3 className="mt-3 font-heading text-2xl font-bold tracking-tight text-[var(--mkt-text)]">
              Modules on the same Worker
            </h3>
            <p className="mt-2 text-sm text-[var(--mkt-text-muted)]">
              Marketplace, Web3, FluxyEdu, stream, game, IoT, and the chatbot builder are in the console sidebar.
            </p>
          </div>
          <LandingPlatformIndex featured={FEATURED_EXTENSIONS} more={MORE_EXTENSIONS} />
        </div>

        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <a
            href="/devtools"
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--mkt-brand)]/10 px-4 py-2 text-sm font-medium text-[var(--mkt-brand)] ring-1 ring-inset ring-[var(--mkt-brand)]/20 transition-colors hover:bg-[var(--mkt-brand)]/15"
          >
            <Terminal className="h-4 w-4" />
            Try DevTools Playground
          </a>
          <a
            href="/playground"
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--mkt-brand)]/10 px-4 py-2 text-sm font-medium text-[var(--mkt-brand)] ring-1 ring-inset ring-[var(--mkt-brand)]/20 transition-colors hover:bg-[var(--mkt-brand)]/15"
          >
            <LayoutTemplate className="h-4 w-4" />
            Try Card Builder
          </a>
          <a
            href="/middleware"
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--mkt-brand)]/10 px-4 py-2 text-sm font-medium text-[var(--mkt-brand)] ring-1 ring-inset ring-[var(--mkt-brand)]/20 transition-colors hover:bg-[var(--mkt-brand)]/15"
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
            className="text-sm font-medium text-[var(--mkt-brand)] hover:opacity-80"
          >
            Read the guides →
          </a>
        </div>
      </div>
    </section>
  );
}
