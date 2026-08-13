import { describe, expect, it } from "vitest";
import { SOC2_READINESS_CHECKLIST, buildSoc2SelfAssessment } from "./soc2-readiness-checklist.js";

function mockEnv() {
  const controls = [{ id: "c1", status: "implemented", project_id: "p1" }];
  const evidence = [{ id: "e1", project_id: "p1" }];
  const policies = [{ id: "pol1", status: "active", project_id: "p1" }];
  return {
    DB: {
      prepare(sql) {
        return {
          bind(...args) {
            return {
              all: async () => {
                if (sql.includes("soc2_controls") && sql.includes("GROUP BY status")) {
                  return { results: [{ status: "implemented", count: 1 }] };
                }
                if (sql.includes("soc2_controls WHERE")) {
                  return { results: controls };
                }
                if (sql.includes("soc2_evidence")) {
                  return { results: evidence };
                }
                if (sql.includes("soc2_policies") && sql.includes("GROUP BY")) {
                  return { results: [{ status: "active", count: 1 }] };
                }
                if (sql.includes("soc2_policies WHERE")) {
                  return { results: policies };
                }
                if (sql.includes("soc2_incidents")) {
                  return { results: [] };
                }
                if (sql.includes("soc2_risk_assessments")) {
                  return { results: [] };
                }
                return { results: [] };
              },
              first: async () => null,
              run: async () => ({ meta: { changes: 1 } }),
            };
          },
        };
      },
    },
  };
}

describe("soc2-readiness-checklist", () => {
  it("includes TSC categories", () => {
    expect(SOC2_READINESS_CHECKLIST.length).toBeGreaterThan(10);
    const categories = new Set(SOC2_READINESS_CHECKLIST.map((c) => c.category));
    expect(categories.has("security")).toBe(true);
    expect(categories.has("privacy")).toBe(true);
  });

  it("builds self-assessment export", async () => {
    const result = await buildSoc2SelfAssessment(mockEnv(), "p1");
    expect(result.projectId).toBe("p1");
    expect(result.checklist.length).toBe(SOC2_READINESS_CHECKLIST.length);
    expect(result.summary.readinessScore).toBeGreaterThan(0);
    expect(result.disclaimer).toContain("not a SOC 2");
  });
});
