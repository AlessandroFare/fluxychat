import { pickRouteDeps } from "./route-http-deps.js";
import { handleMcpRequest, MCP_SERVER_INFO, MCP_PROTOCOL_VERSION } from "../lib/mcp-server.js";

/**
 * MCP HTTP endpoint.
 *
 * POST /mcp — JSON-RPC 2.0 endpoint for MCP protocol
 *   Accepts: { jsonrpc: "2.0", method: "tools/list" | "tools/call" | "initialize", params: {...}, id: 1 }
 *   Returns: { jsonrpc: "2.0", result: {...}, id: 1 }
 *
 * Authentication: Bearer JWT in Authorization header (same as all other endpoints)
 *
 * MCP clients (Claude, GPT, etc.) connect here to interact with FluxyChat.
 */
export async function dispatchMcpRoutes(request, url, h) {
  if (url.pathname !== "/mcp" || request.method !== "POST") {
    return null;
  }

  const {
    env,
    json,
    corsHeaders,
    requestLogCtx,
    verifyJwtAndGetContext,
    logError,
  } = pickRouteDeps(h, [
    "env",
    "json",
    "corsHeaders",
    "requestLogCtx",
    "verifyJwtAndGetContext",
    "logError",
  ]);

  const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
    if (err instanceof Response) throw err;
    logError("auth.jwt_verify_failed", err, requestLogCtx);
    return null;
  });
  if (!auth) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json(
      { jsonrpc: "2.0", error: { code: -32700, message: "Parse error" }, id: null },
      { status: 400, headers: corsHeaders },
    );
  }

  if (!body || body.jsonrpc !== "2.0" || !body.method) {
    return json(
      {
        jsonrpc: "2.0",
        error: { code: -32600, message: "Invalid Request" },
        id: body?.id ?? null,
      },
      { status: 400, headers: corsHeaders },
    );
  }

  const result = await handleMcpRequest(body, { env, auth, logError });

  return json(result, { headers: corsHeaders });
}

