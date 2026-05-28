/**
 * Hosted-first product paths and copy.
 * Default journey: sign up → onboarding wizard → SDK with project API key.
 * Self-host remains documented under get-started#self-host (backlog tier).
 */

export const HOSTED_PATHS = {
  landing: "/landing",
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
  docs: "/docs",
  onboarding: "/onboarding",
  signUp: "/sign-up",
  signIn: "/sign-in",
  console: "/",
} as const;

/** Routes that use marketing layout (no console sidebar). */
export const MARKETING_PATH_PREFIXES = [
  "/landing",
  "/why",
  "/enter",
  "/get-started",
  "/docs",
  "/compare",
  "/guides",
  "/demo",
  "/sign-in",
  "/sign-up",
] as const;

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
