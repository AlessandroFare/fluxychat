import { describe, expect, it, vi } from "vitest";
import {
  fetchAggregatedRoomLive,
  normalizeShardCount,
  shardIndexForUser,
  roomDoName,
} from "./room-shard.js";

describe("room-shard", () => {
  it("normalizes shard count bounds", () => {
    expect(normalizeShardCount(0)).toBe(1);
    expect(normalizeShardCount(99)).toBe(16);
    expect(normalizeShardCount(4)).toBe(4);
  });

  it("uses stable shard index per user", () => {
    const a = shardIndexForUser("user-a", 4);
    const b = shardIndexForUser("user-a", 4);
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(4);
  });

  it("names DO with shard suffix when count > 1", () => {
    expect(roomDoName("lobby", 0, 1)).toBe("lobby");
    expect(roomDoName("lobby", 2, 4)).toBe("lobby#s2");
  });

  it("aggregates members across shards, dedup by userId, keep first userInfo", async () => {
    const responses = [
      {
        occupied: true,
        online: 2,
        subscriptionCount: 2,
        users: ["alice", "bob"],
        members: [
          { userId: "alice", userInfo: { name: "Alice", role: "owner" } },
          { userId: "bob", userInfo: { name: "Bob" } },
        ],
        socketIds: ["s1", "s2"],
      },
      {
        occupied: true,
        online: 1,
        subscriptionCount: 1,
        users: ["agent-1"],
        members: [
          { userId: "agent-1", userInfo: { name: "Helper", agentId: "agent-1" } },
        ],
        socketIds: ["s3"],
      },
    ];
    let call = 0;
    const env = {
      DB: {
        prepare: () => ({
          bind: () => ({
            first: async () => ({ shard_count: 2 }),
          }),
        }),
      },
      ROOM: {
        idFromName: (name) => name,
        get: () => ({
          fetch: async () => {
            const body = responses[call++] ?? {};
            return new Response(JSON.stringify(body), { status: 200 });
          },
        }),
      },
    };

    const live = await fetchAggregatedRoomLive(env, "proj-1", "lobby");
    expect(live.shardCount).toBe(2);
    expect(live.occupied).toBe(true);
    expect(live.online).toBe(3);
    expect(live.subscriptionCount).toBe(3);
    expect(live.users).toEqual(["alice", "bob", "agent-1"]);
    expect(live.members).toHaveLength(3);
    const alice = live.members.find((m) => m.userId === "alice");
    expect(alice?.userInfo).toEqual({ name: "Alice", role: "owner" });
    const agent = live.members.find((m) => m.userId === "agent-1");
    expect(agent?.userInfo?.agentId).toBe("agent-1");
  });

  it("returns an empty snapshot when the DO is cold", async () => {
    const env = {
      DB: {
        prepare: () => ({
          bind: () => ({
            first: async () => ({ shard_count: 1 }),
          }),
        }),
      },
      ROOM: {
        idFromName: (name) => name,
        get: () => ({
          fetch: async () => new Response("internal", { status: 500 }),
        }),
      },
    };
    const live = await fetchAggregatedRoomLive(env, "proj-1", "lobby");
    expect(live.occupied).toBe(false);
    expect(live.users).toEqual([]);
    expect(live.members).toEqual([]);
    expect(live.subscriptionCount).toBe(0);
  });
});
