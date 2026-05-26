import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { CONSOLE_ACK_COOKIE, getDashboardAccessMode } from "@/lib/dashboard-access";
import { isClerkEnabled } from "@/lib/clerk-config";

const isClerkPublicRoute = createRouteMatcher([
  "/landing(.*)",
  "/why(.*)",
  "/enter(.*)",
  "/get-started(.*)",
  "/docs(.*)",
  "/compare(.*)",
  "/demo(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/console-ack(.*)",
  "/api/webhooks/clerk(.*)",
  /** Worker JWT in Authorization header — not Clerk session cookies */
  "/api/fluxy/search-messages(.*)",
  "/api/fluxy/config(.*)",
  /** Worker JWT in Authorization — not Clerk session cookies */
  "/api/gdpr(.*)",
]);

function isPublicPath(pathname: string): boolean {
  if (pathname === "/favicon.ico") return true;
  const prefixes = [
    "/landing",
    "/why",
    "/enter",
    "/get-started",
    "/docs",
    "/compare",
    "/demo",
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

function applyDashboardSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-Frame-Options", "DENY");

  if (process.env.DASHBOARD_CSP_ENABLED === "true") {
    const workerConnect = (
      process.env.NEXT_PUBLIC_FLUXYCHAT_WORKER_URL ||
      process.env.NEXT_PUBLIC_FLUXYCHAT_CLOUD_URL ||
      ""
    ).trim();
    const clerkHosts = "https://*.clerk.accounts.dev https://*.clerk.com";
    const connectSrc = ["'self'", workerConnect, clerkHosts]
      .filter(Boolean)
      .join(" ");
    response.headers.set(
      "Content-Security-Policy",
      [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https:",
        "font-src 'self' data:",
        `connect-src ${connectSrc}`,
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join("; ")
    );
  }
  return response;
}

function handleConsoleAck(request: NextRequest): NextResponse {
  if (getDashboardAccessMode() !== "ack") {
    return applyDashboardSecurityHeaders(NextResponse.next());
  }

  const { pathname } = request.nextUrl;
  if (isPublicPath(pathname) || isStaticAsset(pathname)) {
    return applyDashboardSecurityHeaders(NextResponse.next());
  }

  const ack = request.cookies.get(CONSOLE_ACK_COOKIE)?.value === "1";
  if (ack) {
    return applyDashboardSecurityHeaders(NextResponse.next());
  }

  const next = `${pathname}${request.nextUrl.search || ""}`;
  const url = request.nextUrl.clone();
  url.pathname = "/enter";
  url.searchParams.set("next", next || "/");
  return applyDashboardSecurityHeaders(NextResponse.redirect(url));
}

export default isClerkEnabled()
  ? clerkMiddleware(async (auth, request) => {
      if (!isClerkPublicRoute(request)) {
        await auth.protect();
      }
      return handleConsoleAck(request);
    })
  : function middleware(request: NextRequest) {
      return handleConsoleAck(request);
    };

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
  ],
};
