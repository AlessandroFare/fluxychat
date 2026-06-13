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
  MessageSquare,
  Plug,
  Search,
  Sparkles,
  Shield,
  ShieldCheck,
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
];

export const CONSOLE_NAV_TOOLS: ConsoleNavItem[] = [
  { href: "/features", label: "Features", icon: Sparkles, description: "P12–P20 capability overview" },
  { href: "/integrations", label: "Integrations", icon: Plug, description: "Turnstile demo + Sent.dm SMS" },
  { href: "/custom-domains", label: "Custom domains", icon: Globe, description: "White-label chat.yourcompany.com" },
  { href: "/embed", label: "Embed widget", icon: Code2, description: "One-line script for your website" },
  { href: "/analytics", label: "Analytics", icon: BarChart3, description: "Room stats and cost estimates" },
  { href: "/activities", label: "Activities", icon: Activity, description: "Webhooks, agents, automation" },
  { href: "/templates", label: "Templates", icon: FileText, description: "Message templates with variables" },
  { href: "/search", label: "Search", icon: Search, description: "Find messages by keyword" },
  { href: "/admin", label: "Admin", icon: Shield, description: "Mute, ban, webhooks" },
  { href: "/privacy", label: "Privacy", icon: ShieldCheck, description: "GDPR export and retention" },
];

function isMarketingPath(pathname: string): boolean {
  return MARKETING_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function isConsoleRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return !isMarketingPath(pathname);
}
