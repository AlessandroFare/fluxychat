import { describe, expect, it } from "vitest";
import { auditGradeFromScore, recordMarketplaceAudit, getLatestMarketplaceAudit } from "./marketplace-audit.js";

function createDb() {
  const rows = [];
  return {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first() {
              if (sql.includes("ORDER BY scanned_at DESC")) {
                const serverId = args[0];
                const match = [...rows].reverse().find((r) => r.server_id === serverId);
                return match ?? null;
              }
              return null;
            },
            async run() {
              if (sql.includes("INSERT INTO marketplace_audits")) {
                rows.push({
                  server_id: args[0],
                  score: args[2],
                  findings_json: args[3],
                  severity_critical: args[4],
                  severity_high: args[5],
                  scanner_version: args[6],
                  scanner_name: args[7],
                  scanned_at: args[8],
                });
              }
              return { success: true };
            },
          };
        },
      };
    },
  };
}

describe("marketplace-audit", () => {
  it("maps score to grade", () => {
    expect(auditGradeFromScore(95)).toBe("A");
    expect(auditGradeFromScore(72)).toBe("C");
    expect(auditGradeFromScore(40)).toBe("F");
  });

  it("records and reads latest audit", async () => {
    const db = createDb();
    await recordMarketplaceAudit(db, {
      serverId: "github-mcp",
      score: 88,
      severityCritical: 0,
      scannerVersion: "0.1.0",
    });
    const latest = await getLatestMarketplaceAudit(db, "github-mcp");
    expect(latest?.grade).toBe("B");
    expect(latest?.severityCritical).toBe(0);
  });
});
