/** Room DO sharding for large channels (P10-SB8). Logical roomId stays unchanged in D1/WS paths. */

export const MAX_ROOM_SHARDS = 16;

export function normalizeShardCount(raw) {
  const n = Math.floor(Number(raw) || 1);
  return Math.max(1, Math.min(MAX_ROOM_SHARDS, n));
}

/**
 * @param {string} userId
 * @param {number} shardCount
 */
export function shardIndexForUser(userId, shardCount) {
  const count = normalizeShardCount(shardCount);
  if (count <= 1) return 0;
  let hash = 0;
  const s = String(userId || "anonymous");
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  }
  return hash % count;
}

/**
 * @param {string} roomId
 * @param {number} shardIndex
 * @param {number} shardCount
 */
export function roomDoName(roomId, shardIndex, shardCount) {
  const count = normalizeShardCount(shardCount);
  if (count <= 1) return roomId;
  return `${roomId}#s${shardIndex}`;
}

/**
 * @param {*} env
 * @param {string} projectId
 * @param {string} roomId
 */
export async function getRoomShardCount(env, projectId, roomId) {
  if (!env?.DB) return 1;
  const row = await env.DB.prepare(
    "SELECT shard_count FROM rooms WHERE project_id = ? AND id = ?",
  )
    .bind(projectId, roomId)
    .first();
  return normalizeShardCount(row?.shard_count ?? 1);
}

/**
 * @param {*} env
 * @param {string} roomId
 * @param {number} shardCount
 * @param {string} [userId]
 */
export function getRoomStub(env, roomId, shardCount, userId) {
  const count = normalizeShardCount(shardCount);
  const idx =
    userId != null && userId !== ""
      ? shardIndexForUser(userId, count)
      : 0;
  const name = roomDoName(roomId, idx, count);
  return env.ROOM.get(env.ROOM.idFromName(name));
}

export const SHARD_FETCH_TIMEOUT_MS = 100;

/**
 * @param {*} env
 * @param {string} roomId
 * @param {number} shardCount
 * @param {(stub: DurableObjectStub, shardIndex: number) => Promise<unknown>} fn
 * @param {number} [timeoutMs]
 */
export async function forEachRoomShard(env, roomId, shardCount, fn, timeoutMs = SHARD_FETCH_TIMEOUT_MS) {
  const count = normalizeShardCount(shardCount);
  if (count <= 1) {
    const stub = env.ROOM.get(env.ROOM.idFromName(roomId));
    return [await fn(stub, 0)];
  }
  const stubs = [];
  for (let i = 0; i < count; i++) {
    stubs.push(env.ROOM.get(env.ROOM.idFromName(roomDoName(roomId, i, count))));
  }
  const settled = await Promise.allSettled(
    stubs.map((stub, i) => {
      if (timeoutMs > 0) {
        return Promise.race([
          fn(stub, i),
          new Promise((_, reject) => setTimeout(() => reject(new Error("shard timeout")), timeoutMs)),
        ]);
      }
      return fn(stub, i);
    }),
  );
  const failed = settled.filter((r) => r.status === "rejected").length;
  if (failed > 0) console.warn(`forEachRoomShard: ${failed}/${count} shards timed out for room ${roomId}`);
  return settled.map((r) => (r.status === "fulfilled" ? r.value : undefined));
}

/**
 * @param {*} env
 * @param {string} projectId
 * @param {string} roomId
 */
export async function fetchAggregatedRoomLive(env, projectId, roomId) {
  const shardCount = await getRoomShardCount(env, projectId, roomId);
  const base = {
    roomId,
    shardCount,
    occupied: false,
    subscriptionCount: 0,
    userCount: 0,
    online: 0,
    users: /** @type {string[]} */ ([]),
    members: /** @type {Array<{ userId: string; userInfo?: Record<string, unknown> }>} */ ([]),
    socketIds: /** @type {string[]} */ ([]),
  };

  const mergeBody = (body) => {
    if (!body || typeof body !== "object") return;
    base.occupied = base.occupied || Boolean(body.occupied ?? body.online > 0);
    base.online += Number(body.online ?? 0);
    base.subscriptionCount += Number(body.subscriptionCount ?? body.online ?? 0);
    const users = Array.isArray(body.users) ? body.users : [];
    for (const uid of users) {
      if (uid && !base.users.includes(uid)) base.users.push(uid);
    }
    const members = Array.isArray(body.members) ? body.members : [];
    const seenMembers = new Set(base.members.map((m) => m.userId));
    for (const member of members) {
      if (!member || typeof member.userId !== "string") continue;
      if (seenMembers.has(member.userId)) continue;
      seenMembers.add(member.userId);
      base.members.push({
        userId: member.userId,
        ...(member.userInfo && typeof member.userInfo === "object"
          ? { userInfo: member.userInfo }
          : {}),
      });
    }
    const sockets = Array.isArray(body.socketIds) ? body.socketIds : [];
    for (const sid of sockets) {
      if (sid && !base.socketIds.includes(sid)) base.socketIds.push(sid);
    }
  };

  if (shardCount <= 1) {
    try {
      const stub = env.ROOM.get(env.ROOM.idFromName(roomId));
      const liveRes = await stub.fetch("https://internal/live-stats");
      if (liveRes.ok) mergeBody(await liveRes.json());
    } catch {
      /* cold DO */
    }
  } else {
    await forEachRoomShard(env, roomId, shardCount, async (stub) => {
      try {
        const liveRes = await stub.fetch("https://internal/live-stats");
        if (liveRes.ok) mergeBody(await liveRes.json());
      } catch {
        /* ignore */
      }
    });
  }

  base.userCount = base.users.length;
  return base;
}

/**
 * POST/GET to all shard DOs (e.g. /announce) — parallel fan-out.
 * @param {*} env
 * @param {string} projectId
 * @param {string} roomId
 * @param {string} path pathname e.g. "/announce"
 * @param {RequestInit} init
 */
export async function fanoutRoomInternal(env, projectId, roomId, path, init) {
  const shardCount = await getRoomShardCount(env, projectId, roomId);
  const url = `https://internal${path.startsWith("/") ? path : `/${path}`}`;
  await forEachRoomShard(env, roomId, shardCount, (stub) => stub.fetch(url, init));
}

/**
 * @param {*} env
 * @param {string} projectId
 * @param {string} roomId
 * @param {string} [userId]
 */
export async function getRoomStubForProject(env, projectId, roomId, userId) {
  const shardCount = await getRoomShardCount(env, projectId, roomId);
  return getRoomStub(env, roomId, shardCount, userId);
}

/**
 * Get SupergroupRouter stub for a project.
 * @param {*} env
 * @param {string} projectId
 */
export function getSupergroupRouter(env, projectId) {
  if (!env.SUPERGROUP_ROUTER) return null;
  const id = env.SUPERGROUP_ROUTER.idFromName(projectId);
  return env.SUPERGROUP_ROUTER.get(id);
}

/**
 * Rebalance shards for a room if approaching capacity.
 * Called after a WebSocket connects to check if rebalancing is needed.
 * @param {*} env
 * @param {string} projectId
 * @param {string} roomId
 */
export async function autoRebalanceRoom(env, projectId, roomId) {
  const router = getSupergroupRouter(env, projectId);
  if (!router) return null;
  try {
    const res = await router.fetch("https://internal/rebalance", {
      method: "POST",
      body: JSON.stringify({ projectId, roomId }),
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(200),
    });
    return res.ok ? res.json() : null;
  } catch {
    return null;
  }
}


