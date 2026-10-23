import { describe, it, expect } from "vitest";
import {
  buildAgentCardPublic,
  createA2ATask,
  delegateA2ATaskToRemote,
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

  it("never attaches the platform bearer to a project endpoint (audit F-25)", async () => {
    const seen = [];
    const env = {
      A2A_OUTBOUND_BEARER: "platform-secret",
      // Audit F-02: user-supplied endpoints require the operator allowlist.
      ALLOWED_SSRF_HOSTS: "peer.example.com",
      DB: {
        prepare(sql) {
          return {
            bind() {
              return {
                async first() {
                  if (sql.includes("FROM a2a_tasks")) {
                    return {
                      id: "t1",
                      project_id: "p1",
                      target_agent_id: "ag1",
                      input_json: JSON.stringify({ q: 1 }),
                      artifacts_json: "[]",
                      status: "pending",
                    };
                  }
                  if (sql.includes("FROM a2a_agent_cards")) {
                    return {
                      id: "c1",
                      project_id: "p1",
                      agent_id: "ag1",
                      endpoint_url: "https://peer.example.com/a2a",
                    };
                  }
                  return null;
                },
                async run() {
                  return { meta: { changes: 1 } };
                },
              };
            },
          };
        },
      },
    };
    globalThis.fetch = async (url, init) => {
      seen.push({ url: String(url), headers: init?.headers || {} });
      return new Response(JSON.stringify({ result: { ok: true } }), { status: 200 });
    };
    try {
      const result = await delegateA2ATaskToRemote(env, {
        projectId: "p1",
        taskId: "t1",
        targetAgentId: "ag1",
      });
      expect(result.ok).toBe(true);
      expect(seen).toHaveLength(1);
      expect(seen[0].headers.Authorization).toBeUndefined();
    } finally {
      delete globalThis.fetch;
    }
  });
});
