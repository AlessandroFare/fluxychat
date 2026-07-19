import { describe, it, expect } from "vitest";
import { createEdiscoveryManager } from "./ediscovery";

describe("ediscovery", () => {
  it("should create a legal hold", () => {
    const e = createEdiscoveryManager();
    const hold = e.createHold({ targetType: "user", targetId: "user-1", reason: "Lawsuit", requestedBy: "legal-officer", approvedBy: "admin", expiresAt: "2027-01-01" });
    expect(hold.holdId).toMatch(/^hold-/);
    expect(hold.status).toBe("active");
  });

  it("should list holds by target", () => {
    const e = createEdiscoveryManager();
    e.createHold({ targetType: "user", targetId: "user-1", reason: "Case A", requestedBy: "legal", approvedBy: "admin", expiresAt: "2027-01-01" });
    e.createHold({ targetType: "user", targetId: "user-2", reason: "Case B", requestedBy: "legal", approvedBy: "admin", expiresAt: "2027-01-01" });
    expect(e.listHolds("user-1")).toHaveLength(1);
  });

  it("should release a hold", () => {
    const e = createEdiscoveryManager();
    const hold = e.createHold({ targetType: "user", targetId: "u1", reason: "Test", requestedBy: "legal", approvedBy: "admin", expiresAt: "2027-01-01" });
    e.releaseHold(hold.holdId, "admin");
    expect(e.getHold(hold.holdId)?.status).toBe("released");
  });

  it("should request and complete an export", () => {
    const e = createEdiscoveryManager();
    const exp = e.requestExport({ scope: { rooms: ["room-1"], dateFrom: "2026-01-01", dateTo: "2026-06-01", includeAttachments: true }, format: "json", requestedBy: "admin" });
    expect(exp.status).toBe("pending");
    const completed = e.completeExport(exp.exportId, "https://storage.example.com/export.json");
    expect(completed.status).toBe("completed");
  });

  it("should produce audit log", () => {
    const e = createEdiscoveryManager();
    const hold = e.createHold({ targetType: "user", targetId: "u1", reason: "Test", requestedBy: "legal", approvedBy: "admin", expiresAt: "2027-01-01" });
    e.releaseHold(hold.holdId, "admin");
    const log = e.getAuditLog();
    expect(log.length).toBeGreaterThanOrEqual(2);
  });

  it("should throw for non-existent export", () => {
    const e = createEdiscoveryManager();
    expect(() => e.completeExport("no-such", "url")).toThrow();
  });
});
