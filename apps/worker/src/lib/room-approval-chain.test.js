import { describe, expect, it } from "vitest";
import {
  parseApprovalChain,
  resolveApproverAtStep,
  snapshotApprovalChain,
} from "./room-approval-chain.js";

describe("room-approval-chain", () => {
  it("parses approver steps and fallback", () => {
    const parsed = parseApprovalChain({
      defaultTimeoutSeconds: 240,
      steps: [
        { approverId: "user_ana", timeoutSeconds: 240 },
        { approverId: "user_carlos", timeoutSeconds: 240 },
        { fallback: "notify_channel" },
      ],
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.chain.steps).toHaveLength(3);
      expect(parsed.chain.defaultTimeoutSeconds).toBe(240);
    }
  });

  it("rejects invalid approver id", () => {
    expect(parseApprovalChain({ steps: [{ approverId: "" }] }).ok).toBe(false);
  });

  it("snapshots chain immutably", () => {
    const chain = { steps: [{ approverId: "a" }], defaultTimeoutSeconds: 180 };
    const snap = snapshotApprovalChain(chain);
    chain.steps.push({ approverId: "b" });
    expect(snap.steps).toHaveLength(1);
  });

  it("resolves approver at step index", () => {
    const steps = [
      { approverId: "user_ana" },
      { fallback: "notify_channel" },
    ];
    expect(resolveApproverAtStep(steps, 0).approverId).toBe("user_ana");
    expect(resolveApproverAtStep(steps, 1).isFallback).toBe(true);
  });
});
