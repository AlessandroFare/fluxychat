/**
 * Voice Stages (#35) — speaker/listener roles + active speaker selection.
 */

const DEFAULT_MAX_SPEAKERS = 5;
const VAD_STALE_MS = 3000;

function generateId() {
  return `stage_${Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}`;
}

/**
 * @param {*} row
 */
export function mapVoiceStageRow(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    roomId: String(row.room_id),
    enabled: Number(row.enabled) !== 0,
    maxSpeakers: Number(row.max_speakers) || DEFAULT_MAX_SPEAKERS,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

/**
 * @param {Map<string, { role: string, displayName?: string, vadScore?: number, lastVadAt?: number, joinedAt: string }>} stageByUserId
 * @param {string | null} activeSpeakerUserId
 */
export function buildStageSnapshot(stageByUserId, activeSpeakerUserId) {
  const participants = [...stageByUserId.entries()].map(([userId, meta]) => ({
    userId,
    role: meta.role,
    displayName: meta.displayName ?? null,
    vadScore: meta.vadScore ?? 0,
    isActiveSpeaker: userId === activeSpeakerUserId,
    joinedAt: meta.joinedAt,
  }));
  return {
    enabled: participants.length > 0 || stageByUserId.size >= 0,
    activeSpeakerUserId,
    participants,
    speakerCount: participants.filter((p) => p.role === "speaker").length,
    listenerCount: participants.filter((p) => p.role === "listener").length,
  };
}

/**
 * Pick loudest recent speaker among stage participants.
 * @param {Map<string, { role: string, vadScore?: number, lastVadAt?: number }>} stageByUserId
 * @param {number} nowMs
 */
export function pickActiveSpeaker(stageByUserId, nowMs = Date.now()) {
  let bestUserId = null;
  let bestScore = 0;
  for (const [userId, meta] of stageByUserId.entries()) {
    if (meta.role !== "speaker") continue;
    const lastAt = meta.lastVadAt ?? 0;
    if (nowMs - lastAt > VAD_STALE_MS) continue;
    const score = Number(meta.vadScore) || 0;
    if (score > bestScore) {
      bestScore = score;
      bestUserId = userId;
    }
  }
  return bestUserId;
}

export async function getVoiceStageConfig(env, { projectId, roomId }) {
  const row = await env.DB.prepare(
    `SELECT * FROM room_voice_stages WHERE project_id = ? AND room_id = ?`,
  )
    .bind(projectId, roomId)
    .first();
  return mapVoiceStageRow(row);
}

export async function upsertVoiceStageConfig(env, input) {
  const roomId = String(input.roomId ?? "").trim();
  if (!roomId) return { ok: false, reason: "room_id_required" };
  const maxSpeakers = Math.min(20, Math.max(1, Number(input.maxSpeakers) || DEFAULT_MAX_SPEAKERS));
  const now = new Date().toISOString();
  const existing = await getVoiceStageConfig(env, { projectId: input.projectId, roomId });
  if (existing) {
    await env.DB.prepare(
      `UPDATE room_voice_stages SET enabled = ?, max_speakers = ?, updated_at = ? WHERE id = ?`,
    )
      .bind(input.enabled === false ? 0 : 1, maxSpeakers, now, existing.id)
      .run();
  } else {
    const id = generateId();
    await env.DB.prepare(
      `INSERT INTO room_voice_stages (id, project_id, room_id, enabled, max_speakers, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(id, input.projectId, roomId, input.enabled === false ? 0 : 1, maxSpeakers, now, now)
      .run();
  }
  const config = await getVoiceStageConfig(env, { projectId: input.projectId, roomId });
  await announceStageToRoom(env, roomId, {
    enabled: config?.enabled !== false,
    maxSpeakers: config?.maxSpeakers ?? maxSpeakers,
  });
  return { ok: true, config };
}

export async function announceStageToRoom(env, roomId, payload) {
  try {
    const id = env.ROOM.idFromName(roomId);
    const stub = env.ROOM.get(id);
    await stub.fetch("https://internal/stage-sync", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  } catch {
    /* ignore */
  }
}
