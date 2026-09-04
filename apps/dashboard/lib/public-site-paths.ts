/**
 * Public marketing and trust URLs.
 * Used by Clerk (no protect), console chrome (no sign-in gate), and the ack cookie.
 * Console tools stay off this list: /privacy, /security, /soc2, /embed, /health, /rooms, /iot, etc.
 */
export const PUBLIC_SITE_PATH_PREFIXES = [
  "/landing",
  "/pricing",
  "/why",
  "/enter",
  "/get-started",
  "/docs",
  "/compare",
  "/guides",
  "/demo",
  "/cli-auth",
  "/status",
  "/subprocessors",
  "/features",
  "/sign-in",
  "/sign-up",
] as const;

export function isPublicSitePath(pathname: string): boolean {
  if (pathname === "/" || pathname === "/favicon.ico") return true;
  return PUBLIC_SITE_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** Clerk `createRouteMatcher` patterns: exact path plus children. */
export function clerkPublicRoutePatterns(): string[] {
  const extra = [
    "/",
    "/.well-known(.*)",
    "/api/console-ack(.*)",
    "/api/webhooks/clerk(.*)",
    "/api/fluxy/search-messages(.*)",
    "/api/fluxy/search-messages-semantic(.*)",
    "/api/fluxy/search-settings(.*)",
    "/api/fluxy/config(.*)",
    "/api/gdpr(.*)",
  ];
  const pages = PUBLIC_SITE_PATH_PREFIXES.flatMap((prefix) => [prefix, `${prefix}/(.*)`]);
  return [...extra, ...pages];
}
