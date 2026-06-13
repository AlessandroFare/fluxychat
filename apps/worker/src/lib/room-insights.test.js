import { describe, it, expect } from "vitest";
import {
  isValidInsightType,
  recordInsight,
  recordInsightsBatch,
  getLatestInsights,
  getInsightSummary,
  getInsightTimeSeries,
  computeEngagementScore,
  subscribeToInsights,
  getInsightSubscriptions,
  unsubscribeFromInsights,
  cleanupOldInsights,
} from "./room-insights.js";

function makeEnv() {
  const store = [];
  return {
    DB: {
      prepare: (sql) => ({
        bind: (...params) => ({
          first: async () => {
            if (sql.includes("SELECT * FROM room_insight_subscriptions")) {
              return store.find((r) => r.__table === "subs" && r.room_id === params[0]) || null;
            }
            return null;
          },
          all: async () => {
            if (sql.includes("GROUP BY")) {
              const byType = {};
              for (const r of store.filter((r) => r.__table === "insights" && r.room_id === params[0])) {
                const key = `${r.insight_type}|${r.metric_name}`;
                if (!byType[key]) byType[key] = { insight_type: r.insight_type, metric_name: r.metric_name, values: [] };
                byType[key].values.push(r.metric_value);
              }
              return {
                results: Object.values(byType).map((g) => ({
                  insight_type: g.insight_type,
                  metric_name: g.metric_name,
                  avg_value: g.values.reduce((a, b) => a + b, 0) / g.values.length,
                  min_value: Math.min(...g.values),
                  max_value: Math.max(...g.values),
                  sample_count: g.values.length,
                })),
              };
            }
            if (sql.includes("metric_name = ?")) {
              return {
                results: store
                  .filter((r) => r.__table === "insights" && r.room_id === params[0] && r.metric_name === params[1])
                  .map((r) => ({ metric_value: r.metric_value, recorded_at: r.recorded_at })),
              };
            }
            if (sql.includes("insight_type = 'activity'")) {
              return {
                results: store
                  .filter((r) => r.__table === "insights" && r.room_id === params[0] && r.insight_type === "activity")
                  .map((r) => ({ metric_name: r.metric_name, metric_value: r.metric_value })),
              };
            }
            let filtered = store.filter((r) => r.__table === "insights" && r.room_id === params[0]);
            if (sql.includes("insight_type = ?")) filtered = filtered.filter((r) => r.insight_type === params[1]);
            return { results: filtered.slice(0, params[params.length - 1] || 20) };
          },
          run: async () => {
            if (sql.includes("INSERT INTO room_insights")) {
              store.push({
                __table: "insights",
                id: store.filter((r) => r.__table === "insights").length + 1,
                project_id: params[0],
                room_id: params[1],
                insight_type: params[2],
                metric_name: params[3],
                metric_value: params[4],
                metadata_json: params[5],
                recorded_at: params[6],
              });
            } else if (sql.includes("INSERT INTO room_insight_subscriptions")) {
              store.push({
                __table: "subs",
                id: params[0],
                project_id: params[1],
                room_id: params[2],
                user_id: params[3],
                insight_types_json: params[4],
                interval_seconds: params[5],
                enabled: params[6],
                created_at: params[7],
              });
            } else if (sql.includes("DELETE")) {
              const before = store.length;
              if (sql.includes("id = ?")) {
                const idx = store.findIndex((r) => r.__table === "subs" && r.id === params[0]);
                if (idx >= 0) store.splice(idx, 1);
              } else if (sql.includes("recorded_at < ?")) {
                const cutoff = params[1];
                for (let i = store.length - 1; i >= 0; i--) {
                  if (store[i].__table === "insights" && store[i].room_id === params[0] && store[i].recorded_at < cutoff) store.splice(i, 1);
                }
              } else {
                const roomId = params[0];
                for (let i = store.length - 1; i >= 0; i--) {
                  if (store[i].room_id === roomId && store[i].__table === "insights") store.splice(i, 1);
                }
              }
              return { meta: { changes: before - store.length } };
            }
            return { meta: { changes: 1 } };
          },
        }),
      }),
    },
    batch: async (stmts) => {
      for (const stmt of stmts) await stmt.run();
    },
    _store: store,
  };
}

describe("room-insights", () => {
  describe("isValidInsightType", () => {
    it("accepts valid types", () => {
      expect(isValidInsightType("engagement")).toBe(true);
      expect(isValidInsightType("activity")).toBe(true);
      expect(isValidInsightType("sentiment")).toBe(true);
      expect(isValidInsightType("queue")).toBe(true);
      expect(isValidInsightType("sla")).toBe(true);
      expect(isValidInsightType("performance")).toBe(true);
      expect(isValidInsightType("custom")).toBe(true);
    });

    it("rejects invalid types", () => {
      expect(isValidInsightType("invalid")).toBe(false);
    });
  });

  describe("recordInsight", () => {
    it("records a metric insight", async () => {
      const env = makeEnv();
      const result = await recordInsight(env, {
        projectId: "p1",
        roomId: "room_1",
        insightType: "engagement",
        metricName: "score",
        metricValue: 85.5,
      });
      expect(result.recorded).toBe(true);
    });

    it("rejects invalid type", async () => {
      const env = makeEnv();
      const result = await recordInsight(env, {
        projectId: "p1",
        roomId: "room_1",
        insightType: "invalid",
        metricName: "score",
        metricValue: 85.5,
      });
      expect(result.error).toContain("must be one of");
    });
  });

  describe("recordInsightsBatch", () => {
    it("records multiple insights", async () => {
      const env = makeEnv();
      const result = await recordInsightsBatch(env, {
        projectId: "p1",
        roomId: "room_1",
        insights: [
          { insightType: "engagement", metricName: "score", metricValue: 85 },
          { insightType: "activity", metricName: "message_rate", metricValue: 12.5 },
          { insightType: "activity", metricName: "active_users", metricValue: 8 },
        ],
      });
      expect(result.recorded).toBe(3);
    });
  });

  describe("getLatestInsights", () => {
    it("returns recent insights", async () => {
      const env = makeEnv();
      await recordInsight(env, { projectId: "p1", roomId: "r1", insightType: "engagement", metricName: "score", metricValue: 85 });
      await recordInsight(env, { projectId: "p1", roomId: "r1", insightType: "activity", metricName: "rate", metricValue: 12 });
      const insights = await getLatestInsights(env, { roomId: "r1" });
      expect(insights.length).toBe(2);
    });

    it("filters by type", async () => {
      const env = makeEnv();
      await recordInsight(env, { projectId: "p1", roomId: "r1", insightType: "engagement", metricName: "score", metricValue: 85 });
      await recordInsight(env, { projectId: "p1", roomId: "r1", insightType: "activity", metricName: "rate", metricValue: 12 });
      const insights = await getLatestInsights(env, { roomId: "r1", insightType: "engagement" });
      expect(insights.length).toBe(1);
      expect(insights[0].insightType).toBe("engagement");
    });
  });

  describe("getInsightSummary", () => {
    it("aggregates insights by type and name", async () => {
      const env = makeEnv();
      await recordInsight(env, { projectId: "p1", roomId: "r1", insightType: "engagement", metricName: "score", metricValue: 80 });
      await recordInsight(env, { projectId: "p1", roomId: "r1", insightType: "engagement", metricName: "score", metricValue: 90 });
      const summary = await getInsightSummary(env, { roomId: "r1" });
      expect(summary.length).toBe(1);
      expect(summary[0].avgValue).toBe(85);
      expect(summary[0].sampleCount).toBe(2);
    });
  });

  describe("computeEngagementScore", () => {
    it("computes engagement score from activity metrics", async () => {
      const env = makeEnv();
      await recordInsight(env, { projectId: "p1", roomId: "r1", insightType: "activity", metricName: "message_rate", metricValue: 5 });
      await recordInsight(env, { projectId: "p1", roomId: "r1", insightType: "activity", metricName: "active_users", metricValue: 10 });
      const result = await computeEngagementScore(env, { roomId: "r1" });
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.components).toBeDefined();
    });
  });

  describe("subscribeToInsights", () => {
    it("creates a subscription", async () => {
      const env = makeEnv();
      const result = await subscribeToInsights(env, {
        projectId: "p1",
        roomId: "r1",
        userId: "u1",
        insightTypes: ["engagement", "activity"],
        intervalSeconds: 30,
      });
      expect(result.created).toBe(true);
      expect(result.id).toBeDefined();
    });
  });

  describe("cleanupOldInsights", () => {
    it("removes old insights from store", async () => {
      const env = makeEnv();
      await recordInsight(env, { projectId: "p1", roomId: "r1", insightType: "engagement", metricName: "score", metricValue: 85 });
      const before = env._store.filter((r) => r.__table === "insights").length;
      expect(before).toBe(1);
      const result = await cleanupOldInsights(env, { roomId: "r1", olderThanHours: 1 });
      expect(result).toBeDefined();
      expect(typeof result.deleted).toBe("number");
    });
  });
});
