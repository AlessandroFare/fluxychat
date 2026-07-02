/**
 * Messages: create, edit, delete, reactions
 * @returns {Promise<Response|null>}
 */
import { normalizeClientMessageId } from "../lib/client-message-id.js";
import { attachAttachmentsToMessages } from "../lib/messages-attachments.js";
import {
  normalizeTemplateVars,
  renderMessageTemplate,
} from "../lib/message-template.js";
import { pickRouteDeps } from "./route-http-deps.js";
import { runInboundMessageMiddleware } from "../lib/message-middleware.js";
import {
  notifyDmRecipient,
  notifyMentionedUsers,
} from "../lib/in-app-notifications.js";
import { isBlockedBetween, filterBlockedUserIds } from "../lib/user-blocks.js";
import { assertGuestCanWrite } from "../lib/guest-auth.js";
import { isValidEmoji, normalizeEmoji } from "../lib/emoji.js";
import {
  parsePollCreateInput,
  insertMessagePoll,
  getMessagePoll,
  castPollVote,
} from "../lib/message-polls.js";
import { translateMessageContent } from "../lib/message-translation.js";
import {
  upsertMessageDelivery,
  listMessageDeliveries,
} from "../lib/message-deliveries.js";
import {
  fanoutRoomInternal,
  getRoomStubForProject,
} from "../lib/room-shard.js";
// B-4: hoist dynamic imports to top-level so they run once at module init.
import { resolveMessageExpiry } from "../lib/message-ttl.js";
import { resolveMessageVisibility, messageVisibilitySql } from "../lib/message-visibility.js";

export async function dispatchMessagesRoutes(request, url, h) {
  const {
    env,
    ctx,
    traceId,
    corsHeaders,
    json,
    requestLogCtx,
    verifyJwtAndGetContext,
    hasAnyRole,
    logError,
    checkAndConsumeProjectQuota,
    quotaResetInfo,
    checkAndConsumeRateLimit,
    incrementOperationalMetric,
    validateMessageContent,
    isValidId,
    extractMentions,
    extractFirstUrl,
    fetchOgPreview,
    sanitizeMessageAttachments,
    deliverWebhooks,
    invokeMentionedAgents,
    safeSchedulePostMessageAutomations,
    canAccessRoom,
    writeAuditEvent,
  } = pickRouteDeps(h, [
    "env",
    "ctx",
    "traceId",
    "corsHeaders",
    "json",
    "requestLogCtx",
    "verifyJwtAndGetContext",
    "hasAnyRole",
    "logError",
    "checkAndConsumeProjectQuota",
    "quotaResetInfo",
    "checkAndConsumeRateLimit",
    "incrementOperationalMetric",
    "validateMessageContent",
    "isValidId",
    "extractMentions",
    "extractFirstUrl",
    "fetchOgPreview",
    "sanitizeMessageAttachments",
    "deliverWebhooks",
    "invokeMentionedAgents",
    "safeSchedulePostMessageAutomations",
    "canAccessRoom",
    "writeAuditEvent",
  ]);

  // Authenticated REST message create endpoint
  if (url.pathname === "/messages" && request.method === "POST") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", {
        status: 401,
        headers: corsHeaders,
      });
    }

    const guestWrite = assertGuestCanWrite(env, auth);
    if (!guestWrite.ok) {
      return json({ error: guestWrite.error }, { status: guestWrite.status });
    }

    const body = await request.json().catch(() => null);
    if (!body || !body.roomId || !isValidId(body.roomId)) {
      return json(
        { error: "roomId required: must be 1-128 chars, alphanumeric with _ -" },
        { status: 400 }
      );
    }
    const { userId: authUserId, projectId: authProjectId } = auth;
    const roomId = body.roomId;

    const allowed = await canAccessRoom(env, auth, roomId);
    if (!allowed) {
      return json({ error: "forbidden" }, { status: 403 });
    }

    const roomAccessRow = await env.DB.prepare(
      "SELECT type FROM rooms WHERE project_id = ? AND id = ? LIMIT 1",
    )
      .bind(authProjectId, roomId)
      .first();
    if (!roomAccessRow) {
      return json({ error: "room not found" }, { status: 404 });
    }
    if (roomAccessRow.type === "dm") {
      const dmMembers = await env.DB.prepare(
        "SELECT user_id FROM room_members WHERE room_id = ?",
      )
        .bind(roomId)
        .all();
      for (const row of dmMembers.results || []) {
        if (!row.user_id || row.user_id === authUserId) continue;
        if (await isBlockedBetween(env, authProjectId, authUserId, row.user_id)) {
          return json({ error: "user_blocked" }, { status: 403 });
        }
      }
    }

    let pollCreate = null;
    let content = "";
    const templateId =
      typeof body.templateId === "string" ? body.templateId.trim() : "";
    if (body.poll) {
      pollCreate = parsePollCreateInput(body.poll);
      if (!pollCreate.ok) {
        return json({ error: pollCreate.error }, { status: 400 });
      }
      content = pollCreate.question;
    } else if (templateId) {
      const tpl = await env.DB.prepare(
        `SELECT body FROM message_templates WHERE id = ? AND project_id = ?`
      )
        .bind(templateId, authProjectId)
        .first();
      if (!tpl) {
        return json({ error: "template_not_found" }, { status: 404 });
      }
      const vars = normalizeTemplateVars(body.templateVars ?? body.vars) ?? {};
      content = renderMessageTemplate(tpl.body, vars);
    } else {
      const contentValidation = validateMessageContent(body.content);
      if (!contentValidation.valid) {
        return json({ error: contentValidation.error }, { status: 400 });
      }
      content = contentValidation.content;
    }

    const middlewareResult = await runInboundMessageMiddleware(env, { content });
    if (!middlewareResult.ok) {
      return json(
        { error: middlewareResult.error, code: middlewareResult.code },
        { status: middlewareResult.code === "content_blocked" ? 403 : 400 },
      );
    }
    content = middlewareResult.content;
    const expiryResult = resolveMessageExpiry(body, env);
    if (!expiryResult.ok) {
      return json({ error: expiryResult.error }, { status: 400 });
    }
    const messageExpiresAt = expiryResult.expiresAt;
    const visibilityResult = resolveMessageVisibility(body);
    if (!visibilityResult.ok) {
      return json({ error: visibilityResult.error }, { status: 400 });
    }
    const { visibility, visibleTo } = visibilityResult;
    const visibleToJson =
      visibility === "whisper" ? JSON.stringify(visibleTo) : null;
    const parentId = body.replyTo ? Number(body.replyTo) || null : null;
    const clientMessageId = normalizeClientMessageId(body.clientMessageId);
    const createdAt = new Date().toISOString();

    if (clientMessageId) {
      const existing = await env.DB.prepare(
        `SELECT id, room_id, user_id, content, created_at, parent_id, edited_at, deleted_at,
                mentions, og_title, og_description, og_image, og_url, client_message_id
         FROM messages
         WHERE project_id = ? AND room_id = ? AND client_message_id = ? AND deleted_at IS NULL
         LIMIT 1`
      )
        .bind(authProjectId, roomId, clientMessageId)
        .first();
      if (existing) {
        const [mapped] = await attachAttachmentsToMessages(
          env,
          authProjectId,
          existing.room_id,
          [existing],
        );
        return json({ message: mapped });
      }
    }

    const quotaResult = await checkAndConsumeProjectQuota(env, {
      projectId: authProjectId,
      metricName: "messages_created",
      amount: 1,
    }).catch(() => ({ allowed: true }));
    if (!quotaResult.allowed) {
      const reset = quotaResetInfo();
      return json(
        {
          error: "quota_exceeded",
          metric: quotaResult.metricName,
          limit: quotaResult.limit,
          used: quotaResult.used,
          month: quotaResult.monthKey,
          resetsAt: reset.resetsAt,
          retryAfterSeconds: reset.retryAfterSeconds,
        },
        { status: 402, headers: { "Retry-After": String(reset.retryAfterSeconds) } }
      );
    }
    const messageRate = await checkAndConsumeRateLimit(env, {
      key: `msg:${authProjectId}:${authUserId}:${roomId}`,
      limit: Number(env.RATE_LIMIT_MESSAGES_PER_MINUTE || 60),
      windowSeconds: 60,
    });
    if (!messageRate.allowed) {
      return json(
        { error: "rate_limit_exceeded", retryAfterSeconds: messageRate.retryAfterSeconds },
        {
          status: 429,
          headers: {
            "Retry-After": String(messageRate.retryAfterSeconds),
          },
        }
      );
    }

    const mentionsRaw = extractMentions(content);
    const mentions = await filterBlockedUserIds(
      env,
      authProjectId,
      authUserId,
      mentionsRaw,
    );
    const firstUrl = extractFirstUrl(content);
    let preview = null;
    if (firstUrl && env.OG_PREVIEW_ENABLED !== "false") {
      preview = await fetchOgPreview(firstUrl, env);
    }

    const insertRes = await env.DB.prepare(
      `INSERT INTO messages (
        project_id, room_id, user_id, content, created_at, parent_id,
        mentions, og_title, og_description, og_image, og_url, client_message_id, expires_at,
        visibility, visible_to_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        authProjectId,
        roomId,
        authUserId,
        content,
        createdAt,
        parentId,
        mentions.length ? JSON.stringify(mentions) : null,
        preview?.title || null,
        preview?.description || null,
        preview?.imageUrl || null,
        preview?.url || null,
        clientMessageId,
        messageExpiresAt,
        visibility === "room" ? null : visibility,
        visibleToJson,
      )
      .run();
    ctx.waitUntil(
      incrementOperationalMetric(env, {
        metricName: "messages_created",
        projectId: authProjectId,
        value: 1,
      }).catch((err) => logError("metrics.increment_failed", err, requestLogCtx))
    );

    const messageId = insertRes.meta.last_row_id;

    let pollSnapshot = null;
    if (pollCreate?.ok) {
      pollSnapshot = await insertMessagePoll(env, {
        messageId,
        projectId: authProjectId,
        roomId,
        question: pollCreate.question,
        options: pollCreate.options,
        allowMultiple: pollCreate.allowMultiple,
      });
    }

    const sanitizedAttachments = sanitizeMessageAttachments(body.attachments);

    if (sanitizedAttachments.length) {
      const attStmts = sanitizedAttachments.map((a) =>
        env.DB.prepare(
          "INSERT INTO attachments (project_id, room_id, message_id, kind, url, name, size_bytes, content_type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
        ).bind(
          authProjectId,
          roomId,
          messageId,
          a.kind,
          a.url,
          a.name,
          a.sizeBytes,
          a.contentType,
          createdAt
        )
      );
      await env.DB.batch(attStmts);
    }

    if (mentions.length) {
      const mentionStmts = mentions.map((mentionedId) =>
        env.DB.prepare(
          "INSERT INTO message_mentions (project_id, room_id, message_id, mentioned_user_id, created_at) VALUES (?, ?, ?, ?, ?)"
        ).bind(authProjectId, roomId, messageId, mentionedId, createdAt)
      );
      await env.DB.batch(mentionStmts);

      await env.DB.prepare(
        "INSERT OR IGNORE INTO automation_events (project_id, event_type, room_id, payload, created_at, idempotency_key) VALUES (?, ?, ?, ?, ?, ?)"
      )
        .bind(
          authProjectId,
          "mention",
          roomId,
          JSON.stringify({
            fromUserId: authUserId,
            toUserIds: mentions,
            messageId,
          }),
          createdAt,
          // Audit B-7: deterministic key for `(project, event_type, messageId)`.
          // A retry of the same message-create handler will be a no-op.
          `mention:${authProjectId}:${messageId}`
        )
        .run();

      ctx.waitUntil(
        deliverWebhooks(env, authProjectId, "mention", {
          roomId,
          fromUserId: authUserId,
          toUserIds: mentions,
          messageId,
          createdAt,
        }).catch((err) =>
          logError("webhook.mention_delivery_failed", err, requestLogCtx)
        )
      );

      ctx.waitUntil(
        notifyMentionedUsers(env, {
          projectId: authProjectId,
          roomId,
          fromUserId: authUserId,
          toUserIds: mentions,
          messageId,
          preview: content,
        }).catch((err) =>
          logError("notifications.mention_failed", err, requestLogCtx),
        ),
      );
    }

    const roomRow = await env.DB.prepare(
      "SELECT type FROM rooms WHERE project_id = ? AND id = ?",
    )
      .bind(authProjectId, roomId)
      .first();
    if (roomRow?.type === "dm") {
      ctx.waitUntil(
        notifyDmRecipient(env, {
          projectId: authProjectId,
          roomId,
          fromUserId: authUserId,
          messageId,
          preview: content,
        }).catch((err) =>
          logError("notifications.dm_failed", err, requestLogCtx),
        ),
      );
    }

    const roomStub = await getRoomStubForProject(env, authProjectId, roomId, authUserId);
    ctx.waitUntil(
      roomStub
        .fetch("https://internal/schedule-expiry", { method: "POST" })
        .catch((err) => logError("message.expiry_schedule_failed", err, requestLogCtx)),
    );

    await fanoutRoomInternal(env, authProjectId, roomId, "/announce", {
      method: "POST",
      body: JSON.stringify({
        roomId,
        id: messageId,
        content,
        userId: authUserId,
        senderId: authUserId,
        createdAt,
        parentId,
        ...(messageExpiresAt ? { expiresAt: messageExpiresAt } : {}),
        ...(visibility === "whisper" ? { visibility, visibleTo } : {}),
        ...(pollSnapshot ? { poll: pollSnapshot, contentType: "poll" } : {}),
        clientMessageId: clientMessageId ?? undefined,
        mentions,
        preview,
        attachments: sanitizedAttachments.map((a) => ({
          kind: a.kind,
          url: a.url,
          name: a.name,
          sizeBytes: a.sizeBytes,
          contentType: a.contentType,
        })),
      }),
    });

    ctx.waitUntil(
      deliverWebhooks(env, authProjectId, "message.created", {
        message: {
          id: messageId,
          roomId,
          senderId: authUserId,
          content,
          createdAt,
          attachments: sanitizedAttachments,
        },
      }).catch((err) =>
        logError("webhook.message_created_delivery_failed", err, requestLogCtx)
      )
    );

    if (mentions.length) {
      ctx.waitUntil(
        invokeMentionedAgents(
          env,
          authProjectId,
          roomId,
          authUserId,
          content,
          mentions,
          traceId,
          parentId,
        ).catch((err) =>
          logError("agent.mention_invoke_failed", err, requestLogCtx)
        )
      );
    }

    ctx.waitUntil(
      safeSchedulePostMessageAutomations(env, {
        projectId: authProjectId,
        roomId,
        authorUserId: authUserId,
        messageId,
        content,
        traceId,
        mentionedUserIds: mentions,
        roomType: roomRow?.type ?? null,
        attachments: sanitizedAttachments,
      }).catch(async (err) => {
        // Audit S-41: surface automation failures to the operator.
        // Without this, exceptions thrown inside `ctx.waitUntil` are
        // silently dropped, which means a broken automation looks
        // identical to "no automation was configured".
        logError("automation.schedule_failed", err, {
          traceId,
          projectId: authProjectId,
          roomId,
          authorUserId: authUserId,
          messageId,
        });
        try {
          await writeAuditEvent(env, {
            projectId: authProjectId,
            actorUserId: authUserId,
            action: "automation.schedule_failed",
            targetType: "message",
            targetId: String(messageId),
            traceId,
            metadata: { error: String(err?.message || err) },
          });
        } catch {
          // audit log failure must not surface to the client
        }
      }),
    );

    return json({
      message: {
        id: messageId,
        roomId,
        userId: authUserId,
        senderId: authUserId,
        content,
        createdAt,
        parentId,
        clientMessageId: clientMessageId ?? undefined,
        mentions,
        preview,
        attachments: sanitizedAttachments.map((a) => ({
          kind: a.kind,
          url: a.url,
          name: a.name,
          sizeBytes: a.sizeBytes ?? undefined,
          contentType: a.contentType ?? undefined,
        })),
        ...(messageExpiresAt ? { expiresAt: messageExpiresAt } : {}),
        ...(visibility === "whisper" ? { visibility, visibleTo } : {}),
        ...(pollSnapshot ? { poll: pollSnapshot } : {}),
      },
    });
  }

  const pollGetMatch = url.pathname.match(/^\/messages\/([^/]+)\/poll$/);
  if (pollGetMatch && request.method === "GET") {
    const auth = await verifyJwtAndGetContext(request, env).catch(() => null);
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const messageId = Number(pollGetMatch[1]);
    if (!Number.isFinite(messageId)) {
      return json({ error: "invalid message id" }, { status: 400 });
    }
    const poll = await getMessagePoll(env, messageId, auth.projectId);
    if (!poll) return json({ error: "poll not found" }, { status: 404 });
    return json({ poll });
  }

  const pollVoteMatch = url.pathname.match(/^\/messages\/([^/]+)\/vote$/);
  if (pollVoteMatch && request.method === "POST") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const messageId = Number(pollVoteMatch[1]);
    if (!Number.isFinite(messageId)) {
      return json({ error: "invalid message id" }, { status: 400 });
    }
    const body = await request.json().catch(() => null);
    const optionIndex = Number(body?.optionIndex ?? body?.option_index);
    const msgRow = await env.DB.prepare(
      "SELECT room_id FROM messages WHERE id = ? AND project_id = ? AND deleted_at IS NULL LIMIT 1",
    )
      .bind(messageId, auth.projectId)
      .first();
    if (!msgRow) return json({ error: "message not found" }, { status: 404 });

    const result = await castPollVote(env, {
      messageId,
      projectId: auth.projectId,
      roomId: msgRow.room_id,
      userId: auth.userId,
      optionIndex,
    });
    if (!result.ok) {
      return json({ error: result.error }, { status: result.status || 400 });
    }

    const roomId = msgRow.room_id;
    await fanoutRoomInternal(env, auth.projectId, roomId, "/announce", {
      method: "POST",
      body: JSON.stringify({
        type: "poll_updated",
        roomId,
        messageId,
        poll: result.poll,
        userId: auth.userId,
      }),
    });

    return json({ ok: true, poll: result.poll });
  }

  const translateMatch = url.pathname.match(/^\/messages\/([^/]+)\/translate$/);
  if (translateMatch && request.method === "POST") {
    const auth = await verifyJwtAndGetContext(request, env).catch(() => null);
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const messageId = Number(translateMatch[1]);
    if (!Number.isFinite(messageId)) {
      return json({ error: "invalid message id" }, { status: 400 });
    }
    const body = await request.json().catch(() => null);
    const targetLang = body?.targetLang ?? body?.target_lang;
    const msgRow = await env.DB.prepare(
      `SELECT id, room_id, content FROM messages
       WHERE id = ? AND project_id = ? AND deleted_at IS NULL LIMIT 1`,
    )
      .bind(messageId, auth.projectId)
      .first();
    if (!msgRow) return json({ error: "message not found" }, { status: 404 });
    const allowed = await canAccessRoom(env, auth, msgRow.room_id);
    if (!allowed) return json({ error: "forbidden" }, { status: 403 });

    const result = await translateMessageContent(env, {
      projectId: auth.projectId,
      messageId,
      content: msgRow.content,
      targetLang,
      sourceLang: body?.sourceLang ?? body?.source_lang,
    });
    if (!result.ok) {
      return json({ error: result.error, detail: result.detail }, { status: result.status || 500 });
    }
    return json({
      messageId,
      cached: result.cached,
      translation: result.translation,
    });
  }

  const deliveredMatch = url.pathname.match(/^\/messages\/([^/]+)\/delivered$/);
  if (deliveredMatch && request.method === "POST") {
    const auth = await verifyJwtAndGetContext(request, env).catch(() => null);
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const messageId = Number(deliveredMatch[1]);
    if (!Number.isFinite(messageId)) {
      return json({ error: "invalid message id" }, { status: 400 });
    }
    const msgRow = await env.DB.prepare(
      "SELECT room_id, user_id FROM messages WHERE id = ? AND project_id = ? AND deleted_at IS NULL LIMIT 1",
    )
      .bind(messageId, auth.projectId)
      .first();
    if (!msgRow) return json({ error: "message not found" }, { status: 404 });
    const allowed = await canAccessRoom(env, auth, msgRow.room_id);
    if (!allowed) return json({ error: "forbidden" }, { status: 403 });
    if (msgRow.user_id === auth.userId) {
      return json({ error: "cannot_mark_own_message_delivered" }, { status: 400 });
    }

    await upsertMessageDelivery(env, {
      messageId,
      userId: auth.userId,
      status: "delivered",
    });

    await fanoutRoomInternal(env, auth.projectId, msgRow.room_id, "/announce", {
      method: "POST",
      body: JSON.stringify({
        type: "delivery_updated",
        roomId: msgRow.room_id,
        messageId,
        userId: auth.userId,
        status: "delivered",
      }),
    });

    return json({ ok: true, messageId, userId: auth.userId, status: "delivered" });
  }

  const deliveriesMatch = url.pathname.match(/^\/messages\/([^/]+)\/deliveries$/);
  if (deliveriesMatch && request.method === "GET") {
    const auth = await verifyJwtAndGetContext(request, env).catch(() => null);
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const messageId = Number(deliveriesMatch[1]);
    if (!Number.isFinite(messageId)) {
      return json({ error: "invalid message id" }, { status: 400 });
    }
    const msgRow = await env.DB.prepare(
      "SELECT room_id, user_id FROM messages WHERE id = ? AND project_id = ? LIMIT 1",
    )
      .bind(messageId, auth.projectId)
      .first();
    if (!msgRow) return json({ error: "message not found" }, { status: 404 });
    const allowed = await canAccessRoom(env, auth, msgRow.room_id);
    if (!allowed) return json({ error: "forbidden" }, { status: 403 });

    const deliveries = await listMessageDeliveries(env, messageId);
    return json({ messageId, deliveries });
  }

  // Authenticated message edit endpoint: PATCH /messages/:id
  if (
    url.pathname.startsWith("/messages/") &&
    !url.pathname.endsWith("/reactions") &&
    !url.pathname.endsWith("/translate") &&
    !url.pathname.endsWith("/delivered") &&
    !url.pathname.endsWith("/deliveries") &&
    !url.pathname.endsWith("/poll") &&
    !url.pathname.endsWith("/vote") &&
    request.method === "PATCH"
  ) {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      console.error("JWT verify error", err);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", {
        status: 401,
        headers: corsHeaders,
      });
    }

    const messageId = url.pathname.split("/")[2];
    if (!messageId) {
      return json({ error: "message id required" }, { status: 400 });
    }

    const body = await request.json().catch(() => null);
    if (!body || !body.content) {
      return json({ error: "content required" }, { status: 400 });
    }

    const { userId, projectId: authProjectId } = auth;

    // Ensure message exists and belongs to this user + project
    const existing = await env.DB.prepare(
      "SELECT id, room_id, user_id, deleted_at FROM messages WHERE id = ? AND project_id = ?"
    )
      .bind(messageId, authProjectId)
      .first();

    if (!existing) {
      return json({ error: "message not found" }, { status: 404 });
    }
    if (existing.deleted_at) {
      return json({ error: "message deleted" }, { status: 409 });
    }
    if (existing.user_id !== userId) {
      return json({ error: "forbidden" }, { status: 403 });
    }

    const now = new Date().toISOString();
    await env.DB.prepare(
      "UPDATE messages SET content = ?, edited_at = ? WHERE id = ? AND project_id = ?"
    )
      .bind(body.content, now, messageId, authProjectId)
      .run();

    // Broadcast edit event to room via DO
    const roomId = existing.room_id;
    await fanoutRoomInternal(env, authProjectId, roomId, "/announce", {
      method: "POST",
      body: JSON.stringify({
        type: "edit",
        id: messageId,
        roomId,
        userId,
        content: body.content,
        editedAt: now,
      }),
    });

    return json({
      message: {
        id: messageId,
        roomId,
        senderId: userId,
        content: body.content,
        editedAt: now,
      },
    });
  }

  // Authenticated message delete endpoint: DELETE /messages/:id
  if (
    url.pathname.startsWith("/messages/") &&
    !url.pathname.endsWith("/reactions") &&
    request.method === "DELETE"
  ) {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      console.error("JWT verify error", err);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", {
        status: 401,
        headers: corsHeaders,
      });
    }

    const messageId = url.pathname.split("/")[2];
    if (!messageId) {
      return json({ error: "message id required" }, { status: 400 });
    }

    const { userId, projectId: authProjectId, roles } = auth;
    const hardDeleteRequested = url.searchParams.get("hard") === "true";

    // Ensure message exists and belongs to this user + project
    const existing = await env.DB.prepare(
      "SELECT id, room_id, user_id FROM messages WHERE id = ? AND project_id = ?"
    )
      .bind(messageId, authProjectId)
      .first();

    if (!existing) {
      return json({ error: "message not found" }, { status: 404 });
    }
    if (existing.user_id !== userId) {
      return json({ error: "forbidden" }, { status: 403 });
    }
    const now = new Date().toISOString();
    if (hardDeleteRequested) {
      // Hard-delete is reserved for admin/owner flows (e.g. GDPR requests).
      if (!hasAnyRole(roles, ["owner", "admin"])) {
        return json({ error: "forbidden_hard_delete_requires_admin" }, { status: 403 });
      }
      // B-6: cascade to dependent rows to prevent orphan FK-like state.
      await env.DB.batch([
        env.DB.prepare(
          "DELETE FROM message_reactions WHERE message_id = ? AND project_id = ?"
        ).bind(messageId, authProjectId),
        env.DB.prepare(
          "DELETE FROM message_mentions WHERE message_id = ? AND project_id = ?"
        ).bind(messageId, authProjectId),
        env.DB.prepare(
          "DELETE FROM attachments WHERE message_id = ? AND project_id = ?"
        ).bind(messageId, authProjectId),
        env.DB.prepare(
          "DELETE FROM message_deliveries WHERE message_id = ?"
        ).bind(messageId),
        env.DB.prepare(
          "DELETE FROM messages WHERE id = ? AND project_id = ?"
        ).bind(messageId, authProjectId),
      ]);
    } else {
      await env.DB.prepare(
        "UPDATE messages SET deleted_at = ?, content = ? WHERE id = ? AND project_id = ? AND user_id = ?"
      )
        .bind(now, "[deleted]", messageId, authProjectId, userId)
        .run();
    }

    // Broadcast delete event to room via DO
    const roomId = existing.room_id;
    await fanoutRoomInternal(env, authProjectId, roomId, "/announce", {
      method: "POST",
      body: JSON.stringify({
        type: "delete",
        id: messageId,
        roomId,
        userId,
        hard: hardDeleteRequested,
        deletedAt: hardDeleteRequested ? now : now,
      }),
    });

    return json({ ok: true, hard: hardDeleteRequested, deletedAt: now });
  }

  // Authenticated reactions endpoints:
  // POST /messages/:id/reactions  (add)
  // DELETE /messages/:id/reactions (remove)
  if (
    url.pathname.startsWith("/messages/") &&
    url.pathname.endsWith("/reactions") &&
    (request.method === "POST" || request.method === "DELETE")
  ) {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      console.error("JWT verify error", err);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", {
        status: 401,
        headers: corsHeaders,
      });
    }

    const parts = url.pathname.split("/");
    const messageId = parts[2];
    if (!messageId) {
      return json({ error: "message id required" }, { status: 400 });
    }

    const body = await request.json().catch(() => null);
    const rawEmoji = body?.emoji;
    if (!rawEmoji) {
      return json({ error: "emoji required" }, { status: 400 });
    }
    const emoji = normalizeEmoji(rawEmoji);
    if (!isValidEmoji(emoji)) {
      return json({ error: "invalid emoji" }, { status: 400 });
    }

    const { userId, projectId: authProjectId } = auth;

    // Need room id for reaction row + broadcast
    const existing = await env.DB.prepare(
      "SELECT room_id FROM messages WHERE id = ? AND project_id = ?"
    )
      .bind(messageId, authProjectId)
      .first();
    if (!existing) {
      return json({ error: "message not found" }, { status: 404 });
    }
    const roomId = existing.room_id;
    const now = new Date().toISOString();

    if (request.method === "DELETE") {
      await env.DB.prepare(
        "DELETE FROM message_reactions WHERE project_id = ? AND message_id = ? AND room_id = ? AND user_id = ? AND emoji = ?"
      )
        .bind(authProjectId, messageId, roomId, userId, emoji)
        .run();
    } else {
      await env.DB.prepare(
        "INSERT INTO message_reactions (project_id, message_id, room_id, user_id, emoji, created_at) VALUES (?, ?, ?, ?, ?, ?)"
      )
        .bind(authProjectId, messageId, roomId, userId, emoji, now)
        .run();
    }

    const op = request.method === "DELETE" ? "remove" : "add";

    // Broadcast reaction event to room via DO
    await fanoutRoomInternal(env, authProjectId, roomId, "/announce", {
      method: "POST",
      body: JSON.stringify({
        type: "reaction",
        roomId,
        userId,
        messageId,
        emoji,
        op,
      }),
    });

    return json({
      ok: true,
      reaction: {
        messageId,
        roomId,
        userId,
        emoji,
        op,
      },
    });
  }

  return null;
}
