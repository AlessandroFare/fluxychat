import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAuthMatrixDeps } from "./auth-matrix-deps.js";
import { dispatchMessagesRoutes } from "./messages-http.js";

// Stub the slash-command lib: the real dispatcher goes through the room DO.
vi.mock("../lib/room-command-dispatch.js", () => ({
  tryDispatchSlashCommand: async () => ({ handled: false }),
}));

const state = vi.hoisted(() => ({ slowMode: false }));

vi.mock("../lib/room-config.js", async (importOriginal) => ({
  ...(await importOriginal()),
  assertRoomSlowModeAllowed: async () =>
    state.slowMode ? { ok: false, retryAfterSeconds: 5 } : { ok: true },
}));

function fakeDb() {
  return {
    prepare(sql) {
      return {
        bind(...params) {
          return {
            async first() {
              if (sql.includes("FROM rooms")) return { type: "group", name: "general" };
              return null;
            },
            async all() {
              return { results: [] };
            },
            async run() {
              if (sql.includes("INSERT INTO messages")) {
                return { meta: { last_row_id: 99, changes: 1 } };
              }
              return { meta: { last_row_id: 1, changes: 1 } };
            },
          };
        },
      };
    },
    async batch() {
      return [];
    },
  };
}

function harness({ rateAllowed = true } = {}) {
  const quota = { calls: 0 };
  const h = createAuthMatrixDeps({
    verifyJwt: async () => ({ userId: "user_bob", projectId: "p1", roles: ["member"] }),
    extra: {
      env: {
        DB: fakeDb(),
        ROOM: {
          idFromName: (name) => name,
          get: () => ({ fetch: async () => new Response("{}") }),
        },
      },
      incrementOperationalMetric: async () => ({}),
      safeSchedulePostMessageAutomations: async () => ({}),
      checkAndConsumeProjectQuota: async () => {
        quota.calls += 1;
        return {
          allowed: true,
          metricName: "messages_created",
          limit: 100,
          used: 0,
          monthKey: "2026-10",
        };
      },
      checkAndConsumeRateLimit: async () =>
        rateAllowed ? { allowed: true } : { allowed: false, retryAfterSeconds: 7 },
    },
  });
  return { h, quota };
}

function request(h) {
  const req = new Request("http://127.0.0.1:8787/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ roomId: "room-1", content: "hi" }),
  });
  return dispatchMessagesRoutes(req, new URL(req.url), h);
}

describe("POST /messages quota consumption order (M3)", () => {
  beforeEach(() => {
    state.slowMode = false;
  });

  it("M3: a rate-limited send does not consume quota", async () => {
    const { h, quota } = harness({ rateAllowed: false });
    const res = await request(h);
    expect(res.status).toBe(429);
    expect(quota.calls).toBe(0);
  });

  it("M3: a slow-mode-rejected send does not consume quota", async () => {
    state.slowMode = true;
    const { h, quota } = harness();
    const res = await request(h);
    expect(res.status).toBe(429);
    expect((await res.json()).error).toBe("slow_mode");
    expect(quota.calls).toBe(0);
  });

  it("M3 control: a successful send consumes quota exactly once", async () => {
    const { h, quota } = harness();
    const res = await request(h);
    expect(res.status).toBe(200);
    expect(quota.calls).toBe(1);
  });
});
