/**
 * P18-I: Predictive Engagement AI
 * Churn prediction, optimal send time, activity forecasting using conversation data.
 * Uses statistical analysis of message patterns (no external ML dependencies).
 */

function generateId() {
  return `pe_${crypto.randomUUID().slice(0, 12)}`;
}

function nowIso() {
  return new Date().toISOString();
}

/* ── Activity Pattern Recording ── */

export async function recordUserActivity(env, { projectId, userId, roomId, activityType, timestamp, metadata }) {
  const id = generateId();
  const now = nowIso();

  await env.DB.prepare(
    `INSERT INTO user_activity_log (id, project_id, user_id, room_id, activity_type, timestamp, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(id, projectId, userId, roomId || null, activityType, timestamp || now, JSON.stringify(metadata || {}), now)
    .run();

  return { id, projectId, userId, roomId: roomId || null, activityType, timestamp: timestamp || now, createdAt: now };
}

export async function getUserActivityLog(env, { projectId, userId, startTime, endTime, limit = 500 }) {
  let sql = `SELECT * FROM user_activity_log WHERE project_id = ? AND user_id = ?`;
  const binds = [projectId, userId];

  if (startTime) { sql += ` AND timestamp >= ?`; binds.push(startTime); }
  if (endTime) { sql += ` AND timestamp <= ?`; binds.push(endTime); }
  sql += ` ORDER BY timestamp DESC LIMIT ?`;
  binds.push(Math.min(limit, 5000));

  const rows = await env.DB.prepare(sql).bind(...binds).all();
  return (rows.results || []).map(mapActivityRow);
}

/* ── Churn Prediction ── */

export async function predictChurnRisk(env, { projectId, userId, lookbackDays = 30 }) {
  const startTime = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();
  const activities = await getUserActivityLog(env, { projectId, userId, startTime });

  if (activities.length === 0) {
    return { userId, risk: 'unknown', score: 0, factors: ['no_data'], lastActivity: null };
  }

  const now = Date.now();
  const lastActivity = activities[0];
  const daysSinceLastActivity = (now - new Date(lastActivity.timestamp).getTime()) / (1000 * 60 * 60 * 24);

  // Activity frequency
  const uniqueDays = new Set(activities.map(a => a.timestamp.split('T')[0])).size;
  const activityFrequency = uniqueDays / lookbackDays;

  // Recency score (0-1, higher = more recent = lower churn risk)
  const recencyScore = Math.max(0, 1 - (daysSinceLastActivity / lookbackDays));

  // Engagement depth (variety of activity types)
  const activityTypes = new Set(activities.map(a => a.activityType));
  const engagementDepth = activityTypes.size / 5; // normalize by 5 common types

  // Room diversity
  const uniqueRooms = new Set(activities.map(a => a.roomId).filter(Boolean)).size;
  const roomDiversity = Math.min(1, uniqueRooms / 3);

  // Composite churn score (0-100, higher = more likely to churn)
  const churnScore = Math.round(
    (1 - recencyScore) * 40 +      // 40% weight on recency
    (1 - activityFrequency) * 30 +  // 30% weight on frequency
    (1 - engagementDepth) * 20 +    // 20% weight on engagement
    (1 - roomDiversity) * 10        // 10% weight on diversity
  );

  const risk = churnScore > 70 ? 'high' : churnScore > 40 ? 'medium' : 'low';
  const factors = [];
  if (daysSinceLastActivity > 7) factors.push('inactive_7d');
  if (activityFrequency < 0.1) factors.push('low_frequency');
  if (activityTypes.size <= 1) factors.push('low_engagement');
  if (uniqueRooms <= 1) factors.push('single_room');

  return {
    userId, risk, score: churnScore, factors,
    lastActivity: lastActivity.timestamp,
    metrics: {
      daysSinceLastActivity: Math.round(daysSinceLastActivity * 10) / 10,
      activityFrequency: Math.round(activityFrequency * 1000) / 1000,
      engagementDepth: Math.round(engagementDepth * 100) / 100,
      roomDiversity,
    },
  };
}

/* ── Optimal Send Time ── */

export async function calculateOptimalSendTime(env, { projectId, userId, lookbackDays = 60 }) {
  const startTime = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();
  const activities = await getUserActivityLog(env, { projectId, userId, startTime });

  if (activities.length < 10) {
    return { userId, optimalHours: [], confidence: 'low', dataPoints: activities.length };
  }

  // Group by hour of day
  const hourCounts = new Array(24).fill(0);
  for (const a of activities) {
    const hour = new Date(a.timestamp).getUTCHours();
    hourCounts[hour]++;
  }

  // Find peak hours (top 3)
  const indexed = hourCounts.map((count, hour) => ({ hour, count }));
  indexed.sort((a, b) => b.count - a.count);
  const optimalHours = indexed.slice(0, 3).map(h => h.hour).sort((a, b) => a - b);

  // Confidence based on data volume
  const confidence = activities.length >= 100 ? 'high' : activities.length >= 30 ? 'medium' : 'low';

  // Activity heatmap (24 hours)
  const maxCount = Math.max(...hourCounts);
  const heatmap = hourCounts.map((count, hour) => ({
    hour,
    activityLevel: maxCount > 0 ? Math.round((count / maxCount) * 100) : 0,
    count,
  }));

  return {
    userId, optimalHours, confidence,
    dataPoints: activities.length,
    heatmap,
  };
}

/* ── Activity Forecasting ── */

export async function forecastActivity(env, { projectId, userId, forecastDays = 7 }) {
  const lookbackDays = 60;
  const startTime = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();
  const activities = await getUserActivityLog(env, { projectId, userId, startTime });

  if (activities.length < 7) {
    return {
      userId, forecastDays,
      predictions: [],
      confidence: 'low',
      summary: 'Insufficient data for forecasting',
    };
  }

  // Daily activity counts for the last 30 days
  const dailyCounts = {};
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  for (const a of activities) {
    const d = new Date(a.timestamp);
    if (d >= thirtyDaysAgo) {
      const day = d.toISOString().split('T')[0];
      dailyCounts[day] = (dailyCounts[day] || 0) + 1;
    }
  }

  const counts = Object.values(dailyCounts);
  const avgDaily = counts.length > 0 ? counts.reduce((a, b) => a + b, 0) / counts.length : 0;
  const trend = counts.length >= 2 ? (counts[counts.length - 1] - counts[0]) / counts.length : 0;

  // Simple moving average forecast
  const predictions = [];
  for (let i = 1; i <= forecastDays; i++) {
    const forecastDate = new Date(Date.now() + i * 24 * 60 * 60 * 1000);
    const predicted = Math.max(0, Math.round((avgDaily + trend * i) * 10) / 10);
    predictions.push({
      date: forecastDate.toISOString().split('T')[0],
      predictedActivity: predicted,
    });
  }

  const confidence = counts.length >= 20 ? 'medium' : 'low';

  return {
    userId, forecastDays, predictions, confidence,
    summary: `Based on ${counts.length} days of data, avg ${avgDaily.toFixed(1)} activities/day`,
    metrics: { avgDaily: Math.round(avgDaily * 10) / 10, trend: Math.round(trend * 100) / 100 },
  };
}

/* ── Bulk Churn Analysis ── */

export async function analyzeProjectChurn(env, { projectId, lookbackDays = 30 }) {
  // Get all users who had activity in the lookback window
  const startTime = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();
  const rows = await env.DB.prepare(
    `SELECT DISTINCT user_id FROM user_activity_log WHERE project_id = ? AND timestamp >= ?`
  )
    .bind(projectId, startTime)
    .all();

  const userIds = (rows.results || []).map(r => r.user_id);
  const results = [];

  for (const userId of userIds) {
    const prediction = await predictChurnRisk(env, { projectId, userId, lookbackDays });
    results.push(prediction);
  }

  const highRisk = results.filter(r => r.risk === 'high').length;
  const mediumRisk = results.filter(r => r.risk === 'medium').length;
  const lowRisk = results.filter(r => r.risk === 'low').length;

  return {
    projectId, totalUsers: results.length,
    riskDistribution: { high: highRisk, medium: mediumRisk, low: lowRisk },
    highRiskUsers: results.filter(r => r.risk === 'high').map(r => ({ userId: r.userId, score: r.score, factors: r.factors })),
  };
}

function mapActivityRow(row) {
  return {
    id: row.id, projectId: row.project_id, userId: row.user_id,
    roomId: row.room_id ?? null, activityType: row.activity_type,
    timestamp: row.timestamp, metadata: tryParse(row.metadata), createdAt: row.created_at,
  };
}

function tryParse(json) {
  try { return JSON.parse(json); } catch { return json; }
}
