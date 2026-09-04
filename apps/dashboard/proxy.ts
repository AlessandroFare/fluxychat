import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { CONSOLE_ACK_COOKIE, getDashboardAccessMode } from "@/lib/dashboard-access";
import { isClerkEnabled } from "@/lib/clerk-config";

const isClerkPublicRoute = createRouteMatcher([
  "/",
  "/landing(.*)",
  "/pricing(.*)",
  "/why(.*)",
  "/enter(.*)",
  "/get-started(.*)",
  "/docs(.*)",
  "/compare(.*)",
  "/guides(.*)",
  "/demo(.*)",
  "/cli-auth(.*)",
  "/status(.*)",
  "/subprocessors(.*)",
  "/features(.*)",
  "/.well-known(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/console-ack(.*)",
  "/api/webhooks/clerk(.*)",
  /** Worker JWT in Authorization header — not Clerk session cookies */
  "/api/fluxy/search-messages(.*)",
  "/api/fluxy/search-messages-semantic(.*)",
  "/api/fluxy/search-settings(.*)",
  "/api/fluxy/config(.*)",
  /** Worker JWT in Authorization — not Clerk session cookies */
  "/api/gdpr(.*)",
]);

function isPublicPath(pathname: string): boolean {
  if (pathname === "/favicon.ico") return true;
  if (pathname === "/") return true;
  const prefixes = [
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
    "/.well-known",
    "/api/webhooks",
    "/api",
  ];
  for (const p of prefixes) {
    if (pathname === p || pathname.startsWith(`${p}/`)) return true;
  }
  return false;
}

function isStaticAsset(pathname: string): boolean {
  return (
    pathname.startsWith("/_next") ||
    /\.(?:ico|png|jpg|jpeg|svg|webp|gif|txt|xml|webmanifest)$/i.test(pathname)
  );
}

function isNonceBasedCspEnabled(): boolean {
  return process.env.DASHBOARD_CSP_NONCE === "true";
}

/**
 * Build a CSP header. By default production uses 'unsafe-inline' because the
 * x-nonce header isn't reliably propagated to the RSC streaming runtime on all
 * platforms (Vercel Edge). The nonce is still generated and forwarded via
 * `x-nonce` for when this is fixed.
 *
 * When a nonce is explicitly provided, the CSP switches to a nonce-based
 * policy: `script-src 'nonce-<value>'` and `style-src 'nonce-<value>'` are
 * emitted and 'unsafe-inline' is omitted. Callers that are not ready for
 * strict nonce-based CSP should pass `undefined`.
 */
export function buildContentSecurityPolicy(nonce?: string): string {
  const workerConnect = (
    process.env.NEXT_PUBLIC_FLUXYCHAT_WORKER_URL ||
    process.env.NEXT_PUBLIC_FLUXYCHAT_CLOUD_URL ||
    ""
  ).trim();
  const clerkHosts = "https://*.clerk.accounts.dev https://*.clerk.com";
  const isDev = process.env.NODE_ENV === "development";
  const devWorkerConnect = isDev
    ? "http://localhost:8787 http://127.0.0.1:8787 ws://localhost:8787 ws://127.0.0.1:8787"
    : "";
  const connectSrc = [
    "'self'",
    workerConnect,
    devWorkerConnect,
    clerkHosts,
    "https://clerk-telemetry.com",
    "https://*.algolia.net",
    "https://*.algolianet.com",
    "https://*.algolia.io",
  ]
    .filter(Boolean)
    .join(" ");

  const mediaSrc = ["'self'", "blob:", workerConnect, devWorkerConnect].filter(Boolean).join(" ");

  const useNonce = Boolean(nonce);

  // Next.js uses the per-request nonce on framework scripts. Clerk injects
  // <style> tags without that nonce — do NOT put a nonce on style-src when
  // Clerk styles are present: browsers ignore 'unsafe-inline' once a nonce is
  // present and Clerk UI renders unstyled. Only enable nonce-based style-src
  // when the application propagates the nonce to all inline styles.
  // In dev, keep 'unsafe-eval' for Next.js dev boot / HMR.
  const scriptSrc = useNonce
    ? ["'self'", clerkHosts, isDev ? "'unsafe-eval'" : "", `'nonce-${nonce}'`].filter(Boolean).join(" ")
    : isDev
      ? ["'self'", clerkHosts, "'unsafe-eval'", "'unsafe-inline'"].join(" ")
      : ["'self'", clerkHosts, "'unsafe-inline'"].join(" ");

  const styleSrc = useNonce
    ? ["'self'", `'nonce-${nonce}'`, clerkHosts, "https://cdn.jsdelivr.net"].join(" ")
    : ["'self'", "'unsafe-inline'", clerkHosts, "https://cdn.jsdelivr.net"].join(" ");

  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    `style-src ${styleSrc}`,
    "img-src 'self' data: https: blob:",
    `media-src ${mediaSrc}`,
    `font-src 'self' data: ${clerkHosts}`,
    `connect-src ${connectSrc}`,
    `frame-src 'self' ${clerkHosts}`,
    "worker-src 'self' blob:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self' https://stackblitz.com",
    "object-src 'none'",
  ].join("; ");
}

function applyDashboardSecurityHeaders(request: NextRequest): NextResponse {
  // Generate a fresh per-request nonce. It is forwarded to the React
  // tree via the request headers (RSC reads `headers().get('x-nonce')`)
  // and embedded in the response CSP so any <Script nonce={...}> or
  // inline boot styles are allowed by the browser.
  //
  // Uses Web Crypto (not node:crypto) because middleware runs in the
  // Edge runtime on Cloudflare/Vercel, where node: builtins are not
  // available.
  const nonceBytes = new Uint8Array(16);
  crypto.getRandomValues(nonceBytes);
  const nonce = btoa(String.fromCharCode(...nonceBytes));
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  // Build the downstream response with the mutated request headers.
  // This is the canonical Next.js way to pass per-request data into
  // the RSC render.
  const response = NextResponse.next({ request: { headers: requestHeaders } });

  // Echo the nonce on the response too so client-side code can read
  // it if needed (rare  server components usually pass it down).
  response.headers.set("x-nonce", nonce);

  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-Frame-Options", "DENY");
  // HSTS: 2 years, include subdomains, eligible for the browser preload
  // list. We set this in middleware (not next.config.mjs) so it applies
  // to every response including the per-request CSP'd ones.
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload",
  );

  // CSP is now always-on (was gated on DASHBOARD_CSP_ENABLED). Operators
  // who need to disable it temporarily can set DASHBOARD_CSP_ENABLED=false.
  if (process.env.DASHBOARD_CSP_ENABLED !== "false") {
    response.headers.set(
      "Content-Security-Policy",
      buildContentSecurityPolicy(isNonceBasedCspEnabled() ? nonce : undefined),
    );
  }

  return response;
}

function requiresConsoleAckGate(): boolean {
  if (getDashboardAccessMode() === "ack") return true;
  if (!isClerkEnabled() && process.env.NODE_ENV === "production") return true;
  return false;
}

function handleConsoleAck(request: NextRequest): NextResponse {
  if (!requiresConsoleAckGate()) {
    return applyDashboardSecurityHeaders(request);
  }

  const { pathname } = request.nextUrl;
  if (isPublicPath(pathname) || isStaticAsset(pathname)) {
    return applyDashboardSecurityHeaders(request);
  }

  const ack = request.cookies.get(CONSOLE_ACK_COOKIE)?.value === "1";
  if (ack) {
    return applyDashboardSecurityHeaders(request);
  }

  const next = `${pathname}${request.nextUrl.search || ""}`;
  const url = request.nextUrl.clone();
  url.pathname = "/enter";
  url.searchParams.set("next", next || "/dashboard");
  // For redirects we still need to apply the security headers. Build
  // a redirect response and copy the *static* security headers onto
  // it. The nonce is per-request RSC plumbing and is not relevant for
  // a 302 response.
  const redirectResponse = NextResponse.redirect(url);
  redirectResponse.headers.set("X-Content-Type-Options", "nosniff");
  redirectResponse.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  redirectResponse.headers.set("X-Frame-Options", "DENY");
  redirectResponse.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload",
  );
  if (process.env.DASHBOARD_CSP_ENABLED !== "false") {
    // Generate a fresh nonce here (the redirect response itself is
    // HTML-less so the CSP is informational, but it keeps the
    // contract: every response carries a CSP).
    const redirectNonceBytes = new Uint8Array(16);
    crypto.getRandomValues(redirectNonceBytes);
    const redirectNonce = btoa(String.fromCharCode(...redirectNonceBytes));
    redirectResponse.headers.set(
      "Content-Security-Policy",
      buildContentSecurityPolicy(isNonceBasedCspEnabled() ? redirectNonce : undefined),
    );
  }
  return redirectResponse;
}

export default isClerkEnabled()
  ? clerkMiddleware(async (auth, request) => {
      if (!isClerkPublicRoute(request)) {
        await auth.protect();
      }
      return handleConsoleAck(request);
    })
  : function proxy(request: NextRequest) {
      return handleConsoleAck(request);
    };

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
  ],
};

