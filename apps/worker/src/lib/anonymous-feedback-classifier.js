/**
 * Anonymous sensitive feedback classifier (HR compliance).
 * Two paths: aggregated anonymous summary vs HR escalation (de-identified).
 * Audit stores category + timestamp only — never content or submitter identity.
 */
import { logError, logInfo } from "./worker-log.js";
import { isAiConfigured } from "./ai-gateway.js";
import { chatCompletion } from "./ai-chat-completion.js";

/** Deliberately biased — escalate when in doubt. */
export const ESCALATION_CONFIDENCE_THRESHOLD = 0.45;

export const SENSITIVE_CATEGORIES = [
  "harassment",
  "discrimination",
  "retaliation",
  "safety",
  "misconduct",
  "mental_health",
  "general",
];

const CLASSIFIER_SYSTEM_PROMPT = `You classify anonymous workplace feedback for HR routing.
Return ONLY valid JSON:
{
  "category": "harassment|discrimination|retaliation|safety|misconduct|mental_health|general",
  "confidence": 0.0-1.0
}

Rules:
1. Never include names, quotes, or message content in the response.
2. When unsure between sensitive and general, pick the more sensitive category with higher confidence.
3. harassment/discrimination/retaliation/safety/misconduct are high-sensitivity.
4. mental_health is sensitive but may use aggregated summary path unless acute risk implied.
5. general is for routine feedback with no compliance sensitivity.`;

/**
 * @param {object} env
 * @param {string} content
 * @returns {Promise<{ category: string, confidence: number, source: string }>}
 */
export async function classifyAnonymousFeedback(env, content) {
  const trimmed = String(content ?? "").trim();
  if (!trimmed) {
    return { category: "general", confidence: 1, source: "empty" };
  }

  if (!isAiConfigured(env)) {
    return heuristicClassify(trimmed);
  }

  try {
    const response = await chatCompletion(env, {
      messages: [
        { role: "system", content: CLASSIFIER_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Classify this anonymous feedback (do not repeat it):\n\n${trimmed.slice(0, 4000)}`,
        },
      ],
      temperature: 0,
      maxTokens: 120,
    });

    const parsed = parseClassifierJson(response?.content ?? response?.text ?? "");
    if (parsed) {
      return { ...parsed, source: "llm" };
    }
  } catch (err) {
    logError("anonymous_feedback.classify_llm_failed", err);
  }

  return heuristicClassify(trimmed);
}

/**
 * @param {{ category: string, confidence: number }} classification
 */
export function resolveFeedbackPath(classification) {
  const category = String(classification.category ?? "general");
  const confidence = Number(classification.confidence ?? 0);

  const sensitive =
    category !== "general" &&
    (confidence >= ESCALATION_CONFIDENCE_THRESHOLD ||
      ["harassment", "discrimination", "retaliation", "safety", "misconduct"].includes(category));

  if (sensitive) {
    return { path: "hr_escalation", category, confidence };
  }
  return { path: "aggregated_summary", category, confidence };
}

/**
 * Submit anonymous feedback — content is NOT stored; only classification metadata.
 * @param {*} env
 * @param {{ projectId: string, roomId?: string, content: string }} input
 */
export async function submitAnonymousFeedback(env, input) {
  if (!env?.DB) throw new Error("db_unavailable");

  const classification = await classifyAnonymousFeedback(env, input.content);
  const routed = resolveFeedbackPath(classification);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO anonymous_feedback_submissions
     (id, project_id, room_id, category, confidence, path, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      input.projectId,
      input.roomId ?? null,
      routed.category,
      routed.confidence,
      routed.path,
      routed.path === "hr_escalation" ? "escalated" : "received",
      now,
    )
    .run();

  await recordAnonymousFeedbackAudit(env, {
    projectId: input.projectId,
    submissionId: id,
    category: routed.category,
    confidence: routed.confidence,
    path: routed.path,
  });

  logInfo("anonymous_feedback.submitted", {
    projectId: input.projectId,
    submissionId: id,
    path: routed.path,
    category: routed.category,
  });

  return {
    ok: true,
    submissionId: id,
    path: routed.path,
    category: routed.category,
    confidence: routed.confidence,
    message:
      routed.path === "hr_escalation"
        ? "Your feedback has been routed to HR. No identifying information was stored."
        : "Thank you. Your feedback will be included in an aggregated summary.",
  };
}

/**
 * Privacy-safe audit — category + timestamp only.
 * @param {*} env
 */
export async function recordAnonymousFeedbackAudit(env, input) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO anonymous_feedback_audit (id, project_id, submission_id, category, confidence, path, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      input.projectId,
      input.submissionId,
      input.category,
      input.confidence,
      input.path,
      now,
    )
    .run();
  return { id, createdAt: now };
}

/**
 * @param {*} env
 * @param {{ projectId: string, limit?: number }} input
 */
export async function listAnonymousFeedbackAudit(env, input) {
  const limit = Math.min(Math.max(Number(input.limit) || 50, 1), 200);
  const { results } = await env.DB.prepare(
    `SELECT id, submission_id, category, confidence, path, created_at
     FROM anonymous_feedback_audit
     WHERE project_id = ?
     ORDER BY created_at DESC LIMIT ?`,
  )
    .bind(input.projectId, limit)
    .all();

  return (results || []).map((row) => ({
    id: row.id,
    submissionId: row.submission_id,
    category: row.category,
    confidence: row.confidence,
    path: row.path,
    createdAt: row.created_at,
  }));
}

function heuristicClassify(content) {
  const lower = content.toLowerCase();
  const rules = [
    { category: "harassment", patterns: ["harass", "bully", "hostile"] },
    { category: "discrimination", patterns: ["discriminat", "racist", "sexist", "bias"] },
    { category: "retaliation", patterns: ["retaliat", "revenge", "punished for reporting"] },
    { category: "safety", patterns: ["unsafe", "injury", "accident", "osha"] },
    { category: "misconduct", patterns: ["fraud", "theft", "bribe", "misconduct"] },
    { category: "mental_health", patterns: ["burnout", "anxiety", "depression", "stress"] },
  ];

  for (const rule of rules) {
    if (rule.patterns.some((p) => lower.includes(p))) {
      return { category: rule.category, confidence: 0.72, source: "heuristic" };
    }
  }
  return { category: "general", confidence: 0.85, source: "heuristic" };
}

function parseClassifierJson(raw) {
  const text = String(raw).trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    const category = SENSITIVE_CATEGORIES.includes(parsed.category)
      ? parsed.category
      : "general";
    const confidence = Math.min(1, Math.max(0, Number(parsed.confidence) || 0));
    return { category, confidence };
  } catch {
    return null;
  }
}
