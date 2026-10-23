/**
 * MCP client for the ops gateway (Streamable HTTP transport).
 * Dual era, per MCP 2026-07-28: probes `server/discover` and then either speaks
 * the stateless modern protocol (headers + `_meta`, no session) or falls back
 * to the legacy initialize handshake. Responses may be application/json or
 * text/event-stream (SSE); both are read. Every request goes through
 * safeOutboundFetch, so the SSRF guard (and the ALLOWED_SSRF_HOSTS allowlist
 * for internal servers) applies to the whole call.
 */
import { canonicalPayloadHash } from "./canonical-payload-hash.js";
import {
  MCP_ERROR_HEADER_MISMATCH,
  MCP_ERROR_UNSUPPORTED_PROTOCOL,
  MCP_LEGACY_PROTOCOL_VERSION,
  MCP_META_CLIENT_CAPABILITIES,
  MCP_META_CLIENT_INFO,
  MCP_META_PROTOCOL_VERSION,
  MCP_META_SERVER_INFO,
  MCP_PROTOCOL_VERSION,
  MCP_SUPPORTED_PROTOCOL_VERSIONS,
  encodeMcpHeaderValue,
} from "./mcp-protocol.js";
import { safeOutboundFetch } from "./url-ssrf.js";

const CLIENT_INFO = { name: "fluxychat-ops", version: "1.0.0" };
const DEFAULT_TIMEOUT_MS = 15000;
/** Per-tool input schema kept in the catalog; row size beats completeness. */
const MAX_CATALOG_SCHEMA_CHARS = 4000;
/** Cap what a server can push into an ops event / D1 row. */
const MAX_TEXT_CHARS = 8000;
const MAX_BODY_CHARS = 200000;
/** A structured blob past the text cap is dropped; the capped text still carries it. */
const MAX_STRUCTURED_CHARS = 8000;

let requestId = 0;

function nextId() {
  requestId += 1;
  return requestId;
}

/**
 * One SSE stream can carry notifications (progress, log) before the reply:
 * return the first event that is an actual JSON-RPC response, preferring the
 * one matching the request id. Multi-line `data:` fields belong to one event.
 */
function ssePayload(text, rpcId) {
  const events = [];
  let data = [];
  for (const line of String(text).split(/\r?\n/)) {
    if (line === "") {
      if (data.length) events.push(data.join("\n"));
      data = [];
      continue;
    }
    if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
  }
  if (data.length) events.push(data.join("\n"));
  let fallback = null;
  for (const event of events) {
    let message;
    try {
      message = JSON.parse(event);
    } catch {
      continue;
    }
    if (!message || typeof message !== "object") continue;
    // Notifications share the stream with the response; skip them.
    if (message.result === undefined && message.error === undefined) continue;
    if (rpcId != null && message.id === rpcId) return message;
    if (!fallback) fallback = message;
  }
  return fallback;
}

async function readMessage(response, rpcId) {
  const raw = await response.text().catch(() => "");
  const text = raw.slice(0, MAX_BODY_CHARS);
  const type = response.headers.get("content-type") || "";
  if (type.includes("text/event-stream")) {
    const message = ssePayload(text, rpcId);
    if (message) return message;
  }
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function textFromContent(content) {
  if (!Array.isArray(content)) return "";
  const parts = [];
  for (const block of content) {
    if (block?.type === "text" && block.text) parts.push(String(block.text));
    else if (block?.type && block.type !== "text") parts.push(`[${block.type}]`);
  }
  return parts.join("\n").trim();
}

function serverInfoOf(result) {
  return result?._meta?.[MCP_META_SERVER_INFO] || result?.serverInfo || null;
}

/**
 * Only 2026-07-28 is modern. A server advertising older versions still speaks
 * the initialize handshake for them, so the negotiated version is carried into
 * the legacy initialize request.
 */
function pickProtocol(supported, serverInfo) {
  const versions = Array.isArray(supported) ? supported.map(String) : [];
  if (versions.includes(MCP_PROTOCOL_VERSION)) {
    return { era: "modern", protocolVersion: MCP_PROTOCOL_VERSION, serverInfo: serverInfo || null };
  }
  const legacy = MCP_SUPPORTED_PROTOCOL_VERSIONS.find(
    (version) => version !== MCP_PROTOCOL_VERSION && versions.includes(version),
  );
  return { era: "legacy", protocolVersion: legacy || MCP_LEGACY_PROTOCOL_VERSION };
}

async function rpc(server, method, params, {
  env,
  sessionId,
  era = "legacy",
  protocolVersion,
  name,
  notification = false,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  const modern = era === "modern";
  const version = protocolVersion || (modern ? MCP_PROTOCOL_VERSION : MCP_LEGACY_PROTOCOL_VERSION);
  const headers = {
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
  };
  if (server.secret) headers.authorization = `Bearer ${server.secret}`;
  if (modern) {
    headers["MCP-Protocol-Version"] = version;
    headers["Mcp-Method"] = method;
    if (name) headers["Mcp-Name"] = encodeMcpHeaderValue(name);
  } else if (sessionId) {
    headers["mcp-session-id"] = sessionId;
  }
  const payloadParams = modern
    ? {
        ...(params || {}),
        _meta: {
          [MCP_META_PROTOCOL_VERSION]: version,
          [MCP_META_CLIENT_INFO]: CLIENT_INFO,
          // MRTR elicitation (form mode) is rendered to the user; declare it so
          // spec-conformant servers may ask instead of erroring -32021.
          [MCP_META_CLIENT_CAPABILITIES]: { elicitation: {} },
        },
      }
    : params || {};
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const rpcId = notification ? null : nextId();
  try {
    const response = await safeOutboundFetch(server.url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        ...(rpcId == null ? {} : { id: rpcId }),
        method,
        params: payloadParams,
      }),
      signal: controller.signal,
    }, env);
    const nextSession = modern ? null : response.headers.get("mcp-session-id") || sessionId || null;
    // Notifications get an empty 202; some servers omit the body on success.
    if (response.status === 202) return { ok: true, result: null, sessionId: nextSession, status: 202 };
    const message = await readMessage(response, rpcId);
    if (!response.ok) {
      const rpcError = message?.error;
      const detail = rpcError?.message || rpcError || `HTTP ${response.status}`;
      return {
        ok: false,
        error: `http_${response.status}`,
        message: String(detail).slice(0, 300),
        code: rpcError?.code ?? null,
        data: rpcError?.data ?? null,
        sessionId: nextSession,
        status: response.status,
      };
    }
    if (!message) return { ok: false, error: "invalid_response", message: "MCP server returned no JSON-RPC payload", sessionId: nextSession, status: response.status };
    if (message.error) {
      return {
        ok: false,
        error: "mcp_error",
        message: String(message.error?.message || message.error).slice(0, 300),
        code: message.error?.code ?? null,
        data: message.error?.data ?? null,
        sessionId: nextSession,
        status: response.status,
      };
    }
    return { ok: true, result: message.result ?? null, sessionId: nextSession, status: response.status };
  } catch (err) {
    const message = String(err?.message || err);
    if (message.includes("ssrf_")) return { ok: false, error: message.slice(0, 60) };
    if (err?.name === "AbortError") return { ok: false, error: "timeout" };
    return { ok: false, error: "unreachable", message: message.slice(0, 200) };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Era probe. Per the transport fallback rule only a server answer identifies
 * the era: a modern JSON-RPC error means modern (retry with a supported
 * version), anything else means legacy. Network failures and timeouts are
 * surfaced instead of retried, so a dead host costs one timeout, not two.
 */
async function negotiate(server, { env, timeoutMs } = {}) {
  const probe = await rpc(server, "server/discover", {}, {
    env,
    timeoutMs,
    era: "modern",
    protocolVersion: MCP_PROTOCOL_VERSION,
  });
  if (probe.ok) {
    const result = probe.result;
    // A modern server MUST answer discover with its versions; anything else
    // that answered at all is the legacy handshake.
    if (!Array.isArray(result?.supportedVersions)) {
      return { ok: true, era: "legacy", protocolVersion: MCP_LEGACY_PROTOCOL_VERSION };
    }
    return { ok: true, ...pickProtocol(result.supportedVersions, serverInfoOf(result)) };
  }
  if (probe.code === MCP_ERROR_UNSUPPORTED_PROTOCOL) {
    return { ok: true, ...pickProtocol(probe.data?.supported, null) };
  }
  if (probe.code === MCP_ERROR_HEADER_MISMATCH) {
    return { ok: false, error: "header_mismatch", message: probe.message };
  }
  if (probe.error === "mcp_error" || probe.error?.startsWith?.("http_4") || probe.error === "invalid_response") {
    return { ok: true, era: "legacy", protocolVersion: MCP_LEGACY_PROTOCOL_VERSION };
  }
  return probe;
}

export async function mcpConnect(server, { env, timeoutMs } = {}) {
  const negotiation = await negotiate(server, { env, timeoutMs });
  if (!negotiation.ok) return negotiation;
  if (negotiation.era === "modern") {
    return {
      ok: true,
      era: "modern",
      protocolVersion: negotiation.protocolVersion,
      sessionId: null,
      serverInfo: negotiation.serverInfo || null,
    };
  }
  const init = await rpc(server, "initialize", {
    protocolVersion: negotiation.protocolVersion,
    capabilities: {},
    clientInfo: CLIENT_INFO,
  }, { env, timeoutMs, era: "legacy" });
  if (!init.ok) return init;
  // The handshake notification is required by spec but ignored by servers that
  // do not need it; a failure here must not sink an otherwise valid call.
  await rpc(server, "notifications/initialized", {}, {
    env,
    sessionId: init.sessionId,
    notification: true,
    timeoutMs,
    era: "legacy",
  });
  return {
    ok: true,
    era: "legacy",
    protocolVersion: negotiation.protocolVersion,
    sessionId: init.sessionId,
    serverInfo: init.result?.serverInfo || null,
  };
}

/** Bounded catalog copy of a tool's input schema; oversized ones stay hash-only. */
function boundedInputSchema(schema) {
  if (!schema || typeof schema !== "object") return null;
  try {
    return JSON.stringify(schema).length <= MAX_CATALOG_SCHEMA_CHARS ? schema : null;
  } catch {
    return null;
  }
}

export async function mcpListTools(server, { env, timeoutMs } = {}) {
  const connected = await mcpConnect(server, { env, timeoutMs });
  if (!connected.ok) return connected;
  const reply = await rpc(server, "tools/list", {}, {
    env,
    sessionId: connected.sessionId,
    timeoutMs,
    era: connected.era,
    protocolVersion: connected.protocolVersion,
  });
  if (!reply.ok) return reply;
  const tools = Array.isArray(reply.result?.tools) ? reply.result.tools : [];
  const catalog = await Promise.all(
    tools
      .filter((tool) => tool?.name)
      .map(async (tool) => ({
        name: String(tool.name),
        description: String(tool.description || "").slice(0, 200),
        readOnly: Boolean(tool?.annotations?.readOnlyHint),
        // Pin the whole definition, not just the name: description and input
        // schema are where tool-poisoning payloads live.
        hash: await canonicalPayloadHash({
          name: tool.name ?? "",
          title: tool.title ?? null,
          description: tool.description ?? "",
          inputSchema: tool.inputSchema ?? null,
          outputSchema: tool.outputSchema ?? null,
          annotations: tool.annotations ?? null,
        }),
        inputSchema: boundedInputSchema(tool.inputSchema),
      })),
  );
  return { ok: true, tools: catalog };
}

export async function mcpCallTool(
  server,
  { tool, arguments: args = {}, inputResponses, requestState, env, timeoutMs } = {},
) {
  // Each call negotiates again: ops runs are low volume and this keeps no
  // server session state inside the Worker.
  const connected = await mcpConnect(server, { env, timeoutMs });
  if (!connected.ok) return connected;
  // MRTR: a resumed call re-sends the same request with the user's answers and
  // the opaque requestState from the input_required result.
  const resumed = buildInputResponses(inputResponses, requestState);
  const reply = await rpc(server, "tools/call", { name: tool, arguments: args, ...resumed }, {
    env,
    sessionId: connected.sessionId,
    timeoutMs,
    era: connected.era,
    protocolVersion: connected.protocolVersion,
    name: tool,
  });
  if (!reply.ok) return reply;
  const result = reply.result || {};
  if (result.resultType === "input_required") {
    // MRTR: the server wants the user in the loop. The engine turns this into a
    // room card; the call resumes once someone answers.
    const requests = normalizeInputRequests(result.inputRequests);
    const request = requests[0] || null;
    return {
      ok: false,
      error: "input_required",
      message: String(request?.params?.message || "MCP server requested additional input").slice(0, 300),
      requests: requests.length ? boundedStructured(requests) : null,
      // Without the opaque state a retry cannot be matched; oversized state is
      // dropped and the engine fails the step instead of asking into the void.
      requestState:
        typeof result.requestState === "string" && result.requestState.length <= MAX_STRUCTURED_CHARS
          ? result.requestState
          : null,
      serverInfo: connected.serverInfo,
    };
  }
  const text = textFromContent(result.content).slice(0, MAX_TEXT_CHARS);
  if (result.isError) {
    return { ok: false, error: "tool_error", message: text || "MCP tool reported an error", serverInfo: connected.serverInfo };
  }
  return {
    ok: true,
    content: text,
    structured: boundedStructured(result.structuredContent),
    serverInfo: serverInfoOf(result) || connected.serverInfo,
  };
}

function boundedStructured(value) {
  if (value == null) return null;
  try {
    return JSON.stringify(value).length > MAX_STRUCTURED_CHARS ? null : value;
  } catch {
    return null;
  }
}

/**
 * MRTR requests arrive as a map keyed by request id (2026-07-28); the older
 * array shape is accepted too. The engine works on a list and stores it whole.
 */
function normalizeInputRequests(value) {
  if (Array.isArray(value)) return value.filter((item) => item && typeof item === "object");
  if (!value || typeof value !== "object") return [];
  return Object.entries(value)
    .map(([id, request]) => ({ id, ...(request && typeof request === "object" ? request : {}) }))
    .filter((item) => item.method);
}

/** Responses go out as the spec map; the engine stores `{ id, result }` pairs. */
function buildInputResponses(inputResponses, requestState) {
  let map = null;
  if (Array.isArray(inputResponses)) {
    if (!inputResponses.length) return {};
    map = {};
    for (const item of inputResponses) {
      const key = String(item?.id || "").trim();
      if (!key) continue;
      map[key] = item?.result && typeof item.result === "object" ? item.result : item;
    }
    if (!Object.keys(map).length) return {};
  } else if (inputResponses && typeof inputResponses === "object") {
    map = inputResponses;
  } else {
    return {};
  }
  return { inputResponses: map, ...(requestState ? { requestState } : {}) };
}
