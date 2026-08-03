import { describe, expect, it, vi } from "vitest";
import { interactGameNpc } from "./game-npc.js";

vi.mock("./rate-limit.js", () => ({
  checkAndConsumeRateLimit: vi.fn(async () => ({ allowed: true, retryAfterSeconds: 0 })),
}));

function mockEnv(npcs = new Map()) {
  return {
    DB: {
      prepare(sql) {
        return {
          bind(...params) {
            return {
              async first() {
                if (sql.includes("FROM game_npcs")) {
                  return [...npcs.values()].find((n) => n.project_id === params[0] && n.id === params[1]) ?? null;
                }
                return null;
              },
              async run() {
                if (sql.includes("UPDATE game_npcs SET memory_json")) {
                  const npc = npcs.get(params[3]);
                  if (npc) {
                    npc.memory_json = params[0];
                    npc.updated_at = params[1];
                  }
                }
                return { meta: { changes: 1 } };
              },
            };
          },
        };
      },
    },
    GAME_NPC_RATE_LIMIT_RPM: "20",
  };
}

describe("game-npc", () => {
  it("returns reply and updates memory", async () => {
    const npcs = new Map([
      [
        "npc_merlin",
        {
          id: "npc_merlin",
          project_id: "p1",
          name: "Merlin",
          personality: "friendly",
          difficulty: 0.6,
          memory_json: "{}",
          state: "idle",
        },
      ],
    ]);
    const env = mockEnv(npcs);
    const auth = { projectId: "p1", userId: "alice" };
    const result = await interactGameNpc(env, auth, "npc_merlin", { message: "Hello wizard!" });
    expect(result.ok).toBe(true);
    expect(result.reply).toMatch(/Hello|Greetings|Nice/);
    expect(result.memoryUpdated).toBe(true);
  });

  it("rejects empty message", async () => {
    const env = mockEnv();
    const result = await interactGameNpc(env, { projectId: "p1", userId: "a" }, "npc_x", { message: "  " });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("message_required");
  });

  it("returns rate_limit_exceeded when limited", async () => {
    const { checkAndConsumeRateLimit } = await import("./rate-limit.js");
    checkAndConsumeRateLimit.mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 30 });

    const npcs = new Map([
      [
        "npc_x",
        {
          id: "npc_x",
          project_id: "p1",
          name: "Bot",
          personality: "merchant",
          difficulty: 0.5,
          memory_json: "{}",
          state: "idle",
        },
      ],
    ]);
    const result = await interactGameNpc(mockEnv(npcs), { projectId: "p1", userId: "a" }, "npc_x", {
      message: "Buy potion",
    });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("rate_limit_exceeded");
    expect(result.retryAfterSeconds).toBe(30);
  });
});
