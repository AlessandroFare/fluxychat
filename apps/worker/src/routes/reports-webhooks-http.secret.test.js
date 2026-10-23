import { describe, expect, it } from "vitest";
import { dispatchReportsWebhooksRoutes } from "./reports-webhooks-http.js";

function buildH() {
  return {
    env: { NODE_ENV: "test", ALLOWED_SSRF_HOSTS: "example.com" },
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
    logInfo: () => {},
    projectId: null,
    checkAndConsumeRateLimit: async () => ({ allowed: true, retryAfterSeconds: 0 }),
    deliverWebhooks: async () => {},
    hashWebhookSecret: async (secret) => `hash_${secret}`,
    signWebhookPayload: async () => "sig",
    timingSafeEqual: async (a, b) => a === b,
    canCreateTenantProjects: () => false,
    tenantScopeForbidden: () => null,
    writeAuditEvent: async () => {},
  };
}

describe("POST /webhooks secretSet (A2-26)", () => {
  it("A2-26: secretSet is false when no secret was supplied", async () => {
    const h = buildH();
    h.env.DB = {
      prepare: () => ({ bind: () => ({ run: async () => ({ meta: { changes: 1 } }) }) }),
    };
    const req = new Request("https://worker.example/webhooks/register", {
      method: "POST",
      headers: { Authorization: "Bearer jwt", "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com/hook", eventTypes: ["message.created"] }),
    });
    const res = await dispatchReportsWebhooksRoutes(req, new URL(req.url), h);
    expect(res.status).toBe(200);
    expect((await res.json()).webhook.secretSet).toBe(false);
  });
});
