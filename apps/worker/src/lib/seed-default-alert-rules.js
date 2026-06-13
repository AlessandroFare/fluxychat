/** Default operational alert rules seeded for every new project (ENG-09). */
export const DEFAULT_ALERT_RULES = Object.freeze([
  Object.freeze({
    metricName: "requests_error",
    windowMinutes: 5,
    thresholdValue: 25,
    comparator: "gte",
    severity: "warning",
    cooldownMinutes: 15,
  }),
  Object.freeze({
    metricName: "webhook_delivery_failed",
    windowMinutes: 15,
    thresholdValue: 5,
    comparator: "gte",
    severity: "warning",
    cooldownMinutes: 30,
  }),
  Object.freeze({
    metricName: "agent_runs_failed",
    windowMinutes: 15,
    thresholdValue: 10,
    comparator: "gte",
    severity: "critical",
    cooldownMinutes: 30,
  }),
]);

/**
 * @param {*} env
 * @param {string} projectId
 */
export async function seedDefaultAlertRules(env, projectId) {
  if (!projectId || !env?.DB) return { seeded: 0 };
  const now = new Date().toISOString();
  const statements = DEFAULT_ALERT_RULES.map((rule) => {
    const id = `alert_default_${rule.metricName}_${projectId}`;
    return env.DB.prepare(
      `INSERT OR IGNORE INTO operational_alert_rules
       (id, project_id, metric_name, window_minutes, threshold_value, comparator, severity, cooldown_minutes, enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    ).bind(
      id,
      projectId,
      rule.metricName,
      rule.windowMinutes,
      rule.thresholdValue,
      rule.comparator,
      rule.severity,
      rule.cooldownMinutes,
      now,
      now,
    );
  });
  if (!statements.length) return { seeded: 0 };
  await env.DB.batch(statements);
  return { seeded: statements.length };
}
