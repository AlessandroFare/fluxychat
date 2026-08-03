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
  Plug,
  Search,
  Settings2,
  Users,
  Sparkles,
  Shield,
  ShieldCheck,
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
  Scale,
  Map,
  Gavel,
} from "lucide-react";
import { HOSTED_PATHS, isMarketingPath } from "@/lib/hosted-product";
import {
  DASHBOARD_LAB_HREFS,
  dashboardFeatureFlags,
  filterDashboardNavItems,
} from "@/lib/dashboard-feature-flags";

export interface ConsoleNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  description?: string;
}

export const CONSOLE_NAV_BUILD: ConsoleNavItem[] = [
  { href: HOSTED_PATHS.console, label: "Overview", icon: LayoutDashboard, description: "Session and shortcuts" },
  { href: "/onboarding", label: "Quickstart", icon: BookOpen, description: "Connect, project, first room" },
  { href: "/projects", label: "Projects", icon: FolderKanban, description: "API keys, plans, quotas" },
  { href: "/rooms", label: "Rooms", icon: MessageSquare, description: "Join rooms and read traffic" },
  { href: "/inbox", label: "Inbox", icon: Inbox, description: "Mentions, unread, snooze, follow-ups" },
  { href: "/agents", label: "Agents", icon: Bot, description: "Configure in-room AI" },
  { href: "/agents/observability", label: "Agent observability", icon: Activity, description: "Run latency and failure sampling" },
  { href: "/agents/eval", label: "Agent eval", icon: ClipboardCheck, description: "Eval datasets + OTel export" },
  { href: "/agents/a2a", label: "A2A protocol", icon: Network, description: "Agent cards, tasks, envelopes" },
  { href: "/agents/cross-org", label: "Cross-org rooms", icon: Handshake, description: "Multi-org agent negotiation pilot" },
  { href: "/agents/debate", label: "Agent debate", icon: Scale, description: "Multi-perspective debate + moderator synthesis" },
  { href: "/agents/rehearsal", label: "Rehearsal rooms", icon: Sparkles, description: "Ephemeral practice rooms with cloned context" },
  { href: "/agents/ambient", label: "Ambient agents", icon: Radio, description: "Event-driven agent policies + audit runs" },
  { href: "/knowledge", label: "Knowledge base", icon: BookOpen, description: "KB connectors and RAG search" },
  { href: "/customers", label: "Customers", icon: Users, description: "CDP profiles, segments, and broadcast campaigns" },
  { href: "/voice-ai", label: "Voice AI", icon: Mic, description: "Realtime voice pipeline metrics and adapters" },
  { href: "/huddles", label: "Huddles", icon: Video, description: "Audio/video huddles with screen share" },
  { href: "/integrations", label: "Integrations", icon: Plug, description: "Turnstile demo + Sent.dm SMS" },
  { href: "/profile", label: "Profile", icon: UserCircle, description: "Your user profile" },
];

/** @deprecated Use CONSOLE_NAV_BUILD — kept for imports that expect the old name. */
export const CONSOLE_NAV_MAIN = CONSOLE_NAV_BUILD;

export const CONSOLE_NAV_OPERATE: ConsoleNavItem[] = [
  { href: "/webhooks", label: "Webhooks", icon: Plug, description: "Register, verify, and replay deliveries" },
  { href: "/bridges", label: "Bridges", icon: ArrowRightLeft, description: "Slack, Discord, and Matrix federation" },
  { href: "/settings", label: "Settings", icon: Settings2, description: "Tenant and project configuration" },
  { href: "/notifications", label: "Notifications", icon: Bell, description: "Mentions, DMs, and read state" },
  { href: "/agent-queue", label: "Agent queue", icon: Headphones, description: "Claim rooms, SLA timers, handoffs" },
  { href: "/moderation", label: "Moderation", icon: Shield, description: "Reports, auto-flags, mute/ban, HITL queue" },
  { href: "/ai-governance", label: "AI Governance", icon: ShieldCheck, description: "Model/prompt/tool registry and evaluations" },
  { href: "/soc2", label: "SOC 2", icon: ShieldCheck, description: "Controls, evidence export, DLP smoke tests" },
  { href: "/settings/status", label: "Status page", icon: Activity, description: "Upptime config and deploy checklist (#62)" },
  { href: "/automations", label: "Automations", icon: Zap, description: "IF-THEN workflow rules" },
  { href: "/analytics", label: "Analytics", icon: BarChart3, description: "Room stats and cost estimates" },
  { href: "/activities", label: "Activities", icon: Activity, description: "Webhooks, agents, automation" },
  { href: "/security", label: "Security", icon: Shield, description: "Error hierarchy, token encryption, security checklist" },
  { href: "/privacy", label: "Privacy", icon: ShieldCheck, description: "GDPR export and retention" },
  { href: "/ediscovery", label: "E-discovery", icon: Landmark, description: "Legal cases, preservation, evidence" },
  { href: "/admin", label: "Admin", icon: Shield, description: "Mute, ban, webhooks" },
  { href: "/billing", label: "Billing", icon: CreditCard, description: "Usage and plan changes" },
];

export const CONSOLE_NAV_TOOLS: ConsoleNavItem[] = [
  { href: "/features", label: "Features", icon: Sparkles, description: "P12–P20 capability overview" },
  { href: "/features/realtime", label: "Realtime demos", icon: Zap, description: "Live SDK demos — chat, streaming, location, push" },
  { href: "/devtools", label: "DevTools", icon: Terminal, description: "AI DevTools playground — stream inspector, tool calls, token stats" },
  { href: "/playground", label: "Card Builder", icon: LayoutTemplate, description: "Visually compose rich message cards" },
  { href: "/cli", label: "CLI", icon: Code2, description: "Scaffold new projects with create-fluxy-chat" },
  { href: "/middleware", label: "Middleware", icon: Settings2, description: "Configure LLM middleware pipeline stages" },
  { href: "/custom-domains", label: "Custom domains", icon: Globe, description: "White-label chat.yourcompany.com" },
  { href: "/embed", label: "Embed widget", icon: Code2, description: "One-line script for your website" },
  { href: "/templates", label: "Templates", icon: FileText, description: "Message templates with variables" },
  { href: "/search", label: "Search", icon: Search, description: "Keyword and hybrid semantic message search" },
  { href: "/cartography", label: "Cartography", icon: Map, description: "Zoomable thematic map of room history" },
  { href: "/truth-market", label: "Truth Market", icon: Gavel, description: "Stake credits on verifiable claims + dispute arbitration" },
  { href: "/transcripts", label: "Transcripts", icon: Users, description: "Per-user conversation transcripts" },
  { href: "/fleet", label: "Fleet", icon: Truck, description: "GPS tracking, vehicles, trips & geofences" },
  { href: "/driver", label: "Driver App", icon: Smartphone, description: "PWA driver app — offline GPS, trips, sync" },
  { href: "/marketplace", label: "Marketplace", icon: Store, description: "Apps, agent skills, AI providers" },
  { href: "/chatbot-builder", label: "Chatbot Builder", icon: Bot, description: "Visual trigger-action rules" },
  { href: "/cross-channel", label: "Cross-Channel", icon: ArrowRightLeft, description: "Multi-channel, journey, A/B, A2A" },
  { href: "/spatial", label: "Spatial", icon: Boxes, description: "Digital twin rooms & AR overlay" },
  { href: "/web3", label: "Web3", icon: Coins, description: "Decentralized chat & token gates" },
  { href: "/collab", label: "Collab", icon: Pen, description: "Whiteboard, notes, kanban & CRDT sync" },
  { href: "/stream", label: "Stream", icon: Video, description: "Live broadcasting, HLS player, chat overlay" },
  { href: "/stream/demo", label: "Stream Demo", icon: Radio, description: "Interactive demo — all FluxyStream features" },
  { href: "/transport", label: "Transport", icon: Zap, description: "WebTransport readiness & auto-negotiation" },
  { href: "/agents/platform", label: "Agent Platform", icon: Bot, description: "No-code builder, versioning, CI/CD, sandbox, cost tracking" },
  { href: "/game", label: "FluxyGame", icon: Gamepad2, description: "Multiplayer game backend — matchmaking, state sync, AI NPCs, tournaments" },
  { href: "/iot", label: "FluxyIoT", icon: Cpu, description: "MQTT bridge, device shadow, rule engine, OTA, geofencing, AI diagnostics" },
  { href: "/templates/code", label: "Code Templates", icon: Code2, description: "Runnable StackBlitz templates — basic, discord clone, support widget, location tracker" },
];

export const CONSOLE_NAV_INDUSTRIES: ConsoleNavItem[] = [
  { href: "/edu", label: "Education", icon: GraduationCap, description: "Live classes, breakouts, polls and attendance" },
  { href: "/health", label: "Health", icon: HeartPulse, description: "Secure care rooms and consent workflows" },
  { href: "/events", label: "Events", icon: CalendarRange, description: "Venues, stages, Q&A and ticket verification" },
  { href: "/finance", label: "Finance", icon: Landmark, description: "Market rooms, risk alerts and approvals" },
];

export interface ConsoleNavGroup {
  label: string;
  items: ConsoleNavItem[];
  defaultOpen?: boolean;
}

const LAB_SHOWCASE_HREFS = DASHBOARD_LAB_HREFS;

const CONTINUITY_LAB: ConsoleNavItem = {
  href: "/continuity",
  label: "Cross-Reality",
  icon: Orbit,
  description: "Cross-device capability and handoff simulator",
};

export const CONSOLE_NAV_LABS: ConsoleNavItem[] = filterDashboardNavItems([
  ...CONSOLE_NAV_TOOLS.filter((item) => LAB_SHOWCASE_HREFS.has(item.href)),
  CONTINUITY_LAB,
]);

export const CONSOLE_NAV_DEV_TOOLS: ConsoleNavItem[] = filterDashboardNavItems(
  CONSOLE_NAV_TOOLS.filter((item) => !LAB_SHOWCASE_HREFS.has(item.href)),
);

function buildConsoleNavGroups(): ConsoleNavGroup[] {
  const groups: ConsoleNavGroup[] = [
    { label: "Build", items: CONSOLE_NAV_BUILD, defaultOpen: true },
    { label: "Operate", items: CONSOLE_NAV_OPERATE, defaultOpen: true },
  ];
  if (dashboardFeatureFlags.labsShowcase) {
    groups.push({ label: "Labs & demos", items: CONSOLE_NAV_LABS, defaultOpen: false });
  }
  groups.push(
    { label: "AI & dev tools", items: CONSOLE_NAV_DEV_TOOLS, defaultOpen: false },
    { label: "Industries", items: CONSOLE_NAV_INDUSTRIES, defaultOpen: false },
  );
  return groups;
}

export const CONSOLE_NAV_GROUPS: ConsoleNavGroup[] = buildConsoleNavGroups();

/** Selects only the deepest configured route that contains the current pathname. */
export function isConsoleNavItemActive(href: string, pathname: string | null): boolean {
  if (!pathname) return false;
  if (href === HOSTED_PATHS.console) return pathname === HOSTED_PATHS.console;
  if (pathname !== href && !pathname.startsWith(`${href}/`)) return false;

  const allHrefs = CONSOLE_NAV_GROUPS.flatMap((group) => group.items).map((item) => item.href);
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
