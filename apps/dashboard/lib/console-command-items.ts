import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  ClipboardCopy,
  LifeBuoy,
  Signal,
  Sparkles,
} from "lucide-react";
import { CONSOLE_NAV_MAIN, CONSOLE_NAV_TOOLS } from "@/app/components/console-nav";
import { HOSTED_PATHS } from "@/lib/hosted-product";

export type ConsoleCommandGroup = "Navigate" | "Actions" | "Help";

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

function navItems(quickstartHref: string): ConsoleCommandItemDef[] {
  const main = CONSOLE_NAV_MAIN.map((item) => ({
    id: `nav-${item.href}`,
    group: "Navigate" as const,
    label: item.label,
    description: item.description,
    icon: item.icon,
    href: item.href === "/onboarding" ? quickstartHref : item.href,
    keywords: [item.href.replace(/^\//, ""), "go", "open"],
  }));

  const tools = CONSOLE_NAV_TOOLS.map((item) => ({
    id: `nav-${item.href}`,
    group: "Navigate" as const,
    label: item.label,
    description: item.description,
    icon: item.icon,
    href: item.href,
    keywords: [item.href.replace(/^\//, ""), "go", "open"],
  }));

  return [...main, ...tools];
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

/** Group filtered items preserving Navigate → Actions → Help order. */
export function groupConsoleCommandItems(
  items: ConsoleCommandItemDef[],
): Array<{ group: ConsoleCommandGroup; items: ConsoleCommandItemDef[] }> {
  const order: ConsoleCommandGroup[] = ["Navigate", "Actions", "Help"];
  return order
    .map((group) => ({
      group,
      items: items.filter((item) => item.group === group),
    }))
    .filter((section) => section.items.length > 0);
}
