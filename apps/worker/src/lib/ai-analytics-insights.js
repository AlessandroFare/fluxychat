/**
 * P14-G: AI-Powered Analytics Insights.
 */

import { buildOpenAiChatCompletionsUrl } from "./openai-compat-url.js";

const INSIGHT_TYPES = ["engagement", "activity", "performance", "retention", "content", "agent", "custom"];

const INSIGHT_PROMPTS = {
  engagement: `Analyze the following engagement data and provide 3-5 actionable insights. Focus on peak activity times, user engagement patterns, and recommendations to improve engagement. Return JSON with: title, summary, keyFindings[], recommendations[].`,
  activity: `Analyze the following activity data and identify trends. Focus on message volume patterns, room activity, and user participation. Return JSON with: title, summary, keyFindings[], recommendations[].`,
  performance: `Analyze the following performance metrics and identify bottlenecks. Focus on response times, error rates, and system health. Return JSON with: title, summary, keyFindings[], recommendations[].`,
  retention: `Analyze the following retention data and identify churn risks. Focus on user activity trends, returning vs new users, and at-risk segments. Return JSON with: title, summary, keyFindings[], recommendations[].`,
  content: `Analyze the following content metrics and identify what resonates. Focus on message types, media usage, and content trends. Return JSON with: title, summary, keyFindings[], recommendations[].`,
  agent: `Analyze the following agent performance data. Focus on resolution rates, response quality, and tool usage. Return JSON with: title, summary, keyFindings[], recommendations[].`,
  custom: `Analyze the following data and provide insights. Return JSON with: title, summary, keyFindings[], recommendations[].`,
};

function isAnalyticsInsightsEnabled(env) {
  return env.AI_ANALYTICS_ENABLED === "true" && !!env.AI_BASE_URL;
}

/**
 * Generate AI insights from operational data.
 */
export async function generateInsights(env, {
  projectId, insightType, periodStart, periodEnd, customData, model,
}) {
  if (!isAnalyticsInsightsEnabled(env)) {
    return { ok: false, error: "analytics_insights_disabled", status: 503 };
  }

  if (!INSIGHT_TYPES.includes(insightType)) {
    return { ok: false, error: `invalid_insight_type: ${insightType}`, status: 400 };
  }

  const startTime = Date.now();
  const selectedModel = model || env.AI_ANALYTICS_MODEL || env.AI_MODEL || "gpt-4o-mini";

  // Gather data from D1
  const data = customData || await gatherAnalyticsData(env, { projectId, insightType, periodStart, periodEnd });

  try {
    const prompt = INSIGHT_PROMPTS[insightType] || INSIGHT_PROMPTS.custom;
    const response = await fetch(buildOpenAiChatCompletionsUrl(env.AI_BASE_URL), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(env.AI_API_KEY ? { Authorization: `Bearer ${env.AI_API_KEY}` } : {}),
      },
      body: JSON.stringify({
        model: selectedModel,
        messages: [
          { role: "system", content: "You are an analytics expert. Provide concise, actionable insights in JSON format." },
          { role: "user", content: `${prompt}\n\nData:\n${JSON.stringify(data, null, 2).slice(0, 8000)}` },
        ],
        temperature: 0.3,
        max_tokens: 1024,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "unknown");
      return { ok: false, error: "ai_api_error", details: errText.slice(0, 200), status: 502 };
    }

    const aiResult = await response.json();
    const content = aiResult.choices?.[0]?.message?.content;
    if (!content) return { ok: false, error: "empty_ai_response", status: 502 };

    let parsed;
    try { parsed = JSON.parse(content); } catch { parsed = { title: "Insight", summary: content }; }

    const id = crypto.randomUUID();
    const insight = {
      id,
      projectId,
      insightType,
      title: parsed.title || `${insightType} insight`,
      summary: parsed.summary || "",
      data: JSON.stringify(parsed),
      periodStart: periodStart || null,
      periodEnd: periodEnd || null,
      model: selectedModel,
      confidence: parsed.confidence || 0.8,
      generatedAt: new Date().toISOString(),
    };

    // Persist
    await env.DB.prepare(
      `INSERT INTO ai_analytics_insights (id, project_id, insight_type, title, summary, data, period_start, period_end, model, confidence)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, projectId, insightType, insight.title, insight.summary, insight.data,
      insight.periodStart, insight.periodEnd, insight.model, insight.confidence)
      .run();

    return {
      ok: true,
      ...insight,
      data: parsed,
      processingTimeMs: Date.now() - startTime,
    };
  } catch (err) {
    return { ok: false, error: "generation_failed", details: err.message?.slice(0, 200), status: 500 };
  }
}

/**
 * List stored insights for a project.
 */
export async function listInsights(env, { projectId, insightType, limit = 20, offset = 0 }) {
  let sql = `SELECT * FROM ai_analytics_insights WHERE project_id = ?`;
  const params = [projectId];
  if (insightType && INSIGHT_TYPES.includes(insightType)) {
    sql += ` AND insight_type = ?`;
    params.push(insightType);
  }
  sql += ` ORDER BY generated_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);
  const { results } = await env.DB.prepare(sql).bind(...params).all();
  return results.map(r => ({ ...r, data: tryParse(r.data) }));
}

/**
 * Get a specific insight.
 */
export async function getInsight(env, { projectId, id }) {
  const row = await env.DB.prepare(
    `SELECT * FROM ai_analytics_insights WHERE id = ? AND project_id = ?`
  ).bind(id, projectId).first();
  if (!row) return null;
  return { ...row, data: tryParse(row.data) };
}

/**
 * Generate weekly digest insights.
 */
export async function generateWeeklyDigest(env, { projectId }) {
  const now = new Date();
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const periodStart = weekAgo.toISOString();
  const periodEnd = now.toISOString();

  const types = ["engagement", "activity", "performance"];
  const insights = [];

  for (const type of types) {
    const result = await generateInsights(env, { projectId, insightType: type, periodStart, periodEnd });
    if (result.ok) insights.push(result);
  }

  return { ok: true, insights, count: insights.length };
}

/**
 * Delete an insight.
 */
export async function deleteInsight(env, { projectId, id }) {
  const row = await env.DB.prepare(
    `SELECT id FROM ai_analytics_insights WHERE id = ? AND project_id = ?`
  ).bind(id, projectId).first();
  if (!row) return { ok: false, error: "not_found" };
  await env.DB.prepare(`DELETE FROM ai_analytics_insights WHERE id = ? AND project_id = ?`).bind(id, projectId).run();
  return { ok: true };
}

/**
 * Gather analytics data from existing operational_metrics and messages tables.
 */
async function gatherAnalyticsData(env, { projectId, insightType, periodStart, periodEnd }) {
  // Build parameterized WHERE clause to prevent SQL injection.
  // periodStart/periodEnd are user-controlled ISO date strings.
  const conditions = [];
  const params = [projectId];
  if (periodStart) { conditions.push("created_at >= ?"); params.push(periodStart); }
  if (periodEnd) { conditions.push("created_at <= ?"); params.push(periodEnd); }
  const periodClause = conditions.length ? "AND " + conditions.join(" AND ") : "";

  const data = {};

  try {
    // Message volume
    const msgCount = await env.DB.prepare(
      `SELECT COUNT(*) as count FROM messages WHERE project_id = ? ${periodClause}`
    ).bind(...params).first();
    data.messageCount = msgCount?.count || 0;

    // Messages by hour
    const byHour = await env.DB.prepare(
      `SELECT CAST(strftime('%H', created_at) AS INTEGER) as hour, COUNT(*) as count
       FROM messages WHERE project_id = ? ${periodClause}
       GROUP BY hour ORDER BY count DESC`
    ).bind(...params).all();
    data.messagesByHour = byHour?.results || [];

    // Messages by day
    const byDay = await env.DB.prepare(
      `SELECT strftime('%w', created_at) as day, COUNT(*) as count
       FROM messages WHERE project_id = ? ${periodClause}
       GROUP BY day ORDER BY count DESC`
    ).bind(...params).all();
    data.messagesByDay = byDay?.results || [];

    // Active rooms
    const activeRooms = await env.DB.prepare(
      `SELECT COUNT(DISTINCT room_id) as count FROM messages WHERE project_id = ? ${periodClause}`
    ).bind(...params).first();
    data.activeRooms = activeRooms?.count || 0;

    // Active users
    const activeUsers = await env.DB.prepare(
      `SELECT COUNT(DISTINCT sender_id) as count FROM messages WHERE project_id = ? ${periodClause}`
    ).bind(...params).first();
    data.activeUsers = activeUsers?.count || 0;

    // Voice messages ratio
    const voiceCount = await env.DB.prepare(
      `SELECT COUNT(*) as count FROM messages WHERE project_id = ? AND kind = 'voice' ${periodClause}`
    ).bind(...params).first();
    data.voiceMessageCount = voiceCount?.count || 0;

    // Agent runs
    const agentRuns = await env.DB.prepare(
      `SELECT COUNT(*) as count FROM agent_runs WHERE project_id = ? ${periodClause}`
    ).bind(...params).first();
    data.agentRunCount = agentRuns?.count || 0;

    // Agent failures
    const agentFails = await env.DB.prepare(
      `SELECT COUNT(*) as count FROM agent_runs WHERE project_id = ? AND status = 'failed' ${periodClause}`
    ).bind(...params).first();
    data.agentFailureCount = agentFails?.count || 0;

  } catch (_) { /* tables may not exist */ }

  return data;
}

function tryParse(str) {
  try { return JSON.parse(str); } catch { return str; }
}
