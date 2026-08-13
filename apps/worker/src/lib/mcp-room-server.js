/**
 * PH-100: Room-scoped MCP server (one room per endpoint).
 *
 * POST /mcp/rooms/:roomId — JSON-RPC 2.0 (initialize, tools/list, tools/call)
 */
import { canAccessRoom } from "./room-access.js";
import { isGuestOnlyAuth } from "./guest-auth.js";
import { isValidId } from "./valid-ids.js";
import { messageVisibilitySql } from "./message-visibility.js";
import { fetchAggregatedRoomLive } from "./room-shard.js";
import { publishMcpRoomMessage } from "./mcp-room-message.js";
import { checkAndConsumeRateLimit } from "./rate-limit.js";
import { MCP_PROTOCOL_VERSION } from "./mcp-server.js";

export const MCP_ROOM_SERVER_INFO = {
  name: "fluxychat-room",
  version: "1.0.0",
};

/** Tools scoped to the room in the URL (no roomId argument). */
export const MCP_ROOM_TOOLS = [
  {
    name: "send_message",
    description:
      "Send a text message to this room. The message is stored in D1 and broadcast on the room WebSocket timeline.",
    inputSchema: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "Message body (1–4000 characters)",
          minLength: 1,
          maxLength: 4000,
        },
        clientMessageId: {
          type: "string",
          description: "Optional idempotency key for retries",
        },
        visibility: {
          type: "string",
          description:
            'Audience scope: omit for room-wide, "whisper" with visibleTo, or "role:<name>" (e.g. role:evaluator)',
        },
        visibleTo: {
          type: "array",
          items: { type: "string" },
          description: "User ids for whisper messages",
        },
      },
      required: ["content"],
    },
  },
  {
    name: "read_timeline",
    description:
      "Read recent messages from this room timeline (newest first). Respects whisper and role-scoped visibility for the authenticated user.",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Max messages (default 50, max 200)",
          minimum: 1,
          maximum: 200,
        },
        before: {
          type: "string",
          description: "ISO timestamp: return messages older than this",
        },
      },
    },
  },
  {
    name: "list_participants",
    description:
      "List room members and who is online now (from room presence).",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Max members to return (default 100, max 500)",
          minimum: 1,
          maximum: 500,
        },
      },
    },
  },
  {
    name: "subscribe_events",
    description:
      "Returns URLs to stream live room events (SSE or WebSocket). Use the same JWT you used for this MCP call.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];

/**
 * Reject tokens scoped to a different guest room.
 * @param {{ roomId?: string } | null} auth
 * @param {string} roomId
 */
export function assertMcpRoomTokenScope(auth, roomId) {
  if (!auth) return { ok: false, error: "unauthorized", status: 401 };
  if (isGuestOnlyAuth(auth) && auth.roomId && auth.roomId !== roomId) {
    return { ok: false, error: "token_not_valid_for_room", status: 403 };
  }
  return { ok: true };
}

/**
 * @param {*} env
 * @param {{ projectId: string, userId: string }} auth
 * @param {string} roomId
 */
export async function assertMcpRoomAccess(env, auth, roomId) {
  const scope = assertMcpRoomTokenScope(auth, roomId);
  if (!scope.ok) return scope;
  if (!isValidId(roomId)) {
    return { ok: false, error: "invalid_room_id", status: 400 };
  }
  const allowed = await canAccessRoom(env, auth, roomId);
  if (!allowed) {
    return { ok: false, error: "forbidden", status: 403 };
  }
  return { ok: true };
}

function mcpTextResult(data, isError = false) {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    ...(isError ? { isError: true } : {}),
  };
}

/**
 * @param {object} params - JSON-RPC request body
 * @param {object} deps
 * @param {string} deps.roomId
 */
export async function handleMcpRoomRequest(params, deps) {
  const { method, params: rpcParams, id } = params;
  const { env, auth, roomId, logError, workerOrigin } = deps;

  const access = await assertMcpRoomAccess(env, auth, roomId);
  if (!access.ok) {
    return {
      jsonrpc: "2.0",
      id,
      error: {
        code: access.status === 403 ? -32003 : -32001,
        message: access.error,
      },
    };
  }

  switch (method) {
    case "initialize":
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: MCP_PROTOCOL_VERSION,
          capabilities: { tools: {} },
          serverInfo: {
            ...MCP_ROOM_SERVER_INFO,
            roomId,
          },
          instructions:
            "You are connected to a single FluxyChat room. Tools affect that room only. External agents appear on the same timeline as human messages.",
        },
      };

    case "tools/list":
      return {
        jsonrpc: "2.0",
        id,
        result: { tools: MCP_ROOM_TOOLS },
      };

    case "tools/call": {
      const toolResult = await handleMcpRoomToolCall(rpcParams, deps);
      return { jsonrpc: "2.0", id, result: toolResult };
    }

    case "ping":
      return { jsonrpc: "2.0", id, result: {} };

    default:
      return {
        jsonrpc: "2.0",
        id,
        error: { code: -32601, message: `Method not found: ${method}` },
      };
  }
}

async function handleMcpRoomToolCall(params, deps) {
  const { name, arguments: args } = params ?? {};
  const { env, auth, roomId, logError, workerOrigin } = deps;

  const toolRate = await checkAndConsumeRateLimit(env, {
    key: `mcp-tool:${auth.projectId}:${auth.userId}:${roomId}`,
    limit: Number(env.RATE_LIMIT_MCP_TOOLS_PER_MINUTE || 120),
    windowSeconds: 60,
  });
  if (!toolRate.allowed) {
    return mcpTextResult(
      { error: "rate_limit_exceeded", retryAfterSeconds: toolRate.retryAfterSeconds },
      true,
    );
  }

  try {
    let result;
    switch (name) {
      case "send_message":
        result = await toolRoomSendMessage(args, deps);
        break;
      case "read_timeline":
        result = await toolRoomReadTimeline(args, deps);
        break;
      case "list_participants":
        result = await toolRoomListParticipants(args, deps);
        break;
      case "subscribe_events":
        result = toolRoomSubscribeEvents(deps);
        break;
      default:
        result = mcpTextResult({ error: `Unknown tool: ${name}` }, true);
    }

    try {
      const { logMcpToolCall } = await import("./mcp-identity-store.js");
      await logMcpToolCall(env, {
        projectId: auth.projectId,
        serverName: `${MCP_ROOM_SERVER_INFO.name}:${roomId}`,
        toolName: name,
        userId: auth.userId,
        agentId: args?.agentId ?? null,
        success: !result?.isError,
        detail: result?.isError ? "tool_error" : "ok",
      });
    } catch {
      /* audit best-effort */
    }

    return result;
  } catch (err) {
    logError("mcp.room_tool_error", err, { tool: name, roomId, projectId: auth.projectId });
    return mcpTextResult({ error: `Error executing ${name}: ${err.message}` }, true);
  }
}

async function toolRoomSendMessage(args, { env, auth, roomId }) {
  const published = await publishMcpRoomMessage(env, {
    auth,
    roomId,
    content: args?.content,
    clientMessageId: args?.clientMessageId,
    visibility: args?.visibility,
    visibleTo: args?.visibleTo,
  });
  if (!published.ok) {
    return mcpTextResult(
      {
        error: published.error,
        ...(published.retryAfterSeconds != null
          ? { retryAfterSeconds: published.retryAfterSeconds }
          : {}),
      },
      true,
    );
  }
  return mcpTextResult({ message: published.message, status: "sent" });
}

async function toolRoomReadTimeline(args, { env, auth, roomId }) {
  const limit = Math.min(Math.max(Number(args?.limit) || 50, 1), 200);
  const before = typeof args?.before === "string" ? args.before.trim() : null;
  const vis = messageVisibilitySql(auth.userId);

  const params = [auth.projectId, roomId, ...vis.binds];
  let sql = `
    SELECT id, user_id, content, kind, created_at, updated_at, client_message_id, visibility
    FROM messages
    WHERE project_id = ? AND room_id = ? AND deleted_at IS NULL
    ${vis.sql}
  `;
  if (before) {
    sql += " AND created_at < ?";
    params.push(before);
  }
  sql += " ORDER BY created_at DESC LIMIT ?";
  params.push(limit);

  const rows = await env.DB.prepare(sql).bind(...params).all();
  const messages = (rows.results || []).map((m) => ({
    id: m.id,
    userId: m.user_id,
    content: m.content,
    kind: m.kind || "text",
    createdAt: m.created_at,
    updatedAt: m.updated_at,
    clientMessageId: m.client_message_id,
    visibility: m.visibility || "room",
  }));

  return mcpTextResult({ roomId, count: messages.length, messages });
}

async function toolRoomListParticipants(args, { env, auth, roomId }) {
  const limit = Math.min(Math.max(Number(args?.limit) || 100, 1), 500);
  const memberRows = await env.DB.prepare(
    `SELECT user_id, role, joined_at FROM room_members
     WHERE room_id = ? ORDER BY joined_at ASC LIMIT ?`,
  )
    .bind(roomId, limit)
    .all();

  let live = { online: false, users: [], userCount: 0 };
  try {
    live = await fetchAggregatedRoomLive(env, auth.projectId, roomId);
  } catch {
    /* cold DO */
  }

  const onlineSet = new Set(live.users || []);
  const members = (memberRows.results || []).map((m) => ({
    userId: m.user_id,
    role: m.role,
    joinedAt: m.joined_at,
    online: onlineSet.has(m.user_id),
  }));

  return mcpTextResult({
    roomId,
    memberCount: members.length,
    onlineCount: live.userCount ?? onlineSet.size,
    members,
  });
}

function toolRoomSubscribeEvents({ roomId, workerOrigin }) {
  const base = (workerOrigin || "").replace(/\/$/, "");
  const encodedRoom = encodeURIComponent(roomId);
  return mcpTextResult({
    roomId,
    sseUrl: `${base}/rooms/${encodedRoom}/stream`,
    websocketPath: `/ws/room/${encodedRoom}`,
    mcpEventsUrl: `${base}/mcp/rooms/${encodedRoom}/events`,
    auth: {
      header: "Authorization: Bearer <member-jwt>",
      websocketQuery: "token=<member-jwt>",
    },
    note: "SSE and WebSocket use the same JWT as this MCP endpoint. Messages and agent events share one timeline.",
  });
}
