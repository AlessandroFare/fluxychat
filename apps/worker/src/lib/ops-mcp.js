/**
 * MCP gateway: the project registry of external MCP servers the governed ops
 * layer may call (ops_mcp_servers). Bearer secrets are encrypted at rest with
 * WEBHOOK_SECRET_ENCRYPTION_KEY, tool names are explicitly allow-listed, and
 * every call still passes the tool-level approval rules (mcp.call is high
 * risk). Admin routes manage the registry; executeOpsTool calls through here.
 */
import { decryptSecret, encryptSecret } from "./secrets-crypto.js";
import { mcpCallTool, mcpListTools } from "./ops-mcp-client.js";
import { resolveMcpAccessToken } from "./ops-mcp-oauth.js";
import { enterpriseConfigMissing } from "./ops-mcp-enterprise.js";
import { applyInputGuardrails, applyOutputGuardrails } from "./ops-guardrails.js";
import { normalizeOpsPolicy } from "./ops-policy.js";
import { mcpRequestMetricName } from "./mcp-protocol.js";
import { incrementOperationalMetric } from "./operational-metrics.js";

const NAME_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const MAX_TOOLS = 200;
const MAX_TOOL_NAME = 128;
/** Registration must not hang on a slow server; discovery is best-effort. */
const DISCOVERY_TIMEOUT_MS = 8000;

export function normalizeMcpServerName(value) {
  const name = String(value || "").trim().toLowerCase();
  return NAME_RE.test(name) ? name : null;
}

function normalizeToolNames(value) {
  if (!Array.isArray(value)) return [];
  const names = [];
  for (const item of value) {
    const name = String(item || "").trim();
    if (name && name.length <= MAX_TOOL_NAME && !names.includes(name)) names.push(name);
    if (names.length >= MAX_TOOLS) break;
  }
  return names;
}

/** Registry rows are returned to HTTP clients without the encrypted secrets. */
export function redactMcpServer(row) {
  if (!row) return null;
  const {
    secretCiphertext,
    secretIv,
    oauthClientSecretCiphertext,
    oauthClientSecretIv,
    enterpriseResourceClientSecretCiphertext,
    enterpriseResourceClientSecretIv,
    toolsCatalog,
    ...rest
  } = row;
  return {
    ...rest,
    auth: rest.auth === "oauth" || rest.auth === "enterprise" ? rest.auth : "secret",
    hasSecret: Boolean(secretCiphertext && secretIv),
    hasOauthClientSecret: Boolean(oauthClientSecretCiphertext && oauthClientSecretIv),
    hasEnterpriseResourceClientSecret: Boolean(
      enterpriseResourceClientSecretCiphertext && enterpriseResourceClientSecretIv,
    ),
    toolsCatalog: displayCatalog(toolsCatalog),
  };
}

/** Public shape of the pinned catalog: hashes stay server-side. */
function displayCatalog(catalog) {
  return (catalog || [])
    .filter((tool) => !tool.missing)
    .map((tool) => ({
      name: tool.name,
      description: tool.description || "",
      readOnly: Boolean(tool.readOnly),
      changed: Boolean(tool.approvedHash && tool.hash !== tool.approvedHash),
      approvedAt: tool.approvedAt || null,
      ...(tool.inputSchema ? { inputSchema: tool.inputSchema } : {}),
    }));
}

/** Keeps the stored secret when the operator re-registers without a new one. */
async function resolveCredentials(env, existing, inputSecret) {
  const secret = typeof inputSecret === "string" && inputSecret.trim() ? inputSecret.trim() : null;
  if (secret) {
    const encrypted = await encryptSecret(env, secret);
    if (!encrypted) return { error: "encryption_key_missing" };
    return { secret, secretCiphertext: encrypted.ciphertext, secretIv: encrypted.iv };
  }
  if (existing?.secretCiphertext) {
    return {
      secret: await decryptSecret(env, existing.secretCiphertext, existing.secretIv),
      secretCiphertext: existing.secretCiphertext,
      secretIv: existing.secretIv,
    };
  }
  return { secret: null, secretCiphertext: null, secretIv: null };
}

/** Same keep-stored-value rule as the bearer secret, for the OAuth client secret. */
async function resolveOauthClientSecret(env, existing, inputSecret) {
  const secret = typeof inputSecret === "string" && inputSecret.trim() ? inputSecret.trim() : null;
  if (secret) {
    const encrypted = await encryptSecret(env, secret);
    if (!encrypted) return { error: "encryption_key_missing" };
    return { oauthClientSecretCiphertext: encrypted.ciphertext, oauthClientSecretIv: encrypted.iv };
  }
  if (existing?.oauthClientSecretCiphertext) {
    return {
      oauthClientSecretCiphertext: existing.oauthClientSecretCiphertext,
      oauthClientSecretIv: existing.oauthClientSecretIv,
    };
  }
  return { oauthClientSecretCiphertext: null, oauthClientSecretIv: null };
}

/** C3: the client secret registered with the Resource Authorization Server. */
async function resolveEnterpriseResourceClientSecret(env, existing, inputSecret) {
  const secret = typeof inputSecret === "string" && inputSecret.trim() ? inputSecret.trim() : null;
  if (secret) {
    const encrypted = await encryptSecret(env, secret);
    if (!encrypted) return { error: "encryption_key_missing" };
    return {
      enterpriseResourceClientSecretCiphertext: encrypted.ciphertext,
      enterpriseResourceClientSecretIv: encrypted.iv,
    };
  }
  if (existing?.enterpriseResourceClientSecretCiphertext) {
    return {
      enterpriseResourceClientSecretCiphertext: existing.enterpriseResourceClientSecretCiphertext,
      enterpriseResourceClientSecretIv: existing.enterpriseResourceClientSecretIv,
    };
  }
  return { enterpriseResourceClientSecretCiphertext: null, enterpriseResourceClientSecretIv: null };
}

function keepText(input, existing, key, max) {
  if (input?.[key] === undefined) return existing?.[key] || null;
  const value = String(input[key] || "").trim();
  return value ? value.slice(0, max) : null;
}

function optionalOauthUrl(input, existing, key) {
  return input?.[key] === undefined ? existing?.[key] || null : normalizeOauthUrl(input[key]);
}

function normalizeOauthUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return { error: true };
    return raw;
  } catch {
    return { error: true };
  }
}

function normalizeOauthScopes(value) {
  const raw = String(value || "").replace(/[^\x20-\x7E]/g, "").trim();
  return raw ? raw.slice(0, 500) : null;
}

async function discoverInto(store, env, row, secret) {
  const listed = await mcpListTools({ url: row.url, secret }, { env, timeoutMs: DISCOVERY_TIMEOUT_MS });
  if (!listed.ok) {
    return { row, result: { ok: false, error: listed.error, message: listed.message || null } };
  }
  const previous = new Map((row.toolsCatalog || []).map((tool) => [tool.name, tool]));
  const now = new Date().toISOString();
  const seen = new Set();
  const catalog = [];
  for (const tool of listed.tools) {
    if (seen.has(tool.name)) continue;
    seen.add(tool.name);
    const prior = previous.get(tool.name);
    // First sight pins the definition. A later change keeps the old approved
    // hash, so calls stay blocked until an admin re-approves the new one.
    catalog.push({
      name: tool.name,
      description: tool.description,
      readOnly: tool.readOnly,
      hash: tool.hash,
      // Keep the schema worth showing in the re-approval card; storing one
      // for every discovered tool would grow the row for no reader.
      inputSchema: (row.allowedTools || []).includes(tool.name) ? tool.inputSchema || null : null,
      approvedHash: prior ? prior.approvedHash || prior.hash || null : tool.hash,
      approvedAt: prior?.approvedAt || now,
    });
    if (catalog.length >= MAX_TOOLS) break;
  }
  // Keep pins for tools that disappeared: a tool removed and later re-added
  // must still match the definition that was approved.
  const carried = (row.toolsCatalog || [])
    .filter((tool) => !seen.has(tool.name))
    .map((tool) => ({ ...tool, missing: true }));
  const toolsCatalog = [...catalog, ...carried].slice(0, MAX_TOOLS * 2);
  const updated = await store.upsertMcpServer(row.projectId, {
    ...row,
    discoveredTools: catalog.map((tool) => tool.name),
    toolsCatalog,
  });
  // One audit event per transition, not one per refresh: a still-drifted tool
  // is already blocked and visible in the registry.
  for (const tool of catalog) {
    if (!(row.allowedTools || []).includes(tool.name)) continue;
    if (!tool.approvedHash || tool.hash === tool.approvedHash) continue;
    const prior = previous.get(tool.name);
    const alreadyDrifted = Boolean(prior?.approvedHash && prior.hash !== prior.approvedHash);
    if (alreadyDrifted) continue;
    await store.appendEvent({
      projectId: row.projectId,
      actor: "system",
      eventType: "ops.mcp.tool_changed",
      result: {
        server: row.name,
        serverId: row.id,
        tool: tool.name,
        previousHash: tool.approvedHash,
        hash: tool.hash,
      },
    });
  }
  return {
    row: updated,
    result: {
      ok: true,
      tools: catalog.map((tool) => tool.name),
      catalog: displayCatalog(catalog),
    },
  };
}

export async function registerMcpServer(store, env, { projectId, input, createdBy } = {}) {
  const name = normalizeMcpServerName(input?.name);
  if (!name) return { ok: false, error: "invalid_name" };
  const url = String(input?.url || "").trim();
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, error: "invalid_url" };
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { ok: false, error: "invalid_url" };
  }

  const existing = await store.getMcpServerByName(projectId, name);
  // auth is explicit once set: re-registering without it must not silently drop
  // a per-user OAuth or enterprise server back to a shared secret.
  let auth = existing?.auth === "oauth" || existing?.auth === "enterprise" ? existing.auth : "secret";
  if (input?.auth !== undefined) {
    const requested = String(input.auth || "").trim().toLowerCase();
    if (requested !== "secret" && requested !== "oauth" && requested !== "enterprise") {
      return { ok: false, error: "invalid_auth" };
    }
    auth = requested;
  }
  const credentials = await resolveCredentials(env, existing, input?.secret);
  if (credentials.error) return { ok: false, error: credentials.error };
  const clientSecret = await resolveOauthClientSecret(env, existing, input?.oauthClientSecret);
  if (clientSecret.error) return { ok: false, error: clientSecret.error };
  const resourceClientSecret = await resolveEnterpriseResourceClientSecret(
    env,
    existing,
    input?.enterpriseResourceClientSecret,
  );
  if (resourceClientSecret.error) return { ok: false, error: resourceClientSecret.error };

  const overrideAuthorize =
    input?.oauthAuthorizeUrl === undefined ? existing?.oauthAuthorizeUrl || null : normalizeOauthUrl(input.oauthAuthorizeUrl);
  const overrideToken =
    input?.oauthTokenUrl === undefined ? existing?.oauthTokenUrl || null : normalizeOauthUrl(input.oauthTokenUrl);
  if (overrideAuthorize?.error || overrideToken?.error) return { ok: false, error: "invalid_oauth_url" };
  if (Boolean(overrideAuthorize) !== Boolean(overrideToken)) {
    return { ok: false, error: "invalid_oauth_url" };
  }

  // C3: enterprise (EMA / ID-JAG) endpoints. AUD/issuer identifiers are not
  // URLs necessarily (a URN is valid), so they stay free text.
  const enterpriseIdpTokenUrl = optionalOauthUrl(input, existing, "enterpriseIdpTokenUrl");
  const enterpriseJwksUrl = optionalOauthUrl(input, existing, "enterpriseJwksUrl");
  if (enterpriseIdpTokenUrl?.error || enterpriseJwksUrl?.error) {
    return { ok: false, error: "invalid_enterprise_url" };
  }

  const candidate = {
    name,
    url,
    auth,
    secretCiphertext: credentials.secretCiphertext,
    secretIv: credentials.secretIv,
    oauthClientId:
      input?.oauthClientId === undefined
        ? existing?.oauthClientId || null
        : String(input.oauthClientId || "").trim() || null,
    ...clientSecret,
    oauthAuthorizeUrl: overrideAuthorize || null,
    oauthTokenUrl: overrideToken || null,
    oauthScopes: input?.oauthScopes === undefined ? existing?.oauthScopes || null : normalizeOauthScopes(input.oauthScopes),
    enterpriseIdpTokenUrl: enterpriseIdpTokenUrl || null,
    enterpriseIssuer: keepText(input, existing, "enterpriseIssuer", 2048),
    enterpriseAudience: keepText(input, existing, "enterpriseAudience", 2048),
    enterpriseJwksUrl: enterpriseJwksUrl || null,
    enterpriseResourceClientId: keepText(input, existing, "enterpriseResourceClientId", 512),
    ...resourceClientSecret,
    // Explicit opt-in: an empty allowlist denies every tool until the operator
    // picks names from the discovered catalog.
    allowedTools: input?.allowedTools === undefined ? existing?.allowedTools || [] : normalizeToolNames(input.allowedTools),
    discoveredTools: existing?.discoveredTools || [],
    enabled: input?.enabled === undefined ? existing?.enabled ?? true : input.enabled !== false,
    createdBy: existing?.createdBy || createdBy || null,
  };
  if (auth === "enterprise") {
    // Fail at registration, not at the first connect: name every missing field.
    const missing = enterpriseConfigMissing(candidate);
    if (missing.length) return { ok: false, error: "enterprise_config_incomplete", missing };
  }
  const row = await store.upsertMcpServer(projectId, candidate);

  if (auth === "oauth" || auth === "enterprise") {
    // tools/list needs a token and every token is per-user: the catalog appears
    // when the first user connects, not at registration.
    return {
      ok: true,
      server: redactMcpServer(row),
      discovery: {
        ok: false,
        error: "oauth_connection_required",
        message: "Connect an account from Process tools; the catalog is discovered with that user's token.",
      },
    };
  }

  const discovery = await discoverInto(store, env, row, credentials.secret);
  return { ok: true, server: redactMcpServer(discovery.row), discovery: discovery.result };
}

export async function refreshMcpTools(store, env, { projectId, id, userId } = {}) {
  const row = await store.getMcpServer(projectId, id);
  if (!row) return { ok: false, error: "not_found" };
  let token = null;
  if (row.auth === "oauth" || row.auth === "enterprise") {
    // Discovery runs with the caller's own connection; no user, no catalog.
    const resolved = await resolveMcpAccessToken(store, env, { projectId, server: row, userId });
    if (!resolved.ok) {
      return {
        ok: true,
        server: redactMcpServer(row),
        discovery: { ok: false, error: resolved.error, message: resolved.message || null },
      };
    }
    token = resolved.token;
  } else {
    token = row.secretCiphertext ? await decryptSecret(env, row.secretCiphertext, row.secretIv) : null;
    if (row.secretCiphertext && !token) return { ok: false, error: "secret_unavailable" };
  }
  const discovery = await discoverInto(store, env, row, token);
  return { ok: true, server: redactMcpServer(discovery.row), discovery: discovery.result };
}

export async function removeMcpServer(store, projectId, id) {
  const removed = await store.deleteMcpServer(projectId, id);
  return removed ? { ok: true, server: redactMcpServer(removed) } : { ok: false, error: "not_found" };
}

/**
 * Accept the currently discovered definition of one tool after a drift block.
 * The hash is re-pinned; the next change blocks calls again.
 */
export async function reapproveMcpTool(store, { projectId, id, tool, actor } = {}) {
  const row = await store.getMcpServer(projectId, id);
  if (!row) return { ok: false, error: "not_found" };
  const name = String(tool || "").trim();
  const entry = (row.toolsCatalog || []).find((item) => item.name === name);
  if (!entry) return { ok: false, error: "tool_not_found" };
  const now = new Date().toISOString();
  const toolsCatalog = row.toolsCatalog.map((item) =>
    item.name === name ? { ...item, approvedHash: item.hash, approvedAt: now } : item,
  );
  const updated = await store.upsertMcpServer(projectId, { ...row, toolsCatalog });
  await store.appendEvent({
    projectId,
    actor: actor || "system",
    eventType: "ops.mcp.tool_reapproved",
    result: { server: row.name, serverId: row.id, tool: name, hash: entry.hash },
  });
  return { ok: true, server: redactMcpServer(updated) };
}

/**
 * Read-only fast path: an mcp.call whose target tool was approved with a
 * read-only hint (pinned definition still matching) is a read, not a write, so
 * it does not stop for the write approval. The hint is trusted only because it
 * lives inside the admin-approved definition hash.
 */
export async function mcpCallIsPinnedReadOnly(store, projectId, input) {
  const name = normalizeMcpServerName(input?.server);
  const tool = String(input?.tool || "").trim();
  if (!name || !tool) return false;
  const row = await store.getMcpServerByName(projectId, name);
  if (!row || !row.enabled || !(row.allowedTools || []).includes(tool)) return false;
  const entry = (row.toolsCatalog || []).find((item) => item.name === tool);
  return Boolean(entry && entry.readOnly === true && entry.approvedHash && entry.hash === entry.approvedHash);
}

export async function callMcpTool(store, env, projectId, input, extras = {}) {
  const name = normalizeMcpServerName(input?.server);
  if (!name) return { ok: false, error: "invalid_server" };
  const tool = String(input?.tool || "").trim();
  if (!tool || tool.length > MAX_TOOL_NAME) return { ok: false, error: "invalid_tool" };
  const row = await store.getMcpServerByName(projectId, name);
  if (!row) return { ok: false, error: "server_not_found" };
  if (!row.enabled) return { ok: false, error: "server_disabled" };
  if (!(row.allowedTools || []).includes(tool)) {
    return { ok: false, error: "tool_not_allowed", allowedTools: (row.allowedTools || []).slice(0, MAX_TOOLS) };
  }
  const pinned = (row.toolsCatalog || []).find((item) => item.name === tool);
  // shortcut: drift is caught at discovery/refresh time (register + Refresh button), not on
  // every call — a server that mutates a definition and is never re-discovered stays blocked
  // only after the next refresh sees it. Add a per-call tools/list when servers expose cheap lists.
  if (pinned && pinned.approvedHash && pinned.hash !== pinned.approvedHash) {
    return {
      ok: false,
      error: "tool_changed",
      message: "This tool's definition changed since it was approved; an admin must re-approve it in Ops settings.",
    };
  }
  // C4: the guardrails live on the ops policy; the call never leaves — and the
  // payload never returns — with a blocked rule unmatched.
  const policy = normalizeOpsPolicy(await store.getPolicy(projectId));
  const pre = applyInputGuardrails(policy.guardrails, input?.arguments || {});
  if (!pre.ok) {
    return { ok: false, error: pre.error, rule: pre.rule, stage: pre.stage, server: row.name, tool };
  }
  // Outbound MCP request counter (agentgateway-style mcp_requests, per method).
  void incrementOperationalMetric(env, {
    metricName: mcpRequestMetricName("tools/call"),
    projectId,
    value: 1,
  }).catch(() => {});
  let token = null;
  if (row.auth === "oauth" || row.auth === "enterprise") {
    const resolved = await resolveMcpAccessToken(store, env, { projectId, server: row, userId: extras.actor });
    if (!resolved.ok) return { ok: false, error: resolved.error, message: resolved.message || null };
    token = resolved.token;
  } else {
    token = row.secretCiphertext ? await decryptSecret(env, row.secretCiphertext, row.secretIv) : null;
    if (row.secretCiphertext && !token) return { ok: false, error: "secret_unavailable" };
  }
  const call = await mcpCallTool({ url: row.url, secret: token }, {
    tool,
    arguments: pre.input,
    inputResponses: input?.inputResponses,
    requestState: input?.requestState,
    env,
  });
  if (!call.ok) return { ...call, server: row.name, tool };
  const post = applyOutputGuardrails(policy.guardrails, call);
  if (!post.ok) {
    return { ok: false, error: post.error, rule: post.rule, stage: post.stage, server: row.name, tool };
  }
  return {
    ...post.payload,
    server: row.name,
    tool,
    ...(post.redacted.length ? { guardrails: { redacted: post.redacted } } : {}),
  };
}

/**
 * "Try tool" from the settings card: only tools pinned read-only can be called
 * outside a run, so a UI button can never trigger side effects; writes stay
 * behind the run approval flow. Every attempt (including a refused write) is
 * audited as ops.mcp.tool_tried.
 */
export async function tryMcpTool(store, env, { projectId, id, tool, args, actor } = {}) {
  const row = await store.getMcpServer(projectId, id);
  if (!row) return { ok: false, error: "not_found" };
  const name = String(tool || "").trim();
  const entry = (row.toolsCatalog || []).find((item) => item.name === name);
  if (!entry) return { ok: false, error: "tool_not_found" };
  if (entry.readOnly !== true) {
    await store.appendEvent({
      projectId,
      actor: actor || "system",
      eventType: "ops.mcp.tool_tried",
      result: { server: row.name, serverId: row.id, tool: name, ok: false, error: "try_requires_read_only" },
    });
    return {
      ok: false,
      error: "try_requires_read_only",
      message: "Only tools approved as read-only can be tried here; write tools run through Processes with approval.",
    };
  }
  const call = await callMcpTool(store, env, projectId, { server: row.name, tool: name, arguments: args || {} }, { actor });
  await store.appendEvent({
    projectId,
    actor: actor || "system",
    eventType: "ops.mcp.tool_tried",
    result: {
      server: row.name,
      serverId: row.id,
      tool: name,
      ok: Boolean(call.ok),
      error: call.ok ? null : call.error || "error",
    },
  });
  return call;
}
