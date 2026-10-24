/**
 * Phase 2 agent HTTP contracts: invoke, list, bots, quota, rate limit.
 */
import { describe, expect, it, vi } from "vitest";
import { createAuthMatrixDeps, unauthorizedRequest } from "./auth-matrix-deps.js";
import { dispatchAgentsRoutes } from "./agents-http.js";
import { finalizeAgentChatMessage } from "../lib/agent-runtime.js";

vi.mock("../lib/agent-runtime.js", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, finalizeAgentChatMessage: vi.fn(async () => null) };
});

const memberJwt = async () => ({
  userId: "u1",
  projectId: "p1",
  roles: ["member"],
});

function agentRow() {
  return {
    id: "bot-1",
    name: "Helper",
    provider: "openai",
    model: "gpt-4o-mini",
    config: null,
    system_prompt: "be brief",
    context_fetch_url: null,
    tool_execute_url: null,
    tools_schema: null,
    rate_limit_rpm: 60,
  };
}

function agentDb({ handoff = false, missingAgent = false } = {}) {
  return {
    prepare(sql) {
      const text = String(sql);
      return {
        bind() {
          return {
            first: async () => {
              if (text.includes("FROM room_handoffs")) return handoff ? { ok: 1 } : null;
              if (text.includes("FROM bots")) return missingAgent ? null : agentRow();
              return null;
            },
            all: async () => ({ results: [] }),
            run: async () => ({ success: true, meta: { last_row_id: 99 } }),
          };
        },
      };
    },
  };
}

function roomStub() {
  return {
    idFromName: (id) => id,
    get: () => ({
      fetch: async () => new Response(JSON.stringify({ ok: true })),
    }),
  };
}

function deps(overrides = {}) {
  const db = overrides.db ?? agentDb();
  return createAuthMatrixDeps({
    db,
    verifyJwt: overrides.verifyJwt ?? memberJwt,
    extra: {
      quotaResetInfo: () => ({
        resetsAt: "2026-10-01T00:00:00.000Z",
        retryAfterSeconds: 3600,
      }),
      checkAndConsumeProjectQuota:
        overrides.checkAndConsumeProjectQuota ?? (async () => ({ allowed: true })),
      checkAndConsumeRateLimit:
        overrides.checkAndConsumeRateLimit ?? (async () => ({ allowed: true })),
      executeAgentRun:
        overrides.executeAgentRun ??
        (async () => ({
          status: "completed",
          content: "ok",
          runId: "run-1",
          latencyMs: 8,
          inputTokens: 2,
          outputTokens: 4,
          estimatedCost: 0,
          iterations: 1,
          toolCalls: [],
          contextFetched: false,
        })),
      createAgentStreamHooks: overrides.createAgentStreamHooks ?? (() => null),
      incrementOperationalMetric: async () => {},
      env: {
        DB: db,
        ROOM: roomStub(),
        ...(overrides.env || {}),
      },
      ...overrides.extra,
    },
  });
}

function agentDoStub({ messageId = null } = {}) {
  return {
    AGENT: {
      idFromName: (name) => name,
      get: () => ({
        fetch: async () =>
          new Response(
            JSON.stringify({
              ok: true,
              run: {
                status: "completed",
                content: "hello from DO",
                runId: "run-do",
                latencyMs: 5,
                inputTokens: 1,
                outputTokens: 2,
                estimatedCost: 0,
                iterations: 1,
                toolCalls: [],
                contextFetched: false,
              },
              messageId,
            }),
            { headers: { "Content-Type": "application/json" } },
          ),
      }),
    },
  };
}

function jsonReq(path, { method = "GET", body } = {}) {
  return unauthorizedRequest(path, { method, body });
}

describe("agent HTTP — invoke", () => {
  it("POST /agents/:id/invoke without JWT is 401", async () => {
    const req = jsonReq("/agents/bot-1/invoke", {
      method: "POST",
      body: { roomId: "room-1", content: "hi" },
    });
    const res = await dispatchAgentsRoutes(req, new URL(req.url), createAuthMatrixDeps());
    expect(res.status).toBe(401);
  });

  it("POST /agents/:id/invoke missing roomId is 400", async () => {
    const req = jsonReq("/agents/bot-1/invoke", {
      method: "POST",
      body: { content: "hi" },
    });
    const res = await dispatchAgentsRoutes(req, new URL(req.url), deps());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(String(body.error)).toMatch(/roomId/);
  });

  it("POST /agents/:id/invoke with depth 4 is 422", async () => {
    const req = jsonReq("/agents/bot-1/invoke", {
      method: "POST",
      body: { roomId: "room-1", content: "hi", depth: 4 },
    });
    const res = await dispatchAgentsRoutes(req, new URL(req.url), deps());
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe("max_recursion_depth_exceeded");
  });

  it("POST /agents/:id/invoke unknown agent is 404", async () => {
    const req = jsonReq("/agents/missing/invoke", {
      method: "POST",
      body: { roomId: "room-1", content: "hi" },
    });
    const res = await dispatchAgentsRoutes(
      req,
      new URL(req.url),
      deps({ db: agentDb({ missingAgent: true }) }),
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("agent not found");
  });

  it("POST /agents/:id/invoke into a room outside the project is 404 (F-39)", async () => {
    const req = jsonReq("/agents/bot-1/invoke", {
      method: "POST",
      body: { roomId: "other-project-room", content: "hi" },
    });
    const res = await dispatchAgentsRoutes(
      req,
      new URL(req.url),
      deps({ extra: { canAccessRoom: async () => false } }),
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("room_not_found");
  });

  it("POST /agents/:id/invoke over agent rpm is 429", async () => {
    const req = jsonReq("/agents/bot-1/invoke", {
      method: "POST",
      body: { roomId: "room-1", content: "hi" },
    });
    const res = await dispatchAgentsRoutes(
      req,
      new URL(req.url),
      deps({
        checkAndConsumeRateLimit: async () => ({
          allowed: false,
          retryAfterSeconds: 30,
        }),
      }),
    );
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe("agent_rate_limit_exceeded");
    expect(res.headers.get("Retry-After")).toBe("30");
  });

  it("POST /agents/:id/invoke with a full room turn queue is 429", async () => {
    const req = jsonReq("/agents/bot-1/invoke", {
      method: "POST",
      body: { roomId: "room-1", content: "hi" },
    });
    const res = await dispatchAgentsRoutes(
      req,
      new URL(req.url),
      deps({
        env: {
          AGENT: {
            idFromName: (name) => name,
            get: () => ({
              fetch: async () =>
                new Response(
                  JSON.stringify({ ok: false, reason: "turn_queue_full", retryAfterSeconds: 7 }),
                  { headers: { "Content-Type": "application/json" } },
                ),
            }),
          },
        },
      }),
    );
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe("turn_queue_full");
    expect(res.headers.get("Retry-After")).toBe("7");
  });

  it("POST /agents/:id/invoke over project quota is 402", async () => {
    const req = jsonReq("/agents/bot-1/invoke", {
      method: "POST",
      body: { roomId: "room-1", content: "hi" },
    });
    const res = await dispatchAgentsRoutes(
      req,
      new URL(req.url),
      deps({
        checkAndConsumeProjectQuota: async () => ({
          allowed: false,
          metricName: "agent_invokes",
          limit: 50,
          used: 50,
          monthKey: "2026-09",
        }),
      }),
    );
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.error).toBe("quota_exceeded");
    expect(body.metric).toBe("agent_invokes");
  });

  it("POST /agents/:id/invoke during human handoff is 409", async () => {
    const req = jsonReq("/agents/bot-1/invoke", {
      method: "POST",
      body: { roomId: "room-1", content: "hi" },
    });
    const res = await dispatchAgentsRoutes(
      req,
      new URL(req.url),
      deps({ db: agentDb({ handoff: true }) }),
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("human_handoff_active");
  });

  it("POST /agents/:id/invoke happy path returns run + message", async () => {
    const req = jsonReq("/agents/bot-1/invoke", {
      method: "POST",
      body: { roomId: "room-1", content: "hi", stream: false },
    });
    const res = await dispatchAgentsRoutes(req, new URL(req.url), deps());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.run.id).toBe("run-1");
    expect(body.run.status).toBe("completed");
    expect(body.message.content).toBe("ok");
    expect(body.message.roomId).toBe("room-1");
  });

  it("POST /agents/:id/invoke via the agent DO finalizes the streamed reply (Art.50)", async () => {
    vi.mocked(finalizeAgentChatMessage).mockClear();
    const automations = vi.fn();
    const req = jsonReq("/agents/bot-1/invoke", {
      method: "POST",
      body: { roomId: "room-1", content: "hi" },
    });
    const res = await dispatchAgentsRoutes(
      req,
      new URL(req.url),
      deps({
        env: agentDoStub({ messageId: 42 }),
        extra: { safeSchedulePostMessageAutomations: automations },
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message.id).toBe(42);
    expect(finalizeAgentChatMessage).toHaveBeenCalledTimes(1);
    expect(finalizeAgentChatMessage).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        messageId: 42,
        userId: "bot-1",
        extraMetadata: { aiDisclosure: "AI assistant" },
      }),
    );
    expect(automations).not.toHaveBeenCalled(); // the room's stream end owns them
  });

  it("POST /agents/:id/invoke via the agent DO with stream:false inserts + finalizes the reply", async () => {
    vi.mocked(finalizeAgentChatMessage).mockClear();
    const automations = vi.fn();
    const req = jsonReq("/agents/bot-1/invoke", {
      method: "POST",
      body: { roomId: "room-1", content: "hi", stream: false },
    });
    const res = await dispatchAgentsRoutes(
      req,
      new URL(req.url),
      deps({
        env: agentDoStub({ messageId: null }),
        extra: { safeSchedulePostMessageAutomations: automations },
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message.id).toBe(99); // inserted by the route (fake D1 last_row_id)
    expect(finalizeAgentChatMessage).toHaveBeenCalledTimes(1);
    expect(automations).toHaveBeenCalledTimes(1);
  });
});

describe("agent HTTP — list and create", () => {
  it("GET /agents with JWT returns an array", async () => {
    const req = jsonReq("/agents");
    const res = await dispatchAgentsRoutes(req, new URL(req.url), deps());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.agents)).toBe(true);
  });

  it("POST /bots without a name is 400", async () => {
    const req = jsonReq("/bots", { method: "POST", body: { provider: "openai" } });
    const res = await dispatchAgentsRoutes(req, new URL(req.url), deps());
    expect(res.status).toBe(403);
  });

  it("POST /bots validates the name for an admin (audit F-44)", async () => {
    const req = jsonReq("/bots", { method: "POST", body: { provider: "openai" } });
    const res = await dispatchAgentsRoutes(
      req,
      new URL(req.url),
      deps({
        verifyJwt: async () => ({ userId: "u1", projectId: "p1", roles: ["admin"] }),
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("name required");
  });
});
