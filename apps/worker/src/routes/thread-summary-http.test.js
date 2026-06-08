import { afterEach, describe, expect, it, vi } from "vitest";
import { dispatchThreadSummaryRoutes } from "./thread-summary-http.js";

function buildDeps(overrides = {}) {
  const corsHeaders = { "access-control-allow-origin": "*" };
  const env = {
    DB: overrides.db,
    AI_BASE_URL: overrides.aiBaseUrl ?? "https://llm.example.com",
    AI_API_KEY: "sk-test",
    RATE_LIMIT_THREAD_SUMMARY_PER_MINUTE: 10,
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
    verifyJwtAndGetContext:
      overrides.verifyJwt ?? (async () => ({ userId: "user_1", projectId: "proj_1" })),
    logError: () => {},
    checkAndConsumeProjectQuota:
      overrides.quota ?? (async () => ({ allowed: true, used: 0, monthKey: "2026-06" })),
    quotaResetInfo: () => ({ resetsAt: "x", retryAfterSeconds: 60 }),
    checkAndConsumeRateLimit:
      overrides.rate ?? (async () => ({ allowed: true, retryAfterSeconds: 0 })),
    isValidId: (s) => typeof s === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(s),
    canAccessRoom: overrides.canAccessRoom ?? (async () => true),
  };
  return { h };
}

function makePost(messageId, body = { roomId: "room_1" }) {
  return new Request(`http://127.0.0.1:8787/messages/${messageId}/summary`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer jwt",
    },
    body: JSON.stringify(body),
  });
}

describe("dispatchThreadSummaryRoutes", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("returns null for non-matching path", async () => {
    const { h } = buildDeps();
    const req = new Request("http://127.0.0.1:8787/messages/suggest-replies", {
      method: "POST",
    });
    const res = await dispatchThreadSummaryRoutes(req, new URL(req.url), h);
    expect(res).toBeNull();
  });

  it("returns 401 without auth", async () => {
    const { h } = buildDeps({ verifyJwt: async () => null });
    const req = makePost(1);
    const res = await dispatchThreadSummaryRoutes(req, new URL(req.url), h);
    expect(res.status).toBe(401);
  });

  it("returns summary payload on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "- Topic: billing\n- Next: email receipt" } }],
        }),
      })),
    );

    const messages = [
      {
        id: 1,
        project_id: "proj_1",
        room_id: "room_1",
        user_id: "a",
        content: "q",
        created_at: "t1",
        parent_id: null,
        deleted_at: null,
      },
      {
        id: 2,
        project_id: "proj_1",
        room_id: "room_1",
        user_id: "b",
        content: "a1",
        created_at: "t2",
        parent_id: 1,
        deleted_at: null,
      },
      {
        id: 3,
        project_id: "proj_1",
        room_id: "room_1",
        user_id: "a",
        content: "a2",
        created_at: "t3",
        parent_id: 1,
        deleted_at: null,
      },
    ];

    const db = {
      prepare(sql) {
        return {
          bind(...binds) {
            return {
              first: async () => {
                if (sql.includes("WHERE project_id = ? AND room_id = ? AND id = ?")) {
                  const [, , id] = binds;
                  return messages.find((m) => m.id === Number(id)) ?? null;
                }
                return null;
              },
              all: async () => {
                if (sql.includes("parent_id IN")) {
                  const parentIds = binds.slice(2).map(Number);
                  return {
                    results: messages.filter((m) => parentIds.includes(m.parent_id)),
                  };
                }
                if (sql.includes("id IN")) {
                  const ids = binds.slice(2).map(Number);
                  return {
                    results: messages
                      .filter((m) => ids.includes(m.id))
                      .sort((a, b) => a.created_at.localeCompare(b.created_at)),
                  };
                }
                return { results: [] };
              },
            };
          },
        };
      },
    };

    const { h } = buildDeps({ db });
    const req = makePost(1);
    const res = await dispatchThreadSummaryRoutes(req, new URL(req.url), h);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.summary).toContain("billing");
    expect(body.messageCount).toBe(3);
    expect(body.rootMessageId).toBe(1);
  });
});
