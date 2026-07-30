import { describe, it, expect } from "vitest";
import { registerModel, runPreDeployEvaluation } from "./ai-governance-registry.js";

describe("ai-governance-registry", () => {
  it("rejects invalid risk tier", async () => {
    const result = await registerModel({ RATE_LIMIT_KV: null }, {
      projectId: "p1",
      modelId: "gpt-4",
      provider: "openai",
      riskTier: "extreme",
    });
    expect(result.error).toBe("invalid_risk_tier");
  });

  it("evaluates registered model", async () => {
    const kv = new Map();
    const env = {
      RATE_LIMIT_KV: {
        async get(k) { return kv.get(k) ?? null; },
        async put(k, v) { kv.set(k, v); },
      },
    };
    await registerModel(env, {
      projectId: "p1",
      modelId: "gpt-4o-mini",
      provider: "openai",
      riskTier: "low",
      approvedBy: "admin",
    });
    const result = await runPreDeployEvaluation(env, {
      projectId: "p1",
      targetId: "gpt-4o-mini",
      targetType: "model",
      approver: "admin",
    });
    expect(result.passed).toBe(true);
    expect(result.evaluation?.targetId).toBe("gpt-4o-mini");
  });
});
