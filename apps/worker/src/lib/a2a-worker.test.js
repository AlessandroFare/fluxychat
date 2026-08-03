import { describe, it, expect } from "vitest";
import {
  buildAgentCardPublic,
  createA2ATask,
  sendA2AEnvelope,
  validateExternalHttpsUrl,
} from "./a2a-worker.js";

function createEnv() {
  const cards = new Map();
  const tasks = new Map();
  const envelopes = [];
  return {
    DB: {
      prepare(sql) {
        return {
          bind(...args) {
            return {
              async first() {
                if (sql.includes("FROM a2a_agent_cards") && sql.includes("agent_id")) {
                  return [...cards.values()].find((c) => c.project_id === args[0] && c.agent_id === args[1]) ?? null;
                }
                if (sql.includes("FROM a2a_tasks WHERE id")) {
                  return tasks.get(args[0]) ?? null;
                }
                return null;
              },
              async all() {
                return { results: [] };
              },
              async run() {
                if (sql.includes("INSERT INTO a2a_tasks")) {
                  tasks.set(args[0], {
                    id: args[0],
                    project_id: args[1],
                    title: args[2],
                    input_json: args[3],
                    status: "pending",
                    source_agent_id: args[5],
                    target_agent_id: args[6],
                    artifacts_json: "[]",
                    output_json: null,
                    created_at: args[7],
                    updated_at: args[8],
                  });
                }
                if (sql.includes("INSERT INTO a2a_envelopes")) {
                  envelopes.push({ id: args[0], target: args[3] });
                }
                return { meta: { changes: 1 } };
              },
            };
          },
        };
      },
    },
  };
}

describe("a2a-worker", () => {
  it("buildAgentCardPublic maps capabilities", () => {
    const card = buildAgentCardPublic({
      name: "Bot",
      description: "Help",
      endpointUrl: "https://example.com/a2a",
      capabilities: ["translate"],
    });
    expect(card.name).toBe("Bot");
    expect(card.skills).toHaveLength(1);
  });

  it("creates task in D1", async () => {
    const env = createEnv();
    const result = await createA2ATask(env, {
      projectId: "p1",
      title: "Test",
      taskInput: { q: 1 },
    });
    expect(result.ok).toBe(true);
    expect(result.task.status).toBe("pending");
  });

  it("sends envelope", async () => {
    const env = createEnv();
    const result = await sendA2AEnvelope(env, {
      projectId: "p1",
      sourceAgentId: "a",
      targetAgentId: "b",
      taskId: "t1",
    });
    expect(result.ok).toBe(true);
    expect(result.envelope.target).toBe("b");
  });

  it("validateExternalHttpsUrl blocks localhost and requires https", () => {
    expect(validateExternalHttpsUrl("http://example.com").ok).toBe(false);
    expect(validateExternalHttpsUrl("https://127.0.0.1/x").ok).toBe(false);
    expect(validateExternalHttpsUrl("https://agent.example.com/card").ok).toBe(true);
  });
});
