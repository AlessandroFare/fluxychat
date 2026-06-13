import { describe, it, expect } from "vitest";
import {
  createKpi, getKpi, listKpis, updateKpiValue,
  getKpiValues, getKpiAggregation, deleteKpi, getRoomAnalytics,
} from "../lib/room-analytics.js";

function mockDb(rows = [], firstRow = null) {
  const run = async () => ({ meta: { changes: 1 } });
  const first = async () => firstRow ?? rows[0] ?? null;
  const all = async () => ({ results: rows });
  return {
    prepare: () => ({
      bind: () => ({ run, first, all }),
    }),
  };
}

describe("room-analytics", () => {
  describe("createKpi", () => {
    it("creates KPI", async () => {
      const env = { DB: mockDb() };
      const kpi = await createKpi(env, {
        projectId: "p1", roomId: "r1", name: "Response Time",
        kpiType: "timer", unit: "ms", target: 200,
      });
      expect(kpi.id).toBeDefined();
      expect(kpi.name).toBe("Response Time");
      expect(kpi.kpiType).toBe("timer");
    });

    it("rejects invalid KPI type", async () => {
      const env = { DB: mockDb() };
      await expect(
        createKpi(env, { projectId: "p1", roomId: "r1", name: "x", kpiType: "invalid" })
      ).rejects.toThrow("Invalid KPI type");
    });
  });

  describe("getKpi", () => {
    it("returns formatted KPI", async () => {
      const env = { DB: mockDb([{
        id: "k1", project_id: "p1", room_id: "r1", name: "Response Time",
        description: "Avg response time", kpi_type: "timer", source: "query",
        config: '{"query":"SELECT AVG(latency) FROM metrics"}', value: 150,
        unit: "ms", target: 200, trend: "down", last_updated_at: "2026-01-01",
        enabled: 1, created_at: "2026-01-01",
      }])};
      const kpi = await getKpi(env, { projectId: "p1", kpiId: "k1" });
      expect(kpi.name).toBe("Response Time");
      expect(kpi.value).toBe(150);
      expect(kpi.target).toBe(200);
      expect(kpi.trend).toBe("down");
    });
  });

  describe("listKpis", () => {
    it("lists KPIs for room", async () => {
      const env = { DB: mockDb([
        { id: "k1", project_id: "p1", room_id: "r1", name: "CPU", description: null, kpi_type: "gauge", source: "manual", config: "{}", value: 75, unit: "%", target: 80, trend: "flat", last_updated_at: null, enabled: 1, created_at: "2026-01-01" },
        { id: "k2", project_id: "p1", room_id: "r1", name: "Memory", description: null, kpi_type: "gauge", source: "manual", config: "{}", value: 60, unit: "%", target: 80, trend: "up", last_updated_at: null, enabled: 1, created_at: "2026-01-01" },
      ])};
      const kpis = await listKpis(env, { projectId: "p1", roomId: "r1" });
      expect(kpis).toHaveLength(2);
    });
  });

  describe("updateKpiValue", () => {
    it("updates value and detects trend", async () => {
      const env = { DB: mockDb([{
        id: "k1", project_id: "p1", room_id: "r1", name: "CPU",
        description: null, kpi_type: "gauge", source: "manual",
        config: "{}", value: 50, unit: "%", target: 80, trend: "flat",
        last_updated_at: null, enabled: 1, created_at: "2026-01-01",
      }])};
      const result = await updateKpiValue(env, {
        projectId: "p1", kpiId: "k1", value: 70,
      });
      expect(result.value).toBe(70);
      expect(result.trend).toBe("up");
      expect(result.recordedAt).toBeDefined();
    });

    it("throws for missing KPI", async () => {
      const env = { DB: mockDb([]) };
      await expect(
        updateKpiValue(env, { projectId: "p1", kpiId: "missing", value: 10 })
      ).rejects.toThrow("KPI not found");
    });
  });

  describe("getKpiValues", () => {
    it("returns values", async () => {
      const env = { DB: mockDb([
        { id: "v1", kpi_id: "k1", project_id: "p1", room_id: "r1", value: 50, metadata: "{}", recorded_at: "2026-01-01T00:00:00Z" },
        { id: "v2", kpi_id: "k1", project_id: "p1", room_id: "r1", value: 60, metadata: "{}", recorded_at: "2026-01-01T00:01:00Z" },
      ])};
      const values = await getKpiValues(env, { projectId: "p1", kpiId: "k1" });
      expect(values).toHaveLength(2);
    });
  });

  describe("getKpiAggregation", () => {
    it("returns aggregation", async () => {
      const env = { DB: mockDb([{ result: 55 }])};
      const result = await getKpiAggregation(env, {
        projectId: "p1", kpiId: "k1", aggregation: "avg",
      });
      expect(result.aggregation).toBe("avg");
      expect(result.value).toBe(55);
    });
  });

  describe("deleteKpi", () => {
    it("deletes KPI", async () => {
      const env = { DB: mockDb() };
      const ok = await deleteKpi(env, { projectId: "p1", kpiId: "k1" });
      expect(ok).toBe(true);
    });
  });

  describe("getRoomAnalytics", () => {
    it("returns room summary", async () => {
      const env = { DB: mockDb([
        { id: "k1", project_id: "p1", room_id: "r1", name: "CPU", description: null, kpi_type: "gauge", source: "manual", config: "{}", value: 90, unit: "%", target: 80, trend: "up", last_updated_at: null, enabled: 1, created_at: "2026-01-01" },
        { id: "k2", project_id: "p1", room_id: "r1", name: "Memory", description: null, kpi_type: "gauge", source: "manual", config: "{}", value: 60, unit: "%", target: 80, trend: "down", last_updated_at: null, enabled: 1, created_at: "2026-01-01" },
      ])};
      const summary = await getRoomAnalytics(env, { projectId: "p1", roomId: "r1" });
      expect(summary.totalKpis).toBe(2);
      expect(summary.onTarget).toBe(1);
      expect(summary.offTarget).toBe(1);
      expect(summary.trending.up).toBe(1);
      expect(summary.trending.down).toBe(1);
    });
  });
});
