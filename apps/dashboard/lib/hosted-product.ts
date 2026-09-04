/**
 * Hosted-first product paths and copy.
 * Default journey: sign up → onboarding wizard → SDK with project API key.
 * Self-host remains documented under get-started#self-host (backlog tier).
 */

import { isPublicSitePath, PUBLIC_SITE_PATH_PREFIXES } from "@/lib/public-site-paths";

/** Public Fumadocs site home (external). Set NEXT_PUBLIC_DOCS_URL=http://localhost:3001 for local docs dev. */
export function docsHomeHref(): string {
  const configured = process.env.NEXT_PUBLIC_DOCS_URL?.trim()?.replace(/\/$/, "");
  const base =
    configured && configured.startsWith("http") ? configured : "https://docs.fluxychat.com";
  return `${base}/docs`;
}

/** Full URL to a page on the public Fumadocs site (e.g. `quickstart` → docs.fluxychat.com/docs/quickstart). */
export function docsSiteHref(slug: string): string {
  const clean = slug.replace(/^\//, "").replace(/^docs\//, "");
  const configured = process.env.NEXT_PUBLIC_DOCS_URL?.trim()?.replace(/\/$/, "");
  const base =
    configured && configured.startsWith("http") ? configured : "https://docs.fluxychat.com";
  return `${base}/docs/${clean}`;
}

/** @deprecated Use {@link docsSiteHref} */
export const fumadocsArticlePath = docsSiteHref;

/** Map dashboard /guides/* paths to Fumadocs learn/* slugs where they differ. */
export const GUIDE_TO_FUMADOCS: Record<string, string> = {
  "/guides/cloudflare-workers-chat": "learn/cloudflare-workers-chat",
  "/guides/durable-objects-for-chat-rooms": "learn/durable-objects-for-chat-rooms",
  "/guides/vercel-realtime-without-pusher": "learn/vercel-realtime-without-pusher",
  "/guides/reconnect-durable-objects-hibernation": "learn/reconnect-durable-objects-hibernation",
  "/guides/after-cloudflare-chat-tutorial": "learn/after-cloudflare-chat-tutorial",
  "/guides/nextjs-vercel-realtime-chat": "learn/nextjs-vercel-realtime-chat",
  "/guides/agent-events-same-websocket-stream": "learn/agent-events-same-websocket-stream",
  "/guides/discord-style-chat-cloudflare": "learn/discord-style-chat-cloudflare",
  "/guides/durable-objects-hibernation-cost": "learn/durable-objects-hibernation-cost",
  "/guides/durable-objects-chat-tradeoffs": "learn/durable-objects-chat-tradeoffs",
  "/guides/build-chat-nextjs-fluxychat": "learn/build-chat-nextjs-fluxychat",
  "/guides/pusher-alternative-saas": "learn/pusher-alternative-saas",
  "/guides/in-app-chat-vs-support-desk": "learn/in-app-chat-vs-support-desk",
  "/guides/llm-memory-vs-room-state": "learn/llm-memory-vs-room-state",
  "/guides/offline-notify-in-app-plus-sms": "learn/offline-notify-in-app-plus-sms",
};

export function guideDocsHref(dashboardGuidePath: string): string {
  const slug = GUIDE_TO_FUMADOCS[dashboardGuidePath];
  if (slug) return docsSiteHref(slug);
  const tail = dashboardGuidePath.replace(/^\/guides\//, "");
  return docsSiteHref(`learn/${tail}`);
}

export const HOSTED_PATHS = {
  /** Public marketing homepage (fluxychat.com root). */
  landing: "/",
  /** @deprecated Use {@link HOSTED_PATHS.landing} — kept for redirects. */
  legacyLanding: "/landing",
  why: "/why",
  compare: "/compare",
  guides: "/guides",
  guidesCloudflareChat: "/guides/cloudflare-workers-chat",
  guidesDurableObjectsChat: "/guides/durable-objects-for-chat-rooms",
  guidesVercelRealtime: "/guides/vercel-realtime-without-pusher",
  guidesReconnect: "/guides/reconnect-durable-objects-hibernation",
  guidesAfterCfTutorial: "/guides/after-cloudflare-chat-tutorial",
  guidesNextjsVercel: "/guides/nextjs-vercel-realtime-chat",
  guidesAgentStream: "/guides/agent-events-same-websocket-stream",
  guidesDiscordStyle: "/guides/discord-style-chat-cloudflare",
  guidesHibernationCost: "/guides/durable-objects-hibernation-cost",
  guidesDoTradeoffs: "/guides/durable-objects-chat-tradeoffs",
  guidesBuildNextjs: "/guides/build-chat-nextjs-fluxychat",
  getStarted: "/get-started",
  docs: docsHomeHref(),
  onboarding: "/onboarding",
  signUp: "/sign-up",
  signIn: "/sign-in",
  /** Operator console overview (Clerk-protected). */
  console: "/dashboard",
  status: "/status",
  /** Fumadocs “Chat only” progressive disclosure slice */
  docsChatOnly: docsSiteHref("chat-only"),
} as const;

/** @deprecated Use PUBLIC_SITE_PATH_PREFIXES. Kept so older imports keep compiling. */
export const MARKETING_PATH_PREFIXES = PUBLIC_SITE_PATH_PREFIXES;

export function isMarketingPath(pathname: string): boolean {
  return isPublicSitePath(pathname);
}

export const HOSTED_COPY = {
  startFree: "Create free account",
  signIn: "Sign in",
  console: "Console",
  connectAccount: "Connect account",
  quickstart: "Quickstart",
  viewDocs: "View docs",
} as const;

/** Browser-safe: publishable key present (sign-in UI available). */
export function isClerkClientConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim());
}

/** Nav "Console" before the user is authenticated. */
export function consoleEntryHref(): string {
  return isClerkClientConfigured() ? HOSTED_PATHS.signIn : HOSTED_PATHS.getStarted;
}

/** Primary signup CTA — full quickstart wizard (first-time setup). */
export function hostedSignupRedirect(): string {
  return HOSTED_PATHS.onboarding;
}

/** Returning users reopen the wizard without being kicked to overview. */
export function hostedQuickstartReviewHref(): string {
  return `${HOSTED_PATHS.onboarding}?review=1`;
}
