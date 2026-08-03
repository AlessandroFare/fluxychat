/**
 * Typing-triggered speculative agent warmup (#49).
 * Pre-fetches semantic retrieval while the user types — read-only, no side-effects.
 */

import { incrementOperationalMetric } from "./operational-metrics.js";
import { logInfo } from "./worker-log.js";

export const WARMUP_THROTTLE_MS = 500;
export const WARMUP_MIN_WORDS = 3;
export const WARMUP_CACHE_TTL_MS = 120_000;
export const WARMUP_MAX_PARTIAL_LEN = 2000;

export function isSpeculativeWarmupEnabled(env) {
  return env.SPECULATIVE_WARMUP_ENABLED === "true" || env.SPECULATIVE_WARMUP_ENABLED === "1";
}

export function countWords(text) {
  return String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

export function normalizeWarmupText(text) {
  return String(text || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, WARMUP_MAX_PARTIAL_LEN);
}

/**
 * Returns true when submitted text is close enough to the warmed partial draft.
 */
export function textMatchesWarmup(partialText, submittedText) {
  const partial = normalizeWarmupText(partialText).toLowerCase();
  const submitted = normalizeWarmupText(submittedText).toLowerCase();
  if (!partial || !submitted) return false;
  if (submitted === partial) return true;
  if (submitted.startsWith(partial) || partial.startsWith(submitted)) return true;

  const partialWords = new Set(partial.split(/\s+/).filter(Boolean));
  const submittedWords = submitted.split(/\s+/).filter(Boolean);
  if (!submittedWords.length) return false;
  const overlap = submittedWords.filter((word) => partialWords.has(word)).length;
  return overlap / submittedWords.length >= 0.75;
}

export function buildWarmupCacheEntry(partialText, results, nowMs = Date.now()) {
  const text = normalizeWarmupText(partialText);
  const safeResults = Array.isArray(results) ? results : [];
  return {
    partialText: text,
    results: safeResults,
    predictedContextIds: safeResults.map((row) => row.id).filter((id) => id != null),
    speculationStartedAt: new Date(nowMs).toISOString(),
    expiresAt: nowMs + WARMUP_CACHE_TTL_MS,
    discarded: false,
  };
}

export function consumeWarmupCacheEntry(cacheEntry, submittedText, nowMs = Date.now()) {
  if (!cacheEntry || cacheEntry.discarded || nowMs > cacheEntry.expiresAt) {
    return { hit: false, outcome: "miss", results: [], predictedContextIds: [] };
  }
  const hit = textMatchesWarmup(cacheEntry.partialText, submittedText);
  return {
    hit,
    outcome: hit ? "hit" : "miss",
    partialText: cacheEntry.partialText,
    results: hit ? cacheEntry.results : [],
    predictedContextIds: hit ? cacheEntry.predictedContextIds : [],
    speculationStartedAt: cacheEntry.speculationStartedAt,
  };
}

export function formatWarmupContextForAgent(results) {
  if (!Array.isArray(results) || !results.length) return null;
  const lines = results
    .slice(0, 8)
    .map((row) => {
      const ts = row.createdAt || row.created_at || "";
      const content = String(row.content || "").replace(/\s+/g, " ").trim();
      return `- [${ts}] ${content}`;
    })
    .join("\n");
  return `[Speculative retrieval cache hit]\n${lines}`.slice(0, 4000);
}

export async function runSpeculativeRetrieval(env, { projectId, roomId, partialText }) {
  if (!isSpeculativeWarmupEnabled(env)) {
    return { ok: false, error: "warmup_disabled" };
  }

  const { getSemanticSearchSettings, isSemanticSearchActive } = await import("./semantic-search-settings.js");
  const settings = await getSemanticSearchSettings(env, projectId);
  if (!isSemanticSearchActive(settings) || settings.embeddingCount <= 0) {
    return { ok: false, error: "semantic_unavailable" };
  }

  const { searchSemanticMessages } = await import("./message-embeddings.js");
  const mode = settings.defaultMode === "semantic" ? "semantic" : "hybrid";
  return searchSemanticMessages(env, {
    query: partialText,
    projectId,
    roomId,
    limit: 8,
    mode,
  });
}

export async function recordWarmupTelemetry(env, { projectId, roomId, userId, outcome, contextCount = 0, partialLen = 0 }) {
  const metricByOutcome = {
    hit: "speculative_warmup_hit",
    miss: "speculative_warmup_miss",
    warmed: "speculative_warmup_run",
    discarded: "speculative_warmup_discarded",
  };
  const metricName = metricByOutcome[outcome];
  if (metricName && projectId) {
    await incrementOperationalMetric(env, { metricName, projectId, value: 1 }).catch(() => {});
  }

  if (!env.DB || !projectId || !roomId || !outcome) return;

  const id = `sw_${Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}`;
  await env.DB.prepare(
    `INSERT INTO speculative_warmup_events
     (id, project_id, room_id, user_id, outcome, context_count, partial_len, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      projectId,
      roomId,
      userId ?? null,
      outcome,
      Number(contextCount) || 0,
      Number(partialLen) || 0,
      new Date().toISOString(),
    )
    .run()
    .catch(() => {});

  logInfo("speculative_warmup.telemetry", {
    projectId,
    roomId,
    userId,
    outcome,
    contextCount,
  });
}

export async function fetchConsumedWarmupFromRoomDo(env, { roomId, userId, submittedText }) {
  if (!isSpeculativeWarmupEnabled(env) || !roomId || !userId || !submittedText?.trim()) {
    return null;
  }
  try {
    const stub = env.ROOM.get(env.ROOM.idFromName(roomId));
    const res = await stub.fetch("https://internal/speculative-warmup/consume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, submittedText }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
