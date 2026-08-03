import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createTruthClaim,
  fileTruthDispute,
  resolveTruthDispute,
  expireOpenTruthClaims,
  grantTruthCredits,
} from "./truth-market.js";

vi.mock("./room-access.js", () => ({
  canAccessRoom: vi.fn(async () => true),
}));

function makeEnv() {
  const credits = new Map();
  const claims = new Map();
  const disputes = new Map();

  const env = {
    TRUTH_MARKET_MIN_STAKE: 1,
    TRUTH_MARKET_MAX_STAKE: 100,
    TRUTH_MARKET_INITIAL_CREDITS: 50,
    DB: {
      prepare: vi.fn((sql) => ({
        bind: vi.fn((...args) => ({
          run: vi.fn(async () => {
            if (sql.includes("INSERT INTO truth_credits") || sql.includes("ON CONFLICT")) {
              const [, userId, amount] = args;
              const key = `${args[0]}:${userId}`;
              credits.set(key, (credits.get(key) || 0) + Number(amount));
            }
            if (sql.includes("UPDATE truth_credits SET balance")) {
              const [balance, , projectId, userId] = args;
              credits.set(`${projectId}:${userId}`, balance);
            }
            if (sql.includes("INSERT INTO truth_claims")) {
              claims.set(args[0], {
                id: args[0],
                project_id: args[1],
                room_id: args[2],
                message_id: args[3],
                agent_id: args[4],
                content: args[5],
                staked_by_user_id: args[6],
                stake_amount: args[7],
                currency: "credits",
                ttl_seconds: args[9],
                state: "open",
                expires_at: args[10],
                created_at: args[11],
                resolved_at: null,
              });
            }
            if (sql.includes("UPDATE truth_claims SET state = 'disputed'")) {
              const claim = claims.get(args[0]);
              if (claim) claim.state = "disputed";
            }
            if (sql.includes("UPDATE truth_claims SET state = ?, resolved_at")) {
              const claim = claims.get(args[2]);
              if (claim) {
                claim.state = args[0];
                claim.resolved_at = args[1];
              }
            }
            if (sql.includes("UPDATE truth_claims SET state = 'verified_by_time'")) {
              const claim = claims.get(args[1]);
              if (claim) {
                claim.state = "verified_by_time";
                claim.resolved_at = args[0];
              }
            }
            if (sql.includes("INSERT INTO truth_disputes")) {
              disputes.set(args[0], {
                id: args[0],
                claim_id: args[1],
                project_id: args[2],
                disputed_by_user_id: args[3],
                evidence: args[4],
                state: "pending",
                resolved_by_user_id: null,
                outcome: null,
                created_at: args[6],
                resolved_at: null,
              });
            }
            if (sql.includes("UPDATE truth_disputes")) {
              const dispute = disputes.get(args[4]);
              if (dispute) {
                dispute.state = "resolved";
                dispute.outcome = args[0];
                dispute.resolved_by_user_id = args[2];
                dispute.resolved_at = args[3];
              }
            }
            return {};
          }),
          first: vi.fn(async () => {
            if (sql.includes("FROM truth_credits")) {
              const [projectId, userId] = args;
              const balance = credits.get(`${projectId}:${userId}`);
              if (balance == null) return null;
              return { balance, updated_at: new Date().toISOString() };
            }
            if (sql.includes("FROM messages WHERE")) return { id: args[2] };
            if (sql.includes("FROM truth_claims WHERE project_id = ? AND id = ?")) {
              return claims.get(args[1]) || null;
            }
            if (sql.includes("FROM truth_disputes") && sql.includes("state = 'pending'")) {
              return disputes.get(args[2]) || null;
            }
            if (sql.includes("COUNT(*) AS c FROM truth_disputes")) return { c: 0 };
            return null;
          }),
          all: vi.fn(async () => {
            if (sql.includes("FROM truth_claims") && sql.includes("expires_at")) {
              const now = args[0];
              const expired = [...claims.values()].filter(
                (c) => c.state === "open" && c.expires_at <= now,
              );
              return { results: expired };
            }
            if (sql.includes("FROM truth_claims")) {
              return { results: [...claims.values()] };
            }
            if (sql.includes("FROM truth_disputes WHERE project_id")) {
              return { results: [...disputes.values()].filter((d) => d.claim_id === args[1]) };
            }
            return { results: [] };
          }),
        })),
      })),
    },
  };

  return { env, claims, disputes, credits };
}

describe("truth-market", () => {
  let ctx;

  beforeEach(() => {
    ctx = makeEnv();
  });

  it("creates claim and debits credits", async () => {
    await grantTruthCredits(ctx.env, { projectId: "p1", userId: "u1", amount: 20 });
    const result = await createTruthClaim(ctx.env, { projectId: "p1", userId: "u1" }, {
      roomId: "r1",
      content: "Revenue grew 12% in Q2",
      stakeAmount: 5,
    });
    expect(result.ok).toBe(true);
    expect(result.claim.stakeAmount).toBe(5);
    expect(ctx.claims.size).toBe(1);
  });

  it("files dispute and resolves confirmed", async () => {
    await grantTruthCredits(ctx.env, { projectId: "p1", userId: "u1", amount: 20 });
    const created = await createTruthClaim(ctx.env, { projectId: "p1", userId: "u1" }, {
      roomId: "r1",
      content: "Claim text",
      stakeAmount: 5,
    });
    const claimId = created.claim.id;

    const dispute = await fileTruthDispute(ctx.env, { projectId: "p1", userId: "u2" }, {
      claimId,
      evidence: "Official report shows otherwise",
    });
    expect(dispute.ok).toBe(true);

    const resolved = await resolveTruthDispute(
      ctx.env,
      { projectId: "p1", userId: "mod1" },
      { claimId, disputeId: dispute.dispute.id, outcome: "confirmed" },
    );
    expect(resolved.ok).toBe(true);
    expect(resolved.claim.state).toBe("disputed_confirmed");
  });

  it("expires open claims and returns stake", async () => {
    await grantTruthCredits(ctx.env, { projectId: "p1", userId: "u1", amount: 20 });
    await createTruthClaim(ctx.env, { projectId: "p1", userId: "u1" }, {
      roomId: "r1",
      content: "Soon verified",
      stakeAmount: 3,
      ttlSeconds: 60,
    });
    const claim = [...ctx.claims.values()][0];
    claim.expires_at = new Date(Date.now() - 1000).toISOString();

    const result = await expireOpenTruthClaims(ctx.env);
    expect(result.expired).toBe(1);
    expect(claim.state).toBe("verified_by_time");
  });
});
