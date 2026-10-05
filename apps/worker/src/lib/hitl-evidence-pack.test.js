import { describe, expect, it } from "vitest";
import { buildHitlEvidencePack, sealHitlEvidencePack } from "./hitl-evidence-pack.js";

describe("buildHitlEvidencePack", () => {
  it("copies decision fields without inventing a verdict", () => {
    const pack = buildHitlEvidencePack({
      id: "apr_1",
      projectId: "p1",
      roomId: "r1",
      toolName: "deleteFile",
      toolInput: { path: "/tmp" },
      status: "approved",
      decidedBy: "u2",
      note: "ok",
    });
    expect(pack.v).toBe(2);
    expect(pack.kind).toBe("fluxy.hitl.evidence");
    expect(pack.approvalId).toBe("apr_1");
    expect(pack.toolInput).toEqual({ path: "/tmp" });
    expect(pack.status).toBe("approved");
  });

  it("seals a SHA-256 over the v2 pack including maker-checker chain", async () => {
    const sealed = await sealHitlEvidencePack({
      id: "apr_2",
      projectId: "p1",
      roomId: "treasury",
      toolName: "wire",
      status: "pending",
      approvalChainSnapshot: { makerChecker: true, steps: [{ approverId: "checker" }] },
    });
    expect(sealed.eventHash).toMatch(/^[a-f0-9]{64}$/);
    expect(sealed.chain.makerChecker).toBe(true);
    const again = await sealHitlEvidencePack({
      id: "apr_2",
      projectId: "p1",
      roomId: "treasury",
      toolName: "wire",
      status: "pending",
      approvalChainSnapshot: { makerChecker: true, steps: [{ approverId: "checker" }] },
    });
    expect(again.eventHash).toBe(sealed.eventHash);
  });
});
