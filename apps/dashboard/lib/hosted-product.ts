/**
 * Hosted-first product paths and copy.
 * Default journey: sign up → onboarding wizard → SDK with project API key.
 * Self-host remains documented under get-started#self-host (backlog tier).
 */

export const HOSTED_PATHS = {
  landing: "/landing",
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
  "/enter",
  "/get-started",
  "/docs",
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

/** Primary signup / trial CTA destination after Clerk. */
export function hostedSignupRedirect(): string {
  return `${HOSTED_PATHS.onboarding}?guided=1`;
}
