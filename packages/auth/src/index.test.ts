import { describe, expect, it, vi } from "vitest";
import {
  clerkUserIdFromAuth,
  createAuthJsFluxyTokenRoute,
  createBetterAuthFluxyTokenRoute,
  createClerkFluxyTokenRoute,
  createOidcFluxyTokenRoute,
  createSupabaseFluxyTokenRoute,
  userIdFromAuthJsSession,
  userIdFromBetterAuthSession,
  userIdFromOidcSub,
  userIdFromSupabaseGetUser,
} from "./index.js";

describe("@fluxy-chat/auth", () => {
  it("reads Clerk and Auth.js session shapes", () => {
    expect(clerkUserIdFromAuth({ userId: "user_1" })).toBe("user_1");
    expect(clerkUserIdFromAuth({ userId: null })).toBeNull();
    expect(userIdFromAuthJsSession({ user: { id: "u2" } })).toBe("u2");
    expect(userIdFromBetterAuthSession({ user: { id: "u3" } })).toBe("u3");
    expect(typeof createBetterAuthFluxyTokenRoute).toBe("function");
    expect(userIdFromAuthJsSession(null)).toBeNull();
    expect(userIdFromSupabaseGetUser({ data: { user: { id: "sb_1" } } })).toBe("sb_1");
    expect(userIdFromOidcSub({ user: { sub: "auth0|1" } })).toBe("auth0_1");
  });

  it("mints via Clerk getUserId", async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ token: "jwt" }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const POST = createClerkFluxyTokenRoute({
      workerUrl: "https://worker.example",
      apiKey: "fc_test",
      auth: async () => ({ userId: "clerk_1" }),
    });
    const res = await POST(new Request("https://app.example/api/fluxy/token", { method: "POST" }));
    expect(res.status).toBe(200);
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(init.body))).toMatchObject({ userId: "clerk_1" });
    vi.unstubAllGlobals();
  });

  it("401s Auth.js without a user id", async () => {
    const POST = createAuthJsFluxyTokenRoute({
      workerUrl: "https://worker.example",
      apiKey: "fc_test",
      auth: async () => ({ user: {} }),
    });
    const res = await POST(new Request("https://app.example/api/fluxy/token", { method: "POST" }));
    expect(res.status).toBe(401);
  });

  it("mints via Supabase getUser", async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ token: "jwt" }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const POST = createSupabaseFluxyTokenRoute({
      workerUrl: "https://worker.example",
      apiKey: "fc_test",
      getUser: async () => ({ data: { user: { id: "sb_9" } } }),
    });
    const res = await POST(new Request("https://app.example/api/fluxy/token", { method: "POST" }));
    expect(res.status).toBe(200);
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(init.body))).toMatchObject({ userId: "sb_9" });
    vi.unstubAllGlobals();
  });

  it("mints via OIDC sub", async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ token: "jwt" }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const POST = createOidcFluxyTokenRoute({
      workerUrl: "https://worker.example",
      apiKey: "fc_test",
      auth: async () => ({ user: { sub: "oidc_1" } }),
    });
    const res = await POST(new Request("https://app.example/api/fluxy/token", { method: "POST" }));
    expect(res.status).toBe(200);
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(init.body))).toMatchObject({ userId: "oidc_1" });
    vi.unstubAllGlobals();
  });
});
