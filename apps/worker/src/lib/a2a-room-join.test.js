import { describe, expect, it } from "vitest";
import { joinA2AAgentToRoom } from "./a2a-room-join.js";

function mockEnv({ card, bot, policy }) {
  const statements = [];
  return {
    statements,
    env: {
      DB: {
        prepare(sql) {
          statements.push(sql);
          return {
            bind() {
              return {
                async first() {
                  if (sql.includes("FROM rooms")) return { id: "room_1" };
                  if (sql.includes("FROM a2a_agent_cards")) return card;
                  if (sql.includes("FROM bots")) return bot;
                  if (sql.includes("FROM agent_policies") && sql.includes("SELECT id")) return policy;
                  if (sql.includes("SELECT * FROM agent_policies")) {
                    return {
                      id: "apol_1",
                      project_id: "p1",
                      name: "A2A",
                      trigger_type: "message_keyword",
                      trigger_pattern: "alpha",
                      agent_id: "agent-alpha",
                      room_id: "room_1",
                      max_autonomy: "notify",
                      prompt_template: null,
                      enabled: 1,
                      cooldown_seconds: 60,
                      last_triggered_at: null,
                      created_at: "t",
                      updated_at: "t",
                    };
                  }
                  return null;
                },
                async run() {
                  return { success: true };
                },
              };
            },
          };
        },
      },
    },
  };
}

describe("joinA2AAgentToRoom", () => {
  it("rejects missing card", async () => {
    const { env } = mockEnv({ card: null, bot: null, policy: null });
    const result = await joinA2AAgentToRoom(env, {
      projectId: "p1",
      roomId: "room_1",
      agentId: "agent-alpha",
      actorUserId: "u1",
    });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("card_not_found");
  });
});
