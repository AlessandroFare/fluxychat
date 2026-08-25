/**
 * Dual-era MCP: modern 2026-07-28 (stateless) + legacy initialize handshake.
 * Spec: https://modelcontextprotocol.io/specification/2026-07-28
 */

export const MCP_PROTOCOL_VERSION = "2026-07-28";
export const MCP_LEGACY_PROTOCOL_VERSION = "2024-11-05";

export const MCP_SUPPORTED_PROTOCOL_VERSIONS = [
  "2026-07-28",
  "2025-11-25",
  "2025-03-26",
  "2024-11-05",
];

export const MCP_META_PROTOCOL_VERSION = "io.modelcontextprotocol/protocolVersion";
export const MCP_META_CLIENT_INFO = "io.modelcontextprotocol/clientInfo";
export const MCP_META_CLIENT_CAPABILITIES = "io.modelcontextprotocol/clientCapabilities";
export const MCP_META_SERVER_INFO = "io.modelcontextprotocol/serverInfo";

export const MCP_ERROR_HEADER_MISMATCH = -32020;
export const MCP_ERROR_UNSUPPORTED_PROTOCOL = -32022;
export const MCP_ERROR_METHOD_NOT_FOUND = -32601;

export const MCP_LIST_TTL_MS = 3_600_000;

export const MCP_HTTP_ALLOW_HEADERS =
  "Content-Type,Authorization,X-Trace-Id,X-Fluxy-Api-Key,X-Project-Id,MCP-Protocol-Version,Mcp-Method,Mcp-Name,mcp-session-id";

const METHODS_REQUIRING_MCP_NAME = new Set(["tools/call", "resources/read", "prompts/get"]);

export function getRequestHeader(headers, name) {
  if (!headers) return "";
  if (typeof headers.get === "function") return (headers.get(name) || "").trim();
  const lower = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === lower) return String(value || "").trim();
  }
  return "";
}

export function decodeMcpHeaderValue(raw) {
  const value = String(raw || "");
  if (value.startsWith("=?base64?") && value.endsWith("?=")) {
    const encoded = value.slice("=?base64?".length, -2);
    try {
      return atob(encoded);
    } catch {
      return value;
    }
  }
  return value;
}

export function isJsonRpcNotification(body) {
  return Boolean(
    body &&
      body.jsonrpc === "2.0" &&
      typeof body.method === "string" &&
      !Object.prototype.hasOwnProperty.call(body, "id"),
  );
}

export function mcpRpc({ id, result, error, httpStatus }) {
  const out = { jsonrpc: "2.0", id };
  if (error) out.error = error;
  else out.result = result;
  if (httpStatus && httpStatus !== 200) out.httpStatus = httpStatus;
  return out;
}

export function unsupportedProtocolVersionError(id, requested) {
  return mcpRpc({
    id,
    httpStatus: 400,
    error: {
      code: MCP_ERROR_UNSUPPORTED_PROTOCOL,
      message: "Unsupported protocol version",
      data: {
        supported: [...MCP_SUPPORTED_PROTOCOL_VERSIONS],
        requested: requested || null,
      },
    },
  });
}

export function headerMismatchError(id, message) {
  return mcpRpc({
    id,
    httpStatus: 400,
    error: {
      code: MCP_ERROR_HEADER_MISMATCH,
      message,
    },
  });
}

export function methodNotFoundError(id, method, era) {
  return mcpRpc({
    id,
    httpStatus: era === "modern" ? 404 : 200,
    error: {
      code: MCP_ERROR_METHOD_NOT_FOUND,
      message: `Method not found: ${method}`,
    },
  });
}

export function detectMcpEra(body, headers) {
  const method = body?.method;
  if (method === "initialize" || method === "notifications/initialized") return "legacy";
  const headerVersion = getRequestHeader(headers, "MCP-Protocol-Version");
  const metaVersion = body?.params?._meta?.[MCP_META_PROTOCOL_VERSION];
  if (headerVersion === MCP_PROTOCOL_VERSION || metaVersion === MCP_PROTOCOL_VERSION) {
    return "modern";
  }
  if (method === "server/discover") return "modern";
  return "legacy";
}

/**
 * Reject unknown MCP-Protocol-Version values on any era.
 */
export function rejectUnknownProtocolVersion(body, headers) {
  const headerVersion = getRequestHeader(headers, "MCP-Protocol-Version");
  const metaVersion = body?.params?._meta?.[MCP_META_PROTOCOL_VERSION];
  const requested = headerVersion || metaVersion;
  if (requested && !MCP_SUPPORTED_PROTOCOL_VERSIONS.includes(requested)) {
    return unsupportedProtocolVersionError(body?.id ?? null, requested);
  }
  return null;
}

export function validateModernStreamableHeaders(body, headers) {
  const method = body?.method;
  const headerVersion = getRequestHeader(headers, "MCP-Protocol-Version");
  const headerMethod = getRequestHeader(headers, "Mcp-Method");
  const metaVersion = body?.params?._meta?.[MCP_META_PROTOCOL_VERSION];

  const isDiscoverProbe =
    method === "server/discover" && !headerVersion && !headerMethod;
  if (isDiscoverProbe) {
    return { ok: true, protocolVersion: MCP_PROTOCOL_VERSION };
  }

  if (!headerVersion || !headerMethod) {
    return {
      ok: false,
      response: headerMismatchError(
        body?.id ?? null,
        "Header mismatch: required MCP-Protocol-Version or Mcp-Method missing",
      ),
    };
  }

  if (headerMethod !== method) {
    return {
      ok: false,
      response: headerMismatchError(
        body?.id ?? null,
        `Header mismatch: Mcp-Method header value '${headerMethod}' does not match body value '${method}'`,
      ),
    };
  }

  if (metaVersion && headerVersion !== metaVersion) {
    return {
      ok: false,
      response: headerMismatchError(
        body?.id ?? null,
        "Header mismatch: MCP-Protocol-Version does not match _meta protocolVersion",
      ),
    };
  }

  if (METHODS_REQUIRING_MCP_NAME.has(method)) {
    const headerName = decodeMcpHeaderValue(getRequestHeader(headers, "Mcp-Name"));
    const bodyName =
      method === "resources/read" ? body?.params?.uri : body?.params?.name;
    if (!headerName) {
      return {
        ok: false,
        response: headerMismatchError(
          body?.id ?? null,
          "Header mismatch: required Mcp-Name header missing",
        ),
      };
    }
    if (String(bodyName || "") !== headerName) {
      return {
        ok: false,
        response: headerMismatchError(
          body?.id ?? null,
          `Header mismatch: Mcp-Name header value '${headerName}' does not match body value '${bodyName}'`,
        ),
      };
    }
  }

  return { ok: true, protocolVersion: headerVersion || MCP_PROTOCOL_VERSION };
}

export function negotiateLegacyInitializeVersion(params) {
  const requested = params?.protocolVersion;
  if (!requested) return { ok: true, protocolVersion: MCP_LEGACY_PROTOCOL_VERSION };
  if (MCP_SUPPORTED_PROTOCOL_VERSIONS.includes(requested)) {
    return { ok: true, protocolVersion: requested };
  }
  return { ok: false, requested };
}

export function withModernResult(era, serverInfo, result, options = {}) {
  if (era !== "modern") return result;
  if (result?.resultType === "input_required") {
    return {
      ...result,
      _meta: {
        ...(result._meta || {}),
        [MCP_META_SERVER_INFO]: serverInfo,
      },
    };
  }
  const next = {
    resultType: "complete",
    ...result,
    _meta: {
      ...(result?._meta || {}),
      [MCP_META_SERVER_INFO]: serverInfo,
    },
  };
  if (options.cacheable) {
    next.ttlMs = options.ttlMs ?? MCP_LIST_TTL_MS;
    next.cacheScope = options.cacheScope || "private";
  }
  return next;
}

export function discoverResult(serverInfo, capabilities, instructions) {
  return {
    resultType: "complete",
    supportedVersions: [...MCP_SUPPORTED_PROTOCOL_VERSIONS],
    capabilities,
    instructions,
    ttlMs: MCP_LIST_TTL_MS,
    cacheScope: "public",
    _meta: {
      [MCP_META_SERVER_INFO]: serverInfo,
    },
  };
}

export function emptyPromptsList(era, serverInfo) {
  return withModernResult(era, serverInfo, { prompts: [] }, { cacheable: true });
}

export function emptyResourcesList(era, serverInfo) {
  return withModernResult(era, serverInfo, { resources: [] }, { cacheable: true });
}

export function mcpCapabilities() {
  return {
    tools: {},
    prompts: {},
    resources: {},
    elicitation: { form: {} },
  };
}

/**
 * Merge Multi Round-Trip `inputResponses` into tool arguments (MCP 2026-07-28 MRTR).
 */
export function mergeMcpInputResponses(params) {
  const args = { ...(params?.arguments || {}) };
  const responses = params?.inputResponses;
  if (!Array.isArray(responses)) return args;
  for (const item of responses) {
    const payload = item?.result || item;
    if (payload?.action && payload.action !== "accept") continue;
    const content = payload?.content;
    if (content && typeof content === "object" && !Array.isArray(content)) {
      Object.assign(args, content);
    } else if (typeof content === "string" && content.trim()) {
      args.content = content;
    }
  }
  return args;
}

export function elicitationInputRequired({ message, fieldName = "content", schema }) {
  const requestedSchema = schema || {
    type: "object",
    properties: {
      [fieldName]: {
        type: "string",
        minLength: 1,
        maxLength: 4000,
        description: "Text to send",
      },
    },
    required: [fieldName],
  };
  return {
    resultType: "input_required",
    inputRequests: [
      {
        id: "elicit-1",
        method: "elicitation/create",
        params: {
          mode: "form",
          message,
          requestedSchema,
        },
      },
    ],
  };
}

/**
 * Split transport status from the JSON-RPC body.
 */
export function splitMcpHttpStatus(rpc) {
  if (!rpc || typeof rpc !== "object") {
    return { status: 200, body: rpc };
  }
  const { httpStatus, ...body } = rpc;
  return { status: httpStatus || 200, body };
}
