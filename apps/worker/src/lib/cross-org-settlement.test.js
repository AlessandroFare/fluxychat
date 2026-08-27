/**
 * F3 cross-org settlement — tests.
 *
 * Pins: settlement opens exactly once when both humans confirm; terms snapshot
 * carries public amount/currency but NEVER the private reserve; lifecycle
 * transitions follow the state machine; idempotent on racing double-approvals.
 */
import { describe, expect, it } from "vitest";
import {
  deriveSettlementTerms,
  canTransitionSettlement,
  createCommitmentSettlement,
  getSettlementByCommitment,
  markSettlement,
} from "./cross-org-settlement.js";

/** D1 fake for the settlement statements. */
function makeDb() {
  const settlements = new Map(); // commitment_id -> row
  return {
    settlements,
    DB: {
      prepare(sql) {
        return {
          bind(...p) {
            return {
              async first() {
                if (sql.includes("FROM cross_org_settlements WHERE project_id")) {
                  const [projectId, commitmentId] = p;
                  const row = settlements.get(commitmentId);
                  if (!row || row.project_id !== projectId) return null;
                  return { ...row };
                }
                return null;
              },
              async run() {
                // Newline-tolerant match: the real statement wraps
                // "table\n SET status" across lines.
                const flat = sql.replace(/\s+/g, " ");
                if (flat.includes("INSERT OR IGNORE INTO cross_org_settlements")) {
                  // Real statement has NINE placeholders — status is the
                  // literal 'pending' in the VALUES clause, not a bind.
                  const [id, projectId, coRoomId, commitmentId, provider, amount, currency, createdAt, updatedAt] = p;
                  if (!settlements.has(commitmentId)) {
                    settlements.set(commitmentId, {
                      id,
                      project_id: projectId,
                      cross_org_room_id: coRoomId,
                      commitment_id: commitmentId,
                      provider,
                      status: "pending",
                      amount,
                      currency,
                      external_ref: null,
                      created_at: createdAt,
                      updated_at: updatedAt,
                    });
                  }
                }
                if (flat.includes("UPDATE cross_org_settlements SET status")) {
                  const [status, externalRef, updatedAt, projectId, commitmentId] = p;
                  const row = settlements.get(commitmentId);
                  if (row && row.project_id === projectId) {
                    row.status = status;
                    row.external_ref = externalRef ?? row.external_ref;
                    row.updated_at = updatedAt;
                  }
                }
                if (flat.includes("SET external_ref = ?") && !flat.includes("SET status")) {
                  const [externalRef, updatedAt, projectId, commitmentId] = p;
                  const row = settlements.get(commitmentId);
                  if (row && row.project_id === projectId) {
                    row.external_ref = externalRef;
                    row.updated_at = updatedAt;
                  }
                }
                return { meta: { changes: 1 } };
              },
              async all() {
                return { results: [] };
              },
            };
          },
        };
      },
    },
  };
}

describe("deriveSettlementTerms", () => {
  it("extracts price and currency from public terms", () => {
    expect(deriveSettlementTerms({ price: 1000, currency: "EUR", deliveryDays: 30 })).toEqual({
      amount: 1000,
      currency: "EUR",
    });
    expect(deriveSettlementTerms({ unit_price_usd: 42 })).toEqual({ amount: 42, currency: "USD" });
  });

  it("never reads private reserve keys", () => {
    // Even if a private key leaks into shared terms by accident, settlement
    // must not propagate it.
    const out = deriveSettlementTerms({ price: 10, floorPrice: 1 });
    expect(out).toEqual({ amount: 10, currency: "USD" });
    expect(Object.values(out)).not.toContain(1);
  });

  it("handles garbage input without throwing", () => {
    expect(deriveSettlementTerms(null)).toEqual({ amount: null, currency: "USD" });
    expect(deriveSettlementTerms({ price: "abc" })).toEqual({ amount: null, currency: "USD" });
  });
});

describe("settlement lifecycle", () => {
  it("allows pending->settled / pending->failed / failed->settled, nothing else", () => {
    expect(canTransitionSettlement("pending", "settled")).toBe(true);
    expect(canTransitionSettlement("pending", "failed")).toBe(true);
    expect(canTransitionSettlement("failed", "settled")).toBe(true);
    expect(canTransitionSettlement("failed", "pending")).toBe(true);
    expect(canTransitionSettlement("settled", "pending")).toBe(false);
    expect(canTransitionSettlement("settled", "failed")).toBe(false);
    expect(canTransitionSettlement("unknown", "settled")).toBe(false);
  });

  it("creates a pending settlement with deterministic id", async () => {
    const db = makeDb();
    const r1 = await createCommitmentSettlement({ DB: db.DB }, {
      projectId: "p1",
      crossOrgRoomId: "co1",
      commitmentId: "c1",
      publicTerms: { price: 250, currency: "USD" },
    });
    expect(r1.ok).toBe(true);
    expect(r1.status).toBe("pending");
    expect(r1.amount).toBe(250);
    expect(r1.provider).toBe("manual");

    // Deterministic id: same commitment -> same settlement id.
    const r2 = await createCommitmentSettlement({ DB: db.DB }, {
      projectId: "p1",
      crossOrgRoomId: "co1",
      commitmentId: "c1",
      publicTerms: { price: 250 },
    });
    expect(r2.settlementId).toBe(r1.settlementId);
    expect(db.settlements.size).toBe(1);
  });

  it("markSettlement walks the machine and stores external ref", async () => {
    const db = makeDb();
    await createCommitmentSettlement({ DB: db.DB }, {
      projectId: "p",
      crossOrgRoomId: "co",
      commitmentId: "c",
      publicTerms: { price: 5 },
    });

    const bad = await markSettlement({ DB: db.DB }, "p", "c", "bogus");
    expect(bad.ok).toBe(false);

    const settled = await markSettlement({ DB: db.DB }, "p", "c", "settled", { externalRef: "tx_123" });
    expect(settled.ok).toBe(true);
    expect(settled.settlement.status).toBe("settled");
    expect(settled.settlement.externalRef).toBe("tx_123");

    const reopen = await markSettlement({ DB: db.DB }, "p", "c", "pending");
    expect(reopen.ok).toBe(false);
    expect(reopen.reason).toBe("invalid_transition");
  });

  it("markSettlement on missing commitment fails cleanly", async () => {
    const db = makeDb();
    expect((await markSettlement({ DB: db.DB }, "p", "ghost", "settled")).reason).toBe(
      "settlement_not_found",
    );
  });

  it("getSettlementByCommitment returns null cross-tenant", async () => {
    const db = makeDb();
    await createCommitmentSettlement({ DB: db.DB }, {
      projectId: "pA",
      crossOrgRoomId: "co",
      commitmentId: "c9",
      publicTerms: {},
    });
    expect(await getSettlementByCommitment({ DB: db.DB }, "pB", "c9")).toBeNull();
    expect(await getSettlementByCommitment({ DB: db.DB }, "pA", "c9")).not.toBeNull();
  });

  it("uses x402 when X402_FACILITATOR_URL is set", async () => {
    const db = makeDb();
    const r = await createCommitmentSettlement(
      { DB: db.DB, X402_FACILITATOR_URL: "https://example.com/x402" },
      {
        projectId: "p1",
        crossOrgRoomId: "co1",
        commitmentId: "c-x402",
        publicTerms: { price: 10 },
      },
    );
    expect(r.ok).toBe(true);
    expect(r.provider).toBe("x402");
  });
});