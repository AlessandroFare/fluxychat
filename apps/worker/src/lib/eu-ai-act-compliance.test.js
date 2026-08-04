import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  assessEuAiActCompliance,
  resolveEuAiActRuntimePolicy,
  upsertAgentEuAiActProfile,
  upsertProjectEuAiActSettings,
} from "./eu-ai-act-compliance.js";

function createEnv(overrides = {}) {
  const settings = overrides.settings ?? null;
  const profiles = overrides.profiles ?? [];
  const bots = overrides.bots ?? [{ id: "bot_1", name: "Support Bot" }];

  const prepare = vi.fn((sql) => {
    const s = String(sql);
    return {
      bind: (...args) => ({
        first: async () => {
          if (s.includes("project_eu_ai_act_settings")) return settings;
          if (s.includes("agent_eu_ai_act_profiles") && s.includes("agent_id = ?")) {
            return profiles.find((p) => p.agent_id === args[1]) ?? null;
          }
          if (s.includes("FROM bots WHERE id")) {
            return bots.find((b) => b.id === args[0]) ?? null;
          }
          return null;
        },
        all: async () => {
          if (s.includes("agent_eu_ai_act_profiles") && s.includes("ORDER BY")) {
            return { results: profiles };
          }
          if (s.includes("FROM bots WHERE project_id")) {
            return { results: bots };
          }
          if (s.includes("eu_ai_act_audit_log")) return { results: [] };
          return { results: [] };
        },
        run: async () => ({ success: true }),
      }),
    };
  });

  return {
    DB: { prepare },
    RATE_LIMIT_KV: {
      get: async () => null,
      put: async () => {},
    },
  };
}

describe("eu-ai-act-compliance", () => {
  beforeEach(() => vi.clearAllMocks());

  it("blocks unacceptable risk agents", async () => {
    const env = createEnv({
      settings: {
        enabled: 1,
        block_unacceptable_risk: 1,
        enforce_hitl_high_risk: 1,
        enforce_ai_disclosure: 1,
        record_retention_days: 365,
        require_conformity_for_high_risk: 1,
      },
      profiles: [
        {
          id: "p1",
          agent_id: "bot_1",
          intended_purpose: "Banned use",
          eu_risk_category: "unacceptable",
          human_oversight_level: "human_in_loop",
          hitl_mode: "all_tools",
          requires_disclosure: 1,
          prohibited_use_confirmed: 1,
          conformity_assessed: 0,
          technical_doc_version: "1.0",
          updated_at: new Date().toISOString(),
        },
      ],
    });

    const policy = await resolveEuAiActRuntimePolicy(env, {
      projectId: "proj_1",
      agentId: "bot_1",
      agentName: "Bad Bot",
      tools: [],
      agentConfig: {},
    });

    expect(policy.blocked).toBe(true);
    expect(policy.error).toBe("eu_ai_act_unacceptable_risk");
  });

  it("requires conformity for high-risk agents", async () => {
    const env = createEnv({
      settings: {
        enabled: 1,
        block_unacceptable_risk: 1,
        enforce_hitl_high_risk: 1,
        enforce_ai_disclosure: 1,
        record_retention_days: 365,
        require_conformity_for_high_risk: 1,
      },
      profiles: [
        {
          id: "p1",
          agent_id: "bot_1",
          intended_purpose: "HR screening",
          eu_risk_category: "high",
          annex_iii_category: "employment",
          human_oversight_level: "human_in_loop",
          hitl_mode: "side_effect",
          requires_disclosure: 1,
          prohibited_use_confirmed: 1,
          conformity_assessed: 0,
          technical_doc_version: "1.0",
          updated_at: new Date().toISOString(),
        },
      ],
    });

    const policy = await resolveEuAiActRuntimePolicy(env, {
      projectId: "proj_1",
      agentId: "bot_1",
      agentName: "HR Bot",
      tools: [{ name: "postMessage" }],
      agentConfig: {},
    });

    expect(policy.blocked).toBe(true);
    expect(policy.error).toBe("eu_ai_act_conformity_required");
  });

  it("assessment flags missing provider identity", async () => {
    const env = createEnv({
      settings: {
        enabled: 1,
        enforce_ai_disclosure: 1,
        enforce_hitl_high_risk: 1,
        record_retention_days: 365,
        require_conformity_for_high_risk: 1,
        block_unacceptable_risk: 1,
      },
      profiles: [],
      bots: [],
    });

    const assessment = await assessEuAiActCompliance(env, "proj_1");
    expect(assessment.gaps.some((g) => g.id === "provider_identity")).toBe(true);
    expect(assessment.readyForProduction).toBe(false);
  });
});
