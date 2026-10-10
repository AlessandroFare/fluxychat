import { describe, expect, it } from "vitest";
import { createAuthMatrixDeps, unauthorizedRequest } from "./auth-matrix-deps.js";
import { dispatchAgentPlatformRoutes } from "./agent-platform-http.js";

const memberJwt = async () => ({
  userId: "u1",
  projectId: "p1",
  roles: ["member"],
});

function platformDb() {
  return {
    prepare(sql) {
      const text = String(sql);
      return {
        bind() {
          return {
            first: async () => {
              if (text.includes("FROM agent_platform_ab_tests")) {
                return {
                  id: "ab_1",
                  name: "Style",
                  description: "concise vs verbose",
                  metric: "satisfaction_score",
                  status: "running",
                  variants_json: JSON.stringify([
                    { id: "v_concise", name: "Concise", trafficPercent: 50, exposures: 1, conversions: 1 },
                    { id: "v_verbose", name: "Verbose", trafficPercent: 50, exposures: 0, conversions: 0 },
                  ]),
                  created_at: "2026-10-10T00:00:00.000Z",
                  updated_at: "2026-10-10T00:00:00.000Z",
                };
              }
              if (text.includes("FROM agent_platform_configs")) {
                return {
                  id: "agent_abc",
                  workspace_id: "default",
                  name: "Support",
                  status: "draft",
                  config_json: "{}",
                  created_at: "2026-10-10T00:00:00.000Z",
                  updated_at: "2026-10-10T00:00:00.000Z",
                };
              }
              return null;
            },
            all: async () => {
              if (text.includes("FROM agent_platform_versions")) {
                return {
                  results: [
                    {
                      id: "ver_1",
                      agent_id: "agent_abc",
                      version: "v1",
                      commit_hash: "deadbeef",
                      message: "first",
                      author: "u1",
                      parent_version: null,
                      created_at: "2026-10-10T00:00:00.000Z",
                    },
                  ],
                };
              }
              if (text.includes("FROM agent_platform_costs")) {
                return {
                  results: [
                    {
                      agent_id: "agent_abc",
                      entries: 2,
                      total_input_tokens: 900,
                      total_output_tokens: 400,
                      total_cost_cents: 7,
                    },
                  ],
                };
              }
              if (text.includes("FROM agent_platform_ab_tests")) {
                return {
                  results: [
                    {
                      id: "ab_1",
                      name: "Style",
                      description: "concise vs verbose",
                      metric: "satisfaction_score",
                      status: "running",
                      variants_json: JSON.stringify([
                        { id: "v_concise", name: "Concise", trafficPercent: 50, exposures: 2, conversions: 1 },
                        { id: "v_verbose", name: "Verbose", trafficPercent: 50, exposures: 2, conversions: 2 },
                      ]),
                      created_at: "2026-10-10T00:00:00.000Z",
                      updated_at: "2026-10-10T00:00:00.000Z",
                    },
                  ],
                };
              }
              if (text.includes("FROM agent_platform_deploys")) {
                return {
                  results: [
                    {
                      id: "dep_1",
                      agent_id: "agent_abc",
                      stage: "staging",
                      version: "v1",
                      deployed_by: "u1",
                      status: "active",
                      deployed_at: "2026-10-10T00:00:00.000Z",
                    },
                  ],
                };
              }
              return { results: [] };
            },
            run: async () => ({ success: true }),
          };
        },
      };
    },
  };
}

function deps() {
  const db = platformDb();
  return createAuthMatrixDeps({
    db,
    verifyJwt: memberJwt,
    extra: { env: { DB: db } },
  });
}

describe("agent platform HTTP", () => {
  it("GET versions without JWT is 401", async () => {
    const req = unauthorizedRequest("/agents/platform/agents/agent_abc/versions");
    const res = await dispatchAgentPlatformRoutes(req, new URL(req.url), createAuthMatrixDeps());
    expect(res.status).toBe(401);
  });

  it("GET /agents/platform/agents/:id/versions lists D1 rows", async () => {
    const req = unauthorizedRequest("/agents/platform/agents/agent_abc/versions");
    const res = await dispatchAgentPlatformRoutes(req, new URL(req.url), deps());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.versions[0].version).toBe("v1");
    expect(body.versions[0].commitHash).toBe("deadbeef");
  });

  it("GET /agents/platform/agents/:id/deploys lists D1 rows", async () => {
    const req = unauthorizedRequest("/agents/platform/agents/agent_abc/deploys");
    const res = await dispatchAgentPlatformRoutes(req, new URL(req.url), deps());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deploys[0].stage).toBe("staging");
    expect(body.deploys[0].status).toBe("active");
  });

  it("GET /agents/platform/costs sums D1 rows", async () => {
    const req = unauthorizedRequest("/agents/platform/costs");
    const res = await dispatchAgentPlatformRoutes(req, new URL(req.url), deps());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.summaries[0].agentId).toBe("agent_abc");
    expect(body.summaries[0].totalCostCents).toBe(7);
    expect(body.summaries[0].avgCostPerRequest).toBe(3.5);
  });

  it("POST /agents/platform/agents/:id/costs records a row", async () => {
    const req = unauthorizedRequest("/agents/platform/agents/agent_abc/costs", {
      method: "POST",
      body: { inputTokens: 100, outputTokens: 20, model: "gpt-4o-mini", costCents: 1 },
    });
    const res = await dispatchAgentPlatformRoutes(req, new URL(req.url), deps());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.entry.costCents).toBe(1);
  });

  it("GET /agents/platform/ab-tests lists D1 rows", async () => {
    const req = unauthorizedRequest("/agents/platform/ab-tests");
    const res = await dispatchAgentPlatformRoutes(req, new URL(req.url), deps());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tests[0].id).toBe("ab_1");
    expect(body.tests[0].results).toHaveLength(2);
  });

  it("POST /agents/platform/ab-tests/:id/run bumps a variant", async () => {
    const req = unauthorizedRequest("/agents/platform/ab-tests/ab_1/run", { method: "POST", body: {} });
    const res = await dispatchAgentPlatformRoutes(req, new URL(req.url), deps());
    expect(res.status).toBe(200);
    const body = await res.json();
    const totalExposures = body.test.results.reduce((s, r) => s + r.exposures, 0);
    expect(totalExposures).toBe(2);
  });
});
