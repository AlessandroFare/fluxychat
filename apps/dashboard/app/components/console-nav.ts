import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BarChart3,
  Bell,
  BookOpen,
  Bot,
  CreditCard,
  FileText,
  FolderKanban,
  Globe,
  Code2,
  Headphones,
  Inbox,
  LayoutDashboard,
  LayoutTemplate,
  MessageSquare,
  MessagesSquare,
  Plug,
  Search,
  Settings2,
  Users,
  Sparkles,
  Shield,
  ShieldCheck,
  Scale,
  Terminal,
  UserCircle,
  Zap,
  Store,
  ArrowRightLeft,
  Boxes,
  Coins,
  Truck,
  Smartphone,
  Mic,
  Pen,
  Video,
  Radio,
  Gamepad2,
  Cpu,
  GraduationCap,
  HeartPulse,
  CalendarRange,
  Landmark,
  Orbit,
  Network,
  ClipboardCheck,
  Handshake,
  Map,
  Gavel,
} from "lucide-react";
import { HOSTED_PATHS, isMarketingPath } from "@/lib/hosted-product";
import {
  dashboardFeatureFlags,
  filterDashboardNavItems,
} from "@/lib/dashboard-feature-flags";

export interface ConsoleNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  description?: string;
}

export interface ConsoleNavSubgroup {
  label: string;
  items: ConsoleNavItem[];
}

export interface ConsoleNavGroup {
  label: string;
  items?: ConsoleNavItem[];
  subgroups?: ConsoleNavSubgroup[];
  defaultOpen?: boolean;
}

export const CONSOLE_NAV_BUILD: ConsoleNavItem[] = [
  { href: HOSTED_PATHS.console, label: "Overview", icon: LayoutDashboard, description: "Session and shortcuts" },
  { href: "/onboarding", label: "Quickstart", icon: BookOpen, description: "Connect, project, first room" },
  { href: "/projects", label: "Projects", icon: FolderKanban, description: "API keys, plans, quotas" },
  { href: "/rooms", label: "Rooms", icon: MessageSquare, description: "Join rooms and read traffic" },
  { href: "/inbox", label: "Inbox", icon: Inbox, description: "Mentions, unread, snooze, follow-ups" },
  { href: "/threads", label: "Threads", icon: MessagesSquare, description: "Reply threads, unread, jump to parent" },
  { href: "/profile", label: "Profile", icon: UserCircle, description: "Your user profile" },
];

export const CONSOLE_NAV_AGENTS: ConsoleNavItem[] = [
  { href: "/agents", label: "Agents hub", icon: Bot, description: "Configure in-room AI" },
  { href: "/agents/platform", label: "Agent platform", icon: Bot, description: "No-code builder, sandbox, CI/CD" },
  { href: "/agents/observability", label: "Observability", icon: Activity, description: "Run latency and failure sampling" },
  { href: "/agents/eval", label: "Eval datasets", icon: ClipboardCheck, description: "Eval datasets + OTel export" },
  { href: "/agents/a2a", label: "A2A protocol", icon: Network, description: "Agent cards, tasks, envelopes" },
  { href: "/agents/cross-org", label: "Cross-org rooms", icon: Handshake, description: "Multi-org agent negotiation" },
  { href: "/agents/debate", label: "Agent debate", icon: Scale, description: "Multi-perspective debate" },
  { href: "/agents/rehearsal", label: "Rehearsal rooms", icon: Sparkles, description: "Ephemeral practice rooms" },
  { href: "/agents/ambient", label: "Ambient agents", icon: Radio, description: "Event-driven agent policies" },
];

export const CONSOLE_NAV_CONNECT: ConsoleNavItem[] = [
  { href: "/knowledge", label: "Knowledge base", icon: BookOpen, description: "KB connectors and RAG search" },
  { href: "/customers", label: "Customers", icon: Users, description: "CDP profiles and campaigns" },
  { href: "/voice-ai", label: "Voice AI", icon: Mic, description: "Realtime voice pipeline" },
  { href: "/huddles", label: "Huddles", icon: Video, description: "Audio/video huddles" },
  { href: "/integrations", label: "Integrations", icon: Plug, description: "Turnstile, SMS, WhatsApp" },
  { href: "/bridges", label: "Bridges", icon: ArrowRightLeft, description: "Slack, Discord, Matrix" },
  { href: "/bridges/forms", label: "Channel forms", icon: MessageSquare, description: "WhatsApp / RCS structured forms" },
];

/** @deprecated Use CONSOLE_NAV_BUILD — kept for imports that expect the old name. */
export const CONSOLE_NAV_MAIN = CONSOLE_NAV_BUILD;

export const CONSOLE_NAV_OPERATE: ConsoleNavItem[] = [
  { href: "/webhooks", label: "Webhooks", icon: Plug, description: "Register, verify, and replay deliveries" },
  { href: "/settings", label: "Settings", icon: Settings2, description: "Tenant and project configuration" },
  { href: "/notifications", label: "Notifications", icon: Bell, description: "Mentions, DMs, and read state" },
  { href: "/user-activity", label: "My activity", icon: Bell, description: "Cross-room mentions feed" },
  { href: "/agent-queue", label: "Agent queue", icon: Headphones, description: "Claim rooms, SLA timers, handoffs" },
  { href: "/automations", label: "Automations", icon: Zap, description: "IF-THEN workflow rules" },
  { href: "/analytics", label: "Analytics", icon: BarChart3, description: "Room stats and cost estimates" },
  { href: "/activities", label: "Activities", icon: Activity, description: "Webhooks, agents, automation" },
  { href: "/billing", label: "Billing", icon: CreditCard, description: "Usage and plan changes" },
  { href: "/admin", label: "Admin", icon: Shield, description: "Mute, ban, webhooks" },
];

export const CONSOLE_NAV_TRUST: ConsoleNavItem[] = [
  { href: "/moderation", label: "Moderation", icon: Shield, description: "Reports, auto-flags, HITL queue" },
  { href: "/ai-governance", label: "AI Governance", icon: ShieldCheck, description: "Model/prompt/tool registry" },
  { href: "/ai-governance/eu-ai-act", label: "EU AI Act", icon: Scale, description: "Risk classification & conformity" },
  { href: "/soc2", label: "SOC 2", icon: ShieldCheck, description: "Controls and evidence export" },
  { href: "/privacy", label: "Privacy", icon: ShieldCheck, description: "GDPR export and retention" },
  { href: "/ediscovery", label: "E-discovery", icon: Landmark, description: "Legal cases and preservation" },
  { href: "/security", label: "Security", icon: Shield, description: "Token encryption and checklist" },
  { href: "/settings/status", label: "Status page", icon: Activity, description: "Public uptime (Upptime)" },
];

export const CONSOLE_NAV_TOOLS: ConsoleNavItem[] = [
  { href: "/features", label: "Features hub", icon: Sparkles, description: "Capability overview with links" },
  { href: "/features/realtime", label: "Realtime demos", icon: Zap, description: "Live SDK demos" },
  { href: "/devtools", label: "DevTools", icon: Terminal, description: "LLM inspector, tool calls, tokens" },
  { href: "/middleware", label: "LLM middleware", icon: Settings2, description: "Guardrails, RAG, PII redaction" },
  { href: "/playground", label: "Card builder", icon: LayoutTemplate, description: "Rich message cards" },
  { href: "/cli", label: "CLI", icon: Code2, description: "create-fluxy-chat scaffold" },
  { href: "/custom-domains", label: "Custom domains", icon: Globe, description: "White-label chat subdomain" },
  { href: "/embed", label: "Embed widget", icon: Code2, description: "One-line script embed" },
  { href: "/templates", label: "Templates", icon: FileText, description: "Message templates" },
  { href: "/templates/code", label: "Code templates", icon: Code2, description: "StackBlitz starters" },
  { href: "/search", label: "Search", icon: Search, description: "Keyword + semantic search" },
  { href: "/cartography", label: "Cartography", icon: Map, description: "Thematic room map" },
  { href: "/truth-market", label: "Truth Market", icon: Gavel, description: "Stake + dispute claims" },
  { href: "/transcripts", label: "Transcripts", icon: Users, description: "Cross-platform transcripts" },
];

export const CONSOLE_NAV_PLATFORM: ConsoleNavItem[] = [
  { href: "/collab", label: "FluxyCollab", icon: Pen, description: "Whiteboard, notes, kanban" },
  { href: "/stream", label: "FluxyStream", icon: Video, description: "Live broadcast + chat overlay" },
  { href: "/stream/demo", label: "Stream demo", icon: Radio, description: "Interactive stream SDK demo" },
  { href: "/game", label: "FluxyGame", icon: Gamepad2, description: "Multiplayer game backend" },
  { href: "/iot", label: "FluxyIoT", icon: Cpu, description: "MQTT bridge, device shadow" },
  { href: "/transport", label: "WebTransport", icon: Zap, description: "Transport fallback chain" },
  { href: "/marketplace", label: "Marketplace", icon: Store, description: "Apps and agent skills" },
  { href: "/chatbot-builder", label: "Chatbot builder", icon: Bot, description: "Trigger-action rules" },
  { href: "/cross-channel", label: "Cross-channel", icon: ArrowRightLeft, description: "Unified sessions" },
  { href: "/spatial", label: "Spatial twins", icon: Boxes, description: "3D room scenes" },
  { href: "/web3", label: "Web3", icon: Coins, description: "Wallet auth, token gates" },
  { href: "/fleet", label: "Fleet", icon: Truck, description: "GPS tracking and geofences" },
  { href: "/driver", label: "Driver app", icon: Smartphone, description: "PWA driver client" },
];

export const CONSOLE_NAV_INDUSTRIES: ConsoleNavItem[] = [
  { href: "/edu", label: "Education", icon: GraduationCap, description: "Live classes, breakouts, polls and attendance" },
  { href: "/health", label: "Health", icon: HeartPulse, description: "Secure care rooms and consent workflows" },
  { href: "/events", label: "Events", icon: CalendarRange, description: "Venues, stages, Q&A and ticket verification" },
  { href: "/finance", label: "Finance", icon: Landmark, description: "Market rooms, risk alerts and approvals" },
];

export interface ConsoleNavSubgroup {
  label: string;
  items: ConsoleNavItem[];
}

export interface ConsoleNavGroup {
  label: string;
  items?: ConsoleNavItem[];
  subgroups?: ConsoleNavSubgroup[];
  defaultOpen?: boolean;
}

const CONTINUITY_LAB: ConsoleNavItem = {
  href: "/continuity",
  label: "Cross-Reality",
  icon: Orbit,
  description: "Cross-device capability simulator",
};

function filterItems(items: ConsoleNavItem[]): ConsoleNavItem[] {
  return filterDashboardNavItems(items);
}

function buildConsoleNavGroups(): ConsoleNavGroup[] {
  return [
    {
      label: "Build",
      subgroups: [
        { label: "Core", items: filterItems(CONSOLE_NAV_BUILD) },
        { label: "Agents", items: filterItems(CONSOLE_NAV_AGENTS) },
        { label: "Connect", items: filterItems(CONSOLE_NAV_CONNECT) },
      ],
      defaultOpen: true,
    },
    {
      label: "Operate",
      subgroups: [
        { label: "Ops", items: filterItems(CONSOLE_NAV_OPERATE) },
        { label: "Trust & compliance", items: filterItems(CONSOLE_NAV_TRUST) },
      ],
      defaultOpen: true,
    },
    {
      label: "Platform",
      items: filterItems([...CONSOLE_NAV_PLATFORM, ...(dashboardFeatureFlags.labsShowcase ? [CONTINUITY_LAB] : [])]),
      defaultOpen: false,
    },
    {
      label: "AI & dev tools",
      items: filterItems(CONSOLE_NAV_TOOLS),
      defaultOpen: false,
    },
    {
      label: "Industries",
      items: filterItems(CONSOLE_NAV_INDUSTRIES),
      defaultOpen: false,
    },
  ];
}

export const CONSOLE_NAV_GROUPS: ConsoleNavGroup[] = buildConsoleNavGroups();

/** Flat list of all sidebar routes (for command palette + breadcrumbs). */
export function flattenConsoleNavItems(): ConsoleNavItem[] {
  return CONSOLE_NAV_GROUPS.flatMap((group) => [
    ...(group.items ?? []),
    ...(group.subgroups ?? []).flatMap((sg) => sg.items),
  ]);
}

/** @deprecated Use CONSOLE_NAV_PLATFORM */
export const CONSOLE_NAV_LABS = CONSOLE_NAV_PLATFORM;

/** @deprecated Use CONSOLE_NAV_TOOLS */
export const CONSOLE_NAV_DEV_TOOLS = CONSOLE_NAV_TOOLS;

/** Selects only the deepest configured route that contains the current pathname. */
export function isConsoleNavItemActive(href: string, pathname: string | null): boolean {
  if (!pathname) return false;
  if (href === HOSTED_PATHS.console) return pathname === HOSTED_PATHS.console;
  if (pathname !== href && !pathname.startsWith(`${href}/`)) return false;

  const allHrefs = CONSOLE_NAV_GROUPS.flatMap((group) => [
    ...(group.items ?? []).map((item) => item.href),
    ...(group.subgroups ?? []).flatMap((sg) => sg.items.map((item) => item.href)),
  ]);
  return !allHrefs.some(
    (other) =>
      other !== href &&
      other.startsWith(`${href}/`) &&
      (pathname === other || pathname.startsWith(`${other}/`)),
  );
}

export function isConsoleRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return !isMarketingPath(pathname);
}
