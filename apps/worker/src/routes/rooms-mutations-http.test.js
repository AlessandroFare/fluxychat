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
});
