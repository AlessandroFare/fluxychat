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
