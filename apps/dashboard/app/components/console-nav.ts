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
} from "lucide-react";
import { MARKETING_PATH_PREFIXES } from "@/lib/hosted-product";

export interface ConsoleNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  description?: string;
}

export const CONSOLE_NAV_MAIN: ConsoleNavItem[] = [
  { href: "/", label: "Overview", icon: LayoutDashboard, description: "Session and shortcuts" },
  { href: "/onboarding", label: "Quickstart", icon: BookOpen, description: "Connect, project, first room" },
  { href: "/projects", label: "Projects", icon: FolderKanban, description: "API keys, plans, quotas" },
  { href: "/rooms", label: "Rooms", icon: MessageSquare, description: "Join rooms and read traffic" },
  { href: "/inbox", label: "Inbox", icon: Inbox, description: "Mentions, unread, snooze, follow-ups" },
  { href: "/agent-queue", label: "Agent queue", icon: Headphones, description: "Claim rooms, SLA timers, handoffs" },
  { href: "/notifications", label: "Notifications", icon: Bell, description: "Mentions, DMs, and read state" },
  { href: "/agents", label: "Agents", icon: Bot, description: "Configure in-room AI" },
  { href: "/billing", label: "Billing", icon: CreditCard, description: "Usage and plan changes" },
  { href: "/profile", label: "Profile", icon: UserCircle, description: "Your user profile" },
];

export const CONSOLE_NAV_TOOLS: ConsoleNavItem[] = [
  { href: "/features", label: "Features", icon: Sparkles, description: "P12–P20 capability overview" },
  { href: "/features/realtime", label: "Realtime demos", icon: Zap, description: "Live SDK demos — chat, streaming, location, push" },
  { href: "/devtools", label: "DevTools", icon: Terminal, description: "AI DevTools playground — stream inspector, tool calls, token stats" },
  { href: "/playground", label: "Card Builder", icon: LayoutTemplate, description: "Visually compose rich message cards" },
  { href: "/cli", label: "CLI", icon: Code2, description: "Scaffold new projects with create-fluxy-chat" },
  { href: "/security", label: "Security", icon: Shield, description: "Error hierarchy, token encryption, security checklist" },
  { href: "/middleware", label: "Middleware", icon: Settings2, description: "Configure LLM middleware pipeline stages" },
  { href: "/integrations", label: "Integrations", icon: Plug, description: "Turnstile demo + Sent.dm SMS" },
  { href: "/custom-domains", label: "Custom domains", icon: Globe, description: "White-label chat.yourcompany.com" },
  { href: "/embed", label: "Embed widget", icon: Code2, description: "One-line script for your website" },
  { href: "/analytics", label: "Analytics", icon: BarChart3, description: "Room stats and cost estimates" },
  { href: "/activities", label: "Activities", icon: Activity, description: "Webhooks, agents, automation" },
  { href: "/templates", label: "Templates", icon: FileText, description: "Message templates with variables" },
  { href: "/search", label: "Search", icon: Search, description: "Find messages by keyword" },
  { href: "/transcripts", label: "Transcripts", icon: Users, description: "Per-user conversation transcripts" },
  { href: "/admin", label: "Admin", icon: Shield, description: "Mute, ban, webhooks" },
  { href: "/privacy", label: "Privacy", icon: ShieldCheck, description: "GDPR export and retention" },
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

/** Selects only the deepest configured route that contains the current pathname. */
export function isConsoleNavItemActive(href: string, pathname: string | null): boolean {
  if (!pathname) return false;
  if (href === "/") return pathname === "/";
  if (pathname !== href && !pathname.startsWith(`${href}/`)) return false;

  const allHrefs = [...CONSOLE_NAV_MAIN, ...CONSOLE_NAV_TOOLS].map((item) => item.href);
  return !allHrefs.some(
    (other) =>
      other !== href &&
      other.startsWith(`${href}/`) &&
      (pathname === other || pathname.startsWith(`${other}/`)),
  );
}

function isMarketingPath(pathname: string): boolean {
  return MARKETING_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function isConsoleRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return !isMarketingPath(pathname);
}
