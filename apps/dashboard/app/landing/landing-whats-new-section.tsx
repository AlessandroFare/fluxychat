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
    title: "Multi-platform adapters",
    description:
      "Bridges for Slack, Discord, Telegram, WhatsApp, Teams. You create the vendor app. Same Worker table.",
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
      "Stream, game, IoT, spatial twins, cross-channel continuity, and marketplace apps, each with docs, demos, and readiness badges.",
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
    title: "FluxyStream: Live Broadcasting",
    description: "Create events, provision ingest, go live with HLS playback. Chat overlay and reactions on the same room.",
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
    title: "FluxyGame: Multiplayer SDK",
    description: "Matchmaking, server-authoritative state sync @20fps, AI NPCs with memory, tournaments, replay system, party system. Game room = chat room.",
    href: "/game",
  },
  {
    icon: Cpu,
    title: "FluxyIoT: HTTP ingest and device fleet",
    description: "Provision devices, ingest readings, device shadow (desired vs reported), rules, and health scores. GPS fleet is a sibling module. Devices fan out on the room WebSocket.",
    href: "/iot",
  },
  {
    icon: GraduationCap,
    title: "FluxyEdu: Live classroom",
    description: "Polls, breakouts, attendance, and stage go-live with server_event fan-out on the room WebSocket.",
    href: "/edu",
  },
] as const;

const CAPABILITY_GROUPS = [
  {
    id: "messages",
    label: "Messages & Adapters",
    icon: MessageSquare,
    items: AI_FEATURES.filter((item) =>
      [
        "Multi-platform adapters",
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
            room WebSocket. Voice AI, streaming AI, MCP tools, and durable agents sit on the same worker, with
            production readiness labels on every surface.
          </p>
        </div>

        <LandingCapabilityIndex groups={CAPABILITY_GROUPS} />

        <div className="mt-14">
          <div className="mb-2 text-center">
            <span className="inline-flex items-center rounded-full bg-[var(--mkt-brand)]/10 px-3 py-1 text-sm font-medium text-[var(--mkt-brand)] ring-1 ring-inset ring-[var(--mkt-brand)]/25">
              Platform Extensions
            </span>
            <h3 className="mt-3 font-heading text-2xl font-bold tracking-tight text-[var(--mkt-text)]">
              App Marketplace · Cross-Channel · Spatial · Web3
            </h3>
            <p className="mt-2 text-sm text-[var(--mkt-text-muted)]">
              Extend FluxyChat with apps, unify sessions across devices, build spatial experiences, and add Web3 auth.
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
