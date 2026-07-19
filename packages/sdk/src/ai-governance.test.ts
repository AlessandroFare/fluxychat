import { describe, it, expect } from "vitest";
import { createAiGovernance } from "./ai-governance";

describe("ai-governance", () => {
  it("should register a model", () => {
    const g = createAiGovernance();
    const model = g.registerModel({ modelId: "gpt-4", provider: "openai", version: "1.0", riskTier: "medium", allowedUseCases: ["chat"], approvedBy: "admin" });
    expect(model.modelId).toBe("gpt-4");
    expect(model.approvedAt).toBeTruthy();
  });

  it("should register a prompt with auto-approval for low risk", () => {
    const g = createAiGovernance();
    const prompt = g.registerPrompt({ promptId: "p1", template: "Hello {{name}}", riskTier: "low", allowedModels: ["gpt-4"], requiredApprovals: [] });
    expect(prompt.status).toBe("approved");
  });

  it("should register a prompt as pending for high risk", () => {
    const g = createAiGovernance();
    const prompt = g.registerPrompt({ promptId: "p2", template: "Sensitive data", riskTier: "high", allowedModels: ["gpt-4"], requiredApprovals: ["compliance"] });
    expect(prompt.status).toBe("pending");
  });

  it("should register a tool", () => {
    const g = createAiGovernance();
    g.registerTool({ toolId: "t1", name: "delete-user", riskTier: "high", allowedRoles: ["admin"], requiresApproval: true, rateLimit: 10 });
    expect(g.listTools()).toHaveLength(1);
  });

  it("should list models filtered by risk tier", () => {
    const g = createAiGovernance();
    g.registerModel({ modelId: "m1", provider: "openai", version: "1", riskTier: "low", allowedUseCases: ["chat"], approvedBy: "admin" });
    g.registerModel({ modelId: "m2", provider: "anthropic", version: "1", riskTier: "high", allowedUseCases: ["chat"], approvedBy: "admin" });
    expect(g.listModels("low")).toHaveLength(1);
    expect(g.listModels("high")).toHaveLength(1);
  });

  it("should throw for missing model on approve", () => {
    const g = createAiGovernance();
    expect(() => g.approveModel("no-such-model", "admin")).toThrow();
  });
});
