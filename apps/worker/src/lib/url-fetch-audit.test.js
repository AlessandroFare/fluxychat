import { describe, expect, it, vi } from "vitest";
import { validateUrl } from "./url-fetch-audit.js";

vi.mock("./url-ssrf.js", () => ({
  isPrivateUrl: vi.fn((url) => url.includes("127.0.0.1")),
  assertSafeOutboundUrl: vi.fn((url) => new URL(url)),
  safeOutboundFetch: vi.fn(async () => new Response("ok", { status: 200 })),
}));

describe("url-fetch-audit", () => {
  it("blocks private URLs via validateUrl", () => {
    expect(validateUrl("http://127.0.0.1/admin").ok).toBe(false);
    expect(validateUrl("https://example.com/page").ok).toBe(true);
  });
});
