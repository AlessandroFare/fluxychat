import { canAccessRoom } from "./room-access.js";
import { publishMcpRoomMessage } from "./mcp-room-message.js";
import { checkAndConsumeRateLimit } from "./rate-limit.js";
import { messageVisibilitySql } from "./message-visibility.js";
import { incrementOperationalMetric } from "./operational-metrics.js";
import {
  clientSupportsElicitation,
  detectMcpEra,
  discoverResult,
  elicitationInputRequired,
  emptyPromptsList,
  emptyResourcesList,
  emptyResourceTemplatesList,
  mcpCapabilities,
  mcpRequestMetricName,
  mcpRpc,
  mergeMcpInputResponses,
  methodNotFoundError,
  missingClientCapabilityError,
  negotiateLegacyInitializeVersion,
  rejectUnknownProtocolVersion,
  unsupportedProtocolVersionError,
  validateModernStreamableHeaders,
  withModernResult,
} from "./mcp-protocol.js";

/**
 * MCP (Model Context Protocol) Server for FluxyChat.
 *
 * Dual-era Streamable HTTP:
 *   - Modern: protocol 2026-07-28, `server/discover`, per-request `_meta`
 *   - Legacy: `initialize` handshake (2024-11-05 through 2025-11-25)
 *
 * Endpoint: POST /mcp
 *
 * Tools: list_rooms, get_room_messages, send_message, search_chat, get_room_info
 */

export const MCP_SERVER_INFO = {
  name: "fluxychat",
  version: "1.0.0",
};

export { MCP_PROTOCOL_VERSION, MCP_SUPPORTED_PROTOCOL_VERSIONS } from "./mcp-protocol.js";

const PROJECT_MCP_INSTRUCTIONS =
  "FluxyChat project MCP. Tools list rooms, read and send messages, and search chat the JWT can access. Live events stay on room WebSocket/SSE, not on this RPC.";

/**
 * Tool definitions following MCP spec.
 * Each tool has name, description, and inputSchema (JSON Schema).
 */
export const MCP_TOOLS = [
  {
    name: "list_rooms",
    title: "List rooms",
    annotations: { readOnlyHint: true, openWorldHint: false },
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
    outputSchema: {
      type: "object",
      properties: {
        rooms: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              type: { type: "string" },
              memberCount: { type: "number" },
              lastActivity: { type: ["string", "null"] },
              createdAt: { type: "string" },
            },
            required: ["id", "name", "type"],
          },
        },
        count: { type: "number" },
        limit: { type: "number" },
        offset: { type: "number" },
      },
      required: ["rooms", "count"],
    },
  },
  {
    name: "get_room_messages",
    title: "Read room messages",
    annotations: { readOnlyHint: true, openWorldHint: false },
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
    outputSchema: {
      type: "object",
      properties: {
        messages: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: ["string", "number"] },
              userId: { type: "string" },
              content: { type: "string" },
              kind: { type: "string" },
              createdAt: { type: "string" },
              updatedAt: { type: ["string", "null"] },
            },
            required: ["id", "content"],
          },
        },
        count: { type: "number" },
        roomId: { type: "string" },
        limit: { type: "number" },
      },
      required: ["messages", "count"],
    },
  },
  {
    name: "send_message",
    title: "Send message",
    annotations: { destructiveHint: false, openWorldHint: false },
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
    outputSchema: {
      type: "object",
      properties: {
        id: { type: ["string", "number"] },
        roomId: { type: "string" },
        content: { type: "string" },
        createdAt: { type: "string" },
        status: { type: "string" },
      },
      required: ["id", "roomId", "status"],
    },
  },
  {
    name: "search_chat",
    title: "Search chat",
    annotations: { readOnlyHint: true, openWorldHint: false },
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
    outputSchema: {
      type: "object",
      properties: {
        results: { type: "array", items: { type: "object" } },
        count: { type: "number" },
      },
      required: ["results", "count"],
    },
  },
  {
    name: "get_room_info",
    title: "Get room info",
    annotations: { readOnlyHint: true, openWorldHint: false },
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
    outputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        name: { type: "string" },
        type: { type: "string" },
        description: { type: ["string", "null"] },
        memberCount: { type: "number" },
        messageCount: { type: "number" },
        createdAt: { type: "string" },
      },
      required: ["id", "name", "type"],
    },
  },
];

/**
 * Tool result with both the text block (legacy clients) and structuredContent
 * (clients that validate against `outputSchema`).
 */
function jsonToolResult(data) {
  return {
    content: [{ type: "text", text: JSON.stringify(data) }],
    structuredContent: data,
  };
}

/**
 * Handle an MCP JSON-RPC 2.0 request.
 *
 * @param {object} rpc - { method, params, id }
 * @param {object} deps - { env, auth, logError, requestHeaders, era }
 * @returns {object} JSON-RPC 2.0 response (may include httpStatus)
 */
export async function handleMcpRequest(rpc, deps) {
  const { method, params: rpcParams, id } = rpc;
  const { env, auth, logError, requestHeaders } = deps;
  const era = deps.era || detectMcpEra(rpc, requestHeaders);

  const versionError = rejectUnknownProtocolVersion(rpc, requestHeaders);
  if (versionError) return versionError;

  if (era === "modern") {
    const headers = validateModernStreamableHeaders(rpc, requestHeaders);
    if (!headers.ok) return headers.response;
  }

  // agentgateway-style MCP request counter: the method is encoded in the
  // metric name (the metrics table has no label columns).
  void incrementOperationalMetric(env, {
    metricName: mcpRequestMetricName(method),
    projectId: auth?.projectId,
    value: 1,
  }).catch(() => {});

  switch (method) {
    case "server/discover":
      return mcpRpc({
        id,
        result: discoverResult(MCP_SERVER_INFO, mcpCapabilities(), PROJECT_MCP_INSTRUCTIONS),
      });

    case "initialize": {
      const negotiated = negotiateLegacyInitializeVersion(rpcParams);
      if (!negotiated.ok) {
        return unsupportedProtocolVersionError(id, negotiated.requested);
      }
      return mcpRpc({
        id,
        result: {
          protocolVersion: negotiated.protocolVersion,
          capabilities: mcpCapabilities(),
          serverInfo: MCP_SERVER_INFO,
          instructions: PROJECT_MCP_INSTRUCTIONS,
        },
      });
    }

    case "tools/list":
      return mcpRpc({
        id,
        result: withModernResult(era, MCP_SERVER_INFO, { tools: MCP_TOOLS }, { cacheable: true }),
      });

    case "prompts/list":
      return mcpRpc({ id, result: emptyPromptsList(era, MCP_SERVER_INFO) });

    case "resources/list":
      return mcpRpc({ id, result: emptyResourcesList(era, MCP_SERVER_INFO) });

    case "resources/templates/list":
      return mcpRpc({ id, result: emptyResourceTemplatesList(era, MCP_SERVER_INFO) });

    case "tools/call": {
      const toolResult = await handleToolCall(rpcParams, { env, auth, logError, era });
      if (toolResult?.missingCapability) {
        return missingClientCapabilityError(id, toolResult.missingCapability);
      }
      return mcpRpc({
        id,
        result: withModernResult(era, MCP_SERVER_INFO, toolResult),
      });
    }

    case "ping":
      if (era === "modern") return methodNotFoundError(id, method, era);
      return mcpRpc({ id, result: {} });

    default:
      return methodNotFoundError(id, method, era);
  }
}

/**
 * Dispatch a tool call to the appropriate handler.
 */
async function handleToolCall(params, { env, auth, logError, era }) {
  const name = params?.name;
  const args = mergeMcpInputResponses(params);

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
        if (!String(args?.content || "").trim() && era === "modern") {
          if (!clientSupportsElicitation(params)) {
            // Spec: never elicit from a client that did not declare the capability.
            result = { missingCapability: { elicitation: {} }, isError: true };
            break;
          }
          result = elicitationInputRequired({
            message: "Message text is required to send.",
            fieldName: "content",
          });
          break;
        }
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
    // Audit F-71: internal error messages were echoed verbatim to the caller.
    return {
      content: [{ type: "text", text: `Error executing ${name}.` }],
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

  return jsonToolResult({ rooms, count: rooms.length, limit, offset });
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

  return jsonToolResult({ messages, count: messages.length, roomId, limit });
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

  return jsonToolResult({
    id: published.message.id,
    roomId: published.message.roomId,
    content: published.message.content,
    createdAt: published.message.createdAt,
    status: "sent",
  });
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

  return jsonToolResult({ results: result.results, query: result.query, count: result.results.length });
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

  return jsonToolResult({
    id: roomRow.id,
    name: roomRow.name,
    type: roomRow.type,
    description: roomRow.description,
    memberCount: memberCount?.cnt || 0,
    messageCount: messageCount?.cnt || 0,
    createdAt: roomRow.created_at,
  });
}

