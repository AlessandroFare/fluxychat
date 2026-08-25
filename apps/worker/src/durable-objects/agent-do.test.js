import { describe, expect, it } from "vitest";
import { AgentDurableObject } from "./agent-do.js";

function memoryStorage() {
  const bag = new Map();
  return {
    get: async (k) => bag.get(k),
    put: async (k, v) => bag.set(k, v),
    setAlarm: async () => {},
    deleteAlarm: async () => {},
    getAlarm: async () => null,
    bag,
  };
}

describe("AgentDurableObject", () => {
  it("answers ping and empty state over internal RPC", async () => {
    const storage = memoryStorage();
    const agentDo = new AgentDurableObject({ id: { toString: () => "p__a__u" }, storage }, { DB: {} });
    agentDo.projectId = "p";
    agentDo.agentId = "a";
    agentDo.userId = "u";
    const ping = await agentDo.fetch(
      new Request("https://internal/rpc", {
        method: "POST",
        body: JSON.stringify({ method: "ping" }),
      }),
    );
    expect((await ping.json()).ok).toBe(true);

    const state = await agentDo.fetch(new Request("https://internal/state"));
    const body = await state.json();
    expect(body.ok).toBe(true);
    expect(body.turns).toEqual([]);
  });

  it("stores a delay schedule on the agent isolate", async () => {
    const storage = memoryStorage();
    const agentDo = new AgentDurableObject({ id: { toString: () => "p__bot__u" }, storage }, { DB: {} });
    const res = await agentDo.fetch(
      new Request("https://internal/rpc", {
        method: "POST",
        body: JSON.stringify({
          method: "schedule",
          params: {
            kind: "delay",
            delayMs: 5000,
            agentId: "bot",
            projectId: "p",
            userId: "u",
            prompt: "nudge",
            idempotencyKey: "nudge-1",
          },
        }),
      }),
    );
    const body = await res.json();
    expect(body.created).toBe(true);
    expect(body.schedule.kind).toBe("delay");
  });

  it("keeps the user turn when the bot row is missing", async () => {
    const storage = memoryStorage();
    const env = {
      DB: {
        prepare() {
          return {
            bind() {
              return { first: async () => null };
            },
          };
        },
      },
    };
    const agentDo = new AgentDurableObject({ id: { toString: () => "x" }, storage }, env);
    const res = await agentDo.fetch(
      new Request("https://internal/rpc", {
        method: "POST",
        body: JSON.stringify({
          method: "turn",
          params: { content: "hello", projectId: "p", agentId: "missing", userId: "u" },
        }),
      }),
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.turns[0].content).toBe("hello");
  });

  it("records a room_event without waking the LLM", async () => {
    const storage = memoryStorage();
    const agentDo = new AgentDurableObject({ id: { toString: () => "x" }, storage }, { DB: {} });
    const res = await agentDo.fetch(
      new Request("https://internal/rpc", {
        method: "POST",
        body: JSON.stringify({
          method: "room_event",
          params: { summary: "alice mentioned you", roomId: "room-9", projectId: "p", agentId: "bot", userId: "u" },
        }),
      }),
    );
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.turns[0].content).toContain("[room room-9]");
  });

  it("rejects undeclared RPC methods", async () => {
    const agentDo = new AgentDurableObject({ id: { toString: () => "x" }, storage: memoryStorage() }, { DB: {} });
    const res = await agentDo.fetch(
      new Request("https://internal/rpc", {
        method: "POST",
        body: JSON.stringify({ method: "eval", params: {} }),
      }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).reason).toBe("rpc_method_forbidden");
  });
});
