import { describe, expect, it, vi } from "vitest";
import { dispatchPublicRoutes } from "./public-http.js";

vi.mock("../lib/llm-models-catalog.js", () => ({
  queryModelsCatalog: async () => ({ models: [] }),
  getModelById: async () => null,
  listModelProviders: async () => [],
  syncModelsCatalog: vi.fn(async () => ({ synced: 3 })),
}));

function deps(overrides = {}) {
  return {
    env: { ...(overrides.env || {}) },
    ctx: { waitUntil() {} },
    traceId: "trace-test",
    json: (body, init = {}) =>
      new Response(JSON.stringify(body), {
        status: init.status ?? 200,
        headers: { "Content-Type": "application/json" },
      }),
    corsHeaders: {},
    requestLogCtx: {},
    verifyJwtAndGetContext: overrides.verifyJwtAndGetContext ?? (async () => null),
    hasAnyRole: overrides.hasAnyRole ?? (() => false),
    logError: () => {},
    writeAuditEvent: async () => {},
    sanitizeString: (value) => value,
    validateFileUpload: () => ({ valid: true }),
    getFileExtension: () => "",
    resolveProjectId: async () => "proj-x",
    insertNewProject: async () => ({}),
    isValidId: (id) => /^[a-zA-Z0-9_-]{1,128}$/.test(id),
    validateRoles: () => ({ valid: true, roles: ["member"] }),
    timingSafeEqual: async (a, b) => a === b,
    signJwtHs256: async () => "jwt",
    maxRoomNameLength: 128,
    projectId: null,
    checkAndConsumeRateLimit: async () => ({ allowed: true }),
    canAccessRoom: async () => true,
    customDomain: null,
  };
}

const URL_SYNC = "https://worker.example/llm-models/sync";

function syncRequest(secret) {
  return new Request(URL_SYNC, {
    method: "POST",
    headers: secret ? { "X-Sync-Secret": secret } : {},
  });
}

describe("POST /llm-models/sync auth (A2-2)", () => {
  it("A2-2: rejects the dev fallback when PLATFORM_BOOTSTRAP_SECRET is unset", async () => {
    const h = deps();
    const res = await dispatchPublicRoutes(syncRequest("dev-sync-secret"), new URL(URL_SYNC), h);
    expect(res.status).toBe(403);
  });

  it("A2-2: accepts the configured secret and still 403s a wrong one", async () => {
    const h = deps({ env: { PLATFORM_BOOTSTRAP_SECRET: "prod-secret" } });
    expect((await dispatchPublicRoutes(syncRequest("prod-secret"), new URL(URL_SYNC), h)).status).toBe(200);
    expect((await dispatchPublicRoutes(syncRequest("dev-sync-secret"), new URL(URL_SYNC), h)).status).toBe(403);
  });

  it("A2-2: an owner/admin JWT still syncs without the secret", async () => {
    const h = deps({
      verifyJwtAndGetContext: async () => ({ projectId: "p1", userId: "u1", roles: ["owner"] }),
      hasAnyRole: (roles, allowed) => (roles || []).some((role) => allowed.includes(role)),
    });
    const res = await dispatchPublicRoutes(syncRequest(null), new URL(URL_SYNC), h);
    expect(res.status).toBe(200);
  });
});
