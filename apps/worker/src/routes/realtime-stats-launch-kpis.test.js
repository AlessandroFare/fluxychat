/**
 * GET /stats/launch-kpis — the funnel number the founder reads weekly.
 * Authz + activation/retention/conversion math on a mocked D1.
 */
import { describe, expect, it } from "vitest";
import { dispatchRealtimeStatsRoutes } from "./realtime-stats-http.js";

const ROWS = [
  { id: "proj-kpi" }, // projects
  { c: 2 }, // api_keys
  { project_id: "proj-kpi" }, // project_secrets
  { c: 3 }, // rooms
  { c: 60 }, // messages total
  { c: 5 }, // agent_runs total
  { c: 4 }, // active days, last 7
  { c: 1 }, // active days, previous 7
  { c: 42 }, // messages this month
  { c: 3 }, // agent invokes this month
  { c: 120 }, // messages last 7 days
];

function buildDeps({
  auth = { userId: "u1", projectId: "proj-kpi", roles: ["admin"] },
  env = {},
} = {}) {
  let call = 0;
  return {
    env: {
      NODE_ENV: "test",
      DB: {
        prepare() {
          const row = ROWS[call++];
          const stmt = {
            async first() {
              return row ?? null;
            },
            async all() {
              return { results: [] };
            },
            async run() {
              return {};
            },
            bind() {
              return stmt;
            },
          };
          return stmt;
        },
        async batch() {
          return [];
        },
      },
      ...env,
    },
    corsHeaders: {},
    json(body, init = {}) {
      return new Response(JSON.stringify(body), {
        status: init.status ?? 200,
        headers: { "Content-Type": "application/json" },
      });
    },
    requestLogCtx: {},
    verifyJwtAndGetContext: async () => auth,
    hasAnyRole: (roles, allowed) => (roles || []).some((r) => allowed.includes(r)),
    logError: () => {},
    projectId: "default",
    isRoomMember: async () => true,
    canAccessRoom: async () => true,
    attachAttachmentsToMessages: (messages) => messages,
    getProjectPlan: async () => null,
    getDefaultQuotaLimit: () => 200000,
    monthKeyUtc: () => "2026-10",
    toMinuteBucketIso: () => "2026-10-15T00:00:00.000Z",
    evaluateOperationalAlerts: async () => [],
    canCreateTenantProjects: () => true,
    tenantScopeForbidden: () => false,
    writeAuditEvent: async () => {},
  };
}

async function callKpis(deps) {
  const request = new Request("https://api.example.com/stats/launch-kpis");
  const response = await dispatchRealtimeStatsRoutes(request, new URL(request.url), deps);
  expect(response).not.toBeNull();
  return response;
}

describe("GET /stats/launch-kpis", () => {
  it("401s without auth", async () => {
    const response = await callKpis(buildDeps({ auth: null }));
    expect(response.status).toBe(401);
  });

  it("403s without an operator role", async () => {
    const deps = buildDeps({
      auth: { userId: "u1", projectId: "proj-kpi", roles: ["member"] },
    });
    const response = await callKpis(deps);
    expect(response.status).toBe(403);
  });

  it("returns activation, retention and conversion for an admin", async () => {
    const response = await callKpis(buildDeps());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.projectId).toBe("proj-kpi");
    expect(body.activation).toMatchObject({
      completedOnboardingSteps: 6,
      totalOnboardingSteps: 6,
      activationRate: 1,
      messagesLast7: 120,
      activeThreshold: 100,
      activeProject: true,
      checks: {
        projectCreated: true,
        apiKeyActive: true,
        jwtSecretConfigured: true,
        firstRoomCreated: true,
        firstMessageSent: true,
        firstAgentInvoke: true,
      },
    });
    expect(body.retention).toEqual({
      activeDaysLast7: 4,
      activeDaysPrev7: 1,
      retainedDevelopers: 1,
      trend: 3,
    });
    expect(body.conversion.monthlyMessages).toBe(42);
    expect(body.conversion.monthlyAgentInvokes).toBe(3);
    expect(body.conversion.freeMessagesQuota).toBe(200000);
    // Free-tier usage is not a paid conversion, whatever the estimated revenue is.
    expect(body.conversion.convertedToPaid).toBe(false);
  });

  it("honors ACTIVE_PROJECT_MESSAGES_7D", async () => {
    const deps = buildDeps({ env: { ACTIVE_PROJECT_MESSAGES_7D: "1000" } });
    const body = await (await callKpis(deps)).json();
    expect(body.activation.activeThreshold).toBe(1000);
    expect(body.activation.activeProject).toBe(false);
  });
});
