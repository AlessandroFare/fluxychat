/**
 * AI-prioritized notification scoring (roadmap #8).
 * Score = mention × urgency × role × content signals.
 */

import { getPreference, priorityWeight } from "./notification-controls.js";

const URGENT_KEYWORDS = ["urgent", "asap", "critical", "emergency", "down", "outage", "help!"];
const QUESTION_MARK = /\?/;

/**
 * @param {{
 *   isMention: boolean,
 *   preview?: string,
 *   authorRole?: string | null,
 *   topic?: string,
 * }} input
 */
export function scoreMessageNotification(input) {
  let score = 2;
  const reasons = [];

  if (input.isMention) {
    score += 10;
    reasons.push("mention");
  }

  const preview = String(input.preview ?? "").toLowerCase();
  if (QUESTION_MARK.test(preview)) {
    score += 3;
    reasons.push("question");
  }

  if (URGENT_KEYWORDS.some((kw) => preview.includes(kw))) {
    score += 8;
    reasons.push("urgency_keyword");
  }

  const role = String(input.authorRole ?? "").toLowerCase();
  if (role === "admin" || role === "owner" || role === "moderator") {
    score += 4;
    reasons.push("elevated_role");
  }

  if (input.topic === "handoff" || input.topic === "escalation") {
    score += 6;
    reasons.push(input.topic);
  }

  if (input.topic === "announcement") {
    score += 8;
    reasons.push("announcement");
  }

  let level = "normal";
  if (score >= 18) level = "urgent";
  else if (score >= 12) level = "high";
  else if (score <= 4) level = "low";

  return {
    score,
    level,
    reasons,
    weight: priorityWeight(level),
    shouldBatchLowPriority: level === "low" && !input.isMention,
  };
}

/**
 * Resolve effective priority for a recipient (user prefs + computed score).
 */
export async function resolveNotificationPriority(env, {
  projectId,
  userId,
  roomId,
  isMention,
  preview,
  authorRole,
  topic = "message",
}) {
  const effectiveTopic = topic === "announcement" ? "announcement" : isMention ? "mention" : topic || "message";
  const computed = scoreMessageNotification({
    isMention,
    preview,
    authorRole,
    topic: effectiveTopic,
  });
  const pref = await getPreference(env.DB, {
    projectId,
    userId,
    topic: effectiveTopic === "announcement" ? "message" : effectiveTopic,
    roomId,
  });
  const prefLevel = pref?.priorityLevel ?? "normal";
  const weight = Math.max(computed.weight, priorityWeight(prefLevel));
  const level = weight >= 4 ? "urgent" : weight >= 3 ? "high" : weight >= 2 ? "normal" : "low";

  return {
    ...computed,
    level,
    weight,
    digestFrequency: pref?.digestFrequency ?? "realtime",
    pushEnabled: pref?.pushEnabled !== false,
  };
}
