import { afterEach, describe, expect, it, vi } from "vitest";
import { rejectUnauthorizedProxyRequest } from "./api-guard";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  clerkEnabled: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/lib/clerk-config", () => ({ isClerkEnabled: mocks.clerkEnabled }));

function req(headers: Record<string, string> = {}) {
  return new Request("https://console.example.com/api/fluxy/search-messages?q=a", {
    headers,
  });
}

describe("rejectUnauthorizedProxyRequest (#34)", () => {
  afterEach(() => {
    mocks.auth.mockReset();
    mocks.clerkEnabled.mockReset();
  });

  it("allows same-origin requests without a session when Clerk is off", async () => {
    mocks.clerkEnabled.mockReturnValue(false);
    expect(await rejectUnauthorizedProxyRequest(req())).toBeNull();
    expect(
      await rejectUnauthorizedProxyRequest(req({ origin: "https://console.example.com" })),
    ).toBeNull();
  });

  it("rejects cross-origin requests", async () => {
    mocks.clerkEnabled.mockReturnValue(false);
    const res = await rejectUnauthorizedProxyRequest(req({ origin: "https://evil.example" }));
    expect(res?.status).toBe(403);
  });

  it("requires a live Clerk session when Clerk is enabled", async () => {
    mocks.clerkEnabled.mockReturnValue(true);

    mocks.auth.mockResolvedValue({ userId: null });
    const denied = await rejectUnauthorizedProxyRequest(req());
    expect(denied?.status).toBe(401);

    mocks.auth.mockResolvedValue({ userId: "user_1" });
    expect(await rejectUnauthorizedProxyRequest(req())).toBeNull();
  });
});
