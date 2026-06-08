import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dispatchSuggestRepliesRoutes } from "./suggest-replies-http.js";

function makeJsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function createMockD1() {
  const messages = [
    { user_id: "alice", content: "Hello everyone", created_at: "2026-06-05T09:00:00.000Z" },
    { user_id: "bob", content: "Hey Alice, how are you?", created_at: "2026-06-05T09:01:00.000Z" },
  ];
  return {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            first: async () => {
              if (/SELECT user_id, content FROM messages WHERE .* id = \?/.test(sql)) {
                return messages[0]; // parentId match
              }
              return null;
            },
            all: async () => {
              if (/SELECT user_id, content, created_at FROM messages/.test(sql)) {
                return { results: messages };
              }
              return { results: [] };
            },
          };
        },
      };
    },
  };
}

function buildDeps(overrides = {}) {
  const db = overrides.db ?? createMockD1();
  const corsHeaders = { "access-control-allow-origin": "*" };
  const env = {
    DB: db,
    AI_BASE_URL: overrides.aiBaseUrl ?? "https://llm.example.com",
    AI_API_KEY: overrides.aiKey ?? "sk-test",
    AI_MODEL: overrides.aiModel,
    RATE_LIMIT_SUGGEST_REPLIES_PER_MINUTE: overrides.rateLimit ?? 20,
  };
  const h = {
    env,
    json: (data, init = {}) =>
      new Response(JSON.stringify(data), {
        status: init.status ?? 200,
        headers: { "content-type": "application/json", ...corsHeaders, ...(init.headers || {}) },
      }),
    corsHeaders,
    requestLogCtx: { traceId: "t" },
    verifyJwtAndGetContext: overrides.verifyJwt ?? (async () => ({ userId: "user_1", projectId: "proj_1" })),
    logError: () => {},
    checkAndConsumeProjectQuota: overrides.quota ?? (async () => ({ allowed: true, used: 0, monthKey: "2026-06" })),
    quotaResetInfo: () => ({ resetsAt: "x", retryAfterSeconds: 60 }),
    checkAndConsumeRateLimit: overrides.rate ?? (async () => ({ allowed: true, retryAfterSeconds: 0 })),
    isValidId: (s) => typeof s === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(s),
    canAccessRoom: overrides.canAccessRoom ?? (async () => true),
  };
  return { env, h };
}

function makePost(body, token = "jwt") {
  return new Request("http://127.0.0.1:8787/messages/suggest-replies", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
}

describe("dispatchSuggestRepliesRoutes", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns null for non-matching path", async () => {
    const { h } = buildDeps();
    const req = new Request("http://127.0.0.1:8787/messages/other");
    const url = new URL(req.url);
    const res = await dispatchSuggestRepliesRoutes(req, url, h);
    expect(res).toBeNull();
  });

  it("returns 401 when no JWT is provided", async () => {
    const { h } = buildDeps();
    const req = new Request("http://127.0.0.1:8787/messages/suggest-replies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId: "room_1" }),
    });
    const url = new URL(req.url);
    await expect(dispatchSuggestRepliesRoutes(req, url, h)).rejects.toThrow();
  });

  it("returns 400 when roomId is missing", async () => {
    const { h } = buildDeps();
    const req = makePost({});
    const url = new URL(req.url);
    const res = await dispatchSuggestRepliesRoutes(req, url, h);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("roomId required");
  });

  it("returns 400 when parentId is invalid", async () => {
    const { h } = buildDeps();
    const req = makePost({ roomId: "room_1", parentId: -5 });
    const url = new URL(req.url);
    const res = await dispatchSuggestRepliesRoutes(req, url, h);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("parentId");
  });

  it("returns 403 when caller cannot access the room", async () => {
    const { h } = buildDeps({ canAccessRoom: async () => false });
    const req = makePost({ roomId: "room_1" });
    const url = new URL(req.url);
    const res = await dispatchSuggestRepliesRoutes(req, url, h);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("forbidden");
  });

  it("returns 503 when AI is not configured", async () => {
    const { h } = buildDeps({ aiBaseUrl: "" });
    const req = makePost({ roomId: "room_1" });
    const url = new URL(req.url);
    const res = await dispatchSuggestRepliesRoutes(req, url, h);
    expect(res.status).toBe(503);
  });

  it("returns 402 when quota is exceeded", async () => {
    const { h } = buildDeps({
      quota: async () => ({ allowed: false, used: 100, monthKey: "2026-06" }),
    });
    const req = makePost({ roomId: "room_1" });
    const url = new URL(req.url);
    const res = await dispatchSuggestRepliesRoutes(req, url, h);
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.error).toBe("quota_exceeded");
  });

  it("returns 429 when rate limited", async () => {
    const { h } = buildDeps({
      rate: async () => ({ allowed: false, retryAfterSeconds: 30 }),
    });
    const req = makePost({ roomId: "room_1" });
    const url = new URL(req.url);
    const res = await dispatchSuggestRepliesRoutes(req, url, h);
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe("rate_limit_exceeded");
  });

  it("returns empty suggestions when room has no messages", async () => {
    const db = {
      prepare() {
        return {
          bind() {
            return {
              first: async () => null,
              all: async () => ({ results: [] }),
            };
          },
        };
      },
    };
    const { h } = buildDeps({ db });
    const req = makePost({ roomId: "room_1" });
    const url = new URL(req.url);
    const res = await dispatchSuggestRepliesRoutes(req, url, h);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.suggestions).toEqual([]);
  });

  it("calls AI and returns parsed suggestions on the happy path", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: '["Sounds good!", "Let me check", "Thanks!"]' } }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const { h } = buildDeps();
    const req = makePost({ roomId: "room_1" });
    const url = new URL(req.url);
    const res = await dispatchSuggestRepliesRoutes(req, url, h);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.suggestions).toEqual(["Sounds good!", "Let me check", "Thanks!"]);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [calledUrl, calledInit] = fetchSpy.mock.calls[0];
    expect(String(calledUrl)).toContain("/v1/chat/completions");
    expect(calledInit.method).toBe("POST");
    const sentBody = JSON.parse(String(calledInit.body));
    expect(sentBody.temperature).toBe(0.7);
    expect(sentBody.max_tokens).toBe(128);
  });

  it("returns 502 when AI provider fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("overloaded", { status: 500, statusText: "Internal Server Error" }),
    );
    const { h } = buildDeps();
    const req = makePost({ roomId: "room_1" });
    const url = new URL(req.url);
    const res = await dispatchSuggestRepliesRoutes(req, url, h);
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toBe("ai_provider_failed");
  });

  it("handles markdown-fenced JSON from AI", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: '```json\n["OK", "Got it"]\n```' } }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const { h } = buildDeps();
    const req = makePost({ roomId: "room_1" });
    const url = new URL(req.url);
    const res = await dispatchSuggestRepliesRoutes(req, url, h);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.suggestions).toEqual(["OK", "Got it"]);
  });

  it("returns empty suggestions when AI returns non-array JSON", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: '{"reply": "yes"}' } }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const { h } = buildDeps();
    const req = makePost({ roomId: "room_1" });
    const url = new URL(req.url);
    const res = await dispatchSuggestRepliesRoutes(req, url, h);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.suggestions).toEqual([]);
  });

  it("passes parentId in the AI prompt context when provided", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: '["Sure thing"]' } }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const { h } = buildDeps();
    const req = makePost({ roomId: "room_1", parentId: 1 });
    const url = new URL(req.url);
    const res = await dispatchSuggestRepliesRoutes(req, url, h);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.suggestions).toEqual(["Sure thing"]);
    // The user prompt should mention the parent message
    const sentBody = JSON.parse(String(fetchSpy.mock.calls[0][1]?.body));
    const userMsg = sentBody.messages.find((m) => m.role === "user");
    expect(userMsg.content).toContain("replying to");
  });
});
