import { afterEach, describe, expect, it, vi } from "vitest";
import { createMemoryOpsStore } from "./ops-store.js";
import { registerMcpServer } from "./ops-mcp.js";
import { startMcpConnect } from "./ops-mcp-oauth.js";
import { handleMcpOauthCallback } from "./ops-mcp-oauth-http.js";

const KEY = btoa("0123456789abcdef0123456789abcdef");
const URL_OK = "https://mcp.example.com/mcp";

function env(store) {
  return {
    OPS_STORE: store,
    WEBHOOK_SECRET_ENCRYPTION_KEY: KEY,
    ALLOWED_SSRF_HOSTS: "mcp.example.com, auth.example.com",
    RATE_LIMIT_FALLBACK_ALLOW: "true",
  };
}

function json(body, init = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status || 200,
    headers: { "content-type": "application/json" },
  });
}

/** Pre-discovered server: the callback test only needs the token endpoint. */
async function connectedSetup(store) {
  const registered = await registerMcpServer(store, env(store), {
    projectId: "p1",
    input: {
      name: "grafana",
      url: URL_OK,
      auth: "oauth",
      oauthAuthorizeUrl: "https://auth.example.com/authorize",
      oauthTokenUrl: "https://auth.example.com/token",
      oauthClientId: "manual",
    },
  });
  await store.upsertMcpServer("p1", {
    ...(await store.getMcpServer("p1", registered.server.id)),
    discoveredTools: ["query"],
  });
  const started = await startMcpConnect(store, env(store), {
    projectId: "p1",
    serverId: registered.server.id,
    userId: "u1",
    origin: "https://api.example",
  });
  return new URL(started.authorizationUrl).searchParams.get("state");
}

function callback(url, accept = "application/json") {
  return {
    request: new Request(url, { headers: { accept } }),
    url: new URL(url),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("handleMcpOauthCallback", () => {
  it("refuses an unknown state without touching the provider", async () => {
    const store = createMemoryOpsStore();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { request, url } = callback("https://api.example/public/ops/mcp/oauth/callback?state=nope&code=c1");

    const res = await handleMcpOauthCallback(request, url, env(store), json, {});
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ ok: false, error: "invalid_state" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("exchanges the code and renders the connected page", async () => {
    const store = createMemoryOpsStore();
    const fetchMock = vi.fn(async (url) => {
      if (String(url) === "https://auth.example.com/token") {
        return json({ access_token: "at-http", refresh_token: "rt-http", expires_in: 3600, token_type: "Bearer" });
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const state = await connectedSetup(store);
    const { request, url } = callback(
      `https://api.example/public/ops/mcp/oauth/callback?state=${encodeURIComponent(state)}&code=code-1`,
      "text/html",
    );
    const res = await handleMcpOauthCallback(request, url, env(store), json, {});
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(await res.text()).toContain("Account connected");

    const connection = await store.listMcpConnections("p1", { userId: "u1" });
    expect(connection).toHaveLength(1);
    expect(connection[0].status).toBe("active");
  });

  it("renders the failure page for an expired state", async () => {
    const store = createMemoryOpsStore();
    vi.stubGlobal("fetch", vi.fn());
    const { request, url } = callback(
      "https://api.example/public/ops/mcp/oauth/callback?state=stale&code=c1",
      "text/html",
    );
    const res = await handleMcpOauthCallback(request, url, env(store), json, {});
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("invalid or was already used");
  });
});
