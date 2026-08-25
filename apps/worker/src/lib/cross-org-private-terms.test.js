/**
 * Cross-org negotiation confidentiality.
 *
 * A negotiation floor (the price a party will not go below) is the most
 * sensitive value in the whole exchange: disclosing it to the counterparty
 * destroys the party's position. `lib/cross-org-rooms.js` documents these keys as
 * private, but they used to travel inside the shared `terms_json`, which is
 * readable by both organisations in the room and echoed into the shared audit
 * log. These tests pin the boundary.
 */
import { describe, expect, it, vi } from "vitest";
import {
  PRIVATE_TERM_KEYS,
  splitCommitmentTerms,
  redactPrivateTerms,
  mapCommitmentRow,
  mapCommitmentRowInternal,
  assertNegotiationFloorPrice,
} from "./cross-org-rooms.js";

function commitmentRow(overrides = {}) {
  return {
    id: "c1",
    cross_org_room_id: "co1",
    project_id: "proj",
    room_id: "room1",
    proposed_by_org: "org-a",
    proposed_by_agent: "agent-a",
    terms_json: '{"price":100}',
    private_terms_json: null,
    private_terms_org: null,
    state: "proposed",
    round_number: 1,
    ttl_seconds: 3600,
    expires_at: null,
    human_a_confirmed_at: null,
    human_b_confirmed_at: null,
    parent_commitment_id: null,
    created_at: "2026-08-01T00:00:00Z",
    updated_at: "2026-08-01T00:00:00Z",
    ...overrides,
  };
}

describe("splitCommitmentTerms", () => {
  it("separates every documented private reserve key", () => {
    const terms = { price: 100 };
    for (const key of PRIVATE_TERM_KEYS) terms[key] = 1;

    const { publicTerms, privateTerms } = splitCommitmentTerms(terms);

    expect(publicTerms).toEqual({ price: 100 });
    expect(Object.keys(privateTerms).sort()).toEqual([...PRIVATE_TERM_KEYS].sort());
  });

  it("returns empty objects for non-object input", () => {
    expect(splitCommitmentTerms(null)).toEqual({ publicTerms: {}, privateTerms: {} });
    expect(splitCommitmentTerms("nope")).toEqual({ publicTerms: {}, privateTerms: {} });
  });

  it("keeps unrelated commercial terms public", () => {
    const { publicTerms, privateTerms } = splitCommitmentTerms({
      price: 100,
      currency: "USD",
      deliveryDays: 30,
      floorPrice: 90,
    });
    expect(publicTerms).toEqual({ price: 100, currency: "USD", deliveryDays: 30 });
    expect(privateTerms).toEqual({ floorPrice: 90 });
  });
});

describe("mapCommitmentRow", () => {
  it("never exposes a reserve price stored in the shared terms blob", () => {
    // Simulates a row written before the private column existed.
    const row = commitmentRow({ terms_json: '{"price":100,"floorPrice":90}' });

    const mapped = mapCommitmentRow(row);

    expect(mapped?.terms).toEqual({ price: 100 });
    expect(mapped?.terms).not.toHaveProperty("floorPrice");
    expect(mapped).not.toHaveProperty("privateTerms");
  });

  it("redacts every private key variant, including snake_case aliases", () => {
    const leaky = {};
    for (const key of PRIVATE_TERM_KEYS) leaky[key] = 42;
    leaky.price = 100;
    const mapped = mapCommitmentRow(commitmentRow({ terms_json: JSON.stringify(leaky) }));

    expect(mapped?.terms).toEqual({ price: 100 });
  });

  it("withholds private terms from the counterparty", () => {
    const row = commitmentRow({
      private_terms_json: '{"floorPrice":90}',
      private_terms_org: "org-a",
    });

    const asCounterparty = mapCommitmentRow(row, { forOrgId: "org-b" });

    expect(asCounterparty).not.toHaveProperty("privateTerms");
    expect(asCounterparty?.terms).toEqual({ price: 100 });
  });

  it("returns private terms to the org that owns them", () => {
    const row = commitmentRow({
      private_terms_json: '{"floorPrice":90}',
      private_terms_org: "org-a",
    });

    const asOwner = mapCommitmentRow(row, { forOrgId: "org-a" });

    expect(asOwner?.privateTerms).toEqual({ floorPrice: 90 });
  });

  it("defaults to the safe shape when no org is supplied", () => {
    const row = commitmentRow({
      private_terms_json: '{"floorPrice":90}',
      private_terms_org: "org-a",
    });

    expect(mapCommitmentRow(row)).not.toHaveProperty("privateTerms");
  });

  it("survives malformed json without leaking or throwing", () => {
    expect(mapCommitmentRow(commitmentRow({ terms_json: "{not json" }))?.terms).toEqual({});
    expect(mapCommitmentRow(commitmentRow({ terms_json: "[1,2,3]" }))?.terms).toEqual({});
    expect(mapCommitmentRow(null)).toBeNull();
  });

  it("preserves the rest of the commitment shape", () => {
    const mapped = mapCommitmentRow(commitmentRow());
    expect(mapped).toMatchObject({
      id: "c1",
      crossOrgRoomId: "co1",
      roomId: "room1",
      proposedByOrg: "org-a",
      proposedByAgent: "agent-a",
      state: "proposed",
      roundNumber: 1,
      ttlSeconds: 3600,
    });
  });
});

describe("mapCommitmentRowInternal", () => {
  it("exposes the reserve for server-side enforcement", () => {
    const row = commitmentRow({
      private_terms_json: '{"floorPrice":90}',
      private_terms_org: "org-a",
    });

    const internal = mapCommitmentRowInternal(row);

    expect(internal?.privateTerms).toEqual({ floorPrice: 90 });
    expect(internal?.privateTermsOrg).toBe("org-a");
    // The shared view stays redacted even internally.
    expect(internal?.terms).toEqual({ price: 100 });
  });
});

describe("redactPrivateTerms", () => {
  it("is a no-op on already-clean terms", () => {
    expect(redactPrivateTerms({ price: 1, currency: "EUR" })).toEqual({
      price: 1,
      currency: "EUR",
    });
  });

  it("tolerates nullish input", () => {
    expect(redactPrivateTerms(null)).toEqual({});
    expect(redactPrivateTerms(undefined)).toEqual({});
  });
});

describe("assertNegotiationFloorPrice", () => {
  it("passes when no floor is set", () => {
    expect(assertNegotiationFloorPrice({ price: 10 })).toEqual({ ok: true });
  });

  it("rejects a price below the floor", () => {
    const result = assertNegotiationFloorPrice({ price: 85, floorPrice: 90 });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("below_floor_price");
  });

  it("requires a price when a floor is present", () => {
    expect(assertNegotiationFloorPrice({ floorPrice: 90 })).toEqual({
      ok: false,
      reason: "price_required_with_floor",
    });
  });

  it("accepts the snake_case aliases used by agent payloads", () => {
    expect(assertNegotiationFloorPrice({ unit_price_usd: 95, min_price: 90 })).toEqual({
      ok: true,
    });
  });
});

describe("counterCommitment floor enforcement", () => {
  /**
   * Builds a fake D1 that serves one commitment row and records the UPDATE binds,
   * so we can assert both the rejection path and what actually gets persisted.
   */
  function makeEnv(row, room) {
    const updates = [];
    const auditEvents = [];
    return {
      updates,
      auditEvents,
      DB: {
        prepare(sql) {
          return {
            bind(...args) {
              return {
                first: async () => {
                  if (sql.includes("FROM cross_org_rooms")) return room;
                  if (sql.includes("FROM cross_org_audit_log")) return null;
                  if (sql.includes("FROM cross_org_commitments")) return row;
                  return null;
                },
                all: async () => ({ results: [] }),
                run: async () => {
                  if (sql.trim().startsWith("UPDATE cross_org_commitments")) {
                    updates.push(args);
                  }
                  if (sql.includes("INSERT INTO cross_org_audit_log")) {
                    auditEvents.push(args);
                  }
                  return { success: true, meta: { last_row_id: auditEvents.length } };
                },
              };
            },
          };
        },
      },
    };
  }

  const room = {
    id: "co1",
    cross_org_room_id: "co1",
    project_id: "proj",
    room_id: "room1",
    org_a_id: "org-a",
    org_b_id: "org-b",
    max_rounds: 5,
    state: "open",
    created_at: "x",
    updated_at: "x",
    name: "n",
    org_a_agent_id: null,
    org_b_agent_id: null,
  };

  it("rejects a counter that undercuts the standing reserve", async () => {
    const { counterCommitment } = await import("./cross-org-rooms.js");
    const row = commitmentRow({
      private_terms_json: '{"floorPrice":90}',
      private_terms_org: "org-a",
    });
    const env = makeEnv(row, room);

    const result = await counterCommitment(env, {
      projectId: "proj",
      commitmentId: "c1",
      counterByOrg: "org-b",
      terms: { price: 85 },
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("below_floor_price");
    // Critically, the error must not disclose the reserve value.
    expect(result).not.toHaveProperty("floor");
    expect(env.updates).toHaveLength(0);
  });

  it("allows a counter that respects the standing reserve", async () => {
    const { counterCommitment } = await import("./cross-org-rooms.js");
    const row = commitmentRow({
      private_terms_json: '{"floorPrice":90}',
      private_terms_org: "org-a",
    });
    const env = makeEnv(row, room);

    const result = await counterCommitment(env, {
      projectId: "proj",
      commitmentId: "c1",
      counterByOrg: "org-b",
      terms: { price: 95 },
    });

    expect(result.ok).toBe(true);
    expect(env.updates).toHaveLength(1);
    // The persisted shared blob must not contain the reserve.
    const persistedTerms = JSON.parse(env.updates[0][0]);
    expect(persistedTerms).toEqual({ price: 95 });
  });

  it("keeps the original reserve owner when the counter adds none", async () => {
    const { counterCommitment } = await import("./cross-org-rooms.js");
    const row = commitmentRow({
      private_terms_json: '{"floorPrice":90}',
      private_terms_org: "org-a",
    });
    const env = makeEnv(row, room);

    await counterCommitment(env, {
      projectId: "proj",
      commitmentId: "c1",
      counterByOrg: "org-b",
      terms: { price: 95 },
    });

    const [, privateJson, privateOrg] = env.updates[0];
    expect(JSON.parse(privateJson)).toEqual({ floorPrice: 90 });
    expect(privateOrg).toBe("org-a");
  });

  it("transfers reserve ownership when the countering org sets its own", async () => {
    const { counterCommitment } = await import("./cross-org-rooms.js");
    const row = commitmentRow();
    const env = makeEnv(row, room);

    await counterCommitment(env, {
      projectId: "proj",
      commitmentId: "c1",
      counterByOrg: "org-b",
      terms: { price: 95, maxPrice: 120 },
    });

    const [termsJson, privateJson, privateOrg] = env.updates[0];
    expect(JSON.parse(termsJson)).toEqual({ price: 95 });
    expect(JSON.parse(privateJson)).toEqual({ maxPrice: 120 });
    expect(privateOrg).toBe("org-b");
  });
});
