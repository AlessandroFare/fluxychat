import { describe, expect, it, vi } from "vitest";
import { dispatchHIPAARoutes } from "./hipaa-http.js";
import { completeTraining, reviewPHIDetection, updateBAA, updateBreach } from "../lib/hipaa-compliance.js";

vi.mock("../lib/admin-route-context.js", () => ({
  resolveAdminContext: async () => ({ env: {}, projectId: "proj_own" }),
}));
vi.mock("../lib/hipaa-compliance.js", () => ({
  createBAA: vi.fn(async () => ({})),
  updateBAA: vi.fn(async () => ({ updated: true })),
  listBAAs: vi.fn(async () => []),
  logPHIAccess: vi.fn(async () => ({})),
  listPHIAccessLogs: vi.fn(async () => []),
  logPHIDetection: vi.fn(async () => ({})),
  listPHIDetections: vi.fn(async () => []),
  reviewPHIDetection: vi.fn(async () => ({ reviewed: true })),
  createBreach: vi.fn(async () => ({})),
  updateBreach: vi.fn(async () => ({ updated: true })),
  listBreaches: vi.fn(async () => []),
  assignTraining: vi.fn(async () => ({})),
  completeTraining: vi.fn(async () => ({ completed: true })),
  listTrainings: vi.fn(async () => []),
  configureEncryption: vi.fn(async () => ({})),
  listEncryptionConfigs: vi.fn(async () => []),
  logAuditEvent: vi.fn(async () => ({})),
  listAuditLogs: vi.fn(async () => []),
  getHIPAADashboard: vi.fn(async () => ({})),
}));

function deps() {
  return {
    json: (body, init = {}) =>
      new Response(JSON.stringify(body), {
        status: init.status ?? 200,
        headers: { "Content-Type": "application/json" },
      }),
  };
}

function request(target, body, method = "POST") {
  return new Request(`https://worker.example${target}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
}

describe("hipaa-http update routes pin projectId (A2-5)", () => {
  it("A2-5: the body cannot override the authenticated project on updates", async () => {
    const cases = [
      ["/api/hipaa/baa/baa1", "PATCH", updateBAA],
      ["/api/hipaa/phi/detections/det1/review", "POST", reviewPHIDetection],
      ["/api/hipaa/breaches/br1", "PATCH", updateBreach],
      ["/api/hipaa/training/tr1/complete", "POST", completeTraining],
    ];
    for (const [path, method, handler] of cases) {
      const res = await dispatchHIPAARoutes(
        request(path, { projectId: "proj_victim", status: "active", actionTaken: "masked" }, method),
        new URL(`https://worker.example${path}`),
        deps(),
      );
      expect(res.status).toBe(200);
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][1].projectId).toBe("proj_own");
    }
  });
});
