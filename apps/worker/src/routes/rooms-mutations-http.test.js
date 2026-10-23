import { describe, expect, it } from "vitest";
import { dispatchRoomsMutationsRoutes } from "./rooms-mutations-http.js";

function buildDeps(overrides = {}) {
  const corsHeaders = { "access-control-allow-origin": "*" };
  return {
    env: { DB: overrides.db },
    ctx: { waitUntil: () => {} },
    traceId: "t",
    projectId: null,
    json: (data, init = {}) =>
      new Response(JSON.stringify(data), {
        status: init.status ?? 200,
        headers: { "content-type": "application/json", ...corsHeaders },
      }),
    corsHeaders,
    requestLogCtx: { traceId: "t" },
    verifyJwtAndGetContext: overrides.verifyJwt ?? (async () => null),
    logError: () => {},
    hasAnyRole: () => true,
    isValidId: (s) => typeof s === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(s),
    validateRoles: (roles) => ({ roles: Array.isArray(roles) ? roles : ["member"] }),
    validateRoomName: (name) =>
      typeof name === "string" && name.trim()
        ? { valid: true, name: name.trim() }
        : { valid: false, error: "name required" },
    canAccessRoom: async () => true,
    canBypassRoomMembership: () => false,
    invalidateCache: () => {},
    canCreateTenantProjects: () => false,
    tenantScopeForbidden: () => null,
    writeAuditEvent: async () => {},
  };
}

describe("dispatchRoomsMutationsRoutes auth", () => {
  it("returns 401 on POST /rooms without JWT", async () => {
    const req = new Request("http://127.0.0.1:8787/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "General", type: "public" }),
    });
    const res = await dispatchRoomsMutationsRoutes(req, new URL(req.url), buildDeps());
    expect(res).not.toBeNull();
    expect(res.status).toBe(401);
  });

  it("GET /rooms/:id/agent-runs returns tenant-scoped inspector rows", async () => {
    const db = {
      prepare() {
        return {
          bind() {
            return {
              all: async () => ({
                results: [
                  {
                    id: "run-1",
                    agent_id: "agent-abc",
                    status: "ok",
                    latency_ms: 42,
                    input_tokens: 10,
                    output_tokens: 20,
                    estimated_cost: 0.01,
                    error: null,
                    iterations: 1,
                    tool_calls_json: '[{"name":"search"}]',
                    created_at: "2026-08-25T00:00:00.000Z",
                  },
                ],
              }),
            };
          },
        };
      },
    };
    const req = new Request("http://127.0.0.1:8787/rooms/room-1/agent-runs?limit=12");
    const res = await dispatchRoomsMutationsRoutes(
      req,
      new URL(req.url),
      buildDeps({
        db,
        verifyJwt: async () => ({ projectId: "p1", userId: "u1" }),
      }),
    );
    expect(res).not.toBeNull();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.runs).toEqual([
      expect.objectContaining({
        id: "run-1",
        agentId: "agent-abc",
        status: "ok",
        latencyMs: 42,
        inputTokens: 10,
        outputTokens: 20,
        toolCalls: [{ name: "search" }],
      }),
    ]);
  });

  it("GET /rooms/:id/agent-schedules returns 401 without JWT", async () => {
    const req = new Request("http://127.0.0.1:8787/rooms/room-1/agent-schedules");
    const res = await dispatchRoomsMutationsRoutes(req, new URL(req.url), buildDeps());
    expect(res.status).toBe(401);
  });

  it("GET /rooms/:id/agent-schedules proxies to the room DO", async () => {
    const fetch = async () =>
      new Response(JSON.stringify({ ok: true, schedules: [{ id: "asch_1", kind: "delay" }] }), {
        headers: { "content-type": "application/json" },
      });
    const deps = buildDeps({
      verifyJwt: async () => ({ projectId: "p1", userId: "u1" }),
    });
    deps.env.ROOM = {
      idFromName: (id) => id,
      get: () => ({ fetch }),
    };
    const req = new Request("http://127.0.0.1:8787/rooms/room-1/agent-schedules");
    const res = await dispatchRoomsMutationsRoutes(req, new URL(req.url), deps);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.schedules[0].id).toBe("asch_1");
  });

  it("GET /rooms/:id/pitr returns 401 without JWT", async () => {
    const req = new Request("http://127.0.0.1:8787/rooms/room-1/pitr");
    const res = await dispatchRoomsMutationsRoutes(req, new URL(req.url), buildDeps());
    expect(res.status).toBe(401);
  });

  it("GET /rooms/:id/pitr proxies to the room DO", async () => {
    const fetch = async () =>
      new Response(
        JSON.stringify({
          ok: true,
          pitrAvailable: true,
          retentionDays: 30,
          snapshots: [{ id: "pitr_1", bookmark: "bm-1" }],
        }),
        { headers: { "content-type": "application/json" } },
      );
    const deps = buildDeps({
      verifyJwt: async () => ({ projectId: "p1", userId: "u1", roles: ["member"] }),
    });
    deps.env.ROOM = {
      idFromName: (id) => id,
      get: () => ({ fetch }),
    };
    const req = new Request("http://127.0.0.1:8787/rooms/room-1/pitr");
    const res = await dispatchRoomsMutationsRoutes(req, new URL(req.url), deps);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.snapshots[0].id).toBe("pitr_1");
  });

  it("POST /rooms/:id/pitr is owner/admin only", async () => {
    const deps = buildDeps({
      verifyJwt: async () => ({ projectId: "p1", userId: "u1", roles: ["member"] }),
    });
    deps.hasAnyRole = (roles, allowed) => allowed.some((r) => roles.includes(r));
    const req = new Request("http://127.0.0.1:8787/rooms/room-1/pitr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "snapshot" }),
    });
    const res = await dispatchRoomsMutationsRoutes(req, new URL(req.url), deps);
    expect(res.status).toBe(403);
  });

  it("GET /rooms/:id/sealed returns 401 without JWT", async () => {
    const req = new Request("http://127.0.0.1:8787/rooms/room-1/sealed");
    const res = await dispatchRoomsMutationsRoutes(req, new URL(req.url), buildDeps());
    expect(res.status).toBe(401);
  });

  it("GET /rooms/:id/sealed proxies to the room DO", async () => {
    let fetchedUrl = "";
    const fetch = async (url) => {
      fetchedUrl = url;
      return new Response(
        JSON.stringify({
          ok: true,
          sealed: { reason: "boot_crash_loop", crashes: 2, sealedAt: "2026-10-16T00:00:00.000Z" },
        }),
        { headers: { "content-type": "application/json" } },
      );
    };
    const deps = buildDeps({
      verifyJwt: async () => ({ projectId: "p1", userId: "u1", roles: ["member"] }),
    });
    deps.env.ROOM = {
      idFromName: (id) => id,
      get: () => ({ fetch }),
    };
    const req = new Request("http://127.0.0.1:8787/rooms/room-1/sealed");
    const res = await dispatchRoomsMutationsRoutes(req, new URL(req.url), deps);
    expect(res.status).toBe(200);
    expect(fetchedUrl).toBe("https://internal/sealed");
    const body = await res.json();
    expect(body.sealed.reason).toBe("boot_crash_loop");
  });

  it("POST /rooms/:id/sealed is owner/admin only", async () => {
    const deps = buildDeps({
      verifyJwt: async () => ({ projectId: "p1", userId: "u1", roles: ["member"] }),
    });
    deps.hasAnyRole = (roles, allowed) => allowed.some((r) => roles.includes(r));
    const req = new Request("http://127.0.0.1:8787/rooms/room-1/sealed", { method: "POST" });
    const res = await dispatchRoomsMutationsRoutes(req, new URL(req.url), deps);
    expect(res.status).toBe(403);
  });

  it("POST /rooms/:id/sealed proxies unseal for owners", async () => {
    let fetchedMethod = "";
    const fetch = async (_url, init) => {
      fetchedMethod = init.method;
      return new Response(JSON.stringify({ ok: true, sealed: null }), {
        headers: { "content-type": "application/json" },
      });
    };
    const deps = buildDeps({
      verifyJwt: async () => ({ projectId: "p1", userId: "u1", roles: ["owner"] }),
    });
    deps.hasAnyRole = (roles, allowed) => allowed.some((r) => roles.includes(r));
    deps.env.ROOM = {
      idFromName: (id) => id,
      get: () => ({ fetch }),
    };
    const req = new Request("http://127.0.0.1:8787/rooms/room-1/sealed", { method: "POST" });
    const res = await dispatchRoomsMutationsRoutes(req, new URL(req.url), deps);
    expect(res.status).toBe(200);
    expect(fetchedMethod).toBe("POST");
    const body = await res.json();
    expect(body.sealed).toBeNull();
  });

  it("POST /rooms/:id/members stubs a missing D1 room instead of 404", async () => {
    const sqls = [];
    const db = {
      prepare(sql) {
        sqls.push(sql);
        return {
          bind() {
            return {
              first: async () => null,
              run: async () => ({ success: true }),
            };
          },
        };
      },
    };
    const req = new Request("http://127.0.0.1:8787/rooms/assistant-proj-1/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "u1", role: "member" }),
    });
    const res = await dispatchRoomsMutationsRoutes(
      req,
      new URL(req.url),
      buildDeps({
        db,
        verifyJwt: async () => ({
          projectId: "proj-1",
          userId: "admin",
          roles: ["admin"],
        }),
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(sqls.some((s) => s.includes("INSERT OR IGNORE INTO rooms"))).toBe(true);
    expect(sqls.some((s) => s.includes("INSERT OR IGNORE INTO room_members"))).toBe(true);
  });

  it("POST /rooms/:id/members stores moderator for the legacy mod alias", async () => {
    const binds = [];
    const db = {
      prepare(sql) {
        return {
          bind(...args) {
            binds.push({ sql, args });
            return {
              first: async () => ({ id: "room-1", project_id: "proj-1" }),
              run: async () => ({ success: true }),
            };
          },
        };
      },
    };
    const req = new Request("http://127.0.0.1:8787/rooms/room-1/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "u2", role: "mod" }),
    });
    const res = await dispatchRoomsMutationsRoutes(
      req,
      new URL(req.url),
      buildDeps({
        db,
        verifyJwt: async () => ({
          projectId: "proj-1",
          userId: "admin",
          roles: ["admin"],
        }),
      }),
    );
    expect(res.status).toBe(200);
    const memberInsert = binds.find((b) => b.sql.includes("INSERT OR IGNORE INTO room_members"));
    expect(memberInsert).toBeTruthy();
    expect(memberInsert.args[2]).toBe("moderator");
  });
});
