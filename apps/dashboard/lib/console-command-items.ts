import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  ClipboardCopy,
  LifeBuoy,
  Signal,
  Sparkles,
} from "lucide-react";
import {
  CONSOLE_NAV_AGENTS,
  CONSOLE_NAV_BUILD,
  CONSOLE_NAV_CONNECT,
  CONSOLE_NAV_GROUPS,
  CONSOLE_NAV_INDUSTRIES,
  CONSOLE_NAV_OPERATE,
  CONSOLE_NAV_PLATFORM,
  CONSOLE_NAV_TOOLS,
  CONSOLE_NAV_TRUST,
  flattenConsoleNavItems,
} from "@/app/components/console-nav";
import { HOSTED_PATHS } from "@/lib/hosted-product";
import { filterDashboardNavItems } from "@/lib/dashboard-feature-flags";

export type ConsoleCommandGroup = "Navigate" | "Industries" | "Labs" | "Operate" | "Actions" | "Help";

export type ConsoleCommandAction = "copy-worker-url" | "open-support";

export interface ConsoleCommandItemDef {
  id: string;
  group: ConsoleCommandGroup;
  label: string;
  description?: string;
  keywords?: string[];
  icon?: LucideIcon;
  href?: string;
  action?: ConsoleCommandAction;
}

function mapNavItems(
  items: Array<{ href: string; label: string; description?: string; icon: LucideIcon }>,
  group: ConsoleCommandGroup,
  quickstartHref: string,
): ConsoleCommandItemDef[] {
  return items.map((item) => ({
    id: `nav-${item.href}`,
    group,
    label: item.label,
    description: item.description,
    icon: item.icon,
    href: item.href === "/onboarding" ? quickstartHref : item.href,
    keywords: [item.href.replace(/^\//, ""), "go", "open", group.toLowerCase()],
  }));
}

function navItems(quickstartHref: string): ConsoleCommandItemDef[] {
  return [
    ...mapNavItems(filterDashboardNavItems(CONSOLE_NAV_BUILD), "Navigate", quickstartHref),
    ...mapNavItems(filterDashboardNavItems(CONSOLE_NAV_AGENTS), "Navigate", quickstartHref),
    ...mapNavItems(filterDashboardNavItems(CONSOLE_NAV_CONNECT), "Navigate", quickstartHref),
    ...mapNavItems(filterDashboardNavItems(CONSOLE_NAV_TOOLS), "Navigate", quickstartHref),
    ...mapNavItems(filterDashboardNavItems(CONSOLE_NAV_PLATFORM), "Labs", quickstartHref),
    ...mapNavItems(filterDashboardNavItems(CONSOLE_NAV_INDUSTRIES), "Industries", quickstartHref),
    ...mapNavItems(filterDashboardNavItems(CONSOLE_NAV_OPERATE), "Operate", quickstartHref),
    ...mapNavItems(filterDashboardNavItems(CONSOLE_NAV_TRUST), "Operate", quickstartHref),
  ];
}

export function buildConsoleCommandItems(quickstartHref: string): ConsoleCommandItemDef[] {
  return [
    ...navItems(quickstartHref),
    {
      id: "nav-status",
      group: "Navigate",
      label: "System status",
      description: "Public health and dependency checks",
      icon: Signal,
      href: HOSTED_PATHS.status,
      keywords: ["health", "uptime", "monitoring"],
    },
    {
      id: "nav-landing",
      group: "Navigate",
      label: "Product & pricing",
      description: "Marketing landing page",
      icon: Sparkles,
      href: HOSTED_PATHS.landing,
      keywords: ["marketing", "pricing", "home"],
    },
    {
      id: "nav-docs",
      group: "Navigate",
      label: "Documentation",
      description: "Guides and API references",
      icon: BookOpen,
      href: HOSTED_PATHS.docs,
      keywords: ["guides", "api", "sdk"],
    },
    {
      id: "action-copy-worker-url",
      group: "Actions",
      label: "Copy Worker URL",
      description: "Paste into SDK baseUrl or curl",
      icon: ClipboardCopy,
      action: "copy-worker-url",
      keywords: ["api", "endpoint", "baseurl", "clipboard"],
    },
    {
      id: "action-support",
      group: "Actions",
      label: "Contact support",
      description: "Email fluxychat@outlook.com",
      icon: LifeBuoy,
      action: "open-support",
      keywords: ["help", "email", "contact"],
    },
  ];
}

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

function itemHaystack(item: ConsoleCommandItemDef): string {
  return [item.label, item.description, ...(item.keywords ?? []), item.href ?? "", item.action ?? ""]
    .join(" ")
    .toLowerCase();
}

/** Filter and rank command items for the palette search box. */
export function filterConsoleCommandItems(
  items: ConsoleCommandItemDef[],
  query: string,
): ConsoleCommandItemDef[] {
  const q = normalizeQuery(query);
  if (!q) return items;

  const tokens = q.split(/\s+/).filter(Boolean);
  return items.filter((item) => {
    const haystack = itemHaystack(item);
    return tokens.every((token) => haystack.includes(token));
  });
}

const GROUP_ORDER: ConsoleCommandGroup[] = ["Navigate", "Industries", "Operate", "Labs", "Actions", "Help"];

/** Group filtered items preserving section order. */
export function groupConsoleCommandItems(
  items: ConsoleCommandItemDef[],
): Array<{ group: ConsoleCommandGroup; items: ConsoleCommandItemDef[] }> {
  return GROUP_ORDER
    .map((group) => ({
      group,
      items: items.filter((item) => item.group === group),
    }))
    .filter((section) => section.items.length > 0);
}

/** Resolve nav group + item for breadcrumb rendering. */
export function resolveConsoleNavContext(pathname: string | null): {
  groupLabel: string;
  itemLabel: string;
  itemHref: string;
} | null {
  if (!pathname || pathname === HOSTED_PATHS.console) return null;

  for (const group of CONSOLE_NAV_GROUPS) {
    const items = [
      ...(group.items ?? []),
      ...(group.subgroups ?? []).flatMap((sg) => sg.items),
    ];
    const match = items.find(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
    );
    if (match) {
      return { groupLabel: group.label, itemLabel: match.label, itemHref: match.href };
    }
  }

  const fallback = flattenConsoleNavItems().find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  if (fallback) {
    return { groupLabel: "Console", itemLabel: fallback.label, itemHref: fallback.href };
  }
  return null;
}
