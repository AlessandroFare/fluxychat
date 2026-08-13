import { canAccessRoom } from "./room-access.js";
import { publishMcpRoomMessage } from "./mcp-room-message.js";
import { checkAndConsumeRateLimit } from "./rate-limit.js";
import { messageVisibilitySql } from "./message-visibility.js";

/**
 * MCP (Model Context Protocol) Server for FluxyChat.
 *
 * Exposes FluxyChat rooms/messages as MCP tools that any AI agent
 * (Claude, GPT, etc.) can use via the standard MCP protocol.
 *
 * Protocol: JSON-RPC 2.0 over HTTP POST
 * Endpoints: POST /mcp (single endpoint for all MCP operations)
 *
 * Tools exposed:
 *   - list_rooms: List rooms the authenticated user has access to
 *   - get_room_messages: Get messages from a specific room
 *   - send_message: Send a text message to a room
 *   - search_chat: Full-text search across rooms
 *   - get_room_info: Get room details (members, online count)
 */

export const MCP_SERVER_INFO = {
  name: "fluxychat",
  version: "0.1.0",
};

export const MCP_PROTOCOL_VERSION = "2024-11-05";

/**
 * Tool definitions following MCP spec.
 * Each tool has name, description, and inputSchema (JSON Schema).
 */
export const MCP_TOOLS = [
  {
    name: "list_rooms",
    description:
      "List rooms the authenticated user has access to. Returns room IDs, names, types, member counts, and last activity.",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Max rooms to return (default 20, max 100)",
          minimum: 1,
          maximum: 100,
        },
        offset: {
          type: "number",
          description: "Pagination offset (default 0)",
          minimum: 0,
        },
      },
    },
  },
  {
    name: "get_room_messages",
    description:
      "Get recent messages from a specific room. Returns message content, sender, timestamps, and metadata.",
    inputSchema: {
      type: "object",
      properties: {
        roomId: {
          type: "string",
          description: "The room ID to fetch messages from",
        },
        limit: {
          type: "number",
          description: "Max messages to return (default 50, max 200)",
          minimum: 1,
          maximum: 200,
        },
        before: {
          type: "string",
          description: "ISO timestamp: fetch messages before this time (for pagination)",
        },
      },
      required: ["roomId"],
    },
  },
  {
    name: "send_message",
    description:
      "Send a text message to a room. The message is persisted and broadcast to all room members in real-time.",
    inputSchema: {
      type: "object",
      properties: {
        roomId: {
          type: "string",
          description: "The room ID to send the message to",
        },
        content: {
          type: "string",
          description: "The message text content",
          minLength: 1,
          maxLength: 4000,
        },
      },
      required: ["roomId", "content"],
    },
  },
  {
    name: "search_chat",
    description:
      "Full-text search across rooms the user has access to. Finds messages matching the query, with snippets.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query (supports natural language)",
          minLength: 1,
        },
        roomId: {
          type: "string",
          description: "Optional: restrict search to a specific room",
        },
        limit: {
          type: "number",
          description: "Max results (default 20, max 50)",
          minimum: 1,
          maximum: 50,
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_room_info",
    description:
      "Get detailed information about a room: name, type, member count, online count, description, and settings.",
    inputSchema: {
      type: "object",
      properties: {
        roomId: {
          type: "string",
          description: "The room ID to get info about",
        },
      },
      required: ["roomId"],
    },
  },
];

/**
 * Handle an MCP JSON-RPC 2.0 request.
 *
 * @param {object} params - { method, params, id }
 * @param {object} deps - { env, auth, logError }
 * @returns {object} JSON-RPC 2.0 response
 */
export async function handleMcpRequest(params, deps) {
  const { method, params: toolParams, id } = params;
  const { env, auth, logError } = deps;

  switch (method) {
    case "initialize":
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: MCP_PROTOCOL_VERSION,
          capabilities: {
            tools: {},
          },
          serverInfo: MCP_SERVER_INFO,
        },
      };

    case "tools/list":
      return {
        jsonrpc: "2.0",
        id,
        result: {
          tools: MCP_TOOLS,
        },
      };

    case "tools/call": {
      const toolResult = await handleToolCall(toolParams, { env, auth, logError });
      return {
        jsonrpc: "2.0",
        id,
        result: toolResult,
      };
    }

    case "ping":
      return { jsonrpc: "2.0", id, result: {} };

    default:
      return {
        jsonrpc: "2.0",
        id,
        error: {
          code: -32601,
          message: `Method not found: ${method}`,
        },
      };
  }
}

/**
 * Dispatch a tool call to the appropriate handler.
 */
async function handleToolCall(params, { env, auth, logError }) {
  const { name, arguments: args } = params;

  try {
    let result;
    switch (name) {
      case "list_rooms":
        result = await toolListRooms(args, { env, auth });
        break;
      case "get_room_messages":
        result = await toolGetRoomMessages(args, { env, auth });
        break;
      case "send_message":
        result = await toolSendMessage(args, { env, auth, logError });
        break;
      case "search_chat":
        result = await toolSearchChat(args, { env, auth });
        break;
      case "get_room_info":
        result = await toolGetRoomInfo(args, { env, auth });
        break;
      default:
        result = {
          content: [{ type: "text", text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }

    try {
      const { logMcpToolCall } = await import("./mcp-identity-store.js");
      await logMcpToolCall(env, {
        projectId: auth.projectId,
        serverName: MCP_SERVER_INFO.name,
        toolName: name,
        userId: auth.userId,
        agentId: args?.agentId ?? null,
        success: !result?.isError,
        detail: result?.isError ? "tool_error" : "ok",
      });
    } catch {
      // Audit is best-effort.
    }

    return result;
  } catch (err) {
    logError("mcp.tool_error", err, { tool: name, projectId: auth.projectId });
    return {
      content: [{ type: "text", text: `Error executing ${name}: ${err.message}` }],
      isError: true,
    };
  }
}

/**
 * Tool: list_rooms
 */
async function toolListRooms(args, { env, auth }) {
  const limit = Math.min(Math.max(Number(args?.limit) || 20, 1), 100);
  const offset = Math.max(Number(args?.offset) || 0, 0);

  const rows = await env.DB.prepare(
    `SELECT r.id, r.name, r.type, r.created_at,
       (SELECT COUNT(*) FROM room_members WHERE room_id = r.id) AS member_count,
       (SELECT MAX(created_at) FROM messages WHERE room_id = r.id AND deleted_at IS NULL) AS last_activity
     FROM rooms r
     JOIN room_members rm ON rm.room_id = r.id AND rm.user_id = ?
     WHERE r.project_id = ?
     ORDER BY last_activity DESC NULLS LAST
     LIMIT ? OFFSET ?`
  )
    .bind(auth.userId, auth.projectId, limit, offset)
    .all();

  const rooms = (rows.results || []).map((r) => ({
    id: r.id,
    name: r.name,
    type: r.type,
    memberCount: r.member_count,
    lastActivity: r.last_activity,
    createdAt: r.created_at,
  }));

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({ rooms, count: rooms.length, limit, offset }),
      },
    ],
  };
}

/**
 * Tool: get_room_messages
 */
async function toolGetRoomMessages(args, { env, auth }) {
  const { roomId, before } = args;
  if (!roomId) {
    return { content: [{ type: "text", text: "Error: roomId is required" }], isError: true };
  }

  const allowed = await canAccessRoom(env, auth, roomId);
  if (!allowed) {
    return { content: [{ type: "text", text: "Error: forbidden" }], isError: true };
  }

  const limit = Math.min(Math.max(Number(args?.limit) || 50, 1), 200);
  const vis = messageVisibilitySql(auth.userId);

  const params = [auth.projectId, roomId, ...vis.binds];
  let sql = `
    SELECT id, user_id, content, kind, created_at, updated_at
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
  }));

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({ messages, count: messages.length, roomId, limit }),
      },
    ],
  };
}

/**
 * Tool: send_message
 */
async function toolSendMessage(args, { env, auth, logError }) {
  const { roomId, content } = args;
  if (!roomId || !content) {
    return {
      content: [{ type: "text", text: "Error: roomId and content are required" }],
      isError: true,
    };
  }

  const toolRate = await checkAndConsumeRateLimit(env, {
    key: `mcp-msg:${auth.projectId}:${auth.userId}:${roomId}`,
    limit: Number(env.RATE_LIMIT_MCP_MESSAGES_PER_MINUTE || 30),
    windowSeconds: 60,
  });
  if (!toolRate.allowed) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            error: "rate_limit_exceeded",
            retryAfterSeconds: toolRate.retryAfterSeconds,
          }),
        },
      ],
      isError: true,
    };
  }

  const published = await publishMcpRoomMessage(env, {
    auth,
    roomId,
    content,
    clientMessageId: args?.clientMessageId,
  });

  if (!published.ok) {
    logError?.("mcp.send_message_failed", new Error(published.error), {
      roomId,
      projectId: auth.projectId,
    });
    return {
      content: [{ type: "text", text: `Error: ${published.error}` }],
      isError: true,
    };
  }

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          id: published.message.id,
          roomId: published.message.roomId,
          content: published.message.content,
          createdAt: published.message.createdAt,
          status: "sent",
        }),
      },
    ],
  };
}

/**
 * Tool: search_chat
 */
async function toolSearchChat(args, { env, auth }) {
  const { query } = args;
  if (!query) {
    return { content: [{ type: "text", text: "Error: query is required" }], isError: true };
  }

  const limit = Math.min(Math.max(Number(args?.limit) || 20, 1), 50);
  const roomId = args?.roomId || null;

  const { searchMessages } = await import("./message-search.js");
  const result = await searchMessages(env, {
    projectId: auth.projectId,
    userId: auth.userId,
    roles: auth.roles,
    query,
    roomId,
    limit,
  });

  if (!result.ok) {
    return {
      content: [{ type: "text", text: `Search error: ${result.error}` }],
      isError: true,
    };
  }

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({ results: result.results, query: result.query, count: result.results.length }),
      },
    ],
  };
}

/**
 * Tool: get_room_info
 */
async function toolGetRoomInfo(args, { env, auth }) {
  const { roomId } = args;
  if (!roomId) {
    return { content: [{ type: "text", text: "Error: roomId is required" }], isError: true };
  }

  const allowed = await canAccessRoom(env, auth, roomId);
  if (!allowed) {
    return { content: [{ type: "text", text: `Room not found: ${roomId}` }], isError: true };
  }

  const roomRow = await env.DB.prepare(
    `SELECT id, name, type, description, created_at
     FROM rooms
     WHERE id = ? AND project_id = ?`
  )
    .bind(roomId, auth.projectId)
    .first();

  if (!roomRow) {
    return { content: [{ type: "text", text: `Room not found: ${roomId}` }], isError: true };
  }

  const memberCount = await env.DB.prepare(
    `SELECT COUNT(*) AS cnt FROM room_members WHERE room_id = ?`
  )
    .bind(roomId)
    .first();

  const messageCount = await env.DB.prepare(
    `SELECT COUNT(*) AS cnt FROM messages WHERE room_id = ? AND deleted_at IS NULL`
  )
    .bind(roomId)
    .first();

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          id: roomRow.id,
          name: roomRow.name,
          type: roomRow.type,
          description: roomRow.description,
          memberCount: memberCount?.cnt || 0,
          messageCount: messageCount?.cnt || 0,
          createdAt: roomRow.created_at,
        }),
      },
    ],
  };
}

