import { isPrivateUrl, safeOutboundFetch } from "./url-ssrf.js";
import { checkAndConsumeProjectQuota } from "./project-plan-quota.js";
import {
  resolveWebhookSigningSecret,
  signWebhookPayload,
  webhookRequiresSigningSecret,
} from "./webhook-signing.js";
import { safeJsonParse, truncateForStorage } from "./storage-utils.js";
import { incrementOperationalMetric } from "./operational-metrics.js";
import { logError } from "./worker-log.js";

export function retryDelayMsForAttempt(attemptNumber) {
  const schedule = [60_000, 300_000, 1_800_000, 3_600_000];
  const idx = Math.min(Math.max(0, attemptNumber - 1), schedule.length - 1);
  return schedule[idx];
}

/**
 * Parse an HTTP `Retry-After` header (delay-seconds or HTTP-date) into
 * milliseconds, clamped to [1s, 1h] so a receiver cannot park a delivery past
 * our own backoff ceiling. Returns null when absent or unparsable.
 */
export function parseRetryAfterMs(value, now = Date.now()) {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const seconds = Number(raw);
  const ms = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(raw) - now;
  if (!Number.isFinite(ms)) return null;
  return Math.min(Math.max(Math.trunc(ms), 1_000), 3_600_000);
}

/** Audit F-67: how long a 'processing' claim may sit before it is retryable. */
const STALE_CLAIM_MS = 5 * 60_000;

export async function deliverWebhooks(env, projectId, eventType, payload, options = {}) {
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
    if (options.excludeWebhookId && h.id === options.excludeWebhookId) continue;
    const allowed = String(h.event_types || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (allowed.length && !allowed.includes(eventType)) continue;
    // Audit F-47: a quota check that errors must not fail open — the delivery
    // is skipped (and logged) instead of bypassing the project quota.
    let quotaResult;
    try {
      quotaResult = await checkAndConsumeProjectQuota(env, {
        projectId,
        metricName: "webhook_deliveries",
        amount: 1,
      });
    } catch (err) {
      logError("webhooks.quota_check_failed", err, { projectId, webhookId: h.id });
      continue;
    }
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
  // Audit F-67: claim rows atomically before sending. Rows stuck in
  // 'processing' (isolate died mid-send) become claimable again after the
  // stale window, so a crash cannot lose a delivery.
  const staleBefore = new Date(Date.now() - STALE_CLAIM_MS).toISOString();
  const pending = await env.DB.prepare(
    "SELECT id, project_id, webhook_id, webhook_url, payload, attempt_count FROM webhook_deliveries WHERE (status = 'pending' AND next_attempt_at <= ?) OR (status = 'processing' AND updated_at <= ?) ORDER BY next_attempt_at ASC LIMIT ?"
  )
    .bind(now, staleBefore, maxBatch)
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
      // Audit F-67: exclusive claim — a concurrent processor that also selected
      // this row must not send it a second time.
      const claim = await env.DB.prepare(
        "UPDATE webhook_deliveries SET status = 'processing', updated_at = ? WHERE id = ? AND (status = 'pending' OR (status = 'processing' AND updated_at <= ?))"
      )
        .bind(new Date().toISOString(), d.id, staleBefore)
        .run();
      if (!claim.meta?.changes) return;
      const nextAttemptCount = Number(d.attempt_count || 0) + 1;
      let httpStatus = null;
      let errorText = null;
      let retryAfterMs = null;
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
        const { injectW3cTraceHeaders } = await import("./w3c-trace-context.js");
        Object.assign(
          headers,
          injectW3cTraceHeaders(headers, {
            traceId: payload.traceId || payload.payload?.runId || d.id,
            spanId: d.id,
          }),
        );
        // Audit F-66: the delivery fetch must apply the same host allowlist as
        // registration (env-aware — see url-ssrf.ts).
        if (isPrivateUrl(d.webhook_url, env)) {
          errorText = "webhook_url_blocked_ssrf";
        } else {
          const response = await safeOutboundFetch(
            d.webhook_url,
            {
              method: "POST",
              headers,
              body: d.payload,
            },
            env,
          );
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
          retryAfterMs = parseRetryAfterMs(response.headers.get("retry-after"));
        }
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
        await notifyWebhookDeliveryFailed(env, d, {
          attempts: nextAttemptCount,
          httpStatus,
          errorText,
        });
        return;
      }

      // Honor Retry-After when the receiver asks for more than our schedule.
      const retryAt = new Date(
        Date.now() + Math.max(retryDelayMsForAttempt(nextAttemptCount), retryAfterMs || 0)
      ).toISOString();
      // Audit F-67: release the claim back to 'pending' so the retry schedule
      // (not the 5-minute stale window) controls the next attempt.
      await env.DB.prepare(
        "UPDATE webhook_deliveries SET status = 'pending', attempt_count = ?, next_attempt_at = ?, last_http_status = ?, last_error = ?, updated_at = ? WHERE id = ?"
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

/**
 * n8n-style error workflow: when a delivery exhausts its retries, projects
 * subscribed to `webhook.delivery_failed` get a notification (metadata only —
 * the original payload is not resent). The failing webhook itself is excluded,
 * and a failed `webhook.delivery_failed` delivery never re-triggers this path,
 * so the chain stops after one hop.
 */
async function notifyWebhookDeliveryFailed(env, delivery, { attempts, httpStatus, errorText }) {
  const original = safeJsonParse(delivery.payload) || {};
  if (original.type === "webhook.delivery_failed") return;
  await deliverWebhooks(
    env,
    delivery.project_id,
    "webhook.delivery_failed",
    {
      deliveryId: delivery.id,
      webhookId: delivery.webhook_id,
      webhookUrl: delivery.webhook_url,
      eventType: original.type || "unknown",
      attempts,
      lastHttpStatus: httpStatus,
      lastError: errorText,
    },
    { excludeWebhookId: delivery.webhook_id }
  );
}
