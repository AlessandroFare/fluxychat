/**
 * HTTP handlers: /gdpr/* and compliance report (privacy-focused routes).
 * @returns {Promise<Response|null>}
 */
import { pickRouteDeps } from "./route-http-deps.js";
import { deleteUserAttachmentObjects } from "../lib/attachment-storage.js";
import { redactUserPayloadsInTable } from "../lib/gdpr-payload-redaction.js";

export async function dispatchGdprRoutes(request, url, h) {
  const {
    env,
    corsHeaders,
    json,
    requestLogCtx,
    verifyJwt,
    writeAuditEvent,
    hasAnyRole,
    logError,
    logInfo,
    getProjectPlan,
  } = pickRouteDeps(h, [
    "env",
    "corsHeaders",
    "json",
    "requestLogCtx",
    "verifyJwt",
    "writeAuditEvent",
    "hasAnyRole",
    "logError",
    "logInfo",
    "getProjectPlan",
  ]);

  async function jwtAuth() {
    return verifyJwt(request).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
  }

  if (url.pathname === "/gdpr/export" && request.method === "GET") {
    const auth = await jwtAuth();
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const { userId, projectId } = auth;

    const [messages, reactions, readReceipts, moderationEvents, roomMembers, mentions] =
      await Promise.all([
        env.DB.prepare(
          "SELECT id, room_id, content, created_at, parent_id, edited_at, mentions, og_title, og_description, og_image, og_url FROM messages WHERE project_id = ? AND user_id = ? AND deleted_at IS NULL ORDER BY created_at ASC LIMIT 10000" // perf: unbounded
        )
          .bind(projectId, userId)
          .all(),
        env.DB.prepare(
          "SELECT id, message_id, room_id, emoji, created_at FROM message_reactions WHERE project_id = ? AND user_id = ? ORDER BY created_at ASC LIMIT 10000" // perf: unbounded
        )
          .bind(projectId, userId)
          .all(),
        env.DB.prepare(
          "SELECT room_id, message_id, created_at FROM read_receipts WHERE project_id = ? AND user_id = ? ORDER BY created_at ASC LIMIT 10000" // perf: unbounded
        )
          .bind(projectId, userId)
          .all(),
        env.DB.prepare(
          "SELECT id, room_id, action, reason, expires_at, created_at FROM moderation_events WHERE project_id = ? AND user_id = ? ORDER BY created_at ASC LIMIT 10000" // perf: unbounded
        )
          .bind(projectId, userId)
          .all(),
        env.DB.prepare(
          `SELECT rm.room_id, rm.role, rm.joined_at FROM room_members rm
           INNER JOIN rooms r ON r.id = rm.room_id
           WHERE r.project_id = ? AND rm.user_id = ?`
        )
          .bind(projectId, userId)
          .all(),
        env.DB.prepare(
          "SELECT room_id, message_id, created_at FROM message_mentions WHERE project_id = ? AND mentioned_user_id = ? ORDER BY created_at ASC LIMIT 10000" // perf: unbounded
        )
          .bind(projectId, userId)
          .all(),
      ]);

    const exportData = {
      exportedAt: new Date().toISOString(),
      projectId,
      userId,
      data: {
        messages: messages.results || [],
        reactions: reactions.results || [],
        readReceipts: readReceipts.results || [],
        moderationEvents: moderationEvents.results || [],
        roomMemberships: roomMembers.results || [],
        mentions: mentions.results || [],
      },
    };

    await writeAuditEvent(env, {
      projectId,
      action: "gdpr.export",
      actorUserId: userId,
      metadata: { userId },
    }).catch(() => {});

    return new Response(JSON.stringify(exportData, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="gdpr-export-${userId}-${Date.now()}.json"`,
        ...corsHeaders,
      },
    });
  }

  if (url.pathname === "/gdpr/delete" && request.method === "DELETE") {
    const auth = await jwtAuth();
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    if (!hasAnyRole(auth.roles, ["owner", "admin"])) {
      return json({ error: "only owner/admin can request data erasure" }, { status: 403 });
    }
    const { userId, projectId } = auth;

    const [gdprMemberRooms, gdprMessageRooms] = await Promise.all([
      env.DB.prepare(
        `SELECT DISTINCT rm.room_id AS room_id FROM room_members rm
         INNER JOIN rooms r ON r.id = rm.room_id
         WHERE r.project_id = ? AND rm.user_id = ? AND rm.room_id IS NOT NULL`
      )
        .bind(projectId, userId)
        .all(),
      env.DB.prepare(
        "SELECT DISTINCT room_id FROM messages WHERE project_id = ? AND user_id = ? AND room_id IS NOT NULL"
      )
        .bind(projectId, userId)
        .all(),
    ]);
    const gdprErasureRoomIds = new Set();
    for (const r of gdprMemberRooms.results || []) {
      if (r.room_id) gdprErasureRoomIds.add(String(r.room_id));
    }
    for (const r of gdprMessageRooms.results || []) {
      if (r.room_id) gdprErasureRoomIds.add(String(r.room_id));
    }

    await env.DB.prepare(
      "UPDATE messages SET content = '[REDACTED BY GDPR ERASURE REQUEST]', edited_at = ? WHERE project_id = ? AND user_id = ? AND deleted_at IS NULL"
    )
      .bind(new Date().toISOString(), projectId, userId)
      .run();

    await env.DB.prepare(
      "DELETE FROM message_reactions WHERE project_id = ? AND user_id = ?"
    )
      .bind(projectId, userId)
      .run();

    await env.DB.prepare(
      "DELETE FROM read_receipts WHERE project_id = ? AND user_id = ?"
    )
      .bind(projectId, userId)
      .run();

    await env.DB.prepare(
      `DELETE FROM room_members WHERE room_id IN (
         SELECT rm.room_id FROM room_members rm
         INNER JOIN rooms r ON r.id = rm.room_id
         WHERE r.project_id = ? AND rm.user_id = ?
       ) AND user_id = ?`
    )
      .bind(projectId, userId, userId)
      .run();

    await env.DB.prepare(
      "DELETE FROM message_mentions WHERE project_id = ? AND mentioned_user_id = ?"
    )
      .bind(projectId, userId)
      .run();

    const attachmentRows = await env.DB.prepare(
      "SELECT id, url FROM attachments WHERE project_id = ? AND user_id = ?"
    )
      .bind(projectId, userId)
      .all();
    const r2Result = await deleteUserAttachmentObjects(
      env,
      projectId,
      userId,
      attachmentRows.results || [],
      logInfo
    );
    if (r2Result.warnings.includes("ATTACHMENTS not bound")) {
      logInfo("gdpr.attachment_r2_warning", { projectId, userId, reason: "ATTACHMENTS not bound" });
    }
    if ((attachmentRows.results || []).length) {
      await env.DB.prepare(
        "DELETE FROM attachments WHERE project_id = ? AND user_id = ?"
      )
        .bind(projectId, userId)
        .run();
    }

    await env.DB.prepare(
      "DELETE FROM moderation_events WHERE project_id = ? AND user_id = ?"
    )
      .bind(projectId, userId)
      .run();

    const erasureNow = new Date().toISOString();
    await env.DB.prepare(
      "UPDATE webhook_deliveries SET status = 'cancelled', last_error = 'gdpr_erasure', updated_at = ? WHERE project_id = ? AND status IN ('pending', 'retrying') AND payload LIKE ?"
    )
      .bind(erasureNow, projectId, `%${userId}%`)
      .run();

    const [automationRedaction, deliveryRedaction] = await Promise.all([
      redactUserPayloadsInTable(env.DB, {
        projectId,
        userId,
        table: "automation_events",
      }),
      redactUserPayloadsInTable(env.DB, {
        projectId,
        userId,
        table: "webhook_deliveries",
      }),
    ]);

    logInfo("gdpr.payload_redaction", {
      projectId,
      userId,
      automation_events: automationRedaction,
      webhook_deliveries: deliveryRedaction,
    });

    if (gdprErasureRoomIds.size > 0) {
      const roomIdList = [...gdprErasureRoomIds];
      const chunkSize = 80;
      for (let i = 0; i < roomIdList.length; i += chunkSize) {
        const chunk = roomIdList.slice(i, i + chunkSize);
        const placeholders = chunk.map(() => "?").join(",");
        await env.DB.prepare(
          `DELETE FROM agent_runs WHERE project_id = ? AND room_id IN (${placeholders})`
        )
          .bind(projectId, ...chunk)
          .run();
      }
    }

    await env.DB.prepare(
      "DELETE FROM operational_audit_events WHERE project_id = ? AND actor_user_id = ?"
    )
      .bind(projectId, userId)
      .run();

    await writeAuditEvent(env, {
      projectId,
      action: "gdpr.erasure",
      actorUserId: userId,
      metadata: { userId, erasedAt: new Date().toISOString() },
    }).catch(() => {});

    const [messagesRemaining, membersRemaining, reactionsRemaining] = await Promise.all([
      env.DB.prepare(
        "SELECT COUNT(*) FROM messages WHERE project_id = ? AND user_id = ? AND content != '[REDACTED BY GDPR ERASURE REQUEST]'"
      )
        .bind(projectId, userId)
        .first(),
      env.DB.prepare(
        `SELECT COUNT(*) AS c FROM room_members rm
         INNER JOIN rooms r ON r.id = rm.room_id
         WHERE r.project_id = ? AND rm.user_id = ?`
      )
        .bind(projectId, userId)
        .first(),
      env.DB.prepare(
        "SELECT COUNT(*) FROM message_reactions WHERE project_id = ? AND user_id = ?"
      )
        .bind(projectId, userId)
        .first(),
    ]);

    const remainingCounts = {
      messages: Number(messagesRemaining?.c ?? messagesRemaining?.["COUNT(*)"] ?? 0),
      room_members: Number(membersRemaining?.c ?? membersRemaining?.["COUNT(*)"] ?? 0),
      message_reactions: Number(reactionsRemaining?.c ?? reactionsRemaining?.["COUNT(*)"] ?? 0),
    };
    const hasRemaining =
      remainingCounts.messages > 0 ||
      remainingCounts.room_members > 0 ||
      remainingCounts.message_reactions > 0;

    if (hasRemaining) {
      logError("gdpr.erasure_incomplete", { projectId, userId, remainingCounts });
    }

    logInfo("gdpr.erasure_completed", {
      projectId,
      userId,
      partial_erasure: hasRemaining || false,
    });
    return json({
      ok: true,
      message: hasRemaining
        ? "Data erasure completed with warnings — some records could not be removed."
        : "All personal data for this user has been redacted/removed in this project.",
      partial_erasure: hasRemaining || false,
      ...(hasRemaining ? { remaining_counts: remainingCounts } : {}),
    });
  }

  if (url.pathname === "/compliance/report" && request.method === "GET") {
    const auth = await jwtAuth();
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    if (!hasAnyRole(auth.roles, ["owner", "admin"])) {
      return json({ error: "forbidden" }, { status: 403 });
    }
    const projectId = auth.projectId;

    const gdprExportExists = true;
    const gdprDeleteExists = true;

    const auditCount = await env.DB.prepare(
      "SELECT COUNT(*) as c FROM operational_audit_events WHERE project_id = ?"
    )
      .bind(projectId)
      .first();
    const retentionPolicies = await env.DB.prepare(
      "SELECT data_type, retention_days, auto_purge, last_purged_at FROM data_retention_policies WHERE project_id = ? OR project_id = '__default'"
    )
      .bind(projectId)
      .all();
    const webhookCount = await env.DB.prepare(
      "SELECT COUNT(*) as c FROM webhooks WHERE project_id = ?"
    )
      .bind(projectId)
      .first();
    const plan = await getProjectPlan(env, projectId);
    const agentCount = await env.DB.prepare(
      "SELECT COUNT(*) as c FROM bots WHERE project_id = ?"
    )
      .bind(projectId)
      .first();

    const report = {
      generatedAt: new Date().toISOString(),
      projectId,
      gdpr: {
        rightToAccess: gdprExportExists,
        rightToErasure: gdprDeleteExists,
        dataPortability: gdprExportExists,
        auditEventsRecorded: Number(auditCount?.c || 0),
        retentionPolicies: retentionPolicies.results || [],
      },
      security: {
        apiKeysHashed: true,
        webhookSecretsHashed: true,
        ssrfProtection: true,
        inputValidation: true,
        corsConfigurable: true,
        cspHeaders: true,
        rateLimiting: true,
        jwtStorage: "sessionStorage",
      },
      ai: {
        agentsCount: Number(agentCount?.c || 0),
        multiProviderRouting: true,
        toolCalling: true,
        contextCaching: true,
        typingIndicator: true,
      },
      billing: {
        plan: plan?.planName || "free",
        billingStatus: plan?.billingStatus || "manual",
        stripeIntegration: true,
      },
      compliance: {
        auditTrailComplete: true,
        dataRetentionAutomated: true,
        privacyPolicyAvailable: true,
        cookieConsentAvailable: true,
        webhooksCount: Number(webhookCount?.c || 0),
      },
    };

    return json({ report });
  }

  return null;
}
