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
import { parsePostMessageBody } from "../lib/http-body.js";
import { runInboundMessageMiddleware } from "../lib/message-middleware.js";
import {
  runFluxyRoomAuthz,
  runFluxyPublishPipeline,
} from "../lib/fluxy-config-runtime.js";
import {
  notifyDmRecipient,
  notifyMentionedUsers,
  notifyAnnouncementMembers,
} from "../lib/in-app-notifications.js";
import { isBlockedBetween, filterBlockedUserIds } from "../lib/user-blocks.js";
import { assertGuestCanWrite } from "../lib/guest-auth.js";
import { assertCanPostToRoom } from "../lib/room-post-policy.js";
import { isValidEmoji, normalizeEmoji } from "../lib/emoji.js";
import {
  parsePollCreateInput,
  insertMessagePoll,
  getMessagePoll,
  closeMessagePoll,
  castPollVote,
} from "../lib/message-polls.js";
import { tryDispatchSlashCommand } from "../lib/room-command-dispatch.js";
import { expandMentions, mentionHandlesForAgentInvoke } from "../lib/message-mentions.js";
import { fetchAggregatedRoomLive } from "../lib/room-shard.js";
import { runRoomFirmwareHook } from "../lib/room-firmware.js";
import {
  parseDecisionCreateInput,
  insertMessageDecision,
  getMessageDecision,
  ackMessageDecision,
} from "../lib/message-decisions.js";
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
import { resolveMessageExpiryWithRoomPolicy } from "../lib/message-retention-room.js";
import { assertProjectWriteResidency } from "../lib/data-residency-settings.js";
import { resolveMessageVisibility } from "../lib/message-visibility.js";
import { branchRoomFromMessage } from "../lib/message-branch.js";
import {
  getAgentRunRecord,
  listCounterfactualRuns,
  mapAgentRunRow,
  replayCounterfactualToolCall,
} from "../lib/counterfactual-replay.js";

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

    const rawBody = await request.json().catch(() => null);
    const parsedMessage = parsePostMessageBody(rawBody);
    if (!parsedMessage.ok) {
      return json({ error: parsedMessage.error }, { status: 400 });
    }
    const body = parsedMessage.body;
    if (!isValidId(body.roomId)) {
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

    const authz = await runFluxyRoomAuthz(roomId, auth);
    if (authz.action === "block") {
      return json({ error: authz.reason, code: "blocked" }, { status: 403 });
    }

    const residencyCheck = await assertProjectWriteResidency(env, authProjectId, {
      operation: "message_create",
    });
    if (!residencyCheck.ok) {
      return json(
        {
          error: residencyCheck.error,
          code: "data_residency_violation",
          workerRegion: residencyCheck.workerRegion,
          allowedRegions: residencyCheck.allowedRegions,
        },
        { status: 403 },
      );
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

    const postPolicy = await assertCanPostToRoom(env, {
      projectId: authProjectId,
      roomId,
      userId: authUserId,
      jwtRoles: auth.roles ?? [],
    });
    if (!postPolicy.ok) {
      return json(
        { error: postPolicy.error, code: postPolicy.error, roomType: postPolicy.roomType },
        { status: postPolicy.status || 403 },
      );
    }

    let pollCreate = null;
    let decisionCreate = null;
    let content = "";
    const templateId =
      typeof body.templateId === "string" ? body.templateId.trim() : "";
    if (body.poll) {
      pollCreate = parsePollCreateInput(body.poll);
      if (!pollCreate.ok) {
        return json({ error: pollCreate.error }, { status: 400 });
      }
      content = pollCreate.question;
    } else if (body.decision) {
      decisionCreate = parseDecisionCreateInput(body.decision);
      if (!decisionCreate.ok) {
        return json({ error: decisionCreate.error }, { status: 400 });
      }
      content = decisionCreate.content;
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

    if (!pollCreate && !decisionCreate && !templateId && !body.attachments?.length) {
      const slashDispatch = await tryDispatchSlashCommand(env, {
        projectId: authProjectId,
        roomId,
        userId: authUserId,
        content,
        jwtRoles: auth.roles ?? [],
        parentId: body.replyTo ? Number(body.replyTo) || null : null,
        clientMessageId: normalizeClientMessageId(body.clientMessageId),
      });
      if (slashDispatch.handled) {
        if (!slashDispatch.ok) {
          return json({ error: slashDispatch.error, command: true }, { status: slashDispatch.status || 400 });
        }
        if (slashDispatch.suppressMessage) {
          return json({ ok: true, command: true, ...slashDispatch.commandResult });
        }
        return json({
          ok: true,
          command: true,
          ...slashDispatch.commandResult,
          message: slashDispatch.message ?? undefined,
        });
      }
    }

    const middlewareResult = await runInboundMessageMiddleware(env, { content });
    if (!middlewareResult.ok) {
      return json(
        { error: middlewareResult.error, code: middlewareResult.code },
        { status: middlewareResult.code === "content_blocked" ? 403 : 400 },
      );
    }
    content = middlewareResult.content;

    const fluxyPipeline = await runFluxyPublishPipeline(
      roomId,
      auth,
      content,
      {
        capabilities: authz.capabilities ?? {},
        replyTo: body.replyTo ? Number(body.replyTo) || null : null,
      },
    );
    if (!fluxyPipeline.ok) {
      return json({ error: fluxyPipeline.reason, code: "blocked" }, { status: 403 });
    }
    content = fluxyPipeline.content;

    const firmwareResult = await runRoomFirmwareHook(env, {
      projectId: authProjectId,
      roomId,
      userId: authUserId,
      eventType: "message.create",
      event: {
        content,
        clientMessageId: normalizeClientMessageId(body.clientMessageId),
      },
    });
    if (firmwareResult.action === "veto") {
      return json(
        {
          error: firmwareResult.reason ?? "firmware_veto",
          code: "firmware_veto",
          moduleId: firmwareResult.moduleId,
          retryAfterSeconds: firmwareResult.retryAfterSeconds,
        },
        {
          status: firmwareResult.retryAfterSeconds ? 429 : 403,
          headers: firmwareResult.retryAfterSeconds
            ? { "Retry-After": String(firmwareResult.retryAfterSeconds) }
            : undefined,
        },
      );
    }
    content = firmwareResult.content ?? content;

    const expiryResult = await resolveMessageExpiryWithRoomPolicy(
      env,
      authProjectId,
      roomId,
      body,
    );
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
    let onlineUserIds = [];
    try {
      const live = await fetchAggregatedRoomLive(env, authProjectId, roomId);
      onlineUserIds = live.users || [];
    } catch {
      onlineUserIds = [];
    }
    const expandedMentions = await expandMentions(env, {
      projectId: authProjectId,
      roomId,
      authorUserId: authUserId,
      tokens: mentionsRaw,
      onlineUserIds,
    });
    const mentions = await filterBlockedUserIds(
      env,
      authProjectId,
      authUserId,
      expandedMentions,
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

    ctx.waitUntil(
      import("../lib/presence-escalation.js")
        .then((m) =>
          m.markPresenceEscalationResponded(env, {
            projectId: authProjectId,
            roomId,
            responderUserId: authUserId,
          }),
        )
        .catch(() => null),
    );

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

    let decisionSnapshot = null;
    if (decisionCreate?.ok) {
      decisionSnapshot = await insertMessageDecision(env, {
        messageId,
        projectId: authProjectId,
        roomId,
        content: decisionCreate.content,
        requiredRoles: decisionCreate.requiredRoles,
        ttlSeconds: decisionCreate.ttlSeconds,
        createdBy: authUserId,
      });
    }

    const sanitizedAttachments = sanitizeMessageAttachments(body.attachments);

    if (sanitizedAttachments.length) {
      const { assertAttachmentsMediaClean } = await import("../lib/media-pipeline.js");
      const mediaCheck = await assertAttachmentsMediaClean(env, authProjectId, sanitizedAttachments);
      if (!mediaCheck.ok) {
        return json({ error: mediaCheck.error, fileKey: mediaCheck.fileKey }, { status: 422 });
      }
    }

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
      "SELECT type, name FROM rooms WHERE project_id = ? AND id = ?",
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
    if (roomRow?.type === "announcement") {
      ctx.waitUntil(
        notifyAnnouncementMembers(env, {
          projectId: authProjectId,
          roomId,
          fromUserId: authUserId,
          messageId,
          preview: content,
          roomName: roomRow.name,
        }).catch((err) =>
          logError("notifications.announcement_failed", err, requestLogCtx),
        ),
      );
    }

    const roomStub = await getRoomStubForProject(env, authProjectId, roomId, authUserId);
    ctx.waitUntil(
      roomStub
        .fetch("https://internal/schedule-expiry", { method: "POST" })
        .catch((err) => logError("message.expiry_schedule_failed", err, requestLogCtx)),
    );

    const { resolveVisibilityRecipientUserIds } = await import(
      "../lib/message-visibility.js",
    );
    const scopedRecipients = await resolveVisibilityRecipientUserIds(
      env,
      roomId,
      visibility,
      visibleTo,
      authUserId,
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
        ...(visibility !== "room"
          ? { visibility, ...(visibleTo.length ? { visibleTo } : {}) }
          : {}),
        ...(scopedRecipients ? { recipientUserIds: [...scopedRecipients] } : {}),
        ...(pollSnapshot ? { poll: pollSnapshot, contentType: "poll" } : {}),
        ...(decisionSnapshot ? { decision: decisionSnapshot, contentType: "decision" } : {}),
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

    const agentHandles = mentionHandlesForAgentInvoke(mentionsRaw);
    if (agentHandles.length) {
      ctx.waitUntil(
        invokeMentionedAgents(
          env,
          authProjectId,
          roomId,
          authUserId,
          content,
          agentHandles,
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
        roomName: roomRow?.name ?? null,
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
        ...(visibility !== "room"
          ? { visibility, ...(visibleTo.length ? { visibleTo } : {}) }
          : {}),
        ...(pollSnapshot ? { poll: pollSnapshot } : {}),
        ...(decisionSnapshot ? { decision: decisionSnapshot } : {}),
      },
    });
  }

  const decisionGetMatch = url.pathname.match(/^\/messages\/([^/]+)\/decision$/);
  if (decisionGetMatch && request.method === "GET") {
    const auth = await verifyJwtAndGetContext(request, env).catch(() => null);
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const messageId = Number(decisionGetMatch[1]);
    if (!Number.isFinite(messageId)) {
      return json({ error: "invalid message id" }, { status: 400 });
    }
    const decision = await getMessageDecision(env, messageId, auth.projectId);
    if (!decision) return json({ error: "decision not found" }, { status: 404 });
    return json({ decision });
  }

  const decisionAckMatch = url.pathname.match(/^\/messages\/([^/]+)\/ack$/);
  if (decisionAckMatch && request.method === "POST") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const messageId = Number(decisionAckMatch[1]);
    if (!Number.isFinite(messageId)) {
      return json({ error: "invalid message id" }, { status: 400 });
    }
    const msgRow = await env.DB.prepare(
      "SELECT room_id FROM messages WHERE id = ? AND project_id = ? AND deleted_at IS NULL LIMIT 1",
    )
      .bind(messageId, auth.projectId)
      .first();
    if (!msgRow) return json({ error: "message not found" }, { status: 404 });

    const result = await ackMessageDecision(env, {
      messageId,
      projectId: auth.projectId,
      roomId: msgRow.room_id,
      userId: auth.userId,
      jwtRoles: auth.roles,
    });
    if (!result.ok) {
      return json({ error: result.error }, { status: result.status || 400 });
    }

    await fanoutRoomInternal(env, auth.projectId, msgRow.room_id, "/announce", {
      method: "POST",
      body: JSON.stringify({
        type: "decision_updated",
        roomId: msgRow.room_id,
        messageId,
        decision: result.decision,
        userId: auth.userId,
      }),
    });

    return json({ ok: true, decision: result.decision });
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
    const poll = await getMessagePoll(env, messageId, auth.projectId, auth.userId);
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

  const pollCloseMatch = url.pathname.match(/^\/messages\/([^/]+)\/poll$/);
  if (pollCloseMatch && request.method === "PATCH") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const messageId = Number(pollCloseMatch[1]);
    if (!Number.isFinite(messageId)) {
      return json({ error: "invalid message id" }, { status: 400 });
    }
    const { closed: closeRequest } = await request.json().catch(() => ({}));
    if (closeRequest !== true) {
      return json({ error: 'body must have {"closed":true}' }, { status: 400 });
    }
    const result = await closeMessagePoll(env, messageId, auth.projectId);
    if (!result.ok) {
      return json({ error: result.error }, { status: result.status || 400 });
    }
    const msgRow = await env.DB.prepare(
      "SELECT room_id FROM messages WHERE id = ? AND project_id = ? LIMIT 1",
    )
      .bind(messageId, auth.projectId)
      .first();
    if (msgRow?.room_id) {
      await fanoutRoomInternal(env, auth.projectId, msgRow.room_id, "/announce", {
        method: "POST",
        body: JSON.stringify({
          type: "poll_updated",
          roomId: msgRow.room_id,
          messageId,
          poll: result.poll,
          userId: auth.userId,
        }),
      });
    }
    return json({ ok: true, poll: result.poll });
  }

  const translateGetMatch = url.pathname.match(/^\/messages\/([^/]+)\/translate$/);
  if (translateGetMatch && request.method === "GET") {
    const auth = await verifyJwtAndGetContext(request, env).catch(() => null);
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const messageId = Number(translateGetMatch[1]);
    if (!Number.isFinite(messageId)) {
      return json({ error: "invalid message id" }, { status: 400 });
    }
    const targetLang = url.searchParams.get("targetLang") ?? url.searchParams.get("target_lang");
    if (!targetLang) {
      return json({ error: "targetLang query required" }, { status: 400 });
    }
    const msgRow = await env.DB.prepare(
      `SELECT id, room_id FROM messages
       WHERE id = ? AND project_id = ? AND deleted_at IS NULL LIMIT 1`,
    )
      .bind(messageId, auth.projectId)
      .first();
    if (!msgRow) return json({ error: "message not found" }, { status: 404 });
    const allowed = await canAccessRoom(env, auth, msgRow.room_id);
    if (!allowed) return json({ error: "forbidden" }, { status: 403 });

    const { getCachedTranslation, normalizeTargetLang } = await import("../lib/message-translation.js");
    const normalized = normalizeTargetLang(targetLang);
    if (!normalized) return json({ error: "invalid_target_lang" }, { status: 400 });
    const cached = await getCachedTranslation(env, messageId, normalized);
    if (!cached) return json({ messageId, translation: null }, { status: 404 });
    return json({ messageId, cached: true, translation: cached });
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
    !url.pathname.endsWith("/decision") &&
    !url.pathname.endsWith("/ack") &&
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

  // Branch conversation: POST /rooms/:roomId/branch
  if (
    url.pathname.startsWith("/rooms/") &&
    url.pathname.endsWith("/branch") &&
    request.method === "POST"
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
    const roomId = parts[2];
    if (!roomId || !isValidId(roomId)) {
      return json({ error: "roomId required" }, { status: 400 });
    }

    const canAccess = await canAccessRoom(env, auth, roomId);
    if (!canAccess) {
      return json({ error: "forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    const fromMessageId = Number(body?.fromMessageId);
    if (!Number.isFinite(fromMessageId) || fromMessageId <= 0) {
      return json({ error: "fromMessageId required" }, { status: 400 });
    }

    const { userId, projectId: authProjectId, roles } = auth;
    const agentIds = Array.isArray(body?.agentIds)
      ? body.agentIds.filter((id) => typeof id === "string" && id.trim())
      : typeof body?.agentId === "string" && body.agentId.trim()
        ? [body.agentId.trim()]
        : [];

    const isAdmin = hasAnyRole(roles, ["owner", "admin"]);
    const result = await branchRoomFromMessage(
      env,
      authProjectId,
      roomId,
      fromMessageId,
      userId,
      agentIds,
      { isAdmin },
    );

    if (!result.ok) {
      const status = result.reason === "not_found" ? 404 : result.reason === "forbidden_anchor" ? 403 : 409;
      return json({ error: result.reason, blockedUserId: result.blockedUserId ?? null }, { status });
    }

    for (const messageId of result.deletedIds) {
      await fanoutRoomInternal(env, authProjectId, roomId, "/announce", {
        method: "POST",
        body: JSON.stringify({
          type: "delete",
          id: messageId,
          roomId,
          userId,
          deletedAt: result.deletedAt,
          branch: true,
        }),
      });
    }

    return json({ ok: true, deletedIds: result.deletedIds, deletedAt: result.deletedAt });
  }

  // Counterfactual replay: GET /rooms/:roomId/counterfactuals?originalRunId=
  if (
    url.pathname.startsWith("/rooms/") &&
    url.pathname.endsWith("/counterfactuals") &&
    request.method === "GET"
  ) {
    const auth = await verifyJwtAndGetContext(request, env).catch(() => null);
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const parts = url.pathname.split("/");
    const roomId = parts[2];
    if (!roomId || !isValidId(roomId)) {
      return json({ error: "roomId required" }, { status: 400 });
    }
    const canAccess = await canAccessRoom(env, auth, roomId);
    if (!canAccess) return json({ error: "forbidden" }, { status: 403 });

    const originalRunId = String(url.searchParams.get("originalRunId") || "").trim();
    if (!originalRunId) {
      return json({ error: "originalRunId query param required" }, { status: 400 });
    }

    const original = await getAgentRunRecord(env, auth.projectId, originalRunId);
    if (!original || String(original.room_id || "") !== roomId) {
      return json({ error: "original_run_not_found" }, { status: 404 });
    }

    const alternatives = await listCounterfactualRuns(env, auth.projectId, originalRunId);
    return json({
      original: mapAgentRunRow(original),
      alternatives,
    });
  }

  // Counterfactual replay: POST /rooms/:roomId/counterfactual
  if (
    url.pathname.startsWith("/rooms/") &&
    url.pathname.endsWith("/counterfactual") &&
    request.method === "POST"
  ) {
    const auth = await verifyJwtAndGetContext(request, env).catch(() => null);
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const parts = url.pathname.split("/");
    const roomId = parts[2];
    if (!roomId || !isValidId(roomId)) {
      return json({ error: "roomId required" }, { status: 400 });
    }
    const canAccess = await canAccessRoom(env, auth, roomId);
    if (!canAccess) return json({ error: "forbidden" }, { status: 403 });

    const body = await request.json().catch(() => null);
    const originalRunId = String(body?.originalRunId || "").trim();
    const toolCallId = String(body?.toolCallId || "").trim();
    if (!originalRunId || !toolCallId) {
      return json({ error: "originalRunId and toolCallId required" }, { status: 400 });
    }

    const modifiedParams =
      body?.modifiedParams && typeof body.modifiedParams === "object" ? body.modifiedParams : {};
    const fromMessageId =
      body?.fromMessageId != null && Number.isFinite(Number(body.fromMessageId))
        ? Number(body.fromMessageId)
        : null;
    const agentIds = Array.isArray(body?.agentIds)
      ? body.agentIds.filter((id) => typeof id === "string" && id.trim())
      : typeof body?.agentId === "string" && body.agentId.trim()
        ? [body.agentId.trim()]
        : [];

    const isAdmin = hasAnyRole(auth.roles, ["owner", "admin"]);
    const result = await replayCounterfactualToolCall(env, {
      projectId: auth.projectId,
      roomId,
      userId: auth.userId,
      originalRunId,
      toolCallId,
      modifiedParams,
      fromMessageId,
      dryRun: body?.dryRun === true,
      agentIds,
      isAdmin,
      traceId: request.headers.get("X-Fluxy-Trace-Id") || crypto.randomUUID(),
    });

    if (!result.ok) {
      const status =
        result.reason === "original_run_not_found" || result.reason === "tool_call_not_found"
          ? 404
          : result.reason === "nested_counterfactual_not_allowed"
            ? 409
            : result.reason === "branch_failed" || result.reason === "blocked_by_other_users"
              ? 409
              : 400;
      return json({ error: result.reason, sideEffect: result.sideEffect ?? false }, { status });
    }

    for (const messageId of result.branchDeletedIds || []) {
      await fanoutRoomInternal(env, auth.projectId, roomId, "/announce", {
        method: "POST",
        body: JSON.stringify({
          type: "delete",
          id: messageId,
          roomId,
          userId: auth.userId,
          branch: true,
          counterfactual: true,
        }),
      });
    }

    return json({
      ok: true,
      branchId: result.branchId,
      runId: result.runId,
      dryRun: result.dryRun,
      sideEffect: result.sideEffect,
      costWarning: result.costWarning,
      run: result.run,
      original: result.original,
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
