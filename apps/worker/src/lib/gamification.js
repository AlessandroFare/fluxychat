/**
 * P15-N: Gamification layer
 *
 * Badges, XP, level progression, streaks, and leaderboard.
 * XP sources: messages, reactions, polls, forms, handoffs.
 * Badge types: achievement, streak, milestone, special.
 * Level formula: level = floor(sqrt(xp / 100)) + 1
 */

import { logInfo } from "./worker-log.js";

const XP_PER_MESSAGE = 5;
const XP_PER_REACTION_GIVEN = 1;
const XP_PER_REACTION_RECEIVED = 2;
const XP_PER_POLL_VOTE = 3;
const XP_PER_FORM_SUBMIT = 5;
const XP_PER_HANDOFF = 10;
const LEVEL_XP_BASE = 100;

const DEFAULT_BADGES = [
  { name: "First Message", description: "Send your first message", icon: "💬", type: "milestone", xp: 10, criteria: { metric: "messages_count", threshold: 1 } },
  { name: "Chatterbox", description: "Send 100 messages", icon: "🗣️", type: "achievement", xp: 50, criteria: { metric: "messages_count", threshold: 100 } },
  { name: "Conversations Starter", description: "Send 500 messages", icon: "🎯", type: "achievement", xp: 200, criteria: { metric: "messages_count", threshold: 500 } },
  { name: "Reaction Starter", description: "Give 10 reactions", icon: "👍", type: "milestone", xp: 10, criteria: { metric: "reactions_given", threshold: 10 } },
  { name: "Popular", description: "Receive 50 reactions", icon: "⭐", type: "achievement", xp: 50, criteria: { metric: "reactions_received", threshold: 50 } },
  { name: "Voter", description: "Vote in 10 polls", icon: "🗳️", type: "milestone", xp: 15, criteria: { metric: "polls_voted", threshold: 10 } },
  { name: "Form Filler", description: "Submit 5 forms", icon: "📋", type: "milestone", xp: 15, criteria: { metric: "forms_submitted", threshold: 5 } },
  { name: "Handoff Hero", description: "Complete 10 handoffs", icon: "🤝", type: "achievement", xp: 50, criteria: { metric: "handoffs_completed", threshold: 10 } },
  { name: "3-Day Streak", description: "Active 3 days in a row", icon: "🔥", type: "streak", xp: 20, criteria: { metric: "current_streak", threshold: 3 } },
  { name: "7-Day Streak", description: "Active 7 days in a row", icon: "🔥", type: "streak", xp: 50, criteria: { metric: "current_streak", threshold: 7 } },
  { name: "30-Day Streak", description: "Active 30 days in a row", icon: "💎", type: "streak", xp: 200, criteria: { metric: "current_streak", threshold: 30 } },
];

/**
 * Initialize default badges for a project.
 */
export async function initDefaultBadges(env, { projectId }) {
  const existing = await env.DB.prepare(
    "SELECT COUNT(*) as cnt FROM gamification_badges WHERE project_id = ?"
  )
    .bind(projectId)
    .first();

  if ((existing?.cnt || 0) > 0) return { ok: true, created: 0 };

  let created = 0;
  for (const badge of DEFAULT_BADGES) {
    await env.DB.prepare(
      "INSERT INTO gamification_badges (id, project_id, name, description, icon, badge_type, xp_reward, criteria_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    )
      .bind(crypto.randomUUID(), projectId, badge.name, badge.description, badge.icon, badge.type, badge.xp, JSON.stringify(badge.criteria))
      .run();
    created++;
  }

  logInfo("gamification.badges_initialized", { projectId, count: created });
  return { ok: true, created };
}

/**
 * Award XP for an action.
 */
export async function awardXP(env, input) {
  const { projectId, userId, roomId, source, referenceId } = input;
  if (!userId) return { ok: false, error: "user_required" };

  const xpMap = {
    message: XP_PER_MESSAGE,
    reaction_given: XP_PER_REACTION_GIVEN,
    reaction_received: XP_PER_REACTION_RECEIVED,
    poll_vote: XP_PER_POLL_VOTE,
    form_submit: XP_PER_FORM_SUBMIT,
    handoff: XP_PER_HANDOFF,
  };

  const xp = xpMap[source];
  if (!xp) return { ok: false, error: "invalid_source" };

  const now = new Date().toISOString();
  const today = now.slice(0, 10);

  // Get or create user record
  let user = await env.DB.prepare(
    "SELECT * FROM user_gamification WHERE project_id = ? AND user_id = ?"
  )
    .bind(projectId, userId)
    .first();

  if (!user) {
    await env.DB.prepare(
      `INSERT INTO user_gamification (id, project_id, user_id, room_id, xp_total, level, messages_count, reactions_given, reactions_received, polls_voted, forms_submitted, handoffs_completed, current_streak, longest_streak, last_active_date, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, 0, 0, 0, 0, 0, 0, 0, 0, ?, ?, ?)`
    )
      .bind(crypto.randomUUID(), projectId, userId, roomId || null, 0, today, now, now)
      .run();

    user = await env.DB.prepare(
      "SELECT * FROM user_gamification WHERE project_id = ? AND user_id = ?"
    )
      .bind(projectId, userId)
      .first();
  }

  // Update streak
  let newStreak = user.current_streak || 0;
  const lastActive = user.last_active_date;
  if (lastActive) {
    const lastDate = new Date(lastActive);
    const todayDate = new Date(today);
    const diffDays = Math.floor((todayDate - lastDate) / 86400000);
    if (diffDays === 1) {
      newStreak++;
    } else if (diffDays > 1) {
      newStreak = 1;
    }
    // diffDays === 0 means same day, no change
  } else {
    newStreak = 1;
  }

  const longestStreak = Math.max(newStreak, user.longest_streak || 0);

  // Update counters
  const counterField = {
    message: "messages_count",
    reaction_given: "reactions_given",
    reaction_received: "reactions_received",
    poll_vote: "polls_voted",
    form_submit: "forms_submitted",
    handoff: "handoffs_completed",
  }[source];

  const newXP = (user.xp_total || 0) + xp;
  const newLevel = Math.floor(Math.sqrt(newXP / LEVEL_XP_BASE)) + 1;

  await env.DB.prepare(
    `UPDATE user_gamification SET
       xp_total = ?, level = ?, ${counterField} = ${counterField} + 1,
       current_streak = ?, longest_streak = ?, last_active_date = ?, updated_at = ?
     WHERE project_id = ? AND user_id = ?`
  )
    .bind(newXP, newLevel, newStreak, longestStreak, today, now, projectId, userId)
    .run();

  // Log XP
  await env.DB.prepare(
    "INSERT INTO xp_log (id, project_id, user_id, xp_amount, source, reference_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  )
    .bind(crypto.randomUUID(), projectId, userId, xp, source, referenceId || null, now)
    .run();

  // Check badges
  const awardedBadges = await checkAndAwardBadges(env, { projectId, userId });

  return { ok: true, xp, totalXP: newXP, level: newLevel, streak: newStreak, awardedBadges };
}

/**
 * Check and award badges based on current stats.
 */
async function checkAndAwardBadges(env, { projectId, userId }) {
  const user = await env.DB.prepare(
    "SELECT * FROM user_gamification WHERE project_id = ? AND user_id = ?"
  )
    .bind(projectId, userId)
    .first();

  if (!user) return [];

  const badges = await env.DB.prepare(
    "SELECT * FROM gamification_badges WHERE project_id = ? AND is_active = 1"
  )
    .bind(projectId)
    .all();

  const earned = [];

  for (const badge of badges.results || []) {
    // Check if already earned
    const existing = await env.DB.prepare(
      "SELECT id FROM user_badges WHERE project_id = ? AND user_id = ? AND badge_id = ?"
    )
      .bind(projectId, userId, badge.id)
      .first();

    if (existing) continue;

    // Check criteria
    const criteria = JSON.parse(badge.criteria_json || "{}");
    const metricValue = user[criteria.metric] || 0;

    if (metricValue >= (criteria.threshold || 0)) {
      await env.DB.prepare(
        "INSERT INTO user_badges (id, project_id, user_id, badge_id, earned_at) VALUES (?, ?, ?, ?, ?)"
      )
        .bind(crypto.randomUUID(), projectId, userId, badge.id, new Date().toISOString())
        .run();

      // Award badge XP
      await env.DB.prepare(
        "UPDATE user_gamification SET xp_total = xp_total + ? WHERE project_id = ? AND user_id = ?"
      )
        .bind(badge.xp_reward || 0, projectId, userId)
        .run();

      earned.push({ name: badge.name, icon: badge.icon, xp: badge.xp_reward });
    }
  }

  return earned;
}

/**
 * Get user gamification profile.
 */
export async function getUserProfile(env, input) {
  const { projectId, userId } = input;

  const user = await env.DB.prepare(
    "SELECT * FROM user_gamification WHERE project_id = ? AND user_id = ?"
  )
    .bind(projectId, userId)
    .first();

  if (!user) return { ok: true, profile: null };

  const badges = await env.DB.prepare(
    `SELECT b.name, b.icon, b.badge_type, b.xp_reward, ub.earned_at
     FROM user_badges ub JOIN gamification_badges b ON ub.badge_id = b.id
     WHERE ub.project_id = ? AND ub.user_id = ?
     ORDER BY ub.earned_at DESC`
  )
    .bind(projectId, userId)
    .all();

  return {
    ok: true,
    profile: {
      userId: user.user_id,
      xpTotal: user.xp_total,
      level: user.level,
      messagesCount: user.messages_count,
      reactionsGiven: user.reactions_given,
      reactionsReceived: user.reactions_received,
      pollsVoted: user.polls_voted,
      formsSubmitted: user.forms_submitted,
      handoffsCompleted: user.handoffs_completed,
      currentStreak: user.current_streak,
      longestStreak: user.longest_streak,
      lastActiveDate: user.last_active_date,
    },
    badges: (badges.results || []).map((b) => ({
      name: b.name,
      icon: b.icon,
      type: b.badge_type,
      xp: b.xp_reward,
      earnedAt: b.earned_at,
    })),
  };
}

/**
 * Get leaderboard.
 */
export async function getLeaderboard(env, input) {
  const { projectId, roomId, limit = 50 } = input;

  let sql = "SELECT user_id, xp_total, level, current_streak, messages_count FROM user_gamification WHERE project_id = ?";
  const params = [projectId];

  if (roomId) {
    sql += " AND room_id = ?";
    params.push(roomId);
  }

  sql += " ORDER BY xp_total DESC LIMIT ?";
  params.push(limit);

  const rows = await env.DB.prepare(sql).bind(...params).all();

  return {
    ok: true,
    leaderboard: (rows.results || []).map((r, i) => ({
      rank: i + 1,
      userId: r.user_id,
      xpTotal: r.xp_total,
      level: r.level,
      streak: r.current_streak,
      messages: r.messages_count,
    })),
  };
}

/**
 * Get all available badges for a project.
 */
export async function listBadges(env, input) {
  const { projectId } = input;

  const badges = await env.DB.prepare(
    "SELECT * FROM gamification_badges WHERE project_id = ? AND is_active = 1 ORDER BY badge_type, name"
  )
    .bind(projectId)
    .all();

  return {
    ok: true,
    badges: (badges.results || []).map((b) => ({
      id: b.id,
      name: b.name,
      description: b.description,
      icon: b.icon,
      type: b.badge_type,
      xp: b.xp_reward,
    })),
  };
}
