/**
 * FluxyGame AI NPC interact with per-player rate limits (roadmap game vertical).
 */

import { checkAndConsumeRateLimit } from "./rate-limit.js";

const DEFAULT_NPC_RPM = 20;
const MAX_MESSAGE_LENGTH = 512;

function parseJson(raw, fallback) {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function npcResponse(npc, playerId, message) {
  const memory = npc.memory?.[playerId] ?? "none";
  const pools = {
    friendly: [
      `Hello again! I remember you — last time you said "${String(memory).slice(0, 40)}".`,
      "Nice to see you! How can I help?",
      "Greetings, traveler! Ready for an adventure?",
    ],
    hostile: [
      `You dare approach me?! I won't forget "${String(memory).slice(0, 30)}"!`,
      "Prepare to battle!",
      "You're trespassing on my territory!",
    ],
    merchant: [
      "Welcome to my shop! I have rare items for sale.",
      `Ah, a returning customer! Last time you asked about "${String(memory).slice(0, 30)}".`,
      "Special discount for you today!",
    ],
  };
  const pool = pools[npc.personality] || pools.friendly;
  return pool[Math.floor(Math.random() * pool.length)];
}

export async function upsertGameNpc(env, auth, input) {
  const id = String(input.id ?? input.npcId ?? "").trim() || `npc_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
  const name = String(input.name ?? "").trim().slice(0, 64);
  const personality = String(input.personality ?? "friendly").slice(0, 32);
  if (!name) return { ok: false, error: "name_required" };

  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO game_npcs (id, project_id, name, personality, difficulty, memory_json, state, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, '{}', 'idle', ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       personality = excluded.personality,
       difficulty = excluded.difficulty,
       updated_at = excluded.updated_at`,
  )
    .bind(id, auth.projectId, name, personality, Number(input.difficulty) || 0.5, now, now)
    .run();

  return { ok: true, npc: await getGameNpc(env, auth, id) };
}

export async function listGameNpcs(env, auth) {
  const rows = await env.DB.prepare(
    `SELECT * FROM game_npcs WHERE project_id = ? ORDER BY updated_at DESC LIMIT 100`,
  )
    .bind(auth.projectId)
    .all();
  return (rows.results || []).map((row) => ({
    id: row.id,
    name: row.name,
    personality: row.personality,
    difficulty: Number(row.difficulty),
    state: row.state,
  }));
}

export async function getGameNpc(env, auth, npcId) {
  const row = await env.DB.prepare(
    `SELECT * FROM game_npcs WHERE project_id = ? AND id = ?`,
  )
    .bind(auth.projectId, npcId)
    .first();
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    personality: row.personality,
    difficulty: Number(row.difficulty),
    memory: parseJson(row.memory_json, {}),
    state: row.state,
  };
}

export async function interactGameNpc(env, auth, npcId, input) {
  const playerId = String(input.playerId ?? auth.userId).trim();
  const message = String(input.message ?? "").trim().slice(0, MAX_MESSAGE_LENGTH);
  if (!playerId || !message) return { ok: false, error: "message_required" };

  const npc = await getGameNpc(env, auth, npcId);
  if (!npc) return { ok: false, error: "npc_not_found" };

  const rpm = Number(env.GAME_NPC_RATE_LIMIT_RPM) || DEFAULT_NPC_RPM;
  const rate = await checkAndConsumeRateLimit(env, {
    key: `game-npc:${auth.projectId}:${npcId}:${playerId}`,
    limit: rpm,
    windowSeconds: 60,
  });
  if (!rate.allowed) {
    return {
      ok: false,
      error: "rate_limit_exceeded",
      retryAfterSeconds: rate.retryAfterSeconds ?? 60,
    };
  }

  const memory = { ...npc.memory, [playerId]: message };
  const now = new Date().toISOString();
  await env.DB.prepare(
    `UPDATE game_npcs SET memory_json = ?, updated_at = ? WHERE project_id = ? AND id = ?`,
  )
    .bind(JSON.stringify(memory), now, auth.projectId, npcId)
    .run();

  return {
    ok: true,
    npcId,
    playerId,
    reply: npcResponse({ ...npc, memory }, playerId, message),
    memoryUpdated: true,
  };
}
