import { describe, expect, it } from "vitest";
import { dispatchDigestRoutes } from "./digest-http.js";

function createDb() {
  const prefs = new Map();
  return {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first() {
              if (sql.includes("FROM user_digest_preferences")) {
                return prefs.get(`${args[0]}:${args[1]}`) ?? null;
              }
              return null;
            },
            async run() {
              if (sql.includes("INSERT INTO user_digest_preferences")) {
                const key = `${args[0]}:${args[1]}`;
                prefs.set(key, {
                  project_id: args[0],
                  user_id: args[1],
                  enabled: args[2],
                  email: args[3],
                  email_enabled: args[4],
                  web_push_enabled: args[5],
                  in_app_enabled: args[6],
                  updated_at: args[7],
                });
              }
              return { meta: { changes: 1 } };
            },
            async all() {
              return { results: [] };
            },
          };
        },
      };
    },
  };
}

function buildDeps(overrides = {}) {
  const corsHeaders = { "access-control-allow-origin": "*" };
  return {
    h: {
      env: { DB: createDb(), ...(overrides.env || {}) },
      json: (data, init = {}) =>
        new Response(JSON.stringify(data), {
          status: init.status ?? 200,
          headers: { "content-type": "application/json", ...corsHeaders },
        }),
      corsHeaders,
      requestLogCtx: { traceId: "t" },
      verifyJwtAndGetContext:
        overrides.verifyJwt ??
        (async () => ({
          userId: "user_1",
          projectId: "proj_1",
          roles: overrides.roles ?? ["member"],
        })),
      logError: () => {},
      hasAnyRole: (_roles, allowed) =>
        (overrides.roles ?? ["member"]).some((r) => allowed.includes(r)),
    },
  };
}

describe("dispatchDigestRoutes", () => {
  it("returns null for unrelated paths", async () => {
    const { h } = buildDeps();
    const res = await dispatchDigestRoutes(
      new Request("http://x/health"),
      new URL("http://x/health"),
      h,
    );
    expect(res).toBeNull();
  });

  it("GET /digest/preferences returns defaults", async () => {
    const { h } = buildDeps();
    const req = new Request("http://x/digest/preferences", {
      headers: { Authorization: "Bearer jwt" },
    });
    const res = await dispatchDigestRoutes(req, new URL(req.url), h);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.preferences.enabled).toBe(false);
  });

  it("PATCH /digest/preferences stores opt-in", async () => {
    const { h } = buildDeps();
    const req = new Request("http://x/digest/preferences", {
      method: "PATCH",
      headers: {
        Authorization: "Bearer jwt",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        enabled: true,
        email: "user@example.com",
        emailEnabled: true,
      }),
    });
    const res = await dispatchDigestRoutes(req, new URL(req.url), h);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.preferences.enabled).toBe(true);
    expect(body.preferences.email).toBe("user@example.com");
  });

  it("POST /admin/digest/run requires admin role", async () => {
    const { h } = buildDeps({ roles: ["member"] });
    const req = new Request("http://x/admin/digest/run", {
      method: "POST",
      headers: {
        Authorization: "Bearer jwt",
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    const res = await dispatchDigestRoutes(req, new URL(req.url), h);
    expect(res.status).toBe(403);
  });
});
