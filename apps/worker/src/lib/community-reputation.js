/**
 * P20-D: Community Moderation + Reputation — trust-based governance.
 *
 * Features:
 *   • Reputation scoring (points per action type)
 *   • Trust levels: 1=newbie, 2=member, 3=trusted, 4=moderator, 5=elder
 *   • Trusted members get auto-privileges (skip mod queue, pin messages)
 *   • Anti-spam rules (rate limit, link detection, keyword filter)
 *   • Warning system (escalation: warn → mute → ban)
 *   • Contest mode (leaderboard, challenges)
 *   • Analytics (reputation distribution, top contributors, spam stats)
 */

const TRUST_LEVELS = {
  1: { name: "newbie", minScore: 0 },
  2: { name: "member", minScore: 50 },
  3: { name: "trusted", minScore: 200 },
  4: { name: "moderator", minScore: 500 },
  5: { name: "elder", minScore: 1000 },
};

const DEFAULT_REPUTATION_POINTS = {
  message_sent: 1,
  message_liked: 5,
  message_pinned: 10,
  helpful_answer: 20,
  event_attended: 5,
  quiz_correct: 3,
  report_valid: 15,
  report_invalid: -10,
  spam_detected: -20,
  warning_received: -5,
  mute_received: -25,
  daily_login: 1,
  first_message: 10,
};

const SPAM_RULE_TYPES = ["rate_limit", "link_detection", "keyword_filter", "duplicate_detection", "caps_ratio"];

export async function getReputation(env, { projectId, userId }) {
  const row = await env.DB.prepare(
    `SELECT * FROM community_reputation WHERE project_id = ? AND user_id = ?`
  ).bind(projectId, userId).first();
  return row ? formatReputation(row) : null;
}

export async function upsertReputation(env, { projectId, userId, points, eventType, description }) {
  const existing = await getReputation(env, { projectId, userId });
  const newScore = (existing?.score || 0) + points;
  const newLevel = computeTrustLevel(newScore);

  if (existing) {
    await env.DB.prepare(
      `UPDATE community_reputation SET score = ?, level = ?, last_active_at = datetime('now')
       WHERE project_id = ? AND user_id = ?`
    ).bind(newScore, newLevel, projectId, userId).run();
  } else {
    const id = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO community_reputation (id, project_id, user_id, score, level, last_active_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`
    ).bind(id, projectId, userId, newScore, newLevel).run();
  }

  const eventId = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO reputation_events (id, project_id, user_id, event_type, points, description)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(eventId, projectId, userId, eventType, points, description || null).run();

  return { score: newScore, level: newLevel, trusted: newLevel >= 3 };
}

export async function addWarning(env, { projectId, userId }) {
  const existing = await getReputation(env, { projectId, userId });
  if (!existing) throw new Error("User has no reputation record");
  const newWarnings = existing.warnings + 1;
  let newMutes = existing.mutes;
  let action = "warn";
  if (newWarnings >= 3 && newWarnings < 5) { newMutes++; action = "mute"; }
  if (newWarnings >= 5) { action = "ban"; }

  await env.DB.prepare(
    `UPDATE community_reputation SET warnings = ?, mutes = ?
     WHERE project_id = ? AND user_id = ?`
  ).bind(newWarnings, newMutes, projectId, userId).run();

  return { warnings: newWarnings, mutes: newMutes, action };
}

export async function getLeaderboard(env, { projectId, limit = 20 }) {
  const { results } = await env.DB.prepare(
    `SELECT * FROM community_reputation WHERE project_id = ?
     ORDER BY score DESC LIMIT ?`
  ).bind(projectId, limit).all();
  return results.map(formatReputation);
}

export async function getReputationEvents(env, { projectId, userId, eventType, limit = 50 }) {
  let query = `SELECT * FROM reputation_events WHERE project_id = ?`;
  const params = [projectId];
  if (userId) { query += ` AND user_id = ?`; params.push(userId); }
  if (eventType) { query += ` AND event_type = ?`; params.push(eventType); }
  query += ` ORDER BY created_at DESC LIMIT ?`;
  params.push(limit);
  const { results } = await env.DB.prepare(query).bind(...params).all();
  return results.map(formatEvent);
}

/* ═══ Anti-Spam ═══ */

export async function createSpamRule(env, { projectId, ruleName, ruleType, config, action }) {
  if (!SPAM_RULE_TYPES.includes(ruleType)) throw new Error(`Invalid rule type: ${ruleType}`);
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO anti_spam_rules (id, project_id, rule_name, rule_type, config, action)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(id, projectId, ruleName, ruleType, JSON.stringify(config || {}), action || "warn").run();
  return { id, ruleName, ruleType, action: action || "warn" };
}

export async function listSpamRules(env, { projectId }) {
  const { results } = await env.DB.prepare(
    `SELECT * FROM anti_spam_rules WHERE project_id = ? AND enabled = 1`
  ).bind(projectId).all();
  return results.map(formatSpamRule);
}

export async function evaluateSpam(env, { projectId, content, userId, rateLimitKey }) {
  const rules = await listSpamRules(env, { projectId });
  const violations = [];

  for (const rule of rules) {
    const cfg = typeof rule.config === "string" ? JSON.parse(rule.config || "{}") : (rule.config || {});

    if (rule.ruleType === "keyword_filter" && cfg.keywords) {
      const lower = content.toLowerCase();
      for (const kw of cfg.keywords) {
        if (lower.includes(kw.toLowerCase())) {
          violations.push({ ruleId: rule.id, ruleName: rule.ruleName, matchedKeyword: kw, action: rule.action });
        }
      }
    }

    if (rule.ruleType === "caps_ratio") {
      const letters = content.replace(/[^a-zA-Z]/g, "");
      if (letters.length > 0) {
        const upper = letters.replace(/[^A-Z]/g, "").length;
        const ratio = upper / letters.length;
        if (ratio > (cfg.threshold || 0.7)) {
          violations.push({ ruleId: rule.id, ruleName: rule.ruleName, ratio, action: rule.action });
        }
      }
    }

    if (rule.ruleType === "duplicate_detection") {
      const recentEvents = await env.DB.prepare(
        `SELECT COUNT(*) as cnt FROM reputation_events
         WHERE project_id = ? AND user_id = ? AND event_type = 'message_sent'
         AND created_at > datetime('now', '-60 seconds')`
      ).bind(projectId, userId).first();
      if (recentEvents?.cnt >= (cfg.maxDuplicate || 3)) {
        violations.push({ ruleId: rule.id, ruleName: rule.ruleName, count: recentEvents.cnt, action: rule.action });
      }
    }
  }

  return { violations, isSpam: violations.length > 0 };
}

/* ═══ Contest Mode ═══ */

export async function getContestLeaderboard(env, { projectId, timeframe = "week", limit = 10 }) {
  const interval = timeframe === "day" ? "1 day" : timeframe === "month" ? "30 days" : "7 days";
  const { results } = await env.DB.prepare(
    `SELECT user_id, SUM(points) as points
     FROM reputation_events WHERE project_id = ?
     AND created_at > datetime('now', '-' || ? || ')
     GROUP BY user_id ORDER BY points DESC LIMIT ?`
  ).bind(projectId, interval, limit).all();
  return results;
}

/* ═══ Analytics ═══ */

export async function getReputationStats(env, { projectId }) {
  const total = await env.DB.prepare(
    `SELECT COUNT(*) as total FROM community_reputation WHERE project_id = ?`
  ).bind(projectId).first();
  const byLevel = await env.DB.prepare(
    `SELECT level, COUNT(*) as count FROM community_reputation
     WHERE project_id = ? GROUP BY level`
  ).bind(projectId).all();
  const topEvents = await env.DB.prepare(
    `SELECT event_type, COUNT(*) as count, SUM(points) as total_points
     FROM reputation_events WHERE project_id = ?
     GROUP BY event_type ORDER BY count DESC LIMIT 10`
  ).bind(projectId).all();
  const spamCount = await env.DB.prepare(
    `SELECT COUNT(*) as cnt FROM reputation_events
     WHERE project_id = ? AND event_type = 'spam_detected'`
  ).bind(projectId).first();

  return {
    totalUsers: total?.total || 0,
    byLevel: Object.fromEntries((byLevel.results || byLevel).map(r => [TRUST_LEVELS[r.level]?.name || `L${r.level}`, r.count])),
    topEvents: topEvents.results || topEvents,
    spamDetected: spamCount?.cnt || 0,
  };
}

function computeTrustLevel(score) {
  let level = 1;
  for (const [lvl, def] of Object.entries(TRUST_LEVELS)) {
    if (score >= def.minScore) level = parseInt(lvl);
  }
  return level;
}

function formatReputation(row) {
  return {
    id: row.id, projectId: row.project_id, userId: row.user_id,
    score: row.score, level: row.level,
    levelName: TRUST_LEVELS[row.level]?.name || "unknown",
    trusted: row.trusted === 1, warnings: row.warnings,
    mutes: row.mutes, lastActiveAt: row.last_active_at, createdAt: row.created_at,
  };
}

function formatEvent(row) {
  return {
    id: row.id, projectId: row.project_id, userId: row.user_id,
    eventType: row.event_type, points: row.points,
    description: row.description, createdAt: row.created_at,
  };
}

function formatSpamRule(row) {
  return {
    id: row.id, projectId: row.project_id, ruleName: row.rule_name,
    ruleType: row.rule_type, config: JSON.parse(row.config || "{}"),
    action: row.action, enabled: row.enabled === 1, createdAt: row.created_at,
  };
}

