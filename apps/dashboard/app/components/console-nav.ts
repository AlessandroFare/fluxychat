import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  BookOpen,
  Bot,
  CreditCard,
  FolderKanban,
  LayoutDashboard,
  MessageSquare,
  Search,
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
  { href: "/agents", label: "Agents", icon: Bot, description: "Configure in-room AI" },
  { href: "/billing", label: "Billing", icon: CreditCard, description: "Usage and plan changes" },
];

export const CONSOLE_NAV_TOOLS: ConsoleNavItem[] = [
  { href: "/analytics", label: "Analytics", icon: BarChart3, description: "Room stats and cost estimates" },
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
