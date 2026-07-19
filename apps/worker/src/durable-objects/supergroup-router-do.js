/**
 * SupergroupRouter DO — coordinates sharded rooms for 1K+ concurrent connections.
 *
 * Responsibilities:
 *   - Tracks shard status (connection counts, health) per room
 *   - Provides endpoint to trigger dynamic shard count increase
 *   - Aggregates live stats across shards (parallel fetch)
 *   - Re-shards rooms when a shard approaches capacity
 *
 * Architecture:
 *   Router DO per project (idFromName = projectId).
 *   Each router manages all supergroup rooms within that project.
 *   Rooms opt into supergroup mode via D1 `rooms.shard_count > 1` or manual trigger.
 */

import { normalizeShardCount, MAX_ROOM_SHARDS, shardIndexForUser, roomDoName } from "../lib/room-shard.js";

const SHARD_FETCH_TIMEOUT = 100;
const SHARD_CAPACITY_WARN = 800;
const SHARD_CAPACITY_MAX = 1000;

export class SupergroupRouterDurableObject {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.rooms = new Map();
  }

  async fetch(request) {
    const url = new URL(request.url);
    const method = request.method;

    if (method === "GET" && url.pathname === "/health") {
      return new Response(JSON.stringify({ ok: true, rooms: this.rooms.size }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (method === "POST" && url.pathname === "/rebalance") {
      const body = await request.json().catch(() => ({}));
      const { projectId, roomId } = body;
      if (!projectId || !roomId) {
        return new Response(JSON.stringify({ error: "projectId and roomId required" }), { status: 400 });
      }
      const result = await this.rebalanceRoom(projectId, roomId);
      return new Response(JSON.stringify(result), {
        headers: { "Content-Type": "application/json" },
        status: result.error ? 400 : 200,
      });
    }

    if (method === "GET" && url.pathname === "/live-stats") {
      const roomId = url.searchParams.get("roomId");
      const projectId = url.searchParams.get("projectId");
      if (!projectId || !roomId) {
        return new Response(JSON.stringify({ error: "projectId and roomId required" }), { status: 400 });
      }
      const stats = await this.aggregateRoomStats(projectId, roomId);
      return new Response(JSON.stringify(stats), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (method === "POST" && url.pathname === "/report-capacity") {
      const body = await request.json().catch(() => ({}));
      const { roomId, shardIndex, connectionCount } = body;
      if (!roomId || shardIndex === undefined) {
        return new Response(JSON.stringify({ error: "roomId and shardIndex required" }), { status: 400 });
      }
      const key = `${roomId}#s${shardIndex}`;
      this.rooms.set(key, { connectionCount, reportedAt: Date.now() });
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "not found" }), { status: 404 });
  }

  /**
   * Check current shard capacity and auto-scale if needed.
   */
  async rebalanceRoom(projectId, roomId) {
    const count = await this.getShardCount(projectId, roomId);

    if (count >= MAX_ROOM_SHARDS) {
      return { error: `already at max shards (${MAX_ROOM_SHARDS})` };
    }

    const shardStats = await this.checkShardCapacity(projectId, roomId, count);
    const maxUtil = Math.max(...shardStats.map((s) => s.connectionCount));
    const avgUtil = shardStats.reduce((a, s) => a + s.connectionCount, 0) / shardStats.length;

    if (maxUtil >= SHARD_CAPACITY_WARN && count < MAX_ROOM_SHARDS) {
      const newCount = Math.min(count * 2, MAX_ROOM_SHARDS);
      await this.setShardCount(projectId, roomId, newCount);
      return {
        rebalanced: true,
        from: count,
        to: newCount,
        reason: `shard at ${maxUtil}/${SHARD_CAPACITY_WARN} connections`,
        shardStats,
      };
    }

    return {
      rebalanced: false,
      currentCount: count,
      maxUtilization: maxUtil,
      avgUtilization: Math.round(avgUtil),
      shardStats,
    };
  }

  /**
   * Fetch live stats from all shards in parallel and aggregate.
   */
  async aggregateRoomStats(projectId, roomId) {
    const count = await this.getShardCount(projectId, roomId);
    const base = {
      roomId,
      shardCount: count,
      occupied: false,
      subscriptionCount: 0,
      userCount: 0,
      online: 0,
      users: [],
      members: [],
      socketIds: [],
    };

    if (count <= 1) {
      try {
        const stub = this.env.ROOM.get(this.env.ROOM.idFromName(roomId));
        const res = await stub.fetch("https://internal/live-stats", {
          signal: AbortSignal.timeout(SHARD_FETCH_TIMEOUT),
        });
        if (res.ok) this.mergeLiveStats(base, await res.json());
      } catch { /* cold DO */ }
      return base;
    }

    const stubs = [];
    for (let i = 0; i < count; i++) {
      stubs.push(this.env.ROOM.get(this.env.ROOM.idFromName(roomDoName(roomId, i, count))));
    }

    const results = await Promise.allSettled(
      stubs.map((stub) =>
        Promise.race([
          stub.fetch("https://internal/live-stats", {
            signal: AbortSignal.timeout(SHARD_FETCH_TIMEOUT),
          }).then((r) => (r.ok ? r.json() : null)),
          new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), SHARD_FETCH_TIMEOUT)),
        ]),
      ),
    );

    for (const r of results) {
      if (r.status === "fulfilled" && r.value) {
        this.mergeLiveStats(base, r.value);
      }
    }

    base.userCount = base.users.length;
    return base;
  }

  mergeLiveStats(base, body) {
    if (!body || typeof body !== "object") return;
    base.occupied = base.occupied || Boolean(body.occupied ?? body.online > 0);
    base.online += Number(body.online ?? 0);
    base.subscriptionCount += Number(body.subscriptionCount ?? body.online ?? 0);
    const users = Array.isArray(body.users) ? body.users : [];
    for (const uid of users) {
      if (uid && !base.users.includes(uid)) base.users.push(uid);
    }
    const members = Array.isArray(body.members) ? body.members : [];
    const seen = new Set(base.members.map((m) => m.userId));
    for (const m of members) {
      if (m && typeof m.userId === "string" && !seen.has(m.userId)) {
        seen.add(m.userId);
        base.members.push({ userId: m.userId, ...(m.userInfo ? { userInfo: m.userInfo } : {}) });
      }
    }
    const sockets = Array.isArray(body.socketIds) ? body.socketIds : [];
    for (const sid of sockets) {
      if (sid && !base.socketIds.includes(sid)) base.socketIds.push(sid);
    }
  }

  /**
   * Check connection count on each shard via live-stats.
   */
  async checkShardCapacity(projectId, roomId, count) {
    const results = [];
    for (let i = 0; i < count; i++) {
      try {
        const stub = this.env.ROOM.get(this.env.ROOM.idFromName(roomDoName(roomId, i, count)));
        const res = await stub.fetch("https://internal/live-stats", {
          signal: AbortSignal.timeout(SHARD_FETCH_TIMEOUT),
        });
        if (res.ok) {
          const data = await res.json();
          results.push({ shardIndex: i, connectionCount: data.online || 0 });
        } else {
          results.push({ shardIndex: i, connectionCount: 0, error: "fetch failed" });
        }
      } catch {
        results.push({ shardIndex: i, connectionCount: 0, error: "timeout" });
      }
    }
    return results;
  }

  async getShardCount(projectId, roomId) {
    if (!this.env?.DB) return 1;
    try {
      const row = await this.env.DB.prepare(
        "SELECT shard_count FROM rooms WHERE project_id = ? AND id = ?",
      ).bind(projectId, roomId).first();
      return normalizeShardCount(row?.shard_count ?? 1);
    } catch {
      return 1;
    }
  }

  async setShardCount(projectId, roomId, newCount) {
    if (!this.env?.DB) return;
    const clamped = normalizeShardCount(newCount);
    await this.env.DB.prepare(
      "UPDATE rooms SET shard_count = ? WHERE project_id = ? AND id = ?",
    ).bind(clamped, projectId, roomId).run();
  }
}
