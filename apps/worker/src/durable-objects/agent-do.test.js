import { describe, expect, it, vi } from "vitest";
import { AgentDurableObject, AGENT_DO_MAX_TURN_QUEUE } from "./agent-do.js";
import { AGENT_SCHEDULES_STORAGE_KEY, STUCK_CLAIM_MS } from "../lib/agent-schedules.js";
import { executeAgentRun } from "../lib/agent-runtime.js";

vi.mock("../lib/agent-runtime.js", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, executeAgentRun: vi.fn() };
});

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
    };    const agentDo = new AgentDurableObject({ id: { toString: () => "x" }, storage }, env);
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

  it("serializes queued turns FIFO and overflows past the cap", async () => {
    const agentDo = new AgentDurableObject({ id: { toString: () => "q" }, storage: memoryStorage() }, { DB: {} });

    const log = [];
    let releaseFirst;
    const firstGate = new Promise((resolve) => {
      releaseFirst = resolve;
    });

    const first = agentDo.enqueueTurn(async () => {
      log.push("first:start");
      await firstGate;
      log.push("first:end");
      return "first-response";
    }, "overflow-1");

    const rest = [];
    for (let i = 0; i < AGENT_DO_MAX_TURN_QUEUE; i += 1) {
      rest.push(
        agentDo.enqueueTurn(async () => {
          log.push(`turn-${i}`);
          return `response-${i}`;
        }, `overflow-${i + 2}`),
      );
    }
    const overflow = await agentDo.enqueueTurn(async () => "never", "overflow-full");

    expect(overflow).toBe("overflow-full");
    expect(log).toEqual(["first:start"]);

    releaseFirst();
    await expect(first).resolves.toBe("first-response");
    await expect(Promise.all(rest)).resolves.toEqual(rest.map((_, i) => `response-${i}`));
    expect(log).toEqual([
      "first:start",
      "first:end",
      ...Array.from({ length: AGENT_DO_MAX_TURN_QUEUE }, (_, i) => `turn-${i}`),
    ]);
  });

  it("queues concurrent room_invoke RPCs on the room-run instance", async () => {
    const storage = memoryStorage();
    const env = {
      DB: {
        prepare() {
          return {
            bind() {
              return {
                first: async () => ({
                  id: "bot",
                  name: "Ada",
                  provider: "openai",
                  model: "gpt-4o-mini",
                  config: null,
                  system_prompt: "hi",
                  context_fetch_url: null,
                  tool_execute_url: null,
                  tools_schema: null,
                  rate_limit_rpm: null,
                  allowed_tools: null,
                }),
              };
            },
          };
        },
      },
    };
    const agentDo = new AgentDurableObject({ id: { toString: () => "room-run:p:r" }, storage }, env);

    const started = [];
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    vi.mocked(executeAgentRun).mockImplementation(async (_env, args) => {
      started.push(args.userMessage);
      await gate;
      return {
        runId: `run-${args.userMessage}`,
        status: "completed",
        content: `reply ${args.userMessage}`,
        latencyMs: 1,
        inputTokens: 1,
        outputTokens: 1,
        estimatedCost: 0,
        toolCalls: [],
        contextFetched: 0,
        iterations: 1,
      };
    });

    const invoke = (content) =>
      agentDo.fetch(
        new Request("https://internal/rpc", {
          method: "POST",
          body: JSON.stringify({
            method: "room_invoke",
            params: { projectId: "p", roomId: "r", agentId: "bot", userId: "u", content, stream: false },
          }),
        }),
      );

    const first = invoke("m1");
    await vi.waitFor(() => expect(started).toEqual(["m1"]));
    const second = invoke("m2");
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(started).toEqual(["m1"]); // m2 waits: one turn at a time per room

    release();
    const [res1, res2] = await Promise.all([first, second]);
    expect((await res1.json()).run.runId).toBe("run-m1");
    expect((await res2.json()).run.runId).toBe("run-m2");
    expect(started).toEqual(["m1", "m2"]);
    vi.mocked(executeAgentRun).mockReset();
  });

  it("A2-28: a shared room-run instance serves different callers", async () => {
    const storage = memoryStorage();
    const env = {
      DB: {
        prepare() {
          return {
            bind() {
              return {
                first: async () => ({
                  id: "bot",
                  name: "Ada",
                  provider: "openai",
                  model: "gpt-4o-mini",
                  config: null,
                  system_prompt: "hi",
                  context_fetch_url: null,
                  tool_execute_url: null,
                  tools_schema: null,
                  rate_limit_rpm: null,
                  allowed_tools: null,
                }),
              };
            },
          };
        },
      },
    };
    vi.mocked(executeAgentRun).mockImplementation(async (_env, args) => ({
      runId: `run-${args.userMessage}`,
      status: "completed",
      content: "ok",
      latencyMs: 1,
      inputTokens: 1,
      outputTokens: 1,
      estimatedCost: 0,
      toolCalls: [],
      contextFetched: 0,
      iterations: 1,
    }));
    const agentDo = new AgentDurableObject({ id: { toString: () => "room-run:p:r" }, storage }, env);
    const invoke = (userId, agentId, content) =>
      agentDo.fetch(
        new Request("https://internal/rpc", {
          method: "POST",
          body: JSON.stringify({
            method: "room_invoke",
            params: { projectId: "p", roomId: "r", agentId, userId, content, stream: false },
          }),
        }),
      );

    const first = await invoke("alice", "bot", "m1");
    expect((await first.json()).ok).toBe(true);
    const second = await invoke("bob", "bot2", "m2");
    expect((await second.json()).ok).toBe(true);
    vi.mocked(executeAgentRun).mockReset();
  });

  it("A2-29: re-arms the alarm when due rows are still inside the stuck window", async () => {
    const storage = memoryStorage();
    const alarms = [];
    storage.setAlarm = async (ts) => alarms.push(ts);
    const now = Date.now();
    await storage.put(AGENT_SCHEDULES_STORAGE_KEY, {
      s1: {
        id: "s1",
        projectId: "p",
        roomId: "r",
        agentId: "bot",
        kind: "delay",
        prompt: "hi",
        status: "running",
        claimedAt: now - 1_000,
        nextRunAt: now - 5_000,
        failCount: 0,
      },
    });
    const agentDo = new AgentDurableObject({ id: { toString: () => "room-run:p:r" }, storage }, { DB: {} });
    await agentDo.processDueSchedules();
    // Nothing was claimable, but the alarm must fire when the claim expires.
    expect(alarms.length).toBeGreaterThan(0);
    expect(Math.min(...alarms)).toBeGreaterThanOrEqual(now - 1_000 + STUCK_CLAIM_MS - 50);
  });

  it("rejects RPC params that re-point the instance at another identity (audit F-56)", async () => {
    const storage = memoryStorage();
    const agentDo = new AgentDurableObject(
      { id: { toString: () => "p__bot__u" }, storage },
      { DB: {} },
    );
    agentDo.projectId = "p";
    agentDo.agentId = "bot";
    agentDo.userId = "u";

    const res = await agentDo.fetch(
      new Request("https://internal/rpc", {
        method: "POST",
        body: JSON.stringify({
          method: "room_event",
          params: { projectId: "other-project", agentId: "bot", userId: "u", summary: "hi" },
        }),
      }),
    );
    expect(res.status).toBe(403);
    expect((await res.json()).reason).toBe("identity_mismatch");
    expect(agentDo.projectId).toBe("p");

    const ok = await agentDo.fetch(
      new Request("https://internal/rpc", {
        method: "POST",
        body: JSON.stringify({
          method: "room_event",
          params: { projectId: "p", agentId: "bot", userId: "u", summary: "hi" },
        }),
      }),
    );
    expect(ok.status).toBe(200);
  });
});
