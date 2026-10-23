/**
 * Audit #28: secret API keys (fc_) are never persisted in plaintext — the
 * rotate endpoint must insert an opaque id and revoke prior fc_ rows by
 * key_prefix (legacy plaintext-id rows stay covered via the OR branch).
 */
import { describe, expect, it } from "vitest";
import { dispatchAdminProjectsRoutes } from "./admin-projects-http.js";

function createHarness() {
  const batches = [];
  const env = {
    DB: {
      prepare(sql) {
        return {
          bind(...args) {
            return {
              sql,
              args,
              first: async () => ({ id: "p_target" }),
              run: async () => ({ meta: {} }),
            };
          },
        };
      },
    },
  };
  env.DB.batch = async (stmts) => {
    batches.push(stmts.map((s) => ({ sql: s.sql, args: s.args })));
    return [];
  };
  const h = {
    env,
    ctx: { waitUntil: () => {} },
    traceId: "t1",
    corsHeaders: {},
    json: (body, init = {}) =>
      new Response(JSON.stringify(body), {
        status: init.status || 200,
        headers: { "content-type": "application/json" },
      }),
    requestLogCtx: {},
    verifyJwtAndGetContext: async () => ({
      projectId: "p1",
      userId: "u1",
      roles: ["owner"],
    }),
    hasAnyRole: (roles, allowed) => roles.some((r) => allowed.includes(r)),
    logError: () => {},
    requireAdminAuth: true,
    projectId: "p1",
    tenantScopeForbidden: () => null,
    writeAuditEvent: async () => {},
    hashApiKey: async (key) => `hash:${key}`,
    getProjectPlan: async () => null,
    getDefaultQuotaLimit: () => 0,
    listProjectsForAdmin: async () => [],
    insertNewProject: async () => ({}),
    canCreateTenantProjects: () => true,
    signJwtHs256: async () => "jwt",
    validateRoles: (r) => r,
    isValidId: () => true,
  };
  return { h, batches };
}

describe("admin api key rotation (#28)", () => {
  it("stores the secret key with an opaque id and revokes via key_prefix", async () => {
    const { h, batches } = createHarness();
    const url = new URL("https://x/admin/projects/p_target/keys/rotate");
    const res = await dispatchAdminProjectsRoutes(new Request(url, { method: "POST" }), url, h);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.key.apiKey.startsWith("fc_")).toBe(true);

    expect(batches).toHaveLength(1);
    const [update, insert] = batches[0];
    expect(update.sql).toContain("key_prefix LIKE 'fc_%'");
    expect(insert.sql).toContain("INSERT INTO api_keys");

    // Plaintext secret must never be written to the database.
    expect(insert.args[0]).not.toBe(body.key.apiKey);
    expect(String(insert.args[0]).startsWith("fc_")).toBe(false);
    expect(insert.args[2]).toBe(body.key.keyPrefix);
    expect(insert.args[3]).toBe(`hash:${body.key.apiKey}`);
  });
});
