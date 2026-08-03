/**
 * #46 Empathy Layer — ephemeral prosody signals + agent prompt modulation.
 */
import { canAccessRoom } from "./room-access.js";

const SIGNAL_TTL_SECONDS = 300;
const VALID_STATES = new Set(["calm", "frustrated", "stressed", "neutral"]);

function buildEmpathyAgentPromptSuffix(state) {
  switch (state) {
    case "frustrated":
      return (
        "Adapt silently: the user may be frustrated. Be concise, acknowledge difficulty without mentioning emotions, " +
        "and offer a clear next step or human escalation option."
      );
    case "stressed":
      return (
        "Adapt silently: the user may be under pressure. Use a calm tone, shorter sentences, and avoid piling on questions. " +
        "Make human escalation easy to find."
      );
    case "calm":
      return "Adapt silently: conversational pace is calm — match their pace; stay clear and supportive.";
    default:
      return "";
  }
}

function kvKey(projectId, roomId, userId) {
  return `empathy:${projectId}:${roomId}:${userId}`;
}

function getKv(env) {
  return env.RATE_LIMIT_KV ?? env.STREAM_RESUME_KV ?? null;
}

export async function getRoomEmpathySettings(env, projectId, roomId) {
  const row = await env.DB.prepare(
    `SELECT enabled, min_confidence, escalate_on_stressed, updated_at
     FROM room_empathy_settings WHERE project_id = ? AND room_id = ? LIMIT 1`,
  )
    .bind(projectId, roomId)
    .first()
    .catch(() => null);

  if (!row) {
    return {
      enabled: false,
      minConfidence: 0.6,
      escalateOnStressed: true,
      updatedAt: null,
    };
  }

  return {
    enabled: row.enabled === 1,
    minConfidence: Number(row.min_confidence) || 0.6,
    escalateOnStressed: row.escalate_on_stressed === 1,
    updatedAt: row.updated_at,
  };
}

export async function upsertRoomEmpathySettings(env, projectId, roomId, patch) {
  const existing = await getRoomEmpathySettings(env, projectId, roomId);
  const enabled = patch.enabled ?? existing.enabled;
  const minConfidence = patch.minConfidence ?? patch.min_confidence ?? existing.minConfidence;
  const escalateOnStressed =
    patch.escalateOnStressed ?? patch.escalate_on_stressed ?? existing.escalateOnStressed;
  const now = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO room_empathy_settings (project_id, room_id, enabled, min_confidence, escalate_on_stressed, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(project_id, room_id) DO UPDATE SET
       enabled = excluded.enabled,
       min_confidence = excluded.min_confidence,
       escalate_on_stressed = excluded.escalate_on_stressed,
       updated_at = excluded.updated_at`,
  )
    .bind(
      projectId,
      roomId,
      enabled ? 1 : 0,
      minConfidence,
      escalateOnStressed ? 1 : 0,
      now,
    )
    .run();

  return getRoomEmpathySettings(env, projectId, roomId);
}

export async function ingestProsodySignal(env, auth, input) {
  const roomId = String(input.roomId || "").trim();
  if (!roomId) return { ok: false, error: "roomId required" };

  const allowed = await canAccessRoom(env, auth, roomId);
  if (!allowed) return { ok: false, error: "forbidden" };

  const settings = await getRoomEmpathySettings(env, auth.projectId, roomId);
  if (!settings.enabled) return { ok: false, error: "empathy_disabled" };

  const state = String(input.inferredState || input.inferred_state || "").toLowerCase();
  if (!VALID_STATES.has(state)) return { ok: false, error: "invalid_state" };

  const confidence = Number(input.confidence);
  if (!Number.isFinite(confidence) || confidence < settings.minConfidence) {
    return { ok: true, accepted: false, reason: "below_min_confidence" };
  }

  const signal = {
    roomId,
    userId: auth.userId,
    turnId: String(input.turnId || input.turn_id || `turn_${Date.now()}`),
    pitchVariance: Number(input.pitchVariance ?? input.pitch_variance ?? 0),
    speechRate: Number(input.speechRate ?? input.speech_rate ?? 0),
    pauseRatio: Number(input.pauseRatio ?? input.pause_ratio ?? 0),
    inferredState: state,
    confidence,
    capturedAt: new Date().toISOString(),
  };

  const kv = getKv(env);
  if (kv) {
    await kv.put(kvKey(auth.projectId, roomId, auth.userId), JSON.stringify(signal), {
      expirationTtl: SIGNAL_TTL_SECONDS,
    });
  }

  return { ok: true, accepted: true, signal };
}

export async function getLatestProsodySignal(env, { projectId, roomId, userId }) {
  const kv = getKv(env);
  if (!kv) return null;
  const raw = await kv.get(kvKey(projectId, roomId, userId));
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function buildEmpathyPromptSuffix(env, { projectId, roomId, userId }) {
  const settings = await getRoomEmpathySettings(env, projectId, roomId);
  if (!settings.enabled) return "";

  const signal = await getLatestProsodySignal(env, { projectId, roomId, userId });
  if (!signal || signal.confidence < settings.minConfidence) return "";

  const suffix = buildEmpathyAgentPromptSuffix(signal.inferredState);
  if (settings.escalateOnStressed && signal.inferredState === "stressed") {
    return `${suffix}\nIf the user asks for help or the issue persists, proactively mention human escalation.`;
  }
  return suffix;
}
