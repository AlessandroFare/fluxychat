/**
 * Messages: create, edit, delete, reactions
 * @returns {Promise<Response|null>}
 */
import { pickRouteDeps } from "./route-http-deps.js";

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
    schedulePostMessageAutomations,
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
    "schedulePostMessageAutomations",
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

    const body = await request.json().catch(() => null);
    if (!body || !body.roomId || !isValidId(body.roomId)) {
      return json(
        { error: "roomId required: must be 1-128 chars, alphanumeric with _ -" },
        { status: 400 }
      );
    }
    const contentValidation = validateMessageContent(body.content);
    if (!contentValidation.valid) {
      return json({ error: contentValidation.error }, { status: 400 });
    }

    const { userId: authUserId, projectId: authProjectId } = auth;
    const roomId = body.roomId;
    const content = contentValidation.content;
    const parentId = body.replyTo ? Number(body.replyTo) || null : null;
    const createdAt = new Date().toISOString();

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

    const mentions = extractMentions(content);
    const firstUrl = extractFirstUrl(content);
    let preview = null;
    if (firstUrl && env.OG_PREVIEW_ENABLED !== "false") {
      preview = await fetchOgPreview(firstUrl, env);
    }

    const insertRes = await env.DB.prepare(
      "INSERT INTO messages (project_id, room_id, user_id, content, created_at, parent_id, mentions, og_title, og_description, og_image, og_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
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
        preview?.url || null
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
        "INSERT INTO automation_events (project_id, event_type, room_id, payload, created_at) VALUES (?, ?, ?, ?, ?)"
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
          createdAt
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
    }

    const id = env.ROOM.idFromName(roomId);
    const stub = env.ROOM.get(id);
    await stub.fetch("https://internal/announce", {
      method: "POST",
      body: JSON.stringify({
        roomId,
        id: messageId,
        content,
        userId: authUserId,
        senderId: authUserId,
        createdAt,
        parentId,
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
        invokeMentionedAgents(env, authProjectId, roomId, authUserId, content, mentions, traceId).catch((err) =>
          logError("agent.mention_invoke_failed", err, requestLogCtx)
        )
      );
    }

    ctx.waitUntil(
      schedulePostMessageAutomations(env, {
        projectId: authProjectId,
        roomId,
        authorUserId: authUserId,
        messageId,
        content,
        traceId,
      })
    );

    return json({
      message: {
        id: messageId,
        roomId,
        senderId: authUserId,
        content,
        createdAt,
        parentId,
        mentions,
        preview,
        attachments: sanitizedAttachments.map((a) => ({
          kind: a.kind,
          url: a.url,
          name: a.name,
          sizeBytes: a.sizeBytes ?? undefined,
          contentType: a.contentType ?? undefined,
        })),
      },
    });
  }

  // Authenticated message edit endpoint: PATCH /messages/:id
  if (
    url.pathname.startsWith("/messages/") &&
    !url.pathname.endsWith("/reactions") &&
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
    await env.DB.prepare(
      "UPDATE messages SET content = ?, edited_at = ? WHERE id = ? AND project_id = ?"
    )
      .bind(body.content, now, messageId, authProjectId)
      .run();

    // Broadcast edit event to room via DO
    const roomId = existing.room_id;
    const id = env.ROOM.idFromName(roomId);
    const stub = env.ROOM.get(id);
    await stub.fetch("https://internal/announce", {
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
      await env.DB.prepare(
        "DELETE FROM messages WHERE id = ? AND project_id = ?"
      )
        .bind(messageId, authProjectId)
        .run();
    } else {
      await env.DB.prepare(
        "UPDATE messages SET deleted_at = ?, content = ? WHERE id = ? AND project_id = ? AND user_id = ?"
      )
        .bind(now, "[deleted]", messageId, authProjectId, userId)
        .run();
    }

    // Broadcast delete event to room via DO
    const roomId = existing.room_id;
    const id = env.ROOM.idFromName(roomId);
    const stub = env.ROOM.get(id);
    await stub.fetch("https://internal/announce", {
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
    const emoji = body?.emoji;
    if (!emoji) {
      return json({ error: "emoji required" }, { status: 400 });
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
    const id = env.ROOM.idFromName(roomId);
    const stub = env.ROOM.get(id);
    await stub.fetch("https://internal/announce", {
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
