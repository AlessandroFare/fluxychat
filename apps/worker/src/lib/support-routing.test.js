import { describe, it, expect, vi } from "vitest";
import { scoreSupportAgent, pickBestSupportAgent } from "./support-routing.js";

vi.mock("./room-shard.js", () => ({
  getRoomStubForProject: vi.fn(async () => ({
    fetch: async () =>
      new Response(JSON.stringify({ users: ["agent-1"] }), { status: 200 }),
  })),
}));

describe("support-routing", () => {
  it("prefers online agents with matching skills", () => {
    const agents = [
      { userId: "a1", online: true, skills: ["billing"], load: 2 },
      { userId: "a2", online: true, skills: ["technical"], load: 1 },
    ];
    const best = pickBestSupportAgent(agents, { requiredSkills: ["billing"] });
    expect(best?.userId).toBe("a1");
  });

  it("returns null when all offline", () => {
    const agents = [{ userId: "a1", online: false, skills: ["billing"] }];
    expect(pickBestSupportAgent(agents, { requiredSkills: ["billing"] })).toBeNull();
  });

  it("resolveCandidateOnline requires live presence when available", async () => {
    const { loadRoomRoutingCandidates } = await import("./support-routing.js");
    const env = {
      DB: {
        prepare(sql) {
          return {
            bind(...args) {
              return {
                async all() {
                  if (sql.includes("room_members")) {
                    return {
                      results: [
                        { user_id: "agent-1", role: "agent", preferences_json: '{"skills":["billing"]}' },
                        { user_id: "agent-2", role: "agent", preferences_json: null },
                      ],
                    };
                  }
                  if (sql.includes("presence_extensions")) {
                    return { results: [] };
                  }
                  if (sql.includes("agent_capacity")) {
                    return {
                      results: [
                        { user_id: "agent-1", current_load: 1, is_available: 1, capabilities: '["billing"]' },
                        { user_id: "agent-2", current_load: 0, is_available: 1, capabilities: null },
                      ],
                    };
                  }
                  return { results: [] };
                },
              };
            },
          };
        },
      },
    };

    const orig = globalThis.fetch;
    try {
      const candidates = await loadRoomRoutingCandidates(env, { projectId: "p1", roomId: "r1" });
      const online = candidates.filter((c) => c.online);
      expect(online).toHaveLength(1);
      expect(online[0].userId).toBe("agent-1");
    } finally {
      globalThis.fetch = orig;
    }
  });

  it("scores higher for lower load", () => {
    const lowLoad = scoreSupportAgent({ userId: "a", online: true, load: 0 }, {});
    const highLoad = scoreSupportAgent({ userId: "b", online: true, load: 9 }, {});
    expect(lowLoad).toBeGreaterThan(highLoad);
  });
});
