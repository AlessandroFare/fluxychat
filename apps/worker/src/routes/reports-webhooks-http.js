/**
 * Split from worker fetch handler (original lines 2092-2345).
 * @returns {Promise<Response|null>}
 */
import { pickRouteDeps } from "./route-http-deps.js";
import { prepareWebhookSecretForStorage } from "../lib/webhook-signing.js";

export async function dispatchReportsWebhooksRoutes(request, url, h) {
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
    logInfo,
    projectId,
    checkAndConsumeRateLimit,
    deliverWebhooks,
    hashWebhookSecret,
    signWebhookPayload,
    timingSafeEqual,
    canCreateTenantProjects,
    tenantScopeForbidden,
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
    "logInfo",
    "projectId",
    "checkAndConsumeRateLimit",
    "deliverWebhooks",
    "hashWebhookSecret",
    "signWebhookPayload",
    "timingSafeEqual",
    "canCreateTenantProjects",
    "tenantScopeForbidden",
    "writeAuditEvent",
  ]);


  // Moderation / reports: POST /reports (authenticated)
  if (url.pathname === "/reports" && request.method === "POST") {
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

    const body = await request.json().catch(() => null);
    if (!body || !body.messageId || !body.roomId) {
      return json(
        { error: "messageId and roomId required" },
        { status: 400 }
      );
    }

    const { userId, projectId: authProjectId } = auth;
    const now = new Date().toISOString();
    const reportRate = await checkAndConsumeRateLimit(env, {
      key: `report:${authProjectId}:${userId}`,
      limit: Number(env.RATE_LIMIT_REPORTS_PER_MINUTE || 10),
      windowSeconds: 60,
    });
    if (!reportRate.allowed) {
      return json(
        { error: "rate_limit_exceeded", retryAfterSeconds: reportRate.retryAfterSeconds },
        {
          status: 429,
          headers: {
            "Retry-After": String(reportRate.retryAfterSeconds),
          },
        }
      );
    }

    const insert = await env.DB.prepare(
      "INSERT INTO moderation_events (project_id, room_id, user_id, action, reason, created_at, target_message_id) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
      .bind(
        authProjectId,
        body.roomId,
        userId,
        "report",
        body.reason || "user_report",
        now,
        body.messageId
      )
      .run();

    ctx.waitUntil(
      deliverWebhooks(env, authProjectId, "report.created", {
        reportId: insert.meta.last_row_id,
        roomId: body.roomId,
        userId,
        messageId: body.messageId,
        reason: body.reason || null,
      }).catch((err) =>
        logError("webhook.report_created_delivery_failed", err, requestLogCtx)
      )
    );

    return json({ ok: true });
  }

  // Webhook event delivery for bots/integrations: POST /webhooks/test (simple smoke test)
  if (url.pathname === "/webhooks/register" && request.method === "POST") {
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
    const { projectId: authProjectId } = auth;
    const body = await request.json().catch(() => null);
    if (!body || !body.url || !Array.isArray(body.eventTypes)) {
      return json(
        { error: "url and eventTypes[] required" },
        { status: 400 }
      );
    }
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const secretPrep = body.secret
      ? await prepareWebhookSecretForStorage(env, body.secret, hashWebhookSecret)
      : { ok: true, secretHash: null, enc: null, secretPlain: null, warning: null };
    if (!secretPrep.ok) {
      return json(
        { error: secretPrep.error, message: secretPrep.message },
        { status: 400 }
      );
    }
    if (secretPrep.warning) {
      logInfo("webhook.secret_plaintext_warn", {
        projectId: authProjectId,
        webhookId: id,
        reason: secretPrep.warning,
      });
    }
    const secretHash = secretPrep.secretHash ?? null;
    const enc = secretPrep.enc ?? null;
    await env.DB.prepare(
      "INSERT INTO webhooks (id, project_id, url, secret, secret_hash, secret_ciphertext, secret_iv, event_types, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
      .bind(
        id,
        authProjectId,
        body.url,
        enc ? null : secretPrep.secretPlain || null,
        secretHash,
        enc?.secretCiphertext || null,
        enc?.secretIv || null,
        body.eventTypes.join(","),
        now
      )
      .run();
    ctx.waitUntil(
      writeAuditEvent(env, {
        projectId: authProjectId,
        action: "webhook.create",
        actorUserId: auth.userId,
        targetType: "webhook",
        targetId: id,
        traceId,
        metadata: { url: body.url, eventTypes: body.eventTypes },
      }).catch(() => {})
    );
    return json({ webhook: { id, projectId: authProjectId, url: body.url, secret: body.secret, secretHash, warning: "The secret is shown only once. Store it securely." } });
  }

  if (
    url.pathname.startsWith("/webhooks/") &&
    request.method === "PATCH"
  ) {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    if (!hasAnyRole(auth.roles, ["owner", "admin"])) {
      return json({ error: "forbidden" }, { status: 403 });
    }
    const webhookId = url.pathname.split("/")[2];
    const body = await request.json().catch(() => null);
    if (!webhookId || !body) return json({ error: "webhook id and body required" }, { status: 400 });
    const existing = await env.DB.prepare(
      "SELECT id FROM webhooks WHERE id = ? AND project_id = ?"
    ).bind(webhookId, auth.projectId).first();
    if (!existing) return json({ error: "webhook not found" }, { status: 404 });
    const updates = [];
    const values = [];
    if (body.url !== undefined) { updates.push("url = ?"); values.push(body.url); }
    if (body.eventTypes !== undefined) { updates.push("event_types = ?"); values.push(Array.isArray(body.eventTypes) ? body.eventTypes.join(",") : body.eventTypes); }
    if (body.secret !== undefined) {
      const secretPrep = await prepareWebhookSecretForStorage(
        env,
        body.secret,
        hashWebhookSecret
      );
      if (!secretPrep.ok) {
        return json(
          { error: secretPrep.error, message: secretPrep.message },
          { status: 400 }
        );
      }
      if (secretPrep.warning) {
        logInfo("webhook.secret_plaintext_warn", {
          projectId: auth.projectId,
          webhookId,
          reason: secretPrep.warning,
        });
      }
      updates.push("secret = ?");
      values.push(secretPrep.enc ? null : secretPrep.secretPlain || null);
      updates.push("secret_hash = ?");
      values.push(secretPrep.secretHash ?? null);
      updates.push("secret_ciphertext = ?");
      values.push(secretPrep.enc?.secretCiphertext || null);
      updates.push("secret_iv = ?");
      values.push(secretPrep.enc?.secretIv || null);
    }
    if (!updates.length) return json({ error: "no fields to update" }, { status: 400 });
    values.push(webhookId);
    values.push(auth.projectId);
    await env.DB.prepare(
      `UPDATE webhooks SET ${updates.join(", ")} WHERE id = ? AND project_id = ?`
    ).bind(...values).run();
    ctx.waitUntil(
      writeAuditEvent(env, {
        projectId: auth.projectId,
        action: "webhook.update",
        actorUserId: auth.userId,
        targetType: "webhook",
        targetId: webhookId,
        traceId,
        metadata: { url: body.url },
      }).catch(() => {})
    );
    return json({ ok: true });
  }

  if (
    url.pathname.startsWith("/webhooks/") &&
    request.method === "DELETE"
  ) {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    if (!hasAnyRole(auth.roles, ["owner", "admin"])) {
      return json({ error: "forbidden" }, { status: 403 });
    }
    const webhookId = url.pathname.split("/")[2];
    if (!webhookId) return json({ error: "webhook id required" }, { status: 400 });
    const existing = await env.DB.prepare(
      "SELECT id FROM webhooks WHERE id = ? AND project_id = ?"
    ).bind(webhookId, auth.projectId).first();
    if (!existing) return json({ error: "webhook not found" }, { status: 404 });
    await env.DB.prepare("DELETE FROM webhooks WHERE id = ? AND project_id = ?")
      .bind(webhookId, auth.projectId)
      .run();
    ctx.waitUntil(
      writeAuditEvent(env, {
        projectId: auth.projectId,
        action: "webhook.delete",
        actorUserId: auth.userId,
        targetType: "webhook",
        targetId: webhookId,
        traceId,
        metadata: {},
      }).catch(() => {})
    );
    return json({ ok: true });
  }

  // Webhook signature verification endpoint
  if (url.pathname === "/webhooks/verify" && request.method === "POST") {
    const body = await request.json().catch(() => null);
    if (!body || !body.signature || !body.payload) {
      return json({ error: "signature and payload required" }, { status: 400 });
    }
    const webhookId = body.webhookId;
    if (!webhookId) {
      return json({ error: "webhookId required" }, { status: 400 });
    }
    const wh = await env.DB.prepare(
      "SELECT id, secret_hash FROM webhooks WHERE id = ?"
    ).bind(webhookId).first();
    if (!wh) {
      return json({ error: "webhook not found" }, { status: 404 });
    }
    if (!wh.secret_hash) {
      return json({ error: "webhook has no secret_hash configured" }, { status: 400 });
    }
    const expectedSignature = await signWebhookPayload(body.secret || "", body.payload);
    const receivedSig = body.signature.startsWith("sha256=") ? body.signature : `sha256=${body.signature}`;
    const expectedHex = expectedSignature.replace("sha256=", "");
    const receivedHex = receivedSig.replace("sha256=", "");
    const isValid = await timingSafeEqual(expectedHex, receivedHex);
    return json({ valid: isValid });
  }

  return null;
}
