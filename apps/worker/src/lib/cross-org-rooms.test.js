import { describe, expect, it } from "vitest";
import { mapCommitmentRow, mapCrossOrgRoomRow } from "./cross-org-rooms.js";

describe("cross-org mappers", () => {
  it("maps cross org room row", () => {
    const room = mapCrossOrgRoomRow({
      id: "co1",
      project_id: "p1",
      room_id: "room1",
      name: "Pilot",
      org_a_id: "org-a",
      org_b_id: "org-b",
      org_a_agent_id: "agent-a",
      org_b_agent_id: null,
      max_rounds: 5,
      status: "active",
      created_at: "2026-08-01T00:00:00Z",
      created_by: "admin",
    });
    expect(room?.orgAId).toBe("org-a");
    expect(room?.maxRounds).toBe(5);
  });

    it("maps commitment row with parsed terms", () => {
    const c = mapCommitmentRow({
      id: "c1",
      cross_org_room_id: "co1",
      project_id: "p1",
      room_id: "room1",
      proposed_by_org: "org-a",
      proposed_by_agent: "agent-a",
      terms_json: '{"price":100,"floorPrice":90}',
      state: "proposed",
      round_number: 1,
      ttl_seconds: 3600,
      expires_at: null,
      human_a_confirmed_at: null,
      human_b_confirmed_at: null,
      parent_commitment_id: null,
      created_at: "2026-08-01T00:00:00Z",
      updated_at: "2026-08-01T00:00:00Z",
    });
    expect(c?.terms).toEqual({ price: 100 });
    expect(c?.state).toBe("proposed");
  });
});
