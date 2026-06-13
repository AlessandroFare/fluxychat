import { describe, it, expect } from "vitest";
import {
  createSchedule, getSchedule, listSchedules, deleteSchedule,
  createShift, getCurrentOnCall, listShifts, swapShifts, getOnCallHistory,
} from "../lib/oncall-collaboration.js";

function mockDb(rows = []) {
  const run = async () => ({ meta: { changes: 1 } });
  const first = async () => rows[0] || null;
  const all = async () => ({ results: rows });
  return { prepare: () => ({ bind: () => ({ run, first, all }) }) };
}

describe("oncall-collaboration", () => {
  describe("createSchedule", () => {
    it("creates schedule", async () => {
      const env = { DB: mockDb() };
      const sch = await createSchedule(env, {
        projectId: "p1", roomId: "r1", name: "Primary On-Call",
        rotationHours: 8, escalationMinutes: 15,
      });
      expect(sch.id).toBeDefined();
      expect(sch.rotationHours).toBe(8);
    });
  });

  describe("listSchedules", () => {
    it("lists schedules", async () => {
      const env = { DB: mockDb([
        { id: "s1", project_id: "p1", room_id: "r1", name: "A", description: null, rotation_hours: 12, escalation_minutes: 30, enabled: 1, created_at: "2026-01-01" },
      ])};
      const schs = await listSchedules(env, { projectId: "p1" });
      expect(schs).toHaveLength(1);
    });
  });

  describe("createShift", () => {
    it("creates shift", async () => {
      const env = { DB: mockDb() };
      const shift = await createShift(env, {
        projectId: "p1", scheduleId: "s1", userId: "u1",
        startAt: "2026-01-01T00:00:00Z", endAt: "2026-01-01T12:00:00Z",
      });
      expect(shift.id).toBeDefined();
      expect(shift.status).toBe("active");
    });
  });

  describe("getCurrentOnCall", () => {
    it("returns current on-call", async () => {
      const env = { DB: mockDb([{
        id: "sh1", schedule_id: "s1", project_id: "p1", user_id: "u1",
        start_at: "2026-01-01T00:00:00Z", end_at: "2026-12-31T23:59:59Z",
        status: "active", created_at: "2026-01-01",
      }])};
      const current = await getCurrentOnCall(env, { projectId: "p1", scheduleId: "s1" });
      expect(current).toBeDefined();
      expect(current.userId).toBe("u1");
    });

    it("returns null when no on-call", async () => {
      const env = { DB: mockDb([]) };
      const current = await getCurrentOnCall(env, { projectId: "p1", scheduleId: "s1" });
      expect(current).toBeNull();
    });
  });

  describe("swapShifts", () => {
    it("swaps shifts", async () => {
      const env = { DB: mockDb([
        { id: "sh1", schedule_id: "s1", project_id: "p1", user_id: "u1", start_at: "2026-01-01", end_at: "2026-01-02", status: "active", created_at: "2026-01-01" },
        { id: "sh2", schedule_id: "s1", project_id: "p1", user_id: "u2", start_at: "2026-01-02", end_at: "2026-01-03", status: "active", created_at: "2026-01-01" },
      ])};
      const result = await swapShifts(env, {
        projectId: "p1", shiftIdA: "sh1", shiftIdB: "sh2",
      });
      expect(result.swapped).toBe(true);
    });

    it("throws for missing shift", async () => {
      const env = { DB: mockDb([]) };
      await expect(swapShifts(env, { projectId: "p1", shiftIdA: "x", shiftIdB: "y" }))
        .rejects.toThrow("Shift not found");
    });
  });

  describe("getOnCallHistory", () => {
    it("returns history", async () => {
      const env = { DB: mockDb([
        { id: "sh1", schedule_id: "s1", project_id: "p1", user_id: "u1", start_at: "2026-01-01", end_at: "2026-01-02", status: "active", created_at: "2026-01-01" },
      ])};
      const history = await getOnCallHistory(env, { projectId: "p1", scheduleId: "s1" });
      expect(history).toHaveLength(1);
    });
  });
});
