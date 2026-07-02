import { describe, expect, it, vi } from "vitest";

vi.mock("@clerk/nextjs/server", () => ({
  clerkMiddleware: vi.fn(),
  createRouteMatcher: vi.fn(() => () => false),
}));

vi.mock("next/server", () => ({
  NextResponse: {
    next: vi.fn(() => ({ headers: new Headers() })),
    redirect: vi.fn(() => ({ headers: new Headers() })),
  },
}));

vi.mock("@/lib/dashboard-access", () => ({
  CONSOLE_ACK_COOKIE: "ack",
  getDashboardAccessMode: vi.fn(() => "public"),
}));

vi.mock("@/lib/clerk-config", () => ({
  isClerkEnabled: vi.fn(() => false),
}));

import { buildContentSecurityPolicy } from "./proxy";

describe("buildContentSecurityPolicy", () => {
  it("uses nonce in script-src and style-src when a nonce is provided", () => {
    const nonce = "test-nonce-abc123";
    const csp = buildContentSecurityPolicy(nonce);

    expect(csp).toContain(`script-src 'self' https://*.clerk.accounts.dev https://*.clerk.com 'nonce-${nonce}'`);
    expect(csp).toContain(`style-src 'self' 'nonce-${nonce}' https://*.clerk.accounts.dev https://*.clerk.com https://cdn.jsdelivr.net`);
    expect(csp).not.toContain("'unsafe-inline'");
  });

  it("omits nonce and keeps unsafe-inline when no nonce is provided", () => {
    const csp = buildContentSecurityPolicy();

    expect(csp).toContain("'unsafe-inline'");
    expect(csp).not.toContain("nonce-");
  });
});
