import { describe, expect, it, vi } from "vitest";
import { dispatchAdminSearchAutomationRoutes } from "./admin-search-automation-http.js";

const URL_ANNOUNCE = "https://worker.example/admin/announcement";

function buildDeps(overrides = {}) {
  const doFetch = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
  return {
    doFetch,
    h: {
      env: {
        ROOM: {
          idFromName: (name) => `do-${name}`,
          get: () => ({ fetch: doFetch }),
        },
      },
      ctx: { waitUntil() {} },
      traceId: "trace-test",
      corsHeaders: {},
      json: (body, init = {}) =>
        new Response(JSON.stringify(body), {
          status: init.status ?? 200,
          headers: { "Content-Type": "application/json" },
        }),
      requestLogCtx: {},
      verifyJwtAndGetContext: async () => ({
        projectId: "proj_own",
        userId: "u_admin",
        roles: ["owner"],
      }),
      hasAnyRole: (roles, allowed) => (roles || []).some((role) => allowed.includes(role)),
      logError: () => {},
      requireAdminAuth: true,
      projectId: null,
      canAccessRoom: overrides.canAccessRoom ?? (async () => true),
      processPendingWebhookDeliveries: async () => {},
      escapeLike: (value) => value,
      canBypassRoomMembership: () => true,
      generateRoomSummaryAndAnnounce: async () => {},
      canCreateTenantProjects: () => false,
      writeAuditEvent: async () => {},
    },
  };
}

function announceRequest(body) {
  return new Request(URL_ANNOUNCE, {
    method: "POST",
    headers: { Authorization: "Bearer jwt", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /admin/announcement room gate (A2-3)", () => {
  it("A2-3: refuses to announce into a room the project cannot access", async () => {
    const { h, doFetch } = buildDeps({ canAccessRoom: async () => false });
    const res = await dispatchAdminSearchAutomationRoutes(
      announceRequest({ roomId: "room_victim", content: "hello" }),
      new URL(URL_ANNOUNCE),
      h,
    );
    expect(res.status).toBe(403);
    expect(doFetch).not.toHaveBeenCalled();
  });

  it("A2-3 control: announces into an accessible room", async () => {
    const { h, doFetch } = buildDeps();
    const res = await dispatchAdminSearchAutomationRoutes(
      announceRequest({ roomId: "room_own", content: "hello" }),
      new URL(URL_ANNOUNCE),
      h,
    );
    expect(res.status).toBe(200);
    expect(doFetch).toHaveBeenCalledTimes(1);
    const init = doFetch.mock.calls[0][1];
    expect(JSON.parse(init.body)).toMatchObject({ content: "hello", userId: "system" });
  });
});

const URL_RULES = "https://worker.example/admin/alerts/rules";

function rulesDeps(existingOwner) {
  const sqls = [];
  const chain = {
    bind: function () {
      return this;
    },
    run: async () => ({ meta: { changes: 1 } }),
    first: async () => existingOwner,
    all: async () => ({ results: [] }),
  };
  const { h } = buildDeps();
  h.env.DB = {
    prepare: (sql) => {
      sqls.push(sql);
      return chain;
    },
  };
  return { h, sqls };
}

function rulesRequest(body) {
  return new Request(URL_RULES, {
    method: "POST",
    headers: { Authorization: "Bearer jwt", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /admin/alerts/rules client id ownership (A2-11)", () => {
  const payload = (extra) => ({ metricName: "errors", thresholdValue: 5, ...extra });

  it("A2-11: refuses a rule id owned by another project", async () => {
    const { h, sqls } = rulesDeps({ project_id: "proj_victim" });
    const res = await dispatchAdminSearchAutomationRoutes(
      rulesRequest(payload({ id: "rule_victim" })),
      new URL(URL_RULES),
      h,
    );
    expect(res.status).toBe(403);
    expect(sqls.some((sql) => /INSERT OR REPLACE/.test(sql))).toBe(false);
  });

  it("A2-11 control: updates a rule of the caller's project", async () => {
    const { h, sqls } = rulesDeps({ project_id: "proj_own" });
    const res = await dispatchAdminSearchAutomationRoutes(
      rulesRequest(payload({ id: "rule_own" })),
      new URL(URL_RULES),
      h,
    );
    expect(res.status).toBe(200);
    expect(sqls.some((sql) => /INSERT OR REPLACE/.test(sql))).toBe(true);
  });

  it("A2-11 control: a fresh rule without a client id", async () => {
    const { h, sqls } = rulesDeps(null);
    const res = await dispatchAdminSearchAutomationRoutes(
      rulesRequest(payload({})),
      new URL(URL_RULES),
      h,
    );
    expect(res.status).toBe(200);
    expect(sqls.some((sql) => /INSERT OR REPLACE/.test(sql))).toBe(true);
  });
});

describe("POST /admin/mute duration (A2-24)", () => {
  it("A2-24: a non-numeric duration records a permanent mute instead of 500", async () => {
    const calls = [];
    const { h } = buildDeps();
    h.env.DB = {
      prepare: (sql) => ({
        bind: (...args) => {
          calls.push({ sql, args });
          return {
            run: async () => ({ meta: { changes: 1 } }),
            first: async () => null,
            all: async () => ({ results: [] }),
          };
        },
      }),
    };
    const req = new Request("https://worker.example/admin/mute", {
      method: "POST",
      headers: { Authorization: "Bearer jwt", "Content-Type": "application/json" },
      body: JSON.stringify({ roomId: "r1", userId: "u1", durationSeconds: "abc" }),
    });
    const res = await dispatchAdminSearchAutomationRoutes(req, new URL(req.url), h);
    expect(res.status).toBe(200);
    const insert = calls.find((c) => /INSERT INTO moderation_events/.test(c.sql));
    expect(insert.args[5]).toBe(null);
  });
});

describe("GET /admin/webhooks/summary consecutive failures (A2-25)", () => {
  it("A2-25: counts every consecutive failure until a delivered row", async () => {
    const { h } = buildDeps();
    h.env.DB = {
      prepare: (sql) => ({
        bind: () => ({
          first: async () => null,
          run: async () => ({ meta: { changes: 1 } }),
          all: async () => {
            if (sql.includes("FROM webhooks w")) {
              return {
                results: [
                  { webhook_id: "w1", url: "https://a", event_types: "message", webhook_created_at: "t" },
                  { webhook_id: "w2", url: "https://b", event_types: "message", webhook_created_at: "t" },
                ],
              };
            }
            if (sql.includes("FROM webhook_deliveries")) {
              return {
                results: [
                  { webhook_id: "w1", status: "failed" },
                  { webhook_id: "w1", status: "cancelled" },
                  { webhook_id: "w1", status: "failed" },
                  { webhook_id: "w2", status: "failed" },
                  { webhook_id: "w2", status: "delivered" },
                ],
              };
            }
            return { results: [] };
          },
        }),
      }),
    };
    const req = new Request("https://worker.example/admin/webhooks/summary", {
      method: "GET",
      headers: { Authorization: "Bearer jwt" },
    });
    const res = await dispatchAdminSearchAutomationRoutes(req, new URL(req.url), h);
    expect(res.status).toBe(200);
    const body = await res.json();
    const byId = Object.fromEntries(body.webhooks.map((w) => [w.webhookId, w.consecutiveFailures]));
    expect(byId.w1).toBe(3);
    expect(byId.w2).toBe(1);
  });
});
