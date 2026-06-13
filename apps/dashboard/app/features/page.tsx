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
    title: "AI & memory",
    intro: "In-room assistants, persistent context, and AI-driven automations.",
    items: [
      {
        title: "In-room agents",
        description: "Mention an agent and get replies on the same WebSocket stream as chat.",
        href: "/agents",
        hrefLabel: "Configure agents",
      },
      {
        title: "Voice messages & transcription",
        description: "Record audio in chat; the worker stores it on R2 and updates transcription asynchronously.",
        href: "/rooms",
        hrefLabel: "Try in a room",
      },
      {
        title: "AI suggestions & digest",
        description: "Reply suggestions and daily summaries for active rooms.",
        href: "/activities",
        hrefLabel: "Automations",
      },
      {
        title: "Room memory & knowledge graph",
        description: "Persistent room context and links between conversations (worker API).",
      },
      {
        title: "AI actions & moderation",
        description: "Automatic message actions and an assisted moderation queue.",
        href: "/admin",
        hrefLabel: "Admin",
      },
    ],
  },
  {
    title: "Omnichannel & inbox",
    intro: "Unify in-app chat, SMS, WhatsApp, and operator queues.",
    items: [
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
    title: "Integrations & distribution",
    intro: "Put chat where you need it: website, custom domain, external bridges.",
    items: [
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
        title: "MCP & workflow automation",
        description: "MCP server and scheduled automations on the worker.",
        href: "/activities",
        hrefLabel: "Activities",
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
