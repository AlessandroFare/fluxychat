import { ALL_GUIDES } from "@/lib/guides/related-guides";
import { docsSiteHref, HOSTED_PATHS } from "@/lib/hosted-product";

export interface DocSearchEntry {
  title: string;
  href: string;
  snippet?: string;
  external?: boolean;
}

/** Client-side index when Algolia DocSearch env vars are unset (FASE 1.2 fallback). */
export const DOC_SEARCH_INDEX: readonly DocSearchEntry[] = [
  ...ALL_GUIDES.map((guide) => ({
    title: guide.label,
    href: guide.href,
    snippet: guide.href,
  })),
  {
    title: "Documentation hub",
    href: HOSTED_PATHS.docs,
    snippet: "Guides, SDK snippets, StackBlitz examples",
  },
  {
    title: "Public demo playground",
    href: "/demo",
    snippet: "Live chat with AI agent, no signup",
  },
  {
    title: "Full docs site",
    href: docsSiteHref(""),
    snippet: "Search, Ask AI, SDK reference, cookbooks",
    external: true,
  },
  {
    title: "Hosted quickstart",
    href: docsSiteHref("getting-started/quickstart"),
    snippet: "Account, SDK install, first room message",
    external: true,
  },
  {
    title: "Auth and JWT",
    href: docsSiteHref("cookbook/auth-jwt"),
    snippet: "POST /auth/token, member JWTs",
    external: true,
  },
  {
    title: "SDK useChat reference",
    href: docsSiteHref("core/use-chat"),
    snippet: "FluxyChatClient, rooms, WebSocket",
    external: true,
  },
  {
    title: "Self-host on Cloudflare",
    href: docsSiteHref("guides/self-host-one-command"),
    snippet: "Deploy worker and D1",
    external: true,
  },
];

export function filterDocSearchIndex(query: string, limit = 8): DocSearchEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  return DOC_SEARCH_INDEX.filter((entry) => {
    const haystack = `${entry.title} ${entry.snippet ?? ""} ${entry.href}`.toLowerCase();
    return haystack.includes(q);
  }).slice(0, limit);
}
