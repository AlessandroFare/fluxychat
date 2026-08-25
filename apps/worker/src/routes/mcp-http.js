import { pickRouteDeps } from "./route-http-deps.js";
import { handleMcpRequest } from "../lib/mcp-server.js";
import { handleMcpRoomRequest } from "../lib/mcp-room-server.js";
import { canAccessRoom } from "../lib/room-access.js";
import { mergeCorsHeadersOntoResponse } from "../lib/http-cors.js";
import { getRoomStubForProject } from "../lib/room-shard.js";
import {
  ensurePublicRoomMembership,
} from "../lib/public-room-access.js";
import { guestMemberRoleForJoin } from "../lib/guest-auth.js";
import { isValidId } from "../lib/valid-ids.js";
import { isJsonRpcNotification, splitMcpHttpStatus } from "../lib/mcp-protocol.js";

/**
 * MCP HTTP endpoints (dual-era Streamable HTTP).
 *
 * POST /mcp — project-wide MCP
 * POST /mcp/rooms/:roomId — room-scoped MCP
 * GET /mcp/rooms/:roomId/events — SSE alias
 * GET/DELETE /mcp — 405 (no session GET stream in 2026-07-28)
 */

function mcpMethodNotAllowed(json, corsHeaders) {
  return json(
    { jsonrpc: "2.0", error: { code: -32600, message: "Method not allowed." }, id: null },
    { status: 405, headers: corsHeaders },
  );
}

async function parseMcpJsonRpc(request, json, corsHeaders) {
  let body;
  try {
    body = await request.json();
  } catch {
    return {
      errorResponse: json(
        { jsonrpc: "2.0", error: { code: -32700, message: "Parse error" }, id: null },
        { status: 400, headers: corsHeaders },
      ),
    };
  }
  if (!body || body.jsonrpc !== "2.0" || typeof body.method !== "string") {
    return {
      errorResponse: json(
        {
          jsonrpc: "2.0",
          error: { code: -32600, message: "Invalid Request" },
          id: body?.id ?? null,
        },
        { status: 400, headers: corsHeaders },
      ),
    };
  }
  if (isJsonRpcNotification(body)) {
    return {
      errorResponse: new Response(null, { status: 202, headers: corsHeaders }),
    };
  }
  if (!Object.prototype.hasOwnProperty.call(body, "id")) {
    return {
      errorResponse: json(
        { jsonrpc: "2.0", error: { code: -32600, message: "Invalid Request" }, id: null },
        { status: 400, headers: corsHeaders },
      ),
    };
  }
  return { body };
}

function mcpJsonRpcResponse(json, rpc, corsHeaders) {
  const { status, body } = splitMcpHttpStatus(rpc);
  return json(body, { status, headers: corsHeaders });
}

export async function dispatchMcpRoutes(request, url, h) {
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

  const roomMcpMatch = url.pathname.match(/^\/mcp\/rooms\/([^/]+)$/);
  const roomEventsMatch = url.pathname.match(/^\/mcp\/rooms\/([^/]+)\/events$/);
  const isProjectMcp = url.pathname === "/mcp";
  const isProtectedResourceMeta =
    url.pathname === "/.well-known/oauth-protected-resource" ||
    url.pathname === "/.well-known/oauth-protected-resource/mcp";

  if (isProtectedResourceMeta && request.method === "GET") {
    return json(
      {
        resource: `${url.origin}/mcp`,
        bearer_methods_supported: ["header"],
        resource_documentation: `${url.origin}/docs/guides/room-as-mcp-server`,
        scopes_supported: ["mcp"],
      },
      { headers: corsHeaders },
    );
  }

  if (!roomMcpMatch && !roomEventsMatch && !isProjectMcp) {
    return null;
  }

  if ((isProjectMcp || roomMcpMatch) && request.method !== "POST" && !roomEventsMatch) {
    return mcpMethodNotAllowed(json, corsHeaders);
  }

  const workerOrigin = url.origin;
  const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
    if (err instanceof Response) throw err;
    logError("auth.jwt_verify_failed", err, requestLogCtx);
    return null;
  });
  if (!auth) {
    return json(
      { jsonrpc: "2.0", error: { code: -32001, message: "Unauthorized" }, id: null },
      {
        status: 401,
        headers: {
          ...corsHeaders,
          "WWW-Authenticate": `Bearer realm="fluxychat", resource_metadata="${workerOrigin}/.well-known/oauth-protected-resource"`,
        },
      },
    );
  }

  if (roomEventsMatch && request.method === "GET") {
    const roomId = decodeURIComponent(roomEventsMatch[1]);
    if (!isValidId(roomId)) {
      return json({ error: "invalid room id" }, { status: 400, headers: corsHeaders });
    }
    const acceptHeader = request.headers.get("Accept") || "";
    if (!acceptHeader.includes("text/event-stream") && !acceptHeader.includes("*/*")) {
      return json({ error: "Accept: text/event-stream required" }, { status: 406, headers: corsHeaders });
    }
    const canAccess = await canAccessRoom(env, auth, roomId);
    if (!canAccess) {
      return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
    }
    await ensurePublicRoomMembership(
      env,
      auth.projectId,
      roomId,
      auth.userId,
      guestMemberRoleForJoin(auth),
    );
    const stub = await getRoomStubForProject(env, auth.projectId, roomId, auth.userId);
    const internalUrl = new URL("https://do-internal/sse");
    internalUrl.search = url.search;
    const sseRequest = new Request(internalUrl.toString(), {
      method: "GET",
      headers: request.headers,
      signal: request.signal,
    });
    try {
      const res = await stub.fetch(sseRequest);
      return mergeCorsHeadersOntoResponse(res, corsHeaders);
    } catch (err) {
      logError("mcp.room_sse_failed", err, requestLogCtx);
      return json({ error: "sse_stream_failed" }, { status: 500, headers: corsHeaders });
    }
  }

  if (roomMcpMatch && request.method === "POST") {
    const roomId = decodeURIComponent(roomMcpMatch[1]);
    if (!isValidId(roomId)) {
      return json(
        {
          jsonrpc: "2.0",
          error: { code: -32602, message: "Invalid room id" },
          id: null,
        },
        { status: 400, headers: corsHeaders },
      );
    }

    const parsed = await parseMcpJsonRpc(request, json, corsHeaders);
    if (parsed.errorResponse) return parsed.errorResponse;

    const result = await handleMcpRoomRequest(parsed.body, {
      env,
      auth,
      roomId,
      logError,
      workerOrigin,
      requestHeaders: request.headers,
    });
    return mcpJsonRpcResponse(json, result, corsHeaders);
  }

  if (isProjectMcp && request.method === "POST") {
    const parsed = await parseMcpJsonRpc(request, json, corsHeaders);
    if (parsed.errorResponse) return parsed.errorResponse;

    const result = await handleMcpRequest(parsed.body, {
      env,
      auth,
      logError,
      workerOrigin,
      requestHeaders: request.headers,
    });
    return mcpJsonRpcResponse(json, result, corsHeaders);
  }

  return null;
}
