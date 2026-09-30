/**
 * Mid-turn inject + serial lock helpers for room LLM runs.
 * The Agent DO `room-run:{project}:{room}` id already serializes invokes.
 * These KV lists let another socket add text or request stop while a run is live.
 */

function steerKey(projectId, roomId) {
  return `room-agent-steer:${projectId}:${roomId}`;
}

function stopKey(projectId, roomId) {
  return `room-agent-stop:${projectId}:${roomId}`;
}

export async function injectRoomAgentSteer(env, { projectId, roomId, userId, content }) {
  const kv = env.RATE_LIMIT_KV ?? env.STREAM_RESUME_KV;
  if (!kv) return { ok: false, reason: "kv_unavailable" };
  const text = String(content || "").trim().slice(0, 4000);
  if (!text) return { ok: false, reason: "content_required" };
  const key = steerKey(projectId, roomId);
  const prev = await kv.get(key);
  let list = [];
  try {
    list = prev ? JSON.parse(prev) : [];
  } catch {
    list = [];
  }
  if (!Array.isArray(list)) list = [];
  list.push({ userId: String(userId || ""), content: text, at: new Date().toISOString() });
  await kv.put(key, JSON.stringify(list.slice(-20)), { expirationTtl: 300 });
  return { ok: true, pending: list.length };
}

export async function drainRoomAgentSteer(env, projectId, roomId) {
  const kv = env.RATE_LIMIT_KV ?? env.STREAM_RESUME_KV;
  if (!kv) return [];
  const key = steerKey(projectId, roomId);
  const raw = await kv.get(key);
  if (!raw) return [];
  await kv.delete(key);
  try {
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list
      .map((row) => (typeof row?.content === "string" ? row.content.trim() : ""))
      .filter(Boolean);
  } catch {
    return [];
  }
}

export async function requestRoomAgentStop(env, { projectId, roomId, userId }) {
  const kv = env.RATE_LIMIT_KV ?? env.STREAM_RESUME_KV;
  if (!kv) return { ok: false, reason: "kv_unavailable" };
  await kv.put(
    stopKey(projectId, roomId),
    JSON.stringify({ userId: String(userId || ""), at: new Date().toISOString() }),
    { expirationTtl: 120 },
  );
  return { ok: true };
}

export async function consumeRoomAgentStop(env, projectId, roomId) {
  const kv = env.RATE_LIMIT_KV ?? env.STREAM_RESUME_KV;
  if (!kv) return false;
  const key = stopKey(projectId, roomId);
  const hit = await kv.get(key);
  if (!hit) return false;
  await kv.delete(key);
  return true;
}

export async function roomHasLiveHumans(env, roomId) {
  if (!env?.ROOM?.idFromName) return true;
  try {
    const res = await env.ROOM.get(env.ROOM.idFromName(roomId)).fetch("https://internal/presence", {
      method: "POST",
      body: JSON.stringify({ method: "presence", params: {} }),
    });
    const body = await res.json().catch(() => ({}));
    const count = Number(body.count ?? body.userCount ?? 0);
    if (Number.isFinite(count) && count > 0) return true;
    if (Array.isArray(body.members) && body.members.length > 0) return true;
    return false;
  } catch {
    return true;
  }
}
