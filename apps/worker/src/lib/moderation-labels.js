/**
 * Stream-style Labels API — classify content and return labels without auto-enforcement.
 */

import { analyzeContent } from "./ai-moderation.js";

const BUILTIN_PATTERNS = [
  { label: "pii", pattern: /\b\d{3}-\d{2}-\d{4}\b/g },
  { label: "pci", pattern: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14})\b/g },
  { label: "pii", pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/gi },
];

const BUILTIN_LABELS = [
  "spam",
  "harassment",
  "hate",
  "violence",
  "sexual",
  "pii",
  "pci",
  "phi",
  "profanity",
  "self_harm",
  "misinformation",
  "ai_generated",
];

/**
 * Pattern-only classification (no LLM).
 * @param {string} content
 */
export function classifyContentLabels(content) {
  const text = String(content || "");
  const labels = [];
  const scores = {};

  if (!text.trim()) {
    return { labels: [], scores: {}, severity: "none" };
  }

  for (const bp of BUILTIN_PATTERNS) {
    bp.pattern.lastIndex = 0;
    if (bp.pattern.test(text)) {
      if (!labels.includes(bp.label)) labels.push(bp.label);
      scores[bp.label] = Math.max(scores[bp.label] ?? 0, 0.95);
    }
  }

  if (/\b(shit|fuck|damn|asshole|bastard)\b/i.test(text)) {
    labels.push("profanity");
    scores.profanity = 0.85;
  }

  if (/(click here|free money|buy now|limited offer)/i.test(text)) {
    labels.push("spam");
    scores.spam = 0.7;
  }

  const severity =
    labels.includes("pci") || labels.includes("phi")
      ? "critical"
      : labels.includes("pii") || labels.includes("harassment")
        ? "high"
        : labels.length
          ? "medium"
          : "none";

  return { labels, scores, severity };
}

/**
 * @param {*} env
 * @param {{ content: string, projectId: string, roomId?: string, userId?: string, useAi?: boolean }} input
 */
export async function labelContent(env, input) {
  const pattern = classifyContentLabels(input.content);
  if (!input.useAi) {
    return {
      ok: true,
      labels: pattern.labels,
      scores: pattern.scores,
      severity: pattern.severity,
      source: "pattern",
      taxonomy: BUILTIN_LABELS,
    };
  }

  const ai = await analyzeContent(env, {
    content: input.content,
    projectId: input.projectId,
    roomId: input.roomId || "labels",
    userId: input.userId || "system",
  });

  if (!ai.ok) {
    return {
      ok: true,
      labels: pattern.labels,
      scores: pattern.scores,
      severity: pattern.severity,
      source: "pattern_fallback",
      taxonomy: BUILTIN_LABELS,
      aiError: ai.error,
    };
  }

  const scores = { ...pattern.scores };
  const labels = [...pattern.labels];
  for (const category of ai.categories || []) {
    if (!labels.includes(category)) labels.push(category);
    scores[category] = Math.max(scores[category] ?? 0, ai.confidence ?? 0.8);
  }

  return {
    ok: true,
    labels,
    scores,
    severity: ai.severity || pattern.severity,
    reason: ai.reason,
    suggestedAction: ai.suggestedAction,
    source: "hybrid",
    taxonomy: BUILTIN_LABELS,
  };
}
