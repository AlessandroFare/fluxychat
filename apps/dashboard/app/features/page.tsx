"use client";

import Link from "next/link";
import { ConsoleShell } from "../components/console-shell";
import { ConsolePageHeader } from "../components/console-page-header";
import { Panel } from "~/components/ui/Panel";
import { Button } from "~/components/ui/button";

interface FeatureItem {
  title: string;
  description: string;
  href?: string;
  hrefLabel?: string;
}

interface FeatureGroup {
  title: string;
  intro: string;
  items: FeatureItem[];
}

const GROUPS: FeatureGroup[] = [
  {
    title: "AI & agents",
    intro: "In-room assistants, streaming AI, MCP tools, and durable agent execution.",
    items: [
      {
        title: "In-room AI agents",
        description: "Mention an agent and get streaming markdown replies on the same WebSocket stream as chat. Tool calling with HITL approval gates.",
        href: "/agents",
        hrefLabel: "Configure agents",
      },
      {
        title: "MCP client",
        description: "Consume any MCP-compatible tool server. Auto-convert tools to LLM function-calling format.",
      },
      {
        title: "LLM middleware pipeline",
        description: "Pluggable hooks: guardrails, caching, RAG injection, PII redaction, logging — wrapGenerate / wrapStream / transformParams.",
      },
      {
        title: "WorkflowAgent",
        description: "Durable agent execution that survives deploys and restarts. State persisted to D1, automatic resume from last step.",
      },
      {
        title: "Streaming markdown",
        description: "Table buffering, code fence tracking, and inline marker healing for clean partial renders during AI streaming.",
      },
      {
        title: "Stream resumption",
        description: "Reconnect to in-progress AI responses after page refresh or network drop — no lost tokens.",
      },
      {
        title: "Realtime voice",
        description: "Bidirectional voice-to-voice AI conversations with real-time tool calling and provider-agnostic abstraction.",
      },
      {
        title: "AI tool presets",
        description: "Reader, messenger, and moderator tool groups with per-tool approval gates for enterprise governance.",
        href: "/admin",
        hrefLabel: "Admin",
      },
      {
        title: "Room memory & knowledge graph",
        description: "Persistent room context and links between conversations (worker API).",
      },
      {
        title: "AI suggestions & digest",
        description: "Reply suggestions and daily summaries for active rooms.",
        href: "/activities",
        hrefLabel: "Automations",
      },
    ],
  },
  {
    title: "Multi-platform & messaging",
    intro: "14 platform adapters, card builder, and unified messaging across channels.",
    items: [
      {
        title: "14 platform adapters",
        description: "Slack, Discord, Telegram, WhatsApp, Teams, Email, SMS, Webhook, Matrix, and 5 more — one unified interface.",
        href: "/integrations",
        hrefLabel: "Integrations",
      },
      {
        title: "Card element builder",
        description: "Compose rich interactive messages with buttons, tables, and sections — JSX or function API, Slack Block Kit & Teams Adaptive Cards.",
      },
      {
        title: "Unified inbox",
        description: "Mentions, unread, snooze, and follow-ups in one view.",
        href: "/inbox",
        hrefLabel: "Open inbox",
      },
      {
        title: "Agent queue",
        description: "Claim rooms, SLA timers, and handoffs between humans and bots.",
        href: "/agent-queue",
        hrefLabel: "Agent queue",
      },
      {
        title: "SMS & WhatsApp",
        description: "Inbound/outbound via Sent.dm; external messages land in rooms.",
        href: "/integrations",
        hrefLabel: "Integrations",
      },
      {
        title: "Polls & forms",
        description: "In-room polls and forms with live results.",
        href: "/rooms",
        hrefLabel: "Use in a room",
      },
    ],
  },
  {
    title: "Enterprise & compliance",
    intro: "Governance, audit, and controls for regulated teams.",
    items: [
      {
        title: "SSO / SAML & SCIM",
        description: "Enterprise sign-in and user provisioning via API.",
        href: "/admin",
        hrefLabel: "Admin",
      },
      {
        title: "Data classification & retention",
        description: "Labels on rooms/messages, retention policies, and legal hold.",
        href: "/privacy",
        hrefLabel: "Privacy",
      },
      {
        title: "Audit & export",
        description: "Administrative trail and exports for internal reviews.",
        href: "/privacy",
        hrefLabel: "GDPR tools",
      },
      {
        title: "SOC2 / HIPAA checklist",
        description: "Controls, evidence, and compliance reports (admin API).",
      },
      {
        title: "IP whitelist & DLP",
        description: "Network restrictions and content scans to external DLP providers.",
      },
    ],
  },
  {
    title: "Live, events & community",
    intro: "Real-time engagement for events, communities, and streaming.",
    items: [
      {
        title: "Realtime feature showcase",
        description: "Live demos of in-app chat, high fan-out live streaming, and web push — real SDK calls against the demo room.",
        href: "/features/realtime",
        hrefLabel: "Open live demos",
      },
      {
        title: "Live dashboards & events",
        description: "Live metrics and event feeds for high-traffic rooms.",
        href: "/analytics",
        hrefLabel: "Analytics",
      },
      {
        title: "Incident response & on-call",
        description: "Incident management, alerts, and on-call rotations tied to rooms.",
      },
      {
        title: "Gamification & reputation",
        description: "XP, badges, and leaderboards for active communities.",
      },
      {
        title: "Hybrid events & streaming overlays",
        description: "Hybrid events and overlays for live streams.",
      },
    ],
  },
  {
    title: "Developer experience",
    intro: "CLI scaffolding, SDK, DevTools, and sandbox for building fast.",
    items: [
      {
        title: "create-fluxy-chat CLI",
        description: "Scaffold a new FluxyChat project with one command. Worker, SDK, and config wired up.",
      },
      {
        title: "DevTools web UI",
        description: "Visual inspector for LLM calls, tool executions, and token usage. OpenTelemetry with GenAI semantic conventions.",
      },
      {
        title: "Sandbox support",
        description: "Safely execute untrusted code in isolated environments with portable command execution.",
      },
      {
        title: "Embed widget",
        description: "One-line script for your site; configurable themes and flows.",
        href: "/embed",
        hrefLabel: "Embed",
      },
      {
        title: "Custom domain",
        description: "chat.yourcompany.com with managed TLS.",
        href: "/custom-domains",
        hrefLabel: "Domains",
      },
      {
        title: "Slack / Discord / Matrix bridges",
        description: "Sync external channels with FluxyChat rooms (admin config).",
        href: "/integrations",
        hrefLabel: "Integrations",
      },
      {
        title: "Conversation transcripts",
        description: "Per-user message persistence keyed by cross-platform identity. Append, list, filter, and delete with configurable retention.",
        href: "/transcripts",
        hrefLabel: "Transcripts",
      },
      {
        title: "Slash commands",
        description: "Built-in command parser with positional/named args, flags, quoted values, aliases, and auto-generated help.",
      },
      {
        title: "Regex message routing",
        description: "Pattern-based message handlers using regular expressions for keyword triggers without @-mentions.",
      },
      {
        title: "App & Agent Marketplace",
        description: "Publish, review, and install apps with signed manifests, scoped grants, and quota tracking.",
        href: "/marketplace",
        hrefLabel: "Try marketplace",
      },
      {
        title: "Chatbot Builder",
        description: "Visual trigger-action rule engine with 6 event types, 7 action types, conditions, and priority ordering.",
        href: "/chatbot-builder",
        hrefLabel: "Build a bot",
      },
      {
        title: "Cross-Channel Continuity",
        description: "Unified user sessions across web, mobile, voice, email, and SMS with identity binding and context sharing.",
        href: "/cross-channel",
        hrefLabel: "Try cross-channel",
      },
      {
        title: "A/B Testing",
        description: "Multi-variant bot response tests with weighted traffic split, exposure/conversion tracking, and p-value estimation.",
        href: "/cross-channel",
        hrefLabel: "A/B testing",
      },
      {
        title: "A2A Protocol",
        description: "Agent-to-agent communication using Google-standard envelope/task/artifact mapping with extension preservation.",
        href: "/cross-channel",
        hrefLabel: "A2A protocol",
      },
      {
        title: "Spatial & Digital Twin Rooms",
        description: "Shared 3D scene state with entity CRUD, agent vision/action grants, and spatial audio.",
        href: "/spatial",
        hrefLabel: "Spatial demo",
      },
      {
        title: "Web3 / Decentralized Chat",
        description: "Wallet-based auth, token-gated rooms, on-chain message commitments.",
        href: "/web3",
        hrefLabel: "Web3 demo",
      },
      {
        title: "Journey Mapping",
        description: "Track customer touchpoints across channels, visualize transition paths, detect drop-off points.",
      },
      {
        title: "Conversation Analytics",
        description: "Sentiment analysis, intent detection, topic clustering, and knowledge gap identification.",
      },
      {
        title: "Expert Routing",
        description: "Skill-based agent routing with SLA policies, priority scoring, and per-agent load balancing.",
      },
      {
        title: "Virtual Waiting Room",
        description: "Queue management with priority ordering, estimated wait times, and abandonment tracking.",
      },
      {
        title: "CRM & Knowledge Base",
        description: "Salesforce/Zendesk/HubSpot/Intercom integrations, Confluence/Notion/SharePoint connectors with RAG.",
        href: "/integrations",
        hrefLabel: "Integrations",
      },
      {
        title: "Real-time Translation",
        description: "Per-user language preference, auto-detect, glossary terms, and live translate.",
      },
      {
        title: "Automation Engine",
        description: "IF-THEN trigger-action rules with 9 event types, 7 action types, cooldown, and execution history.",
      },
      {
        title: "AST markdown system",
        description: "Complete mdast builder (text, strong, link, code, etc.) with parseMarkdown/stringifyMarkdown via unified/remark with GFM support.",
      },
      {
        title: "Concurrency strategies",
        description: "Five strategies (concurrent, drop, queue, debounce, burst) for controlling message processing with TTL and overflow policies.",
      },
      {
        title: "Thread state",
        description: "Per-thread typed state with merge/replace, TTL-based expiry, and generic TypedThreadState accessor.",
      },
      {
        title: "Ephemeral messages",
        description: "Post ephemeral messages visible only to specific users with automatic DM fallback when native ephemeral is unsupported.",
      },
    ],
  },
];

export default function FeaturesPage() {
  return (
    <ConsoleShell>
      <ConsolePageHeader
        title="Features"
        description="What you can do with FluxyChat today. Each card links to the console page where you can try it."
      />
      <div className="mt-6 space-y-8">
        {GROUPS.map((group) => (
          <section key={group.title}>
            <h2 className="text-lg font-semibold text-foreground">{group.title}</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{group.intro}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {group.items.map((item) => (
                <Panel key={item.title} className="flex h-full flex-col">
                  <h3 className="text-sm font-medium text-foreground">{item.title}</h3>
                  <p className="mt-2 flex-1 text-sm text-muted-foreground">{item.description}</p>
                  {item.href ? (
                    <Button variant="ghost" size="sm" className="mt-3 w-fit px-0" asChild>
                      <Link href={item.href}>{item.hrefLabel ?? "Open"}</Link>
                    </Button>
                  ) : null}
                </Panel>
              ))}
            </div>
          </section>
        ))}
      </div>
    </ConsoleShell>
  );
}
