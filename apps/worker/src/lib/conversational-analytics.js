/**
 * P15-L: Conversational Analytics — query analytics via natural language.
 *
 * Features:
 *   • Parse NL queries into structured intents
 *   • Execute against D1 analytics data
 *   • Cache frequent queries
 *   • Return formatted results with insights
 */

const ANALYTICS_INTENTS = {
  room_stats: /(?:room|chat|conversation)\s+(?:stats|statistics|metrics|activity)/i,
  active_rooms: /(?:active|busy|top)\s+(?:room|chat|conversation)/i,
  agent_performance: /(?:agent|support|team)\s+(?:performance|stats|metrics|speed|resolution)/i,
  agent_response_time: /(?:agent|support)\s+(?:response\s+time|speed|fast|slow)/i,
  sla_compliance: /(?:sla|service\s+level|uptime|compliance)/i,
  message_volume: /(?:message|msg|chat)\s+(?:volume|count|total|trend)/i,
  user_engagement: /(?:user|member|participant)\s+(?:engagement|activity|active|retention)/i,
  churn: /(?:churn|drop|lost|inactive)/i,
  peak_hours: /(?:peak|busiest|busy)\s+(?:hour|time|period)/i,
  moderation_stats: /(?:moderation|flag|report|action)\s+(?:stats|statistics|count)/i,
  resolution_rate: /(?:resolution|resolve|solved|closed)\s+(?:rate|ratio|percent)/i,
  comparison: /(?:compare|comparison|vs|versus|difference)/i,
  trending: /(?:trend|trending|growing|increasing|decreasing)/i,
  summary: /(?:summary|overview|report|dashboard|snapshot)/i,
};

function parseQueryIntent(queryText) {
  const intents = [];
  for (const [intent, pattern] of Object.entries(ANALYTICS_INTENTS)) {
    if (pattern.test(queryText)) intents.push(intent);
  }
  if (intents.length === 0) intents.push("summary");
  return { intents, originalQuery: queryText };
}

function hashQuery(queryText) {
  let hash = 0;
  const str = queryText.toLowerCase().trim();
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return hash.toString(36);
}

async function getCachedResult(env, { projectId, queryHash }) {
  const row = await env.DB.prepare(
    `SELECT result FROM analytics_query_cache WHERE project_id = ? AND query_hash = ? AND expires_at > datetime('now') LIMIT 1`
  ).bind(projectId, queryHash).first();
  return row ? JSON.parse(row.result) : null;
}

async function setCachedResult(env, { projectId, queryHash, result, ttlSeconds = 300 }) {
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT OR REPLACE INTO analytics_query_cache (id, project_id, query_hash, result, expires_at)
     VALUES (?, ?, ?, ?, datetime('now', '+' || ? || ' seconds'))`
  ).bind(id, projectId, queryHash, JSON.stringify(result), ttlSeconds).run();
}

export async function queryAnalytics(env, { projectId, queryText, userId, forceRefresh = false }) {
  const startTime = Date.now();
  const intent = parseQueryIntent(queryText);
  const queryHash = hashQuery(queryText);

  if (!forceRefresh) {
    const cached = await getCachedResult(env, { projectId, queryHash });
    if (cached) return { ...cached, fromCache: true };
  }

  let result = {};
  for (const i of intent.intents) {
    switch (i) {
      case "room_stats":
        result.roomStats = await getRoomStats(env, { projectId });
        break;
      case "active_rooms":
        result.activeRooms = await getActiveRooms(env, { projectId });
        break;
      case "agent_performance":
      case "agent_response_time":
        result.agentPerformance = await getAgentPerformance(env, { projectId });
        break;
      case "sla_compliance":
        result.slaCompliance = await getSlaCompliance(env, { projectId });
        break;
      case "message_volume":
        result.messageVolume = await getMessageVolume(env, { projectId });
        break;
      case "user_engagement":
        result.userEngagement = await getUserEngagement(env, { projectId });
        break;
      case "churn":
        result.churn = await getChurnStats(env, { projectId });
        break;
      case "peak_hours":
        result.peakHours = await getPeakHours(env, { projectId });
        break;
      case "moderation_stats":
        result.moderationStats = await getModerationStats(env, { projectId });
        break;
      case "resolution_rate":
        result.resolutionRate = await getResolutionRate(env, { projectId });
        break;
      case "trending":
        result.trending = await getTrending(env, { projectId });
        break;
      case "summary":
      default:
        result.summary = await getSummary(env, { projectId });
        break;
    }
  }

  const executionTimeMs = Date.now() - startTime;
  const response = { intents: intent.intents, result, executionTimeMs, queryText };

  await setCachedResult(env, { projectId, queryHash, result: response });
  await logQuery(env, { projectId, userId, queryText, intent: intent.intents, result: response, executionTimeMs });

  return response;
}

async function getRoomStats(env, { projectId }) {
  const rooms = await env.DB.prepare(
    `SELECT COUNT(*) as total FROM rooms WHERE project_id = ?`
  ).bind(projectId).first();
  const activeRooms = await env.DB.prepare(
    `SELECT COUNT(DISTINCT room_id) as active FROM messages
     WHERE project_id = ? AND created_at > datetime('now', '-7 days')`
  ).bind(projectId).first();
  return { totalRooms: rooms?.total || 0, activeRooms: activeRooms?.active || 0 };
}

async function getActiveRooms(env, { projectId }) {
  const { results } = await env.DB.prepare(
    `SELECT room_id, COUNT(*) as msg_count FROM messages
     WHERE project_id = ? AND created_at > datetime('now', '-7 days')
     GROUP BY room_id ORDER BY msg_count DESC LIMIT 10`
  ).bind(projectId).all();
  return results;
}

async function getAgentPerformance(env, { projectId }) {
  const { results } = await env.DB.prepare(
    `SELECT assignee_user_id as agent_id,
            COUNT(*) as total_tasks,
            SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved,
            AVG(CASE WHEN resolved_at IS NOT NULL
              THEN (julianday(resolved_at) - julianday(created_at)) * 86400
              ELSE NULL END) as avg_resolution_seconds
     FROM agent_tasks WHERE project_id = ?
     GROUP BY assignee_user_id ORDER BY resolved DESC LIMIT 10`
  ).bind(projectId).all();
  return results.map((r) => ({
    ...r,
    resolution_rate: r.total_tasks > 0 ? Math.round((r.resolved / r.total_tasks) * 100) : 0,
    avg_resolution_seconds: r.avg_resolution_seconds ? Math.round(r.avg_resolution_seconds) : null,
  }));
}

async function getSlaCompliance(env, { projectId }) {
  const total = await env.DB.prepare(
    `SELECT COUNT(*) as total FROM agent_tasks WHERE project_id = ?`
  ).bind(projectId).first();
  const met = await env.DB.prepare(
    `SELECT COUNT(*) as met FROM agent_tasks
     WHERE project_id = ? AND (resolved_at <= sla_due_at OR resolved_at IS NULL AND datetime('now') <= sla_due_at)`
  ).bind(projectId).first();
  return {
    totalTasks: total?.total || 0,
    slaMet: met?.met || 0,
    complianceRate: total?.total > 0 ? Math.round(((met?.met || 0) / total.total) * 100) : 100,
  };
}

async function getMessageVolume(env, { projectId }) {
  const { results } = await env.DB.prepare(
    `SELECT date(created_at) as day, COUNT(*) as count FROM messages
     WHERE project_id = ? AND created_at > datetime('now', '-30 days')
     GROUP BY day ORDER BY day ASC`
  ).bind(projectId).all();
  return results;
}

async function getUserEngagement(env, { projectId }) {
  const total = await env.DB.prepare(
    `SELECT COUNT(DISTINCT user_id) as total FROM messages WHERE project_id = ?`
  ).bind(projectId).first();
  const active = await env.DB.prepare(
    `SELECT COUNT(DISTINCT user_id) as active FROM messages
     WHERE project_id = ? AND created_at > datetime('now', '-7 days')`
  ).bind(projectId).first();
  return {
    totalUsers: total?.total || 0,
    activeUsers7d: active?.active || 0,
    engagementRate: total?.total > 0 ? Math.round(((active?.active || 0) / total.total) * 100) : 0,
  };
}

async function getChurnStats(env, { projectId }) {
  const { results } = await env.DB.prepare(
    `SELECT user_id, MAX(created_at) as last_active FROM messages
     WHERE project_id = ? GROUP BY user_id`
  ).bind(projectId).all();
  const now = new Date();
  let dormant = 0;
  for (const r of results) {
    const lastActive = new Date(r.last_active);
    if ((now - lastActive) > 7 * 24 * 60 * 60 * 1000) dormant++;
  }
  return { totalUsers: results.length, dormantUsers: dormant, churnRate: results.length > 0 ? Math.round((dormant / results.length) * 100) : 0 };
}

async function getPeakHours(env, { projectId }) {
  const { results } = await env.DB.prepare(
    `SELECT CAST(strftime('%H', created_at) AS INTEGER) as hour, COUNT(*) as count
     FROM messages WHERE project_id = ? AND created_at > datetime('now', '-7 days')
     GROUP BY hour ORDER BY count DESC LIMIT 5`
  ).bind(projectId).all();
  return results;
}

async function getModerationStats(env, { projectId }) {
  const total = await env.DB.prepare(
    `SELECT COUNT(*) as total FROM moderation_events WHERE project_id = ?`
  ).bind(projectId).first();
  const recent = await env.DB.prepare(
    `SELECT COUNT(*) as count, action FROM moderation_events
     WHERE project_id = ? AND created_at > datetime('now', '-7 days')
     GROUP BY action`
  ).bind(projectId).all();
  return { totalEvents: total?.total || 0, recentByAction: recent };
}

async function getResolutionRate(env, { projectId }) {
  const { results: stats } = await env.DB.prepare(
    `SELECT status, COUNT(*) as count FROM agent_tasks
     WHERE project_id = ? GROUP BY status`
  ).bind(projectId).all();
  const map = {};
  for (const s of stats) map[s.status] = s.count;
  const total = Object.values(map).reduce((a, b) => a + b, 0);
  return { byStatus: map, total, resolvedRate: total > 0 ? Math.round(((map.resolved || 0) / total) * 100) : 0 };
}

async function getTrending(env, { projectId }) {
  const thisWeek = await env.DB.prepare(
    `SELECT COUNT(*) as count FROM messages
     WHERE project_id = ? AND created_at > datetime('now', '-7 days')`
  ).bind(projectId).first();
  const lastWeek = await env.DB.prepare(
    `SELECT COUNT(*) as count FROM messages
     WHERE project_id = ? AND created_at > datetime('now', '-14 days') AND created_at <= datetime('now', '-7 days')`
  ).bind(projectId).first();
  const tw = thisWeek?.count || 0;
  const lw = lastWeek?.count || 0;
  return {
    thisWeek: tw, lastWeek: lw,
    change: lw > 0 ? Math.round(((tw - lw) / lw) * 100) : (tw > 0 ? 100 : 0),
    direction: tw > lw ? "up" : tw < lw ? "down" : "flat",
  };
}

async function getSummary(env, { projectId }) {
  const [roomStats, msgVol, userEng, resRate] = await Promise.all([
    getRoomStats(env, { projectId }),
    getMessageVolume(env, { projectId }),
    getUserEngagement(env, { projectId }),
    getResolutionRate(env, { projectId }),
  ]);
  return { rooms: roomStats, messages: msgVol.slice(-7), engagement: userEng, resolution: resRate };
}

async function logQuery(env, { projectId, userId, queryText, intent, result, executionTimeMs }) {
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO analytics_queries (id, project_id, user_id, query_text, parsed_intent, query_result, response_text, execution_time_ms)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, projectId, userId || "system", queryText, JSON.stringify({ intents: intent }), JSON.stringify(result), null, executionTimeMs).run();
}

export async function getQueryHistory(env, { projectId, limit = 20 }) {
  const { results } = await env.DB.prepare(
    `SELECT * FROM analytics_queries WHERE project_id = ? ORDER BY created_at DESC LIMIT ?`
  ).bind(projectId, limit).all();
  return results.map((r) => ({ ...r, parsed_intent: JSON.parse(r.parsed_intent || "{}"), query_result: JSON.parse(r.query_result || "{}") }));
}

export async function clearQueryCache(env, { projectId }) {
  const info = await env.DB.prepare(
    `DELETE FROM analytics_query_cache WHERE project_id = ?`
  ).bind(projectId).run();
  return info.meta?.changes || 0;
}
