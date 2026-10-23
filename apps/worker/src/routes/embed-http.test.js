/**
 * Audit F-81: the embed frame is framed cross-origin by the customer page —
 * CSP frame-ancestors carries the allowlist instead of X-Frame-Options.
 */
import { describe, expect, it, vi } from "vitest";
import { createAuthMatrixDeps } from "./auth-matrix-deps.js";
import { dispatchEmbedRoutes } from "./embed-http.js";
import { getEffectiveEmbedOrigins } from "../lib/embed-config.js";

vi.mock("../lib/embed-config.js", () => ({
  isEmbedWidgetGloballyEnabled: vi.fn(async () => true),
  isEmbedWidgetGloballyEnabledSync: vi.fn(() => true),
  getEmbedConfigForProject: vi.fn(async () => ({
    enabled: true,
    theme: { primaryColor: "#111827", position: "bottom-right" },
    launcherTitle: "Chat",
  })),
  getEffectiveEmbedOrigins: vi.fn(async () => []),
  getPublicEmbedConfig: vi.fn(async () => ({})),
  getAdminEmbedConfig: vi.fn(async () => ({})),
  upsertEmbedConfig: vi.fn(async () => ({})),
}));

function deps(envOverrides = {}) {
  return createAuthMatrixDeps({
    extra: { projectId: "p1", env: { NODE_ENV: "production", ...envOverrides } },
  });
}

async function fetchFrame(nodeEnv = "production") {
  const req = new Request("http://127.0.0.1:8787/embed/frame");
  return dispatchEmbedRoutes(req, new URL(req.url), deps({ NODE_ENV: nodeEnv }));
}

describe("GET /embed/frame framing headers (audit F-81)", () => {
  it("allows the configured origins via frame-ancestors", async () => {
    vi.mocked(getEffectiveEmbedOrigins).mockResolvedValue(["https://acme.test"]);
    const res = await fetchFrame();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-security-policy")).toBe(
      "frame-ancestors https://acme.test",
    );
    expect(res.headers.get("x-frame-options")).toBeNull();
  });

  it("denies framing in production when no origin is configured", async () => {
    vi.mocked(getEffectiveEmbedOrigins).mockResolvedValue([]);
    const res = await fetchFrame();
    expect(res.headers.get("content-security-policy")).toBe("frame-ancestors 'none'");
  });

  it("keeps local development usable", async () => {
    vi.mocked(getEffectiveEmbedOrigins).mockResolvedValue([]);
    const res = await fetchFrame("development");
    expect(res.headers.get("content-security-policy")).toBe("frame-ancestors *");
  });
});
