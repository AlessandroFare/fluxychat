/**
 * Per-user OAuth passthrough for the ops MCP gateway (MCP 2025-06-18 auth).
 *
 * A server registered with auth='oauth' is called with the access token of the
 * run actor, not a shared secret: the upstream sees the real user and enforces
 * that user's permissions. Discovery follows RFC 9728 (protected resource
 * metadata) then RFC 8414 / OIDC (authorization server metadata); the flow is
 * authorization code + PKCE S256 with a single-use, hashed-at-rest state.
 * Dynamic client registration (RFC 7591) runs when the authorization server
 * offers it and no client_id is configured. Tokens and the PKCE verifier are
 * AES-GCM encrypted with WEBHOOK_SECRET_ENCRYPTION_KEY and never leave the
 * Worker. Admin-configured oauthAuthorizeUrl/oauthTokenUrl skip discovery for
 * servers whose metadata is missing; every endpoint host must be in
 * ALLOWED_SSRF_HOSTS, same rule as the MCP server itself.
 */
import { decryptSecret, encryptSecret } from "./secrets-crypto.js";
import { mcpListTools } from "./ops-mcp-client.js";
import { fetchJson } from "./ops-mcp-fetch.js";
import {
  SUBJECT_ID_TOKEN,
  SUBJECT_REFRESH_TOKEN,
  enterpriseConfigMissing,
  exchangeForIdJag,
  fetchIdpJwks,
  redeemIdJag,
  verifyIdJag,
} from "./ops-mcp-enterprise.js";

const STATE_TTL_MS = 10 * 60 * 1000;
/** Refresh a minute before expiry instead of racing the next call. */
const REFRESH_SKEW_MS = 60 * 1000;
/** A transient refresh failure retries after a quiet period, not in a burst. */
const REFRESH_FAILURE_COOLDOWN_MS = 30 * 1000;
/** One failed refresh per day counts; four counted days and the user reconnects. */
const REFRESH_FAILURE_MAX_DAYS = 4;
const AUTH_REFRESH_ERRORS = new Set(["invalid_grant", "invalid_token", "unauthorized", "access_denied"]);
const MAX_MESSAGE_CHARS = 300;
const MAX_SCOPES_CHARS = 1000;
const STATE_PURGE_AGE_MS = 60 * 60 * 1000;
/** Discovery must not hang a connect; the catalog cap mirrors the registry. */
const DISCOVERY_TIMEOUT_MS = 8000;
const MAX_TOOLS = 200;

function trimSlashes(value) {
  return String(value || "").replace(/\/+$/, "");
}

/** WORKER_PUBLIC_URL wins; otherwise the connect request's own origin is the callback host. */
export function publicOrigin(env, url) {
  const configured = trimSlashes(env?.WORKER_PUBLIC_URL || "");
  if (configured) return configured;
  if (url) return String(url.origin || "");
  return trimSlashes(env?.PUBLIC_APP_URL || "");
}

function base64Url(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomToken(bytes = 32) {
  return base64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function sha256Base64Url(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(value)));
  return base64Url(new Uint8Array(digest));
}

function protectedResourceMetadataUrls(resourceUrl) {
  const url = new URL(resourceUrl);
  const path = url.pathname.replace(/\/+$/, "");
  const urls = [`${url.origin}/.well-known/oauth-protected-resource${path}`];
  if (path && path !== "/") urls.push(`${url.origin}/.well-known/oauth-protected-resource`);
  return urls;
}

function authorizationServerMetadataUrls(issuer) {
  const url = httpUrlOrNull(issuer);
  if (!url) return [];
  const base = trimSlashes(url);
  const path = new URL(base).pathname.replace(/\/+$/, "");
  const urls = [`${base}/.well-known/oauth-authorization-server`, `${base}/.well-known/openid-configuration`];
  if (path && path !== "/") {
    // RFC 8414: with an issuer path, the well-known segment goes before it.
    const origin = new URL(base).origin;
    urls.unshift(`${origin}/.well-known/oauth-authorization-server${path}`);
    urls.push(`${origin}/.well-known/openid-configuration${path}`);
  }
  return [...new Set(urls)];
}

/** Endpoints come from server metadata, so only http(s) may reach a redirect or fetch. */
function httpUrlOrNull(value) {
  try {
    const url = new URL(String(value || "").trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function endpointsFromMetadata(body, issuer) {
  const authorizationEndpoint = httpUrlOrNull(body?.authorization_endpoint);
  const tokenEndpoint = httpUrlOrNull(body?.token_endpoint);
  if (!authorizationEndpoint || !tokenEndpoint) return null;
  return {
    authorizationEndpoint,
    tokenEndpoint,
    registrationEndpoint: httpUrlOrNull(body?.registration_endpoint),
    issuer: body?.issuer ? String(body.issuer) : issuer || null,
  };
}

async function fetchFirstJson(urls, env) {
  for (const url of urls) {
    const fetched = await fetchJson(url, { method: "GET", headers: { accept: "application/json" } }, env);
    if (fetched.ok && fetched.json) return fetched.json;
  }
  return null;
}

/**
 * Resolve the authorization and token endpoints. The registry overrides win;
 * otherwise protected-resource metadata names the authorization server, and the
 * MCP origin itself is the fallback issuer for deployments without PRM.
 */
export async function discoverOAuthEndpoints(env, server) {
  const overrideAuthorize = httpUrlOrNull(server?.oauthAuthorizeUrl);
  const overrideToken = httpUrlOrNull(server?.oauthTokenUrl);
  if (overrideAuthorize && overrideToken) {
    return {
      ok: true,
      authorizationEndpoint: overrideAuthorize,
      tokenEndpoint: overrideToken,
      registrationEndpoint: null,
      source: "registry",
    };
  }

  const mcp = new URL(server.url);
  const candidates = [];
  const prm = await fetchFirstJson(protectedResourceMetadataUrls(server.url), env);
  if (Array.isArray(prm?.authorization_servers)) {
    for (const issuer of prm.authorization_servers) candidates.push(String(issuer));
  }
  candidates.push(mcp.origin);

  for (const issuer of new Set(candidates)) {
    const body = await fetchFirstJson(authorizationServerMetadataUrls(issuer), env);
    if (!body) continue;
    const endpoints = endpointsFromMetadata(body, issuer);
    if (endpoints) return { ok: true, ...endpoints, source: "metadata" };
  }
  return {
    ok: false,
    error: "oauth_discovery_failed",
    message: "No OAuth metadata found. Set oauthAuthorizeUrl and oauthTokenUrl on the server.",
  };
}

async function registerOauthClient(store, env, { server, endpoints, redirectUri }) {
  const fetched = await fetchJson(
    endpoints.registrationEndpoint,
    {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        client_name: "FluxyChat",
        redirect_uris: [redirectUri],
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        token_endpoint_auth_method: "client_secret_post",
      }),
    },
    env,
  );
  const clientId = String(fetched.json?.client_id || "");
  if (!fetched.ok || !clientId) {
    return { ok: false, error: "oauth_registration_failed", message: fetched.error || null };
  }
  const clientSecret = String(fetched.json?.client_secret || "");
  let secretFields = { oauthClientSecretCiphertext: null, oauthClientSecretIv: null };
  if (clientSecret) {
    const encrypted = await encryptSecret(env, clientSecret);
    if (!encrypted) return { ok: false, error: "encryption_key_missing" };
    secretFields = { oauthClientSecretCiphertext: encrypted.ciphertext, oauthClientSecretIv: encrypted.iv };
  }
  // Persist the registration so later connects for this server reuse it.
  await store.upsertMcpServer(server.projectId, { ...server, oauthClientId: clientId, ...secretFields });
  return { ok: true, clientId, clientSecret };
}

async function resolveOauthClient(store, env, { server, endpoints, redirectUri }) {
  if (server.oauthClientId) {
    const clientSecret = server.oauthClientSecretCiphertext
      ? await decryptSecret(env, server.oauthClientSecretCiphertext, server.oauthClientSecretIv)
      : null;
    return { ok: true, clientId: server.oauthClientId, clientSecret };
  }
  if (endpoints.registrationEndpoint) {
    return registerOauthClient(store, env, { server, endpoints, redirectUri });
  }
  return {
    ok: false,
    error: "oauth_client_missing",
    message: "Set oauthClientId (and secret) on the server, or use one with dynamic client registration.",
  };
}

/**
 * Mint a connect attempt: PKCE verifier + single-use state bound to one user and
 * server, with the resolved endpoints stored alongside. Returns the URL the user
 * must open; no token material exists until the callback exchanges the code.
 */
export async function startMcpConnect(store, env, { projectId, serverId, userId, origin } = {}) {
  const server = await store.getMcpServer(projectId, serverId);
  if (!server) return { ok: false, error: "not_found" };
  if (!server.enabled) return { ok: false, error: "server_disabled" };
  if (server.auth !== "oauth" && server.auth !== "enterprise") {
    return { ok: false, error: "oauth_not_enabled" };
  }
  const base = trimSlashes(origin || publicOrigin(env, null));
  if (!base) return { ok: false, error: "origin_missing" };
  const redirectUri = `${base}/public/ops/mcp/oauth/callback`;
  const enterprise = server.auth === "enterprise";

  let endpoints;
  let client;
  if (enterprise) {
    // C3: the browser signs in at the enterprise IdP; the resource AS is only
    // contacted later, with the ID-JAG. Registration is manual, never DCR.
    const missing = enterpriseConfigMissing(server);
    if (missing.length) return { ok: false, error: "enterprise_config_incomplete", missing };
    endpoints = {
      authorizationEndpoint: server.oauthAuthorizeUrl,
      tokenEndpoint: server.enterpriseIdpTokenUrl,
    };
    client = { clientId: server.oauthClientId };
  } else {
    endpoints = await discoverOAuthEndpoints(env, server);
    if (!endpoints.ok) return endpoints;
    client = await resolveOauthClient(store, env, { server, endpoints, redirectUri });
    if (!client.ok) return client;
  }

  const state = randomToken();
  const verifier = randomToken();
  const challenge = await sha256Base64Url(verifier);
  const encryptedVerifier = await encryptSecret(env, verifier);
  if (!encryptedVerifier) return { ok: false, error: "encryption_key_missing" };

  const now = Date.now();
  await store.purgeMcpOauthStates(new Date(now - STATE_PURGE_AGE_MS).toISOString()).catch(() => {});
  await store.createMcpOauthState({
    // Only the hash is stored: a database copy cannot be replayed.
    stateHash: await sha256Base64Url(state),
    projectId,
    serverId: server.id,
    userId,
    mode: enterprise ? "enterprise" : "oauth",
    verifierCiphertext: encryptedVerifier.ciphertext,
    verifierIv: encryptedVerifier.iv,
    redirectUri,
    tokenUrl: endpoints.tokenEndpoint,
    clientId: client.clientId,
    expireAt: new Date(now + STATE_TTL_MS).toISOString(),
  });

  const params = new URLSearchParams({
    response_type: "code",
    client_id: client.clientId,
    redirect_uri: redirectUri,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  if (enterprise) {
    // Leg 0 is plain OIDC at the IdP: the resource and its scopes travel in
    // the token exchange that follows, not in this authorize request.
    params.set("scope", "openid offline_access");
  } else {
    // RFC 8707 resource indicator: bind the token to this MCP server.
    params.set("resource", server.url);
    const scopes = String(server.oauthScopes || "").trim();
    if (scopes) params.set("scope", scopes.slice(0, MAX_SCOPES_CHARS));
  }
  const separator = endpoints.authorizationEndpoint.includes("?") ? "&" : "?";
  return { ok: true, authorizationUrl: `${endpoints.authorizationEndpoint}${separator}${params.toString()}` };
}

function expiresAtFrom(expiresIn) {
  const seconds = Number(expiresIn);
  // No usable expiry: use the token until the server itself rejects it.
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return new Date(Date.now() + seconds * 1000).toISOString();
}

async function storeTokenPair(store, projectId, row) {
  const encryptedAccess = await encryptSecret(row.env, row.accessToken);
  if (!encryptedAccess) return { ok: false, error: "encryption_key_missing" };
  const encryptedRefresh = row.refreshToken ? await encryptSecret(row.env, row.refreshToken) : null;
  await store.upsertMcpConnection(projectId, {
    serverId: row.serverId,
    userId: row.userId,
    accessCiphertext: encryptedAccess.ciphertext,
    accessIv: encryptedAccess.iv,
    refreshCiphertext: encryptedRefresh?.ciphertext || null,
    refreshIv: encryptedRefresh?.iv || null,
    scopes: row.scopes ? String(row.scopes).slice(0, MAX_SCOPES_CHARS) : null,
    tokenType: row.tokenType ? String(row.tokenType).slice(0, 50) : null,
    tokenUrl: row.tokenUrl || null,
    clientId: row.clientId || null,
    expiresAt: expiresAtFrom(row.expiresIn),
    status: "active",
    // A fresh token clears the refresh-failure state machine.
    lastRefreshFailure: null,
    refreshAttempts: 0,
  });
  return { ok: true };
}

/**
 * Exchange the authorization code. The state was consumed before the network
 * call: a failed exchange burns the attempt, never the stored connection.
 */
export async function completeMcpConnect(store, env, { state, code, error } = {}) {
  if (!state || String(state).length > 2048) return { ok: false, error: "invalid_state" };
  const taken = await store.takeMcpOauthState(await sha256Base64Url(state));
  if (!taken) return { ok: false, error: "invalid_state" };
  if (String(taken.expireAt) < new Date().toISOString()) return { ok: false, error: "expired_state" };
  if (error) return { ok: false, error: `upstream_${String(error).slice(0, 60)}` };
  if (!code) return { ok: false, error: "missing_code" };

  const server = await store.getMcpServer(taken.projectId, taken.serverId);
  if (!server) return { ok: false, error: "server_not_found" };
  if ((taken.mode === "enterprise") !== (server.auth === "enterprise")) {
    return { ok: false, error: "server_mode_changed" };
  }
  const verifier = await decryptSecret(env, taken.verifierCiphertext, taken.verifierIv);
  if (!verifier) return { ok: false, error: "encryption_key_missing" };
  if (taken.mode === "enterprise") {
    return completeEnterpriseConnect(store, env, { taken, server, code, verifier });
  }
  const clientSecret = server.oauthClientSecretCiphertext
    ? await decryptSecret(env, server.oauthClientSecretCiphertext, server.oauthClientSecretIv)
    : null;

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: String(code),
    redirect_uri: taken.redirectUri,
    client_id: taken.clientId || server.oauthClientId || "",
    code_verifier: verifier,
    resource: server.url,
  });
  if (clientSecret) body.set("client_secret", clientSecret);
  const fetched = await fetchJson(
    taken.tokenUrl,
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
      body: body.toString(),
    },
    env,
  );
  const payload = fetched.json || {};
  const accessToken = String(payload.access_token || "");
  if (!fetched.ok || !accessToken) {
    return {
      ok: false,
      error: "token_exchange_failed",
      status: fetched.status || 0,
      message: String(payload.error_description || payload.error || fetched.error || `HTTP ${fetched.status}`).slice(
        0,
        MAX_MESSAGE_CHARS,
      ),
    };
  }

  const stored = await storeTokenPair(store, taken.projectId, {
    env,
    serverId: server.id,
    userId: taken.userId,
    accessToken,
    refreshToken: String(payload.refresh_token || ""),
    scopes: payload.scope || null,
    tokenType: payload.token_type || null,
    tokenUrl: taken.tokenUrl,
    clientId: taken.clientId || server.oauthClientId || null,
    expiresIn: payload.expires_in,
  });
  if (!stored.ok) return stored;

  // First connection fills the discovered catalog: tools/list needs a token.
  const discoveredTools = await discoverToolsWithToken(store, env, {
    projectId: taken.projectId,
    server,
    accessToken,
  });
  return { ok: true, projectId: taken.projectId, serverName: server.name, scopes: payload.scope || null, discoveredTools };
}

/** Best-effort catalog fill with the user's freshly minted access token. */
async function discoverToolsWithToken(store, env, { projectId, server, accessToken }) {
  if ((server.discoveredTools || []).length) return null;
  const listed = await mcpListTools({ url: server.url, secret: accessToken }, { env, timeoutMs: DISCOVERY_TIMEOUT_MS });
  if (!listed.ok) return null;
  const discoveredTools = listed.tools.map((tool) => tool.name).slice(0, MAX_TOOLS);
  await store.upsertMcpServer(projectId, { ...server, discoveredTools });
  return discoveredTools;
}

/**
 * C3: complete EMA. Code → IdP ID token → ID-JAG → Resource AS access token.
 * The ID token and the ID-JAG are used once and never stored.
 */
async function completeEnterpriseConnect(store, env, { taken, server, code, verifier }) {
  const missing = enterpriseConfigMissing(server);
  if (missing.length) return { ok: false, error: "enterprise_config_incomplete", missing };
  const clientSecret = server.oauthClientSecretCiphertext
    ? await decryptSecret(env, server.oauthClientSecretCiphertext, server.oauthClientSecretIv)
    : null;
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: String(code),
    redirect_uri: taken.redirectUri,
    client_id: taken.clientId || server.oauthClientId || "",
    code_verifier: verifier,
  });
  if (clientSecret) body.set("client_secret", clientSecret);
  const fetched = await fetchJson(
    taken.tokenUrl,
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
      body: body.toString(),
    },
    env,
  );
  const payload = fetched.json || {};
  const idToken = String(payload.id_token || "");
  if (!fetched.ok || !idToken) {
    return {
      ok: false,
      error: "token_exchange_failed",
      status: fetched.status || 0,
      message: String(payload.error_description || payload.error || fetched.error || `HTTP ${fetched.status}`).slice(
        0,
        MAX_MESSAGE_CHARS,
      ),
    };
  }
  const issued = await issueEnterpriseConnection(store, env, {
    projectId: taken.projectId,
    userId: taken.userId,
    server,
    idpSubjectToken: idToken,
    subjectTokenType: SUBJECT_ID_TOKEN,
    idpRefreshToken: String(payload.refresh_token || "") || null,
    existingRefreshToken: null,
    clientSecret,
  });
  return issued.ok ? issued.response : issued;
}

/**
 * The two legs shared by first connect and renewal. Returns the shape the
 * callback may expose (`response`) plus the access token for the refresh path;
 * callers must not hand the whole object to an HTTP response.
 */
async function issueEnterpriseConnection(
  store,
  env,
  { projectId, userId, server, idpSubjectToken, subjectTokenType, idpRefreshToken, existingRefreshToken, clientSecret },
) {
  const resourceClientSecret = server.enterpriseResourceClientSecretCiphertext
    ? await decryptSecret(env, server.enterpriseResourceClientSecretCiphertext, server.enterpriseResourceClientSecretIv)
    : null;
  const exchanged = await exchangeForIdJag(env, {
    idpTokenUrl: server.enterpriseIdpTokenUrl,
    audience: server.enterpriseAudience,
    resource: server.url,
    scope: server.oauthScopes,
    subjectToken: idpSubjectToken,
    subjectTokenType,
    clientId: server.oauthClientId,
    clientSecret,
  });
  if (!exchanged.ok) return exchanged;
  const jwks = await fetchIdpJwks(env, server.enterpriseJwksUrl);
  if (!jwks.ok) return jwks;
  const verified = await verifyIdJag(exchanged.idJag, {
    jwks,
    issuer: server.enterpriseIssuer,
    audience: server.enterpriseAudience,
    resource: server.url,
    clientId: server.enterpriseResourceClientId,
  });
  if (!verified.ok) return verified;
  const redeemed = await redeemIdJag(env, {
    tokenUrl: server.oauthTokenUrl,
    clientId: server.enterpriseResourceClientId,
    clientSecret: resourceClientSecret,
    idJag: exchanged.idJag,
  });
  if (!redeemed.ok) return redeemed;
  const stored = await storeTokenPair(store, projectId, {
    env,
    serverId: server.id,
    userId,
    accessToken: redeemed.accessToken,
    // Only the IdP refresh token renews leg 1 (and the IdP may rotate it in
    // the token-exchange response); an AS refresh token is not part of this
    // profile's renewal path and is not stored.
    refreshToken: exchanged.refreshToken || idpRefreshToken || existingRefreshToken || "",
    scopes: redeemed.scope || server.oauthScopes || null,
    tokenType: redeemed.tokenType || null,
    tokenUrl: server.oauthTokenUrl,
    clientId: server.enterpriseResourceClientId,
    expiresIn: redeemed.expiresIn,
  });
  if (!stored.ok) return stored;
  const discoveredTools = await discoverToolsWithToken(store, env, {
    projectId,
    server,
    accessToken: redeemed.accessToken,
  });
  return {
    ok: true,
    accessToken: redeemed.accessToken,
    response: {
      ok: true,
      projectId,
      serverName: server.name,
      scopes: redeemed.scope || server.oauthScopes || null,
      discoveredTools,
    },
  };
}

async function refreshEnterpriseConnection(store, env, { connection, server }) {
  const missing = enterpriseConfigMissing(server);
  if (missing.length) return markConnectionExpired(store, connection, "enterprise_config_incomplete");
  if (refreshInCooldown(connection)) return refreshCooldownError(connection);
  const idpRefreshToken = connection.refreshCiphertext
    ? await decryptSecret(env, connection.refreshCiphertext, connection.refreshIv)
    : null;
  if (!idpRefreshToken) return markConnectionExpired(store, connection, "no_refresh_token");
  const clientSecret = server.oauthClientSecretCiphertext
    ? await decryptSecret(env, server.oauthClientSecretCiphertext, server.oauthClientSecretIv)
    : null;
  const issued = await issueEnterpriseConnection(store, env, {
    projectId: connection.projectId,
    userId: connection.userId,
    server,
    idpSubjectToken: idpRefreshToken,
    subjectTokenType: SUBJECT_REFRESH_TOKEN,
    idpRefreshToken: null,
    existingRefreshToken: idpRefreshToken,
    clientSecret,
  });
  if (!issued.ok) {
    // IdP/AS exchange failures can be outages: count days instead of killing.
    return recordRefreshFailure(store, connection, String(issued.reason || issued.error || "exchange_failed"));
  }
  return { ok: true, token: issued.accessToken, refreshed: true, scopes: issued.response.scopes || null };
}

async function markConnectionExpired(store, connection, reason) {
  await store.upsertMcpConnection(connection.projectId, { ...connection, status: "expired" }).catch(() => {});
  return {
    ok: false,
    error: "mcp_connection_expired",
    message: `The connection for ${connection.serverId} expired (${reason}). Reconnect from Process tools.`,
    reason,
  };
}

/** Too soon after a failure: do not hammer the AS from a burst of tool calls. */
function refreshInCooldown(connection) {
  const last = connection?.lastRefreshFailure ? Date.parse(connection.lastRefreshFailure) : NaN;
  return Number.isFinite(last) && Date.now() - last < REFRESH_FAILURE_COOLDOWN_MS;
}

function refreshCooldownError(connection) {
  return {
    ok: false,
    error: "mcp_connection_refresh_backoff",
    retryable: true,
    message: `Refresh for ${connection.serverId} failed moments ago; the stored token stays and the refresh will be retried.`,
  };
}

/**
 * A rejected grant is dead, not slow: only an explicit auth error (or a 401)
 * reconnects immediately. Network errors and 5xx are transient.
 */
function isAuthRefreshFailure(fetched, payload) {
  const status = Number(fetched?.status) || 0;
  if (status !== 400 && status !== 401 && status !== 403) return false;
  return AUTH_REFRESH_ERRORS.has(String(payload?.error || "").toLowerCase());
}

/**
 * A transient refresh failure must not kill the connection: count at most one
 * attempt per day (cooldown aside), reconnect only after four counted days.
 */
async function recordRefreshFailure(store, connection, reason) {
  const now = new Date();
  const last = connection.lastRefreshFailure ? new Date(connection.lastRefreshFailure) : null;
  const sameDay =
    last && !Number.isNaN(last.getTime()) && last.toISOString().slice(0, 10) === now.toISOString().slice(0, 10);
  const attempts = (Number(connection.refreshAttempts) || 0) + (sameDay ? 0 : 1);
  if (attempts >= REFRESH_FAILURE_MAX_DAYS) {
    return markConnectionExpired(store, connection, `refresh_exhausted:${reason}`.slice(0, MAX_MESSAGE_CHARS));
  }
  await store
    .upsertMcpConnection(connection.projectId, {
      ...connection,
      lastRefreshFailure: now.toISOString(),
      refreshAttempts: attempts,
    })
    .catch(() => {});
  return {
    ok: false,
    error: "mcp_connection_refresh_failed",
    retryable: true,
    message: `Refresh for ${connection.serverId} failed (${reason}); the stored token stays and the refresh will be retried.`,
  };
}

async function refreshMcpConnection(store, env, { connection, server }) {
  if (server?.auth === "enterprise") return refreshEnterpriseConnection(store, env, { connection, server });
  if (refreshInCooldown(connection)) return refreshCooldownError(connection);
  const refreshToken = connection.refreshCiphertext
    ? await decryptSecret(env, connection.refreshCiphertext, connection.refreshIv)
    : null;
  if (!refreshToken || !connection.tokenUrl) return markConnectionExpired(store, connection, "no_refresh_token");
  const clientSecret = server?.oauthClientSecretCiphertext
    ? await decryptSecret(env, server.oauthClientSecretCiphertext, server.oauthClientSecretIv)
    : null;
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: connection.clientId || server?.oauthClientId || "",
  });
  if (server?.url) body.set("resource", server.url);
  if (clientSecret) body.set("client_secret", clientSecret);
  const fetched = await fetchJson(
    connection.tokenUrl,
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
      body: body.toString(),
    },
    env,
  );
  const payload = fetched.json || {};
  const accessToken = String(payload.access_token || "");
  if (!fetched.ok || !accessToken) {
    const reason = String(payload.error || fetched.error || `http_${fetched.status}`).slice(0, MAX_MESSAGE_CHARS);
    // A rejected grant means reconnect; a 5xx/network failure is transient.
    return isAuthRefreshFailure(fetched, payload)
      ? markConnectionExpired(store, connection, reason)
      : recordRefreshFailure(store, connection, reason);
  }
  const stored = await storeTokenPair(store, connection.projectId, {
    env,
    serverId: connection.serverId,
    userId: connection.userId,
    accessToken,
    // Some servers rotate the refresh token; others keep the old one.
    refreshToken: String(payload.refresh_token || "") || refreshToken,
    scopes: payload.scope || connection.scopes,
    tokenType: payload.token_type || connection.tokenType,
    tokenUrl: connection.tokenUrl,
    clientId: connection.clientId,
    expiresIn: payload.expires_in,
  });
  if (!stored.ok) return stored;
  return { ok: true, token: accessToken, refreshed: true, scopes: payload.scope || connection.scopes || null };
}

/**
 * The token a call must present: the run actor's own connection, refreshed when
 * near expiry. No connection means the call is denied, never silently upgraded
 * to a shared credential.
 */
export async function resolveMcpAccessToken(store, env, { projectId, server, userId } = {}) {
  if (!userId) {
    return {
      ok: false,
      error: "mcp_connection_required",
      message: "This server uses per-user OAuth and the run has no user actor. Use a bearer secret for system runs.",
    };
  }
  const connection = await store.getMcpConnection(projectId, server.id, userId);
  if (!connection) {
    return {
      ok: false,
      error: "mcp_connection_required",
      message: `Connect ${server.name} from Process tools before this run can call it.`,
    };
  }
  const accessToken = await decryptSecret(env, connection.accessCiphertext, connection.accessIv);
  if (!accessToken) return { ok: false, error: "mcp_connection_invalid" };
  const expiresAt = connection.expiresAt ? Date.parse(connection.expiresAt) : null;
  if (expiresAt == null || expiresAt - REFRESH_SKEW_MS > Date.now()) {
    return { ok: true, token: accessToken, scopes: connection.scopes || null };
  }
  return refreshMcpConnection(store, env, { connection, server });
}

/** Connections are listed in the console without any token material. */
export function redactMcpConnection(connection, serverName) {
  if (!connection) return null;
  return {
    id: connection.id,
    serverId: connection.serverId,
    serverName: serverName || null,
    status: connection.status || "active",
    scopes: connection.scopes || null,
    expiresAt: connection.expiresAt || null,
    createdAt: connection.createdAt,
    updatedAt: connection.updatedAt,
  };
}

export async function listMcpConnectionsForUser(store, projectId, userId) {
  const [connections, servers] = await Promise.all([
    store.listMcpConnections(projectId, { userId }),
    store.listMcpServers(projectId),
  ]);
  const names = new Map(servers.map((server) => [server.id, server.name]));
  return connections.map((connection) => redactMcpConnection(connection, names.get(connection.serverId)));
}
