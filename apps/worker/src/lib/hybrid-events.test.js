import { describe, it, expect } from "vitest";
import {
  createHybridEvent, getHybridEvent, listHybridEvents,
  checkIn, checkOut, listCheckIns, getHybridStats,
} from "../lib/hybrid-events.js";

function mockDb(rows = []) {
  const run = async () => ({ meta: { changes: 1 } });
  const first = async () => rows[0] || null;
  const all = async () => ({ results: rows });
  return { prepare: () => ({ bind: () => ({ run, first, all }) }) };
}

function mockDbRouter(responses) {
  let callIndex = 0;
  return {
    prepare: (sql) => ({
      bind: () => ({
        run: async () => { callIndex++; return { meta: { changes: 1 } }; },
        first: async () => responses[callIndex++]?.first ?? null,
        all: async () => ({ results: responses[callIndex++]?.all ?? [] }),
      }),
    }),
  };
}

describe("hybrid-events", () => {
  describe("createHybridEvent", () => {
    it("creates hybrid event", async () => {
      const env = { DB: mockDb() };
      const ev = await createHybridEvent(env, {
        projectId: "p1", roomId: "r1", name: "Product Launch",
        mode: "synced", venueUrl: "https://meet.example.com/room1",
      });
      expect(ev.id).toBeDefined();
      expect(ev.mode).toBe("synced");
      expect(ev.qrCode).toContain("hybrid://");
    });
    it("rejects invalid mode", async () => {
      const env = { DB: mockDb() };
      await expect(createHybridEvent(env, { projectId: "p1", roomId: "r1", name: "x", mode: "invalid" }))
        .rejects.toThrow("Invalid hybrid mode");
    });
  });

  describe("listHybridEvents", () => {
    it("lists events", async () => {
      const env = { DB: mockDb([
        { id: "e1", project_id: "p1", room_id: "r1", event_id: null, name: "Launch", description: null, mode: "synced", venue_url: null, qr_code: "hybrid://p1/e1", synced_polls: 1, shared_qa: 1, unified_chat: 1, check_in_count: 0, remote_count: 0, created_at: "2026-01-01" },
      ])};
      const evs = await listHybridEvents(env, { projectId: "p1" });
      expect(evs).toHaveLength(1);
    });
  });

  describe("checkIn", () => {
    it("checks in physical attendee", async () => {
      const env = { DB: mockDb() };
      const result = await checkIn(env, {
        projectId: "p1", hybridEventId: "e1", userId: "u1", checkinType: "physical",
      });
      expect(result.id).toBeDefined();
      expect(result.checkinType).toBe("physical");
    });
    it("defaults to remote", async () => {
      const env = { DB: mockDb() };
      const result = await checkIn(env, { projectId: "p1", hybridEventId: "e1", userId: "u2" });
      expect(result.checkinType).toBe("remote");
    });
  });

  describe("checkOut", () => {
    it("checks out", async () => {
      const env = { DB: mockDb() };
      const ok = await checkOut(env, { projectId: "p1", hybridEventId: "e1", userId: "u1" });
      expect(ok).toBe(true);
    });
  });

  describe("listCheckIns", () => {
    it("lists check-ins", async () => {
      const env = { DB: mockDb([
        { id: "c1", event_id: "e1", project_id: "p1", user_id: "u1", checkin_type: "physical", checked_in_at: "2026-01-01", checked_out_at: null },
      ])};
      const checkins = await listCheckIns(env, { projectId: "p1", hybridEventId: "e1" });
      expect(checkins).toHaveLength(1);
    });
  });

  describe("getHybridStats", () => {
    it("returns stats", async () => {
      const event = { id: "e1", project_id: "p1", room_id: "r1", event_id: null, name: "Launch", description: null, mode: "synced", venue_url: null, qr_code: "hybrid://p1/e1", synced_polls: 1, shared_qa: 1, unified_chat: 1, check_in_count: 5, remote_count: 10, created_at: "2026-01-01" };
      const env = { DB: mockDbRouter([
        { first: event },                        // getHybridEvent
        { first: { total: 15 } },                // totalCheckins
        { all: [                                 // byType
          { checkin_type: "physical", count: 5 },
          { checkin_type: "remote", count: 10 },
        ]},
      ])};
      const stats = await getHybridStats(env, { projectId: "p1", hybridEventId: "e1" });
      expect(stats.totalCheckins).toBe(15);
      expect(stats.physicalCount).toBe(5);
    });
  });
});
