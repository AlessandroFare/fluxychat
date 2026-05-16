import { checkAndConsumeProjectQuota } from "./project-plan-quota.js";
import {
  resolveWebhookSigningSecret,
  signWebhookPayload,
  webhookRequiresSigningSecret,
} from "./webhook-signing.js";
import { safeJsonParse, truncateForStorage } from "./storage-utils.js";
import { incrementOperationalMetric } from "./operational-metrics.js";

export function retryDelayMsForAttempt(attemptNumber) {
  const schedule = [60_000, 300_000, 1_800_000, 3_600_000];
  const idx = Math.min(Math.max(0, attemptNumber - 1), schedule.length - 1);
  return schedule[idx];
}

export async function deliverWebhooks(env, projectId, eventType, payload) {
  if (!projectId) return;
  const res = await env.DB.prepare(
    "SELECT id, url, secret, secret_ciphertext, secret_iv, event_types FROM webhooks WHERE project_id = ?"
  )
    .bind(projectId)
    .all();
  const hooks = res.results || [];
  if (!hooks.length) return;

  const body = JSON.stringify({
    type: eventType,
    projectId,
    payload,
    createdAt: new Date().toISOString(),
  });

  const now = new Date().toISOString();
  const statements = [];
  for (const h of hooks) {
    const allowed = String(h.event_types || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (allowed.length && !allowed.includes(eventType)) continue;
    const quotaResult = await checkAndConsumeProjectQuota(env, {
      projectId,
      metricName: "webhook_deliveries",
      amount: 1,
    }).catch(() => ({ allowed: true }));
    if (!quotaResult.allowed) continue;
    const deliveryId = crypto.randomUUID();
    statements.push(
      env.DB.prepare(
        "INSERT INTO webhook_deliveries (id, project_id, webhook_id, webhook_url, event_type, payload, status, attempt_count, next_attempt_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?, ?)"
      ).bind(
        deliveryId,
        projectId,
        h.id,
        h.url,
        eventType,
        body,
        now,
        now,
        now
      )
    );
  }
  if (statements.length) {
    await env.DB.batch(statements);
    await processPendingWebhookDeliveries(env);
  }
}

export async function processPendingWebhookDeliveries(env, maxBatch = 20) {
  const now = new Date().toISOString();
  const pending = await env.DB.prepare(
    "SELECT id, project_id, webhook_id, webhook_url, payload, attempt_count FROM webhook_deliveries WHERE status = 'pending' AND next_attempt_at <= ? ORDER BY next_attempt_at ASC LIMIT ?"
  )
    .bind(now, maxBatch)
    .all();
  const rows = pending.results || [];
  if (!rows.length) return;

  const webhookIds = [...new Set(rows.map((r) => r.webhook_id).filter(Boolean))];
  const webhookSecrets = {};
  const blockedWebhookIds = new Set();
  if (webhookIds.length) {
    const placeholders = webhookIds.map(() => "?").join(",");
    const wRows = await env.DB.prepare(
      `SELECT id, secret, secret_ciphertext, secret_iv, secret_hash FROM webhooks WHERE id IN (${placeholders})`
    )
      .bind(...webhookIds)
      .all();
    for (const w of wRows.results || []) {
      const resolved = await resolveWebhookSigningSecret(env, w);
      if (resolved.fatalError) {
        blockedWebhookIds.add(w.id);
        await env.DB.prepare(
          "UPDATE webhook_deliveries SET status = 'failed', last_error = ?, updated_at = ? WHERE webhook_id = ? AND status = 'pending'"
        )
          .bind(resolved.fatalError, now, w.id)
          .run();
        continue;
      }
      if (webhookRequiresSigningSecret(w) && !resolved.secret) {
        blockedWebhookIds.add(w.id);
        await env.DB.prepare(
          "UPDATE webhook_deliveries SET status = 'failed', last_error = ?, updated_at = ? WHERE webhook_id = ? AND status = 'pending'"
        )
          .bind("signing_secret_unavailable", now, w.id)
          .run();
        continue;
      }
      webhookSecrets[w.id] = resolved.secret;
    }
  }

  await Promise.all(
    rows.map(async (d) => {
      if (blockedWebhookIds.has(d.webhook_id)) return;
      const nextAttemptCount = Number(d.attempt_count || 0) + 1;
      let httpStatus = null;
      let errorText = null;
      try {
        const headers = { "Content-Type": "application/json" };
        const secret = webhookSecrets[d.webhook_id];
        if (secret) {
          headers["X-Fluxy-Signature"] = await signWebhookPayload(
            secret,
            d.payload
          );
        }
        const payload = safeJsonParse(d.payload) || {};
        headers["X-Fluxy-Event"] = String(payload.type || "unknown");
        headers["X-Fluxy-Project-Id"] = String(payload.projectId || "");
        headers["X-Fluxy-Delivery-Id"] = d.id;
        const response = await fetch(d.webhook_url, {
          method: "POST",
          headers,
          body: d.payload,
        });
        httpStatus = response.status;
        if (response.ok) {
          await env.DB.prepare(
            "UPDATE webhook_deliveries SET status = 'delivered', attempt_count = ?, last_http_status = ?, last_error = NULL, delivered_at = ?, updated_at = ? WHERE id = ?"
          )
            .bind(nextAttemptCount, httpStatus, now, now, d.id)
            .run();
          return;
        }
        errorText = `http_${response.status}`;
      } catch (err) {
        errorText = err instanceof Error ? err.message : "delivery_failed";
      }
      await incrementOperationalMetric(env, {
        metricName: "webhook_delivery_failed",
        projectId: d.project_id || "default",
        value: 1,
      }).catch(() => {});

      const maxAttempts = Number(env.WEBHOOK_MAX_ATTEMPTS || 5);
      if (nextAttemptCount >= maxAttempts) {
        await env.DB.prepare(
          "UPDATE webhook_deliveries SET status = 'failed', attempt_count = ?, last_http_status = ?, last_error = ?, updated_at = ? WHERE id = ?"
        )
          .bind(
            nextAttemptCount,
            httpStatus,
            truncateForStorage(errorText),
            now,
            d.id
          )
          .run();
        return;
      }

      const retryAt = new Date(
        Date.now() + retryDelayMsForAttempt(nextAttemptCount)
      ).toISOString();
      await env.DB.prepare(
        "UPDATE webhook_deliveries SET attempt_count = ?, next_attempt_at = ?, last_http_status = ?, last_error = ?, updated_at = ? WHERE id = ?"
      )
        .bind(
          nextAttemptCount,
          retryAt,
          httpStatus,
          truncateForStorage(errorText),
          now,
          d.id
        )
        .run();
    })
  );
}
