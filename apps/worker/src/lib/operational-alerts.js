import { logError } from "./worker-log.js";
import { toMinuteBucketIso } from "./operational-metrics.js";
import { truncateForStorage } from "./storage-utils.js";

/**
 * Evaluate enabled operational_alert_rules for a project against operational_metrics.
 * Opens alert events and optionally POSTs to ALERT_DISPATCH_WEBHOOK_URL.
 */
export async function evaluateOperationalAlerts(env, projectId) {
  if (!projectId) return { checkedRules: 0, triggered: 0 };
  const rulesResult = await env.DB.prepare(
    "SELECT id, metric_name, window_minutes, threshold_value, comparator, severity, cooldown_minutes FROM operational_alert_rules WHERE project_id = ? AND enabled = 1"
  )
    .bind(projectId)
    .all();
  const rules = rulesResult.results || [];
  if (!rules.length) return { checkedRules: 0, triggered: 0 };

  let triggered = 0;
  for (const rule of rules) {
    const fromBucket = toMinuteBucketIso(
      new Date(Date.now() - Number(rule.window_minutes || 5) * 60_000)
    );
    const metricRow = await env.DB.prepare(
      "SELECT COALESCE(SUM(metric_value),0) as total FROM operational_metrics WHERE project_id = ? AND metric_name = ? AND bucket_minute >= ?"
    )
      .bind(projectId, rule.metric_name, fromBucket)
      .first();
    const observed = Number(metricRow?.total || 0);
    const threshold = Number(rule.threshold_value || 0);
    const comparator = String(rule.comparator || "gte");
    const shouldTrigger =
      comparator === "gt" ? observed > threshold : observed >= threshold;
    if (!shouldTrigger) continue;

    const recentOpen = await env.DB.prepare(
      "SELECT id, created_at FROM operational_alert_events WHERE rule_id = ? AND status = 'open' ORDER BY created_at DESC LIMIT 1"
    )
      .bind(rule.id)
      .first();
    const cooldownMs = Number(rule.cooldown_minutes || 15) * 60_000;
    if (recentOpen?.created_at) {
      const elapsed = Date.now() - Date.parse(recentOpen.created_at);
      if (elapsed < cooldownMs) continue;
    }

    const now = new Date().toISOString();
    const eventId = crypto.randomUUID();
    const message = `${rule.metric_name} ${comparator} ${threshold} (observed ${observed} in ${rule.window_minutes}m)`;
    await env.DB.prepare(
      "INSERT INTO operational_alert_events (id, project_id, rule_id, metric_name, observed_value, threshold_value, status, severity, message, created_at, resolved_at) VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, NULL)"
    )
      .bind(
        eventId,
        projectId,
        rule.id,
        rule.metric_name,
        observed,
        threshold,
        rule.severity || "warning",
        message,
        now
      )
      .run();
    await dispatchOperationalAlertEvent(env, {
      id: eventId,
      projectId,
      ruleId: rule.id,
      metricName: rule.metric_name,
      observedValue: observed,
      thresholdValue: threshold,
      severity: rule.severity || "warning",
      message,
      createdAt: now,
    }).catch((err) =>
      logError("alerts.dispatch_failed", err, {
        projectId,
        ruleId: rule.id,
        alertEventId: eventId,
      })
    );
    triggered += 1;
  }

  return { checkedRules: rules.length, triggered };
}

export async function dispatchOperationalAlertEvent(env, event) {
  const targetUrl = String(env.ALERT_DISPATCH_WEBHOOK_URL || "").trim();
  if (!targetUrl) return;
  const now = new Date().toISOString();
  const dedupeId = `alert-webhook:${event.id}:${targetUrl}`;
  const existing = await env.DB.prepare(
    "SELECT id, status FROM operational_alert_dispatches WHERE id = ?"
  )
    .bind(dedupeId)
    .first();
  if (existing?.status === "dispatched") return;

  if (!existing) {
    await env.DB.prepare(
      "INSERT INTO operational_alert_dispatches (id, event_id, project_id, channel, target, status, attempt_count, last_http_status, last_error, created_at, updated_at, dispatched_at) VALUES (?, ?, ?, 'webhook', ?, 'pending', 0, NULL, NULL, ?, ?, NULL)"
    )
      .bind(dedupeId, event.id, event.projectId, targetUrl, now, now)
      .run();
  }

  const payload = {
    type: "operational.alert.triggered",
    source: "fluxychat-worker",
    ts: now,
    alert: {
      id: event.id,
      projectId: event.projectId,
      ruleId: event.ruleId,
      metricName: event.metricName,
      observedValue: event.observedValue,
      thresholdValue: event.thresholdValue,
      severity: event.severity,
      message: event.message,
      createdAt: event.createdAt,
    },
  };
  const response = await fetch(targetUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Fluxy-Event": payload.type,
      "X-Fluxy-Alert-Id": event.id,
      "X-Fluxy-Project-Id": event.projectId,
      "X-Fluxy-Dedupe-Id": dedupeId,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = `http_${response.status}`;
    await env.DB.prepare(
      "UPDATE operational_alert_dispatches SET status = 'failed', attempt_count = attempt_count + 1, last_http_status = ?, last_error = ?, updated_at = ? WHERE id = ?"
    )
      .bind(response.status, truncateForStorage(error), now, dedupeId)
      .run();
    throw new Error(`alert dispatch failed: ${error}`);
  }

  await env.DB.prepare(
    "UPDATE operational_alert_dispatches SET status = 'dispatched', attempt_count = attempt_count + 1, last_http_status = ?, last_error = NULL, updated_at = ?, dispatched_at = ? WHERE id = ?"
  )
    .bind(response.status, now, now, dedupeId)
    .run();
}
