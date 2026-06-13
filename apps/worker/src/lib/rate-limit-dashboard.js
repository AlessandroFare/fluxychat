/**
 * P14-J: Rate Limit Dashboard (visual).
 *
 * Track and expose rate limit events for dashboard visualization.
 * Features:
 *   • Log rate limit events (allowed + denied) to D1
 *   • Query rate limit usage per project/key/window
 *   • Real-time usage counters
 *   • Threshold alerts
 *   • Historical usage charts
 */

/**
 * Record a rate limit event.
 */
export async function recordRateLimitEvent(env, {
  projectId, key, limit, windowSeconds, allowed, currentCount, retryAfterSeconds, reason,
}) {
  try {
    await env.DB.prepare(
      `INSERT INTO rate_limit_events (project_id, key, limit_val, window_seconds, allowed, current_count, retry_after_seconds, reason)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(projectId, key, limit, windowSeconds, allowed ? 1 : 0, currentCount || 0, retryAfterSeconds || 0, reason || null)
      .run();
  } catch (_) { /* non-critical */ }
}

/**
 * Get rate limit usage summary for a project.
 */
export async function getRateLimitSummary(env, { projectId, windowMinutes = 60 }) {
  const since = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();

  const total = await env.DB.prepare(
    `SELECT COUNT(*) as count FROM rate_limit_events WHERE project_id = ? AND created_at >= ?`
  ).bind(projectId, since).first();

  const denied = await env.DB.prepare(
    `SELECT COUNT(*) as count FROM rate_limit_events WHERE project_id = ? AND created_at >= ? AND allowed = 0`
  ).bind(projectId, since).first();

  const byKey = await env.DB.prepare(
    `SELECT key, COUNT(*) as total, SUM(CASE WHEN allowed = 0 THEN 1 ELSE 0 END) as denied,
     MAX(current_count) as max_count, MAX(limit_val) as limit_val
     FROM rate_limit_events WHERE project_id = ? AND created_at >= ?
     GROUP BY key ORDER BY denied DESC`
  ).bind(projectId, since).all();

  const hourly = await env.DB.prepare(
    `SELECT strftime('%Y-%m-%d %H:00', created_at) as hour,
     COUNT(*) as total, SUM(CASE WHEN allowed = 0 THEN 1 ELSE 0 END) as denied
     FROM rate_limit_events WHERE project_id = ? AND created_at >= ?
     GROUP BY hour ORDER BY hour`
  ).bind(projectId, since).all();

  return {
    windowMinutes,
    totalRequests: total?.count || 0,
    totalDenied: denied?.count || 0,
    denialRate: total?.count > 0 ? ((denied?.count || 0) / total.count * 100).toFixed(1) + "%" : "0%",
    byKey: byKey?.results || [],
    hourly: hourly?.results || [],
  };
}

/**
 * Get rate limit thresholds and current usage for a project.
 */
export async function getRateLimitThresholds(env, { projectId }) {
  // Get current usage from recent events
  const since = new Date(Date.now() - 60 * 1000).toISOString();
  const usage = await env.DB.prepare(
    `SELECT key, MAX(limit_val) as limit_val, MAX(current_count) as current_count,
     MAX(window_seconds) as window_seconds
     FROM rate_limit_events WHERE project_id = ? AND created_at >= ?
     GROUP BY key`
  ).bind(projectId, since).all();

  return (usage?.results || []).map(r => ({
    key: r.key,
    limit: r.limit_val,
    current: r.current_count,
    windowSeconds: r.window_seconds,
    utilization: r.limit_val > 0 ? ((r.current_count / r.limit_val) * 100).toFixed(1) + "%" : "0%",
    status: r.current_count >= r.limit_val ? "exceeded" : r.current_count >= r.limit_val * 0.8 ? "warning" : "ok",
  }));
}

/**
 * Get recent rate limit denials for a project.
 */
export async function getRecentDenials(env, { projectId, limit = 50 }) {
  const { results } = await env.DB.prepare(
    `SELECT * FROM rate_limit_events WHERE project_id = ? AND allowed = 0
     ORDER BY created_at DESC LIMIT ?`
  ).bind(projectId, limit).all();
  return results;
}
