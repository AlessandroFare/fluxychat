/**
 * PH-100: publish a room message from MCP tools (same timeline as REST/WS).
 */
import { canAccessRoom } from "./room-access.js";
import { assertCanPostToRoom } from "./room-post-policy.js";
import { validateMessageContent } from "./message-validation.js";
import { runFluxyRoomAuthz, runFluxyPublishPipeline } from "./fluxy-config-runtime.js";
import { runInboundMessageMiddleware } from "./message-middleware.js";
import { checkAndConsumeRateLimit } from "./rate-limit.js";
import { fanoutRoomInternal } from "./room-shard.js";
import { normalizeClientMessageId } from "./client-message-id.js";
import {
  resolveMessageVisibility,
  resolveVisibilityRecipientUserIds,
} from "./message-visibility.js";

/**
 * @param {*} env
 * @param {{
 *   auth: { projectId: string, userId: string, roles?: string[] },
 *   roomId: string,
 *   content: string,
 *   clientMessageId?: string | null,
 *   visibility?: string,
 *   visibleTo?: string[],
 * }} input
 * @returns {Promise<
 *   | { ok: true, message: { id: number, roomId: string, content: string, createdAt: string, clientMessageId: string } }
 *   | { ok: false, error: string, status: number, retryAfterSeconds?: number }
 * >}
 */
export async function publishMcpRoomMessage(env, input) {
  const { auth, roomId } = input;
  const projectId = auth.projectId;
  const userId = auth.userId;

  const allowed = await canAccessRoom(env, auth, roomId);
  if (!allowed) {
    return { ok: false, error: "forbidden", status: 403 };
  }

  const postPolicy = await assertCanPostToRoom(env, {
    projectId,
    roomId,
    userId,
    jwtRoles: auth.roles ?? [],
  });
  if (!postPolicy.ok) {
    return { ok: false, error: postPolicy.error, status: postPolicy.status || 403 };
  }

  const contentValidation = validateMessageContent(input.content);
  if (!contentValidation.valid) {
    return { ok: false, error: contentValidation.error, status: 400 };
  }

  const authz = await runFluxyRoomAuthz(roomId, auth);
  if (authz.action === "block") {
    return { ok: false, error: authz.reason, status: 403 };
  }

  let content = contentValidation.content;
  const fluxyPipeline = await runFluxyPublishPipeline(roomId, auth, content, {
    capabilities: authz.capabilities ?? {},
  });
  if (!fluxyPipeline.ok) {
    return { ok: false, error: fluxyPipeline.reason, status: 403 };
  }
  content = fluxyPipeline.content ?? content;

  const middlewareResult = await runInboundMessageMiddleware(env, { content });
  if (!middlewareResult.ok) {
    return {
      ok: false,
      error: middlewareResult.error,
      status: middlewareResult.code === "content_blocked" ? 403 : 400,
    };
  }
  content = middlewareResult.content ?? content;

  const visibilityResult = resolveMessageVisibility({
    visibility: input.visibility,
    visibleTo: input.visibleTo,
  });
  if (!visibilityResult.ok) {
    return { ok: false, error: visibilityResult.error, status: 400 };
  }
  const { visibility, visibleTo } = visibilityResult;
  const visibleToJson =
    visibility === "whisper" ? JSON.stringify(visibleTo) : null;

  const messageRate = await checkAndConsumeRateLimit(env, {
    key: `mcp-msg:${projectId}:${userId}:${roomId}`,
    limit: Number(env.RATE_LIMIT_MCP_MESSAGES_PER_MINUTE || 30),
    windowSeconds: 60,
  });
  if (!messageRate.allowed) {
    return {
      ok: false,
      error: "rate_limit_exceeded",
      status: 429,
      retryAfterSeconds: messageRate.retryAfterSeconds,
    };
  }

  const clientMessageId =
    normalizeClientMessageId(input.clientMessageId) ??
    `mcp_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const createdAt = new Date().toISOString();

  const existing = await env.DB.prepare(
    `SELECT id, room_id, user_id, content, created_at, client_message_id
     FROM messages
     WHERE project_id = ? AND room_id = ? AND client_message_id = ? AND deleted_at IS NULL
     LIMIT 1`,
  )
    .bind(projectId, roomId, clientMessageId)
    .first();
  if (existing) {
    return {
      ok: true,
      message: {
        id: Number(existing.id),
        roomId: existing.room_id,
        content: existing.content,
        createdAt: existing.created_at,
        clientMessageId: existing.client_message_id,
      },
    };
  }

  const insertRes = await env.DB.prepare(
    `INSERT INTO messages (
      project_id, room_id, user_id, content, created_at, client_message_id, kind,
      visibility, visible_to_json
    ) VALUES (?, ?, ?, ?, ?, ?, 'text', ?, ?)`,
  )
    .bind(
      projectId,
      roomId,
      userId,
      content,
      createdAt,
      clientMessageId,
      visibility === "room" ? null : visibility,
      visibleToJson,
    )
    .run();

  const messageId = insertRes.meta.last_row_id;

  const scopedRecipients = await resolveVisibilityRecipientUserIds(
    env,
    roomId,
    visibility,
    visibleTo,
    userId,
  );

  await fanoutRoomInternal(env, projectId, roomId, "/announce", {
    method: "POST",
    body: JSON.stringify({
      roomId,
      id: messageId,
      content,
      userId,
      senderId: userId,
      createdAt,
      clientMessageId,
      mentions: [],
      ...(visibility !== "room"
        ? { visibility, ...(visibleTo.length ? { visibleTo } : {}) }
        : {}),
      ...(scopedRecipients ? { recipientUserIds: [...scopedRecipients] } : {}),
    }),
  });

  return {
    ok: true,
    message: {
      id: messageId,
      roomId,
      content,
      createdAt,
      clientMessageId,
    },
  };
}
