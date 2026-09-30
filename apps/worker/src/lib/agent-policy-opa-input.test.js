import { describe, expect, it } from "vitest";
import { buildAgentPolicyOpaInput, isSafeOpaUrl, evaluateAgentPolicyOpa } from "./agent-policy-opa-input.js";

describe("buildAgentPolicyOpaInput", () => {
  it("shapes the documented OPA input", () => {
    const input = buildAgentPolicyOpaInput({
      toolName: "transfer",
      arguments: { amount: 10 },
      roomId: "r1",
      requesterUserId: "u1",
      trust: "untrusted",
      estimatedCostUsd: 0.02,
    });
    expect(input.v).toBe(1);
    expect(input.tool).toBe("transfer");
    expect(input.room.id).toBe("r1");
    expect(input.requester.userId).toBe("u1");
    expect(input.trust).toBe("untrusted");
    expect(input.cost.estimatedUsd).toBe(0.02);
  });

  it("rejects localhost OPA URLs", () => {
    expect(isSafeOpaUrl("http://example.com/v1/data")).toBe(false);
    expect(isSafeOpaUrl("https://127.0.0.1/v1/data")).toBe(false);
    expect(isSafeOpaUrl("https://opa.example.com/v1/data")).toBe(true);
  });

  it("fail-closes when fetch fails", async () => {
    const result = await evaluateAgentPolicyOpa("https://opa.example.com/v1/data", { v: 1 }, async () => {
      throw new Error("net");
    });
    expect(result.allow).toBe(false);
    expect(result.error).toBe("opa_unreachable");
  });
});
