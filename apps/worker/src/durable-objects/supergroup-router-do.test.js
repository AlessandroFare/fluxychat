import { describe, expect, it } from "vitest";
import { SupergroupRouterDurableObject } from "./supergroup-router-do.js";

function makeRouter(liveStats) {
  const env = {
    DB: {
      prepare: () => ({ bind: () => ({ first: async () => ({ shard_count: 1 }) }) }),
    },
    ROOM: {
      idFromName: (name) => name,
      get: () => ({
        fetch: async () =>
          new Response(JSON.stringify(liveStats), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
      }),
    },
  };
  return new SupergroupRouterDurableObject({ storage: {} }, env);
}

describe("SupergroupRouterDurableObject", () => {
  it("A2-30: single-shard stats report userCount", async () => {
    const router = makeRouter({ ok: true, online: 2, users: ["u1", "u2"] });
    const stats = await router.aggregateRoomStats("p", "r");
    expect(stats.users).toHaveLength(2);
    expect(stats.userCount).toBe(2);
  });
});
