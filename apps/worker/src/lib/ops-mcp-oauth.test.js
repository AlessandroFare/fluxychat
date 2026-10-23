import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createMemoryOpsStore } from "./ops-store.js";
import { decryptSecret, encryptSecret } from "./secrets-crypto.js";
import { callMcpTool, registerMcpServer } from "./ops-mcp.js";
import { completeMcpConnect, resolveMcpAccessToken, sha256Base64Url, startMcpConnect } from "./ops-mcp-oauth.js";
import { ID_JAG_TOKEN_TYPE, ID_JAG_TYP } from "./ops-mcp-enterprise.js";

const KEY = btoa("0123456789abcdef0123456789abcdef");
const ENV = {
  WEBHOOK_SECRET_ENCRYPTION_KEY: KEY,
  ALLOWED_SSRF_HOSTS: "mcp.example.com, auth.example.com",
  RATE_LIMIT_FALLBACK_ALLOW: "true",
};
const URL_OK = "https://mcp.example.com/mcp";
const TOKEN_URL = "https://auth.example.com/token";
const REDIRECT = "https://app.example/public/ops/mcp/oauth/callback";

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function oauthStub({
  metadata = true,
  token = { access_token: "at-1", refresh_token: "rt-1", expires_in: 3600, token_type: "Bearer", scope: "tools.read" },
  tokenStatus = 200,
  tools = [{ name: "query", description: "run a query" }],
} = {}) {
  const seen = [];
  const impl = vi.fn(async (url, init = {}) => {
    const href = String(url);
    seen.push({ url: href, method: init.method || "GET", headers: init.headers || {}, body: init.body });
    if (href.includes("/.well-known/oauth-protected-resource")) {
      if (!metadata) return new Response("not found", { status: 404 });
      return json({ resource: URL_OK, authorization_servers: ["https://auth.example.com"] });
    }
    if (href === "https://auth.example.com/.well-known/oauth-authorization-server") {
      if (!metadata) return new Response("not found", { status: 404 });
      return json({
        issuer: "https://auth.example.com",
        authorization_endpoint: "https://auth.example.com/authorize",
        token_endpoint: TOKEN_URL,
        registration_endpoint: "https://auth.example.com/register",
      });
    }
    if (href.includes("/.well-known/openid-configuration")) return new Response("not found", { status: 404 });
    if (href === "https://auth.example.com/register") return json({ client_id: "dcr-client", client_secret: "dcr-secret" });
    if (href === TOKEN_URL) {
      if (tokenStatus !== 200) return json({ error: "invalid_grant", error_description: "refresh token expired" }, tokenStatus);
      return json(token);
    }
    if (href === URL_OK) {
      const body = JSON.parse(init.body);
      if (body.method === "server/discover") return json({ jsonrpc: "2.0", id: body.id, error: { code: -32601, message: "method not found" } });
      if (body.method === "initialize") return json({ jsonrpc: "2.0", id: body.id, result: { serverInfo: { name: "mock" } } });
      if (body.method === "notifications/initialized") return new Response(null, { status: 202 });
      if (body.method === "tools/list") return json({ jsonrpc: "2.0", id: body.id, result: { tools } });
      if (body.method === "tools/call") return json({ jsonrpc: "2.0", id: body.id, result: { content: [{ type: "text", text: "done" }] } });
    }
    throw new Error(`unexpected fetch ${href}`);
  });
  impl.seen = seen;
  return impl;
}

async function oauthServer(store, input = {}) {
  const registered = await registerMcpServer(store, ENV, {
    projectId: "p1",
    input: {
      name: "grafana",
      url: URL_OK,
      auth: "oauth",
      oauthAuthorizeUrl: "https://auth.example.com/authorize",
      oauthTokenUrl: TOKEN_URL,
      oauthClientId: "manual",
      ...input,
    },
  });
  return registered.server;
}

const ENTERPRISE_ENV = {
  ...ENV,
  ALLOWED_SSRF_HOSTS: "mcp.example.com, auth.example.com, idp.example.com",
};
const IDP_TOKEN_URL = "https://idp.example.com/token";
const IDP_JWKS_URL = "https://idp.example.com/jwks";
const ENTERPRISE_AUDIENCE = "https://auth.example.com/";
const AS_CLIENT = "as-client";

let jagKeys;

beforeAll(async () => {
  const pair = await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"],
  );
  jagKeys = {
    privateKey: pair.privateKey,
    jwk: { ...(await crypto.subtle.exportKey("jwk", pair.publicKey)), kid: "k1", alg: "RS256" },
  };
});

async function signIdJag({ resource = URL_OK, audience = ENTERPRISE_AUDIENCE, overrides = {} } = {}) {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ typ: ID_JAG_TYP, alg: "RS256", kid: "k1" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      iss: "https://idp.example.com",
      sub: "U123",
      aud: audience,
      client_id: AS_CLIENT,
      jti: crypto.randomUUID(),
      exp: nowSeconds + 300,
      iat: nowSeconds - 5,
      resource,
      scope: "tools.read",
      ...overrides,
    }),
  ).toString("base64url");
  const data = `${header}.${payload}`;
  const signature = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    jagKeys.privateKey,
    new TextEncoder().encode(data),
  );
  return `${data}.${Buffer.from(new Uint8Array(signature)).toString("base64url")}`;
}

/** Two-leg IdP mocks: code + token exchange + JWKS at the IdP, jwt-bearer at the AS. */
function enterpriseStub({ resource = URL_OK, accessTokens = ["as-at-1", "as-at-2"], rotateRefreshToken = null } = {}) {
  const seen = { code: [], exchange: [], as: [], jwks: 0, mcpAuthorization: [] };
  let accessIndex = 0;
  const impl = vi.fn(async (url, init = {}) => {
    const href = String(url);
    if (href === IDP_TOKEN_URL) {
      const body = new URLSearchParams(init.body);
      const grant = body.get("grant_type");
      if (grant === "authorization_code") {
        seen.code.push(body);
        return json({
          id_token: "id-token-1",
          refresh_token: "idp-rt-1",
          token_type: "Bearer",
          scope: "openid offline_access",
        });
      }
      if (grant === "urn:ietf:params:oauth:grant-type:token-exchange") {
        seen.exchange.push(body);
        const rotates =
          rotateRefreshToken && body.get("subject_token_type") === "urn:ietf:params:oauth:token-type:refresh_token";
        return json({
          issued_token_type: ID_JAG_TOKEN_TYPE,
          access_token: await signIdJag({ resource }),
          scope: "tools.read",
          expires_in: 300,
          ...(rotates ? { refresh_token: rotateRefreshToken } : {}),
        });
      }
      throw new Error(`unexpected idp grant ${grant}`);
    }
    if (href === IDP_JWKS_URL) {
      seen.jwks += 1;
      return json({ keys: [jagKeys.jwk] });
    }
    if (href === TOKEN_URL) {
      const body = new URLSearchParams(init.body);
      seen.as.push(body);
      if (body.get("grant_type") !== "urn:ietf:params:oauth:grant-type:jwt-bearer") {
        throw new Error(`unexpected AS grant ${body.get("grant_type")}`);
      }
      return json({
        access_token: accessTokens[Math.min(accessIndex++, accessTokens.length - 1)],
        token_type: "Bearer",
        expires_in: 3600,
        scope: "tools.read",
      });
    }
    if (href === URL_OK) {
      seen.mcpAuthorization.push(init.headers?.authorization || null);
      const body = JSON.parse(init.body);
      if (body.method === "server/discover") return json({ jsonrpc: "2.0", id: body.id, error: { code: -32601, message: "method not found" } });
      if (body.method === "initialize") return json({ jsonrpc: "2.0", id: body.id, result: { serverInfo: { name: "mock" } } });
      if (body.method === "notifications/initialized") return new Response(null, { status: 202 });
      if (body.method === "tools/list") return json({ jsonrpc: "2.0", id: body.id, result: { tools: [{ name: "query", description: "run a query" }] } });
      if (body.method === "tools/call") return json({ jsonrpc: "2.0", id: body.id, result: { content: [{ type: "text", text: "done" }] } });
    }
    throw new Error(`unexpected fetch ${href}`);
  });
  impl.seen = seen;
  return impl;
}

async function enterpriseServer(store, input = {}) {
  return registerMcpServer(store, ENTERPRISE_ENV, {
    projectId: "p1",
    input: {
      name: "acme-wiki",
      url: URL_OK,
      auth: "enterprise",
      oauthAuthorizeUrl: "https://idp.example.com/authorize",
      oauthTokenUrl: TOKEN_URL,
      oauthClientId: "idp-client",
      oauthClientSecret: "idp-secret",
      oauthScopes: "tools.read",
      enterpriseIdpTokenUrl: IDP_TOKEN_URL,
      enterpriseIssuer: "https://idp.example.com",
      enterpriseAudience: ENTERPRISE_AUDIENCE,
      enterpriseJwksUrl: IDP_JWKS_URL,
      enterpriseResourceClientId: AS_CLIENT,
      enterpriseResourceClientSecret: "as-secret",
      allowedTools: ["query"],
      ...input,
    },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("startMcpConnect", () => {
  it("discovers metadata, registers a client dynamically and mints a hashed state", async () => {
    const store = createMemoryOpsStore();
    const fetchMock = oauthStub();
    vi.stubGlobal("fetch", fetchMock);

    const registered = await registerMcpServer(store, ENV, {
      projectId: "p1",
      input: { name: "grafana", url: URL_OK, auth: "oauth" },
    });
    expect(registered.ok).toBe(true);
    expect(registered.server.auth).toBe("oauth");
    expect(registered.discovery).toMatchObject({ ok: false, error: "oauth_connection_required" });

    const started = await startMcpConnect(store, ENV, {
      projectId: "p1",
      serverId: registered.server.id,
      userId: "u1",
      origin: "https://app.example",
    });
    expect(started.ok).toBe(true);
    const authUrl = new URL(started.authorizationUrl);
    expect(`${authUrl.origin}${authUrl.pathname}`).toBe("https://auth.example.com/authorize");
    expect(authUrl.searchParams.get("client_id")).toBe("dcr-client");
    expect(authUrl.searchParams.get("code_challenge_method")).toBe("S256");
    expect(authUrl.searchParams.get("redirect_uri")).toBe(REDIRECT);
    expect(authUrl.searchParams.get("resource")).toBe(URL_OK);
    const state = authUrl.searchParams.get("state");
    expect(state).toBeTruthy();

    // Only the hash is stored: the raw state finds nothing.
    expect(await store.takeMcpOauthState(state)).toBeNull();
    const taken = await store.takeMcpOauthState(await sha256Base64Url(state));
    expect(taken.userId).toBe("u1");
    expect(taken.redirectUri).toBe(REDIRECT);
    expect(taken.tokenUrl).toBe(TOKEN_URL);
    const verifier = await decryptSecret(ENV, taken.verifierCiphertext, taken.verifierIv);
    expect(verifier.length).toBeGreaterThan(20);
    expect(JSON.stringify(taken)).not.toContain(verifier);

    // The dynamic registration is persisted with the encrypted client secret.
    const row = await store.getMcpServerByName("p1", "grafana");
    expect(row.oauthClientId).toBe("dcr-client");
    expect(await decryptSecret(ENV, row.oauthClientSecretCiphertext, row.oauthClientSecretIv)).toBe("dcr-secret");
  });

  it("uses registry overrides without touching metadata", async () => {
    const store = createMemoryOpsStore();
    const fetchMock = oauthStub({ metadata: false });
    vi.stubGlobal("fetch", fetchMock);

    const server = await oauthServer(store, { name: "selfhost", oauthScopes: "read write" });
    const started = await startMcpConnect(store, ENV, {
      projectId: "p1",
      serverId: server.id,
      userId: "u1",
      origin: "https://app.example",
    });
    expect(started.ok).toBe(true);
    const authUrl = new URL(started.authorizationUrl);
    expect(authUrl.searchParams.get("client_id")).toBe("manual");
    expect(authUrl.searchParams.get("scope")).toBe("read write");
    expect(fetchMock.seen).toHaveLength(0);
  });

  it("refuses to mint a connect state without the encryption key", async () => {
    const store = createMemoryOpsStore();
    vi.stubGlobal("fetch", oauthStub({ metadata: false }));
    const server = await oauthServer(store);
    const started = await startMcpConnect(
      store,
      { ALLOWED_SSRF_HOSTS: ENV.ALLOWED_SSRF_HOSTS },
      { projectId: "p1", serverId: server.id, userId: "u1", origin: "https://app.example" },
    );
    expect(started).toEqual({ ok: false, error: "encryption_key_missing" });
  });

  it("rejects non-http authorization endpoints coming from metadata", async () => {
    const store = createMemoryOpsStore();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) => {
        const href = String(url);
        if (href.includes("/.well-known/oauth-protected-resource")) {
          return json({ resource: URL_OK, authorization_servers: ["https://auth.example.com"] });
        }
        if (href === "https://auth.example.com/.well-known/oauth-authorization-server") {
          // Untrusted metadata: a javascript: endpoint must never reach a redirect.
          return json({ authorization_endpoint: "javascript:alert(1)", token_endpoint: TOKEN_URL });
        }
        return new Response("not found", { status: 404 });
      }),
    );
    const registered = await registerMcpServer(store, ENV, { projectId: "p1", input: { name: "evil", url: URL_OK, auth: "oauth" } });
    const started = await startMcpConnect(store, ENV, {
      projectId: "p1",
      serverId: registered.server.id,
      userId: "u1",
      origin: "https://app.example",
    });
    expect(started).toMatchObject({ ok: false, error: "oauth_discovery_failed" });
  });

  it("refuses connect without metadata or overrides, and on non-oauth servers", async () => {
    const store = createMemoryOpsStore();
    vi.stubGlobal("fetch", oauthStub({ metadata: false }));

    const oauth = await registerMcpServer(store, ENV, { projectId: "p1", input: { name: "nometa", url: URL_OK, auth: "oauth" } });
    const failed = await startMcpConnect(store, ENV, {
      projectId: "p1",
      serverId: oauth.server.id,
      userId: "u1",
      origin: "https://app.example",
    });
    expect(failed).toMatchObject({ ok: false, error: "oauth_discovery_failed" });

    const bearer = await registerMcpServer(store, ENV, { projectId: "p1", input: { name: "bearer", url: URL_OK } });
    const wrongMode = await startMcpConnect(store, ENV, {
      projectId: "p1",
      serverId: bearer.server.id,
      userId: "u1",
      origin: "https://app.example",
    });
    expect(wrongMode).toMatchObject({ ok: false, error: "oauth_not_enabled" });
  });
});

describe("completeMcpConnect", () => {
  it("exchanges the code once and stores encrypted tokens", async () => {
    const store = createMemoryOpsStore();
    const fetchMock = oauthStub();
    vi.stubGlobal("fetch", fetchMock);

    const server = await oauthServer(store, {
      oauthClientSecret: "manual-secret",
      allowedTools: ["query"],
    });
    const started = await startMcpConnect(store, ENV, {
      projectId: "p1",
      serverId: server.id,
      userId: "u1",
      origin: "https://app.example",
    });
    const state = new URL(started.authorizationUrl).searchParams.get("state");

    const done = await completeMcpConnect(store, ENV, { state, code: "code-1" });
    expect(done.ok).toBe(true);
    expect(done.serverName).toBe("grafana");

    const tokenCall = fetchMock.seen.find((entry) => entry.url === TOKEN_URL);
    const body = new URLSearchParams(tokenCall.body);
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("code")).toBe("code-1");
    expect(body.get("code_verifier").length).toBeGreaterThan(20);
    expect(body.get("client_secret")).toBe("manual-secret");
    expect(body.get("redirect_uri")).toBe(REDIRECT);
    expect(body.get("resource")).toBe(URL_OK);

    const connection = await store.getMcpConnection("p1", server.id, "u1");
    expect(connection.status).toBe("active");
    expect(connection.scopes).toBe("tools.read");
    expect(await decryptSecret(ENV, connection.accessCiphertext, connection.accessIv)).toBe("at-1");
    expect(await decryptSecret(ENV, connection.refreshCiphertext, connection.refreshIv)).toBe("rt-1");
    expect(JSON.stringify(connection)).not.toContain("at-1");

    // The catalog is discovered with that user's token.
    expect(done.discoveredTools).toEqual(["query"]);
    expect(fetchMock.seen.some((entry) => entry.url === URL_OK && entry.headers.authorization === "Bearer at-1")).toBe(true);

    // Single-use: the same state cannot run twice.
    expect(await completeMcpConnect(store, ENV, { state, code: "code-1" })).toMatchObject({
      ok: false,
      error: "invalid_state",
    });
  });

  it("refuses expired states, upstream errors and missing codes", async () => {
    const store = createMemoryOpsStore();
    const past = new Date(Date.now() - 60000).toISOString();
    const future = new Date(Date.now() + 60000).toISOString();
    const base = {
      projectId: "p1",
      serverId: "srv",
      userId: "u1",
      verifierCiphertext: "ct",
      verifierIv: "iv",
      redirectUri: REDIRECT,
      tokenUrl: TOKEN_URL,
      clientId: "c",
    };
    await store.createMcpOauthState({ ...base, stateHash: await sha256Base64Url("s-old"), expireAt: past });
    expect(await completeMcpConnect(store, ENV, { state: "s-old", code: "c" })).toMatchObject({
      ok: false,
      error: "expired_state",
    });

    await store.createMcpOauthState({ ...base, stateHash: await sha256Base64Url("s-up"), expireAt: future });
    expect(await completeMcpConnect(store, ENV, { state: "s-up", error: "access_denied" })).toMatchObject({
      ok: false,
      error: "upstream_access_denied",
    });

    await store.createMcpOauthState({ ...base, stateHash: await sha256Base64Url("s-nocode"), expireAt: future });
    expect(await completeMcpConnect(store, ENV, { state: "s-nocode" })).toMatchObject({
      ok: false,
      error: "missing_code",
    });

    expect(await completeMcpConnect(store, ENV, { state: "never-issued", code: "c" })).toMatchObject({
      ok: false,
      error: "invalid_state",
    });
  });

  it("keeps the failure and stores nothing when the exchange fails", async () => {
    const store = createMemoryOpsStore();
    const fetchMock = oauthStub({ tokenStatus: 400 });
    vi.stubGlobal("fetch", fetchMock);

    const server = await oauthServer(store);
    const started = await startMcpConnect(store, ENV, {
      projectId: "p1",
      serverId: server.id,
      userId: "u1",
      origin: "https://app.example",
    });
    const state = new URL(started.authorizationUrl).searchParams.get("state");

    const failed = await completeMcpConnect(store, ENV, { state, code: "code-1" });
    expect(failed.ok).toBe(false);
    expect(failed.error).toBe("token_exchange_failed");
    expect(failed.message).toContain("expired");
    expect(await store.getMcpConnection("p1", server.id, "u1")).toBeNull();
  });
});

describe("resolveMcpAccessToken and calls", () => {
  it("denies mcp.call without a connection and uses the actor's token with one", async () => {
    const store = createMemoryOpsStore();
    const fetchMock = oauthStub();
    vi.stubGlobal("fetch", fetchMock);

    const server = await oauthServer(store, { allowedTools: ["query"] });
    await store.upsertMcpServer("p1", { ...(await store.getMcpServer("p1", server.id)), discoveredTools: ["query"] });

    const noActor = await callMcpTool(store, ENV, "p1", { server: "grafana", tool: "query" });
    expect(noActor).toMatchObject({ ok: false, error: "mcp_connection_required" });
    const noConnection = await callMcpTool(store, ENV, "p1", { server: "grafana", tool: "query" }, { actor: "u1" });
    expect(noConnection.error).toBe("mcp_connection_required");
    expect(fetchMock.seen.filter((entry) => entry.url === URL_OK)).toHaveLength(0);

    const encrypted = await encryptSecret(ENV, "at-user1");
    await store.upsertMcpConnection("p1", {
      serverId: server.id,
      userId: "u1",
      accessCiphertext: encrypted.ciphertext,
      accessIv: encrypted.iv,
      tokenUrl: TOKEN_URL,
      clientId: "manual",
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      status: "active",
    });

    const otherUser = await callMcpTool(store, ENV, "p1", { server: "grafana", tool: "query" }, { actor: "u2" });
    expect(otherUser.error).toBe("mcp_connection_required");

    const ok = await callMcpTool(
      store,
      ENV,
      "p1",
      { server: "grafana", tool: "query", arguments: { q: "up" } },
      { actor: "u1" },
    );
    expect(ok.ok).toBe(true);
    const toolCall = fetchMock.seen.filter((entry) => entry.url === URL_OK).pop();
    expect(toolCall.headers.authorization).toBe("Bearer at-user1");
  });

  it("refreshes an expired connection and persists the rotated tokens", async () => {
    const store = createMemoryOpsStore();
    const fetchMock = oauthStub({ token: { access_token: "at-2", refresh_token: "rt-2", expires_in: 3600 } });
    vi.stubGlobal("fetch", fetchMock);

    const server = await oauthServer(store, { oauthClientSecret: "manual-secret" });
    const access = await encryptSecret(ENV, "at-old");
    const refresh = await encryptSecret(ENV, "rt-old");
    await store.upsertMcpConnection("p1", {
      serverId: server.id,
      userId: "u1",
      accessCiphertext: access.ciphertext,
      accessIv: access.iv,
      refreshCiphertext: refresh.ciphertext,
      refreshIv: refresh.iv,
      tokenUrl: TOKEN_URL,
      clientId: "manual",
      expiresAt: new Date(Date.now() - 1000).toISOString(),
      status: "active",
    });

    const resolved = await resolveMcpAccessToken(store, ENV, {
      projectId: "p1",
      server: await store.getMcpServer("p1", server.id),
      userId: "u1",
    });
    expect(resolved).toMatchObject({ ok: true, token: "at-2", refreshed: true });
    const body = new URLSearchParams(fetchMock.seen[0].body);
    expect(body.get("grant_type")).toBe("refresh_token");
    expect(body.get("refresh_token")).toBe("rt-old");
    expect(body.get("client_secret")).toBe("manual-secret");
    expect(body.get("resource")).toBe(URL_OK);

    const connection = await store.getMcpConnection("p1", server.id, "u1");
    expect(await decryptSecret(ENV, connection.accessCiphertext, connection.accessIv)).toBe("at-2");
    expect(await decryptSecret(ENV, connection.refreshCiphertext, connection.refreshIv)).toBe("rt-2");
    expect(connection.status).toBe("active");
    expect(connection.refreshAttempts).toBe(0);
    expect(connection.lastRefreshFailure).toBeNull();
  });

  it("marks the connection expired when the refresh is refused", async () => {
    const store = createMemoryOpsStore();
    vi.stubGlobal("fetch", oauthStub({ tokenStatus: 400 }));

    const server = await oauthServer(store);
    const access = await encryptSecret(ENV, "at-old");
    const refresh = await encryptSecret(ENV, "rt-old");
    await store.upsertMcpConnection("p1", {
      serverId: server.id,
      userId: "u1",
      accessCiphertext: access.ciphertext,
      accessIv: access.iv,
      refreshCiphertext: refresh.ciphertext,
      refreshIv: refresh.iv,
      tokenUrl: TOKEN_URL,
      clientId: "manual",
      expiresAt: new Date(Date.now() - 1000).toISOString(),
      status: "active",
    });

    const resolved = await resolveMcpAccessToken(store, ENV, {
      projectId: "p1",
      server: await store.getMcpServer("p1", server.id),
      userId: "u1",
    });
    expect(resolved).toMatchObject({ ok: false, error: "mcp_connection_expired" });
    expect((await store.getMcpConnection("p1", server.id, "u1")).status).toBe("expired");
  });

  it("keeps a connection alive when the refresh fails transiently", async () => {
    const store = createMemoryOpsStore();
    const fetchMock = oauthStub({ tokenStatus: 503 });
    vi.stubGlobal("fetch", fetchMock);

    const server = await oauthServer(store);
    const access = await encryptSecret(ENV, "at-old");
    const refresh = await encryptSecret(ENV, "rt-old");
    await store.upsertMcpConnection("p1", {
      serverId: server.id,
      userId: "u1",
      accessCiphertext: access.ciphertext,
      accessIv: access.iv,
      refreshCiphertext: refresh.ciphertext,
      refreshIv: refresh.iv,
      tokenUrl: TOKEN_URL,
      clientId: "manual",
      expiresAt: new Date(Date.now() - 1000).toISOString(),
      status: "active",
    });

    const resolved = await resolveMcpAccessToken(store, ENV, {
      projectId: "p1",
      server: await store.getMcpServer("p1", server.id),
      userId: "u1",
    });
    expect(resolved).toMatchObject({ ok: false, error: "mcp_connection_refresh_failed", retryable: true });
    const connection = await store.getMcpConnection("p1", server.id, "u1");
    expect(connection.status).toBe("active");
    expect(connection.refreshAttempts).toBe(1);
    expect(Date.parse(connection.lastRefreshFailure)).toBeGreaterThan(0);

    // Inside the cooldown the AS is not contacted again.
    const before = fetchMock.seen.length;
    const again = await resolveMcpAccessToken(store, ENV, {
      projectId: "p1",
      server: await store.getMcpServer("p1", server.id),
      userId: "u1",
    });
    expect(again).toMatchObject({ ok: false, error: "mcp_connection_refresh_backoff" });
    expect(fetchMock.seen.length).toBe(before);
  });

  it("requires a reconnect after four counted failure days", async () => {
    const store = createMemoryOpsStore();
    vi.stubGlobal("fetch", oauthStub({ tokenStatus: 503 }));

    const server = await oauthServer(store);
    const access = await encryptSecret(ENV, "at-old");
    const refresh = await encryptSecret(ENV, "rt-old");
    await store.upsertMcpConnection("p1", {
      serverId: server.id,
      userId: "u1",
      accessCiphertext: access.ciphertext,
      accessIv: access.iv,
      refreshCiphertext: refresh.ciphertext,
      refreshIv: refresh.iv,
      tokenUrl: TOKEN_URL,
      clientId: "manual",
      expiresAt: new Date(Date.now() - 1000).toISOString(),
      status: "active",
      // Day 4 of the outage: three counted days behind, cooldown long past.
      refreshAttempts: 3,
      lastRefreshFailure: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
    });

    const resolved = await resolveMcpAccessToken(store, ENV, {
      projectId: "p1",
      server: await store.getMcpServer("p1", server.id),
      userId: "u1",
    });
    expect(resolved).toMatchObject({ ok: false, error: "mcp_connection_expired" });
    expect(String(resolved.reason)).toContain("refresh_exhausted");
    expect((await store.getMcpConnection("p1", server.id, "u1")).status).toBe("expired");
  });

  it("treats a connection without a refresh token as expired", async () => {
    const store = createMemoryOpsStore();
    vi.stubGlobal("fetch", oauthStub());
    const server = await oauthServer(store);
    const access = await encryptSecret(ENV, "at-old");
    await store.upsertMcpConnection("p1", {
      serverId: server.id,
      userId: "u1",
      accessCiphertext: access.ciphertext,
      accessIv: access.iv,
      tokenUrl: TOKEN_URL,
      clientId: "manual",
      expiresAt: new Date(Date.now() - 1000).toISOString(),
      status: "active",
    });

    const resolved = await resolveMcpAccessToken(store, ENV, {
      projectId: "p1",
      server: await store.getMcpServer("p1", server.id),
      userId: "u1",
    });
    expect(resolved).toMatchObject({ ok: false, error: "mcp_connection_expired", reason: "no_refresh_token" });
  });
});

describe("enterprise (EMA / ID-JAG) connections", () => {
  it("registers only with the full ID-JAG config and never returns the client secret", async () => {
    const store = createMemoryOpsStore();
    const incomplete = await registerMcpServer(store, ENTERPRISE_ENV, {
      projectId: "p1",
      input: { name: "acme-wiki", url: URL_OK, auth: "enterprise" },
    });
    expect(incomplete).toMatchObject({ ok: false, error: "enterprise_config_incomplete" });
    expect(incomplete.missing).toContain("enterpriseJwksUrl");
    expect(await store.getMcpServerByName("p1", "acme-wiki")).toBeNull();

    const registered = await enterpriseServer(store);
    expect(registered.ok).toBe(true);
    expect(registered.discovery.error).toBe("oauth_connection_required");
    expect(registered.server.auth).toBe("enterprise");
    expect(registered.server.hasEnterpriseResourceClientSecret).toBe(true);
    expect(registered.server).not.toHaveProperty("enterpriseResourceClientSecretCiphertext");
    expect(registered.server.enterpriseAudience).toBe(ENTERPRISE_AUDIENCE);
  });

  it("signs in at the IdP, validates the ID-JAG and stores the Resource AS token", async () => {
    const store = createMemoryOpsStore();
    const fetchMock = enterpriseStub();
    vi.stubGlobal("fetch", fetchMock);
    const registered = await enterpriseServer(store);
    const server = registered.server;

    const started = await startMcpConnect(store, ENTERPRISE_ENV, {
      projectId: "p1",
      serverId: server.id,
      userId: "u1",
      origin: "https://app.example",
    });
    expect(started.ok).toBe(true);
    const authUrl = new URL(started.authorizationUrl);
    expect(`${authUrl.origin}${authUrl.pathname}`).toBe("https://idp.example.com/authorize");
    expect(authUrl.searchParams.get("client_id")).toBe("idp-client");
    expect(authUrl.searchParams.get("scope")).toBe("openid offline_access");
    expect(authUrl.searchParams.get("resource")).toBeNull();
    expect(authUrl.searchParams.get("code_challenge_method")).toBe("S256");

    const done = await completeMcpConnect(store, ENTERPRISE_ENV, {
      state: authUrl.searchParams.get("state"),
      code: "code-1",
    });
    expect(done).toMatchObject({
      ok: true,
      serverName: "acme-wiki",
      scopes: "tools.read",
      discoveredTools: ["query"],
    });

    // Leg 0: the code is exchanged at the IdP with PKCE and client auth.
    expect(fetchMock.seen.code).toHaveLength(1);
    expect(fetchMock.seen.code[0].get("code")).toBe("code-1");
    expect(fetchMock.seen.code[0].get("client_id")).toBe("idp-client");
    expect(fetchMock.seen.code[0].get("client_secret")).toBe("idp-secret");
    expect(fetchMock.seen.code[0].get("code_verifier")).toBeTruthy();

    // Leg 1: ID token -> ID-JAG, with the AS issuer as audience and resource.
    expect(fetchMock.seen.exchange).toHaveLength(1);
    const exchange = fetchMock.seen.exchange[0];
    expect(exchange.get("grant_type")).toBe("urn:ietf:params:oauth:grant-type:token-exchange");
    expect(exchange.get("requested_token_type")).toBe(ID_JAG_TOKEN_TYPE);
    expect(exchange.get("subject_token")).toBe("id-token-1");
    expect(exchange.get("subject_token_type")).toBe("urn:ietf:params:oauth:token-type:id_token");
    expect(exchange.get("audience")).toBe(ENTERPRISE_AUDIENCE);
    expect(exchange.get("resource")).toBe(URL_OK);
    expect(exchange.get("scope")).toBe("tools.read");
    expect(exchange.get("client_id")).toBe("idp-client");

    // The ID-JAG is validated against the IdP JWKS before redemption.
    expect(fetchMock.seen.jwks).toBe(1);

    // Leg 2: jwt-bearer at the Resource AS, as the AS-registered client.
    expect(fetchMock.seen.as).toHaveLength(1);
    expect(fetchMock.seen.as[0].get("grant_type")).toBe("urn:ietf:params:oauth:grant-type:jwt-bearer");
    expect(fetchMock.seen.as[0].get("assertion").split(".")).toHaveLength(3);
    expect(fetchMock.seen.as[0].get("client_id")).toBe(AS_CLIENT);
    expect(fetchMock.seen.as[0].get("client_secret")).toBe("as-secret");

    const connection = await store.getMcpConnection("p1", server.id, "u1");
    expect(await decryptSecret(ENTERPRISE_ENV, connection.accessCiphertext, connection.accessIv)).toBe("as-at-1");
    expect(await decryptSecret(ENTERPRISE_ENV, connection.refreshCiphertext, connection.refreshIv)).toBe("idp-rt-1");
    expect(connection.clientId).toBe(AS_CLIENT);
    expect(connection.status).toBe("active");

    // Calls and discovery use the AS token; no user means no connection.
    expect((await store.getMcpServer("p1", server.id)).discoveredTools).toEqual(["query"]);
    expect(fetchMock.seen.mcpAuthorization[0]).toBe("Bearer as-at-1");
    const called = await callMcpTool(
      store,
      ENTERPRISE_ENV,
      "p1",
      { server: "acme-wiki", tool: "query", arguments: { q: "up" } },
      { actor: "u1" },
    );
    expect(called.ok).toBe(true);
    expect(fetchMock.seen.mcpAuthorization.at(-1)).toBe("Bearer as-at-1");
    const anonymous = await callMcpTool(store, ENTERPRISE_ENV, "p1", { server: "acme-wiki", tool: "query" });
    expect(anonymous).toMatchObject({ ok: false, error: "mcp_connection_required" });
  });

  it("renews through the IdP refresh token and keeps a rotated one", async () => {
    const store = createMemoryOpsStore();
    const fetchMock = enterpriseStub({ accessTokens: ["as-at-1", "as-at-2"], rotateRefreshToken: "idp-rt-2" });
    vi.stubGlobal("fetch", fetchMock);
    const server = (await enterpriseServer(store)).server;
    const started = await startMcpConnect(store, ENTERPRISE_ENV, {
      projectId: "p1",
      serverId: server.id,
      userId: "u1",
      origin: "https://app.example",
    });
    await completeMcpConnect(store, ENTERPRISE_ENV, {
      state: new URL(started.authorizationUrl).searchParams.get("state"),
      code: "code-1",
    });

    const current = await store.getMcpConnection("p1", server.id, "u1");
    await store.upsertMcpConnection("p1", { ...current, expiresAt: new Date(Date.now() - 1000).toISOString() });

    const resolved = await resolveMcpAccessToken(store, ENTERPRISE_ENV, {
      projectId: "p1",
      server: await store.getMcpServer("p1", server.id),
      userId: "u1",
    });
    expect(resolved).toMatchObject({ ok: true, token: "as-at-2", refreshed: true });

    const renewal = fetchMock.seen.exchange.at(-1);
    expect(renewal.get("subject_token")).toBe("idp-rt-1");
    expect(renewal.get("subject_token_type")).toBe("urn:ietf:params:oauth:token-type:refresh_token");
    const updated = await store.getMcpConnection("p1", server.id, "u1");
    expect(await decryptSecret(ENTERPRISE_ENV, updated.accessCiphertext, updated.accessIv)).toBe("as-at-2");
    expect(await decryptSecret(ENTERPRISE_ENV, updated.refreshCiphertext, updated.refreshIv)).toBe("idp-rt-2");
    expect(updated.status).toBe("active");
  });

  it("never redeems an ID-JAG that fails validation, and stores no connection", async () => {
    const store = createMemoryOpsStore();
    const fetchMock = enterpriseStub({ resource: "https://mcp.example.com/other" });
    vi.stubGlobal("fetch", fetchMock);
    const server = (await enterpriseServer(store)).server;
    const started = await startMcpConnect(store, ENTERPRISE_ENV, {
      projectId: "p1",
      serverId: server.id,
      userId: "u1",
      origin: "https://app.example",
    });

    const done = await completeMcpConnect(store, ENTERPRISE_ENV, {
      state: new URL(started.authorizationUrl).searchParams.get("state"),
      code: "code-1",
    });
    expect(done).toMatchObject({ ok: false, error: "id_jag_invalid", reason: "resource" });
    expect(fetchMock.seen.as).toHaveLength(0);
    expect(await store.getMcpConnection("p1", server.id, "u1")).toBeNull();
  });

  it("refuses a state minted for another connection mode", async () => {
    const store = createMemoryOpsStore();
    const fetchMock = enterpriseStub();
    vi.stubGlobal("fetch", fetchMock);
    const server = (await enterpriseServer(store)).server;
    const started = await startMcpConnect(store, ENTERPRISE_ENV, {
      projectId: "p1",
      serverId: server.id,
      userId: "u1",
      origin: "https://app.example",
    });

    const row = await store.getMcpServer("p1", server.id);
    await store.upsertMcpServer("p1", { ...row, auth: "oauth" });
    const done = await completeMcpConnect(store, ENTERPRISE_ENV, {
      state: new URL(started.authorizationUrl).searchParams.get("state"),
      code: "code-1",
    });
    expect(done).toMatchObject({ ok: false, error: "server_mode_changed" });
    expect(fetchMock.seen.code).toHaveLength(0);
  });

  it("refuses to start when part of the enterprise config disappeared", async () => {
    const store = createMemoryOpsStore();
    const server = (await enterpriseServer(store)).server;
    const row = await store.getMcpServer("p1", server.id);
    await store.upsertMcpServer("p1", { ...row, enterpriseJwksUrl: null });

    const started = await startMcpConnect(store, ENTERPRISE_ENV, {
      projectId: "p1",
      serverId: server.id,
      userId: "u1",
      origin: "https://app.example",
    });
    expect(started).toMatchObject({ ok: false, error: "enterprise_config_incomplete" });
    expect(started.missing).toContain("enterpriseJwksUrl");
  });
});
