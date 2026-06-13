import { describe, it, expect } from "vitest";
import {
  createCase, updateCase, getCase, listCases,
  addCustodian, listCustodians,
  preserveData, listPreservations,
  collectEvidence, listEvidence,
  getChainOfCustody, getCaseStats,
} from "./ediscovery.js";

function makeEnv() {
  const cases = [];
  const custodians = [];
  const preservations = [];
  const evidence = [];
  const coc = [];
  return {
    DB: {
      prepare: (sql) => ({
        bind: (...params) => ({
          first: async () => {
            if (sql.includes("ediscovery_cases")) {
              return cases.find((c) => c.id === params[0] && c.project_id === params[1]) || null;
            }
            return null;
          },
          all: async () => {
            if (sql.includes("GROUP BY status")) {
              const groups = {};
              for (const c of cases.filter((c) => c.project_id === params[0])) {
                groups[c.status] = (groups[c.status] || 0) + 1;
              }
              return { results: Object.entries(groups).map(([status, count]) => ({ status, count })) };
            }
            if (sql.includes("GROUP BY item_type")) {
              const groups = {};
              for (const e of evidence.filter((e) => e.project_id === params[0])) {
                groups[e.item_type] = (groups[e.item_type] || 0) + 1;
              }
              return { results: Object.entries(groups).map(([item_type, count]) => ({ item_type, count })) };
            }
            if (sql.includes("ediscovery_cases")) {
              let filtered = cases.filter((c) => c.project_id === params[0]);
              if (params[1]) filtered = filtered.filter((c) => c.status === params[1]);
              return { results: filtered };
            }
            if (sql.includes("ediscovery_custodians")) return { results: custodians.filter((c) => c.case_id === params[0]) };
            if (sql.includes("ediscovery_preservation")) return { results: preservations.filter((p) => p.case_id === params[0]) };
            if (sql.includes("ediscovery_evidence")) return { results: evidence.filter((e) => e.case_id === params[0]) };
            if (sql.includes("ediscovery_chain_of_custody")) return { results: coc.filter((c) => c.evidence_id === params[0]) };
            return { results: [] };
          },
          run: async () => {
            if (sql.includes("INSERT INTO ediscovery_cases")) {
              const exists = cases.find((c) => c.project_id === params[1] && c.case_number === params[2]);
              if (exists) throw new Error("UNIQUE constraint");
              cases.push({
                id: params[0], project_id: params[1], case_number: params[2], title: params[3],
                description: params[4], matter: params[5], status: "open", priority: params[6],
                assigned_to: params[7], created_by: params[8], opened_at: params[9], created_at: params[10], closed_at: null,
              });
            } else if (sql.includes("INSERT INTO ediscovery_custodians")) {
              custodians.push({ id: params[0], case_id: params[1], project_id: params[2], user_id: params[3], name: params[4], email: params[5], role: params[6], created_at: params[7] });
            } else if (sql.includes("INSERT INTO ediscovery_preservation")) {
              preservations.push({ id: params[0], case_id: params[1], project_id: params[2], room_id: params[3], user_id: params[4], data_types: params[5], reason: params[6], status: "active", expires_at: params[8], created_at: params[9] });
            } else if (sql.includes("INSERT INTO ediscovery_evidence")) {
              const exists = evidence.find((e) => e.case_id === params[1] && e.item_type === params[3] && e.item_id === params[4]);
              if (exists) throw new Error("UNIQUE constraint");
              evidence.push({ id: params[0], case_id: params[1], project_id: params[2], item_type: params[3], item_id: params[4], room_id: params[5], collected_by: params[6], collected_at: params[7], notes: params[8] });
            } else if (sql.includes("INSERT INTO ediscovery_chain_of_custody")) {
              coc.push({ id: params[0], evidence_id: params[1], case_id: params[2], action: params[3], performed_by: params[4], details: params[5], timestamp: params[6] });
            } else if (sql.includes("UPDATE ediscovery_cases")) {
              const idx = cases.findIndex((c) => c.id === params[params.length - 2] && c.project_id === params[params.length - 1]);
              if (idx >= 0) {
                if (sql.includes("status = ?")) cases[idx].status = params[0];
                if (sql.includes("closed_at = ?")) cases[idx].closed_at = params[1];
              }
              return { meta: { changes: idx >= 0 ? 1 : 0 } };
            }
            return { meta: { changes: 1 } };
          },
        }),
      }),
    },
    _cases: cases,
  };
}

describe("ediscovery", () => {
  describe("createCase", () => {
    it("creates a case", async () => {
      const env = makeEnv();
      const result = await createCase(env, { projectId: "p1", caseNumber: "2026-001", title: "Investigation", createdBy: "admin" });
      expect(result.created).toBe(true);
    });

    it("requires caseNumber, title, createdBy", async () => {
      const env = makeEnv();
      const result = await createCase(env, { projectId: "p1" });
      expect(result.error).toContain("required");
    });

    it("rejects duplicate case number", async () => {
      const env = makeEnv();
      await createCase(env, { projectId: "p1", caseNumber: "2026-001", title: "A", createdBy: "admin" });
      const result = await createCase(env, { projectId: "p1", caseNumber: "2026-001", title: "B", createdBy: "admin" });
      expect(result.error).toContain("already_exists");
    });

    it("validates priority", async () => {
      const env = makeEnv();
      const result = await createCase(env, { projectId: "p1", caseNumber: "x", title: "x", createdBy: "admin", priority: "urgent" });
      expect(result.error).toContain("priority");
    });
  });

  describe("addCustodian", () => {
    it("adds a custodian", async () => {
      const env = makeEnv();
      const result = await addCustodian(env, { caseId: "c1", projectId: "p1", userId: "u1", name: "John" });
      expect(result.created).toBe(true);
    });

    it("requires userId", async () => {
      const env = makeEnv();
      const result = await addCustodian(env, { caseId: "c1", projectId: "p1" });
      expect(result.error).toContain("userId");
    });
  });

  describe("preserveData", () => {
    it("creates a preservation order", async () => {
      const env = makeEnv();
      const result = await preserveData(env, { caseId: "c1", projectId: "p1", reason: "Litigation hold" });
      expect(result.created).toBe(true);
    });

    it("requires reason", async () => {
      const env = makeEnv();
      const result = await preserveData(env, { caseId: "c1", projectId: "p1" });
      expect(result.error).toContain("reason");
    });
  });

  describe("collectEvidence", () => {
    it("collects evidence and creates chain of custody", async () => {
      const env = makeEnv();
      const result = await collectEvidence(env, { caseId: "c1", projectId: "p1", itemType: "message", itemId: "m1", collectedBy: "admin" });
      expect(result.created).toBe(true);
      expect(env._cases).toHaveLength(0);
      const chain = await getChainOfCustody(env, { evidenceId: result.id });
      expect(chain.length).toBeGreaterThan(0);
    });

    it("validates itemType", async () => {
      const env = makeEnv();
      const result = await collectEvidence(env, { caseId: "c1", projectId: "p1", itemType: "invalid", itemId: "m1", collectedBy: "admin" });
      expect(result.error).toContain("itemType");
    });

    it("rejects duplicate evidence", async () => {
      const env = makeEnv();
      await collectEvidence(env, { caseId: "c1", projectId: "p1", itemType: "message", itemId: "m1", collectedBy: "admin" });
      const result = await collectEvidence(env, { caseId: "c1", projectId: "p1", itemType: "message", itemId: "m1", collectedBy: "admin" });
      expect(result.error).toContain("already_collected");
    });
  });

  describe("getCaseStats", () => {
    it("returns stats", async () => {
      const env = makeEnv();
      await createCase(env, { projectId: "p1", caseNumber: "2026-001", title: "A", createdBy: "admin" });
      await createCase(env, { projectId: "p1", caseNumber: "2026-002", title: "B", createdBy: "admin" });
      const stats = await getCaseStats(env, { projectId: "p1" });
      expect(stats.totalCases).toBe(2);
      expect(stats.byStatus.open).toBe(2);
    });
  });
});
