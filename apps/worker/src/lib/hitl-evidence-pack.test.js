import { describe, expect, it } from "vitest";
import { buildHitlEvidencePack } from "./hitl-evidence-pack.js";

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
    expect(pack.v).toBe(1);
    expect(pack.kind).toBe("fluxy.hitl.evidence");
    expect(pack.approvalId).toBe("apr_1");
    expect(pack.toolInput).toEqual({ path: "/tmp" });
    expect(pack.status).toBe("approved");
  });
});
