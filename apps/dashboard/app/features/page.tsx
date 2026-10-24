import Link from "next/link";
import { HOSTED_PATHS } from "@/lib/hosted-product";
import { MarketingShell } from "../components/marketing-shell";
import { SimulatedPreviewBanner } from "../components/simulated-preview-banner";
import styles from "../landing/landing-c.module.css";

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
        href: "/settings/mcp",
        hrefLabel: "MCP settings",
      },
      {
        title: "LLM middleware pipeline",
        description: "Pluggable hooks: guardrails, caching, RAG injection, PII redaction, logging via wrapGenerate, wrapStream, and transformParams.",
        href: "/middleware",
        hrefLabel: "Middleware",
      },
      {
        title: "WorkflowAgent",
        description: "Durable agent execution that survives deploys and restarts. State persisted to D1, automatic resume from last step.",
        href: "/agents/platform",
        hrefLabel: "Agent platform",
      },
      {
        title: "Streaming markdown",
        description: "Table buffering, code fence tracking, and inline marker healing for clean partial renders during AI streaming.",
      },
      {
        title: "Reconnect and history",
        description: "The room socket reconnects and REST history merges. Refresh-during-stream is not a published E2E guarantee.",
      },
      {
        title: "Realtime voice",
        description: "joinVoiceStage signaling and async voice clips. Bidirectional media is LiveKit, not FluxyChat.",
        href: "/voice-ai",
        hrefLabel: "Voice AI",
      },
      {
        title: "AI tool presets",
        description: "Reader, messenger, and moderator tool groups with per-tool approval gates for enterprise governance.",
        href: "/settings/agent-tools",
        hrefLabel: "Tool policy",
      },
      {
        title: "Room memory & knowledge graph",
        description: "Persistent room context and links between conversations (worker API).",
        href: "/knowledge",
        hrefLabel: "Knowledge base",
      },
      {
        title: "AI suggestions & digest",
        description: "Reply suggestions in chat; daily digest endpoints on the Worker.",
        href: "/rooms",
        hrefLabel: "In-room suggestions",
      },
    ],
  },
  {
    title: "Multi-platform & messaging",
    intro: "Bridges: you create the vendor app. Same channel_configs table.",
    items: [
      {
        title: "Channel bridges",
        description: "Slack, Discord, Telegram, WhatsApp, Teams: OAuth and signing secrets in the console. Not a finished omnichannel helpdesk.",
        href: "/bridges",
        hrefLabel: "Bridges",
      },
      {
        title: "Card element builder",
        description: "Compose rich interactive messages with buttons, tables, and sections. JSX or function API, Slack Block Kit and Teams Adaptive Cards.",
        href: "/playground",
        hrefLabel: "Card builder",
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
        href: "/settings/telephony",
        hrefLabel: "Telephony",
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
        description: "SAML and SCIM settings for self-hosted projects. Hosted SAML stays off.",
        href: "/settings/identity",
        hrefLabel: "Identity settings",
      },
      {
        title: "Data classification & retention",
        description: "Retention policies, legal hold, classification labels, and room labels in the console; message-level overrides via the Worker API.",
        href: "/settings/retention",
        hrefLabel: "Retention & classification",
      },
      {
        title: "Audit & export",
        description: "Administrative trail and exports for internal reviews.",
        href: "/privacy",
        hrefLabel: "GDPR tools",
      },
      {
        title: "SOC2 / HIPAA checklist",
        description: "Operator checklists and BAA tracking. Not an attestation. Health demos are not HIPAA.",
        href: "/soc2",
        hrefLabel: "SOC 2",
      },
      {
        title: "IP whitelist & DLP",
        description: "Network restrictions and content scans to external DLP providers.",
        href: "/settings/dlp",
        hrefLabel: "DLP settings",
      },
    ],
  },
  {
    title: "Live, events & community",
    intro: "Real-time engagement for events, communities, and streaming.",
    items: [
      {
        title: "Realtime feature showcase",
        description: "Live demos of in-app chat, high fan-out live streaming, and web push with real SDK calls against the demo room.",
        href: "/features/realtime",
        hrefLabel: "Open live demos",
      },
      {
        title: "Live dashboards & events",
        description: "Live metrics and event feeds for high-traffic rooms (Worker API).",
      },
      {
        title: "Incident response & on-call",
        description: "Incident created/acknowledged/resolved phases can start published Ops workflows in the linked room. Paging stays in your on-call tool.",
        href: "/ops/settings",
        hrefLabel: "Incident workflows",
      },
      {
        title: "Gamification & reputation",
        description: "D1 leaderboards in FluxyGame; XP, badges, and community reputation endpoints on the Worker.",
        href: "/game",
        hrefLabel: "Leaderboards",
      },
      {
        title: "Live stream overlays",
        description: "Chat overlays on live streams. WHIP/HLS ingest needs Cloudflare Stream secrets.",
        href: "/stream",
        hrefLabel: "FluxyStream",
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
        href: "/cli",
        hrefLabel: "CLI",
      },
      {
        title: "DevTools web UI",
        description: "Visual inspector for LLM calls, tool executions, and token usage. OpenTelemetry with GenAI semantic conventions.",
        href: "/devtools",
        hrefLabel: "DevTools",
      },
      {
        title: "Sandbox support",
        description: "Safely execute untrusted code in isolated environments with portable command execution.",
        href: "/agents/platform",
        hrefLabel: "Agent sandbox",
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
        href: "/bridges",
        hrefLabel: "Bridges",
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
        href: "/settings/commands",
        hrefLabel: "Slash commands",
      },
      {
        title: "Regex message routing",
        description: "Pattern-based message handlers using regular expressions for keyword triggers without @-mentions.",
      },
      {
        title: "App & Agent Marketplace",
        description: "Private app and template catalog with signed manifests, scoped grants, and quota tracking. Not a public app store.",
        href: "/marketplace",
        hrefLabel: "Open marketplace",
      },
      {
        title: "Chatbot Builder",
        description: "Visual trigger-action rule engine with event types, actions, conditions, and priority ordering.",
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
        href: "/agents/a2a",
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
        href: "/analytics",
        hrefLabel: "Open demo",
      },
      {
        title: "Conversation Analytics",
        description: "Sentiment analysis, intent detection, topic clustering, and knowledge gap identification.",
        href: "/analytics",
        hrefLabel: "Open demo",
      },
      {
        title: "Expert Routing",
        description: "Skill-based agent routing with SLA policies, priority scoring, and per-agent load balancing.",
        href: "/agent-queue",
        hrefLabel: "SDK module",
      },
      {
        title: "Virtual Waiting Room",
        description: "Queue management with priority ordering, estimated wait times, and abandonment tracking.",
        href: "/agent-queue",
        hrefLabel: "SDK module",
      },
      {
        title: "CRM & Knowledge Base",
        description: "Salesforce/Zendesk/HubSpot/Intercom sync and Confluence/Notion/SharePoint connectors. Catalog and dry-run writes until a design partner.",
        href: "/integrations",
        hrefLabel: "Integrations",
      },
      {
        title: "Real-time Translation",
        description: "Per-user viewer language, per-room auto-translate target, and cached LLM translations. Source language is model-inferred; no glossary editor yet.",
        href: "/settings/translation",
        hrefLabel: "Translation",
      },
      {
        title: "Automation Engine",
        description: "IF-THEN trigger-action rules with 9 event types, 7 action types, cooldown, and execution history.",
        href: "/automations",
        hrefLabel: "Automations",
      },
      {
        title: "Processes",
        description: "Describe any workplace flow in chat. A generic engine runs it; people approve writes. Not on the public homepage until a partner uses it.",
        href: "/ops",
        hrefLabel: "Processes",
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
        href: "/settings/ephemeral",
        hrefLabel: "Ephemeral settings",
      },
    ],
  },
];

type FeatureStatus = "production" | "beta" | "preview" | "labs" | "demo" | "checklist" | "api";

/**
 * Readiness follows `PLATFORM_READINESS` for product modules and the QA
 * campaign for the rest. Production = Worker persist + auth + tenancy + tests,
 * not a hosted SLA. Keep this map in sync with the cards above.
 */
const FEATURE_STATUS: Record<string, FeatureStatus> = {
  "In-room AI agents": "production",
  "MCP client": "beta",
  "LLM middleware pipeline": "production",
  WorkflowAgent: "preview",
  "Streaming markdown": "production",
  "Reconnect and history": "production",
  "Realtime voice": "production",
  "AI tool presets": "production",
  "Room memory & knowledge graph": "production",
  "AI suggestions & digest": "production",
  "Channel bridges": "beta",
  "Card element builder": "production",
  "Unified inbox": "production",
  "Agent queue": "production",
  "SMS & WhatsApp": "beta",
  "Polls & forms": "production",
  "SSO / SAML & SCIM": "beta",
  "Data classification & retention": "production",
  "Audit & export": "production",
  "SOC2 / HIPAA checklist": "checklist",
  "IP whitelist & DLP": "labs",
  "Realtime feature showcase": "production",
  "Live dashboards & events": "api",
  "Incident response & on-call": "beta",
  "Gamification & reputation": "beta",
  "Live stream overlays": "production",
  "create-fluxy-chat CLI": "production",
  "DevTools web UI": "production",
  "Sandbox support": "preview",
  "Embed widget": "production",
  "Custom domain": "production",
  "Slack / Discord / Matrix bridges": "beta",
  "Conversation transcripts": "production",
  "Slash commands": "production",
  "Regex message routing": "api",
  "App & Agent Marketplace": "production",
  "Chatbot Builder": "production",
  "Cross-Channel Continuity": "labs",
  "A/B Testing": "labs",
  "A2A Protocol": "preview",
  "Spatial & Digital Twin Rooms": "labs",
  "Web3 / Decentralized Chat": "production",
  "Journey Mapping": "demo",
  "Conversation Analytics": "demo",
  "Expert Routing": "api",
  "Virtual Waiting Room": "api",
  "CRM & Knowledge Base": "beta",
  "Real-time Translation": "production",
  "Automation Engine": "beta",
  Processes: "beta",
  "AST markdown system": "api",
  "Concurrency strategies": "api",
  "Thread state": "api",
  "Ephemeral messages": "production",
};

const FEATURE_STATUS_LABEL: Record<FeatureStatus, string> = {
  production: "Production",
  beta: "Beta",
  preview: "Preview",
  labs: "Labs",
  demo: "Demo",
  checklist: "Checklist",
  api: "API / SDK",
};

const FEATURE_STATUS_LEGEND: Array<[FeatureStatus, string]> = [
  ["production", "Worker persist + auth + tenancy + tests"],
  ["beta", "external dependency, partner gate, or partial console"],
  ["preview", "console surface, no SLA"],
  ["labs", "preview quality, no SLA"],
  ["demo", "in-browser SDK demo"],
  ["checklist", "evidence checklist, not an attestation"],
  ["api", "shipped API/SDK, no console page"],
];

const FEATURE_ITEMS = GROUPS.flatMap((group) => group.items);
const UNLABELED_FEATURES = FEATURE_ITEMS.filter((item) => !FEATURE_STATUS[item.title]);
if (UNLABELED_FEATURES.length > 0) {
  throw new Error(
    `Missing readiness label: ${UNLABELED_FEATURES.map((item) => item.title).join(", ")}`,
  );
}

const STATUS_COUNTS = FEATURE_ITEMS.reduce<Record<FeatureStatus, number>>(
  (counts, item) => {
    counts[FEATURE_STATUS[item.title]] += 1;
    return counts;
  },
  { production: 0, beta: 0, preview: 0, labs: 0, demo: 0, checklist: 0, api: 0 },
);

export default function FeaturesPage() {
  return (
    <MarketingShell className={styles.pageWide}>
      <header className={styles.pageHero}>
        <div className={styles.pageHeroCopy}>
          <span className={styles.pageEyebrow}>Features / readiness</span>
          <h1 className={styles.pageTitle}>What runs today. At what level.</h1>
          <p className={styles.pageLede}>
            A hand-written capability list with an honest readiness label. Production means Worker
            persistence, auth, tenancy, and tests — not a hosted SLA. Cards open the console surface
            where one exists.
          </p>
          <div className={styles.pageActions}>
            <Link href={HOSTED_PATHS.getStarted} className={`${styles.btn} ${styles.btnPrimary}`}>
              Get started
            </Link>
            <Link href="/pricing" className={`${styles.btn} ${styles.btnGhost}`}>
              Pricing
            </Link>
          </div>
        </div>
        <div className={styles.pageMeta}>
          <span><strong>{FEATURE_ITEMS.length}</strong> capabilities</span>
          <span><strong>{STATUS_COUNTS.production}</strong> production</span>
          <span><strong>{FEATURE_ITEMS.length - STATUS_COUNTS.production}</strong> not production</span>
        </div>
      </header>

      <SimulatedPreviewBanner label="Preview - static overview.">
        A hand-written capability list. Readiness labels say what is production, beta, preview,
        labs, demo, API, or checklist.
      </SimulatedPreviewBanner>

      <div className={styles.statusLegend}>
        {FEATURE_STATUS_LEGEND.map(([status, text]) => (
          <span key={status}>
            <strong>{FEATURE_STATUS_LABEL[status]}</strong> {text}
          </span>
        ))}
      </div>

      {GROUPS.map((group) => (
        <section key={group.title} className={styles.pageSection}>
          <div className={styles.pageSectionHead}>
            <span className={styles.pageEyebrow}>Capability</span>
            <h2 className={styles.pageH2}>{group.title}</h2>
          </div>
          <div className={styles.pageBody}>
            <p>{group.intro}</p>
            <div className={styles.pageCards}>
              {group.items.map((item) => (
                <div key={item.title} className={styles.pageCard}>
                  <div className={styles.pageCardHead}>
                    <h3>{item.title}</h3>
                    <span
                      className={styles.statusChip}
                      data-status={FEATURE_STATUS[item.title]}
                    >
                      {FEATURE_STATUS_LABEL[FEATURE_STATUS[item.title]]}
                    </span>
                  </div>
                  <p>{item.description}</p>
                  {item.href ? (
                    <Link href={item.href} className={styles.pageCardLink}>
                      {item.hrefLabel ?? "Open"}
                    </Link>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </section>
      ))}

      <div className={styles.pageCta}>
        <div>
          <span className={styles.pageEyebrow}>Next</span>
          <p className={styles.pageH2}>Try it in a room.</p>
          <p>The playground is public; the console is where agents, keys, and billing live.</p>
        </div>
        <div className={styles.pageActions}>
          <Link href="/demo" className={`${styles.btn} ${styles.btnPrimary}`}>Open the playground</Link>
          <Link href="/why" className={`${styles.btn} ${styles.btnGhost}`}>Why FluxyChat</Link>
          <Link href="/guides" className={`${styles.btn} ${styles.btnGhost}`}>Guides</Link>
        </div>
      </div>
    </MarketingShell>
  );
}
