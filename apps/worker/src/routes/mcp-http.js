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

/**
 * MCP HTTP endpoints.
 *
 * POST /mcp — project-wide MCP (list rooms, search, etc.)
 * POST /mcp/rooms/:roomId — room-scoped MCP (PH-100)
 * GET /mcp/rooms/:roomId/events — SSE stream alias (same as GET /rooms/:roomId/stream)
 */
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

  if (!roomMcpMatch && !roomEventsMatch && !(url.pathname === "/mcp" && request.method === "POST")) {
    return null;
  }

  const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
    if (err instanceof Response) throw err;
    logError("auth.jwt_verify_failed", err, requestLogCtx);
    return null;
  });
  if (!auth) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  const workerOrigin = url.origin;

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

    const result = await handleMcpRoomRequest(body, {
      env,
      auth,
      roomId,
      logError,
      workerOrigin,
    });
    return json(result, { headers: corsHeaders });
  }

  if (url.pathname === "/mcp" && request.method === "POST") {
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

    const result = await handleMcpRequest(body, { env, auth, logError, workerOrigin });
    return json(result, { headers: corsHeaders });
  }

  return null;
}
