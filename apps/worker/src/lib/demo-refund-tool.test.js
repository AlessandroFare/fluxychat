import { describe, expect, it } from "vitest";
import { executeDemoRefundOrder, mergeRefundOrderAgentFields } from "./demo-refund-tool.js";

describe("demo-refund-tool", () => {
  it("rejects invalid input and records a simulated refund", () => {
    expect(executeDemoRefundOrder({}).success).toBe(false);
    expect(executeDemoRefundOrder({ orderId: "1042", amountEur: 240 }).result.simulated).toBe(true);
  });

  it("always gates refund_order even without a prior gate", async () => {
    const { withRefundOrderGate } = await import("./demo-refund-tool.js");
    const gate = withRefundOrderGate(null);
    expect(await gate.needsApproval("refund_order", {})).toBe(true);
    expect(await gate.needsApproval("search", {})).toBe(false);
  });

  it("merges refund_order onto agent config and tools", () => {
    const { config, toolsSchema } = mergeRefundOrderAgentFields("{}", "[]");
    expect(config.approvalGate.alwaysRequire).toContain("refund_order");
    expect(toolsSchema.some((row) => row.function.name === "refund_order")).toBe(true);
  });
});
