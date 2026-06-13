import { describe, it, expect } from "vitest";
import {
  createRetentionPolicy,
  updateRetentionPolicy,
  deleteRetentionPolicy,
  listRetentionPolicies,
  getRetentionPolicy,
  getEffectiveRetention,
  getPurgeCandidates,
  recordPurge,
  getPurgeLogs,
  getRetentionStats,
} from "./custom-retention.js";

function makeEnv() {
  const store = [];
  const logs = [];
  return {
    DB: {
      prepare: (sql) => ({
        bind: (...params) => ({
          first: async () => {
            if (sql.includes("enabled = 1")) {
              const targetRoom = params.length > 2 ? params[2] : null;
              const match = store.find((r) => {
                if (r.project_id !== params[0] || r.data_type !== params[1] || !r.enabled) return false;
                if (targetRoom) return r.room_id === targetRoom;
                return r.room_id === null;
              });
              return match || null;
            }
            return store.find((r) => r.id === params[0] && r.project_id === params[1]) || null;
          },
          all: async () => {
            if (sql.includes("purge_log")) {
              const filtered = logs.filter((l) => l.project_id === params[0]);
              return { results: filtered.slice(0, params[1] || 50) };
            }
            if (sql.includes("GROUP BY")) {
              const groups = {};
              for (const r of store.filter((r) => r.project_id === params[0])) {
                if (!groups[r.data_type]) groups[r.data_type] = { data_type: r.data_type, count: 0, total_days: 0 };
                groups[r.data_type].count++;
                groups[r.data_type].total_days += r.retention_days;
              }
              return { results: Object.values(groups) };
            }
            if (sql.includes("next_purge_at <=")) {
              const now = params[1];
              return {
                results: store.filter(
                  (r) => r.project_id === params[0] && r.enabled && r.auto_purge && r.next_purge_at <= now
                ),
              };
            }
            const filtered = store.filter((r) => r.project_id === params[0]);
            return { results: filtered };
          },
          run: async () => {
            if (sql.includes("INSERT INTO custom_retention")) {
              const exists = store.find((r) => r.project_id === params[1] && r.data_type === params[3] && r.room_id === (params[4] || null));
              if (exists) throw new Error("UNIQUE constraint");
              store.push({
                id: params[0], project_id: params[1], name: params[2], data_type: params[3],
                room_id: params[4], retention_days: params[5], auto_purge: params[6],
                archive_before_delete: params[7], require_approval: params[8],
                enabled: 1, next_purge_at: params[9], created_at: params[10], updated_at: params[11],
                last_purged_at: null,
              });
            } else if (sql.includes("DELETE")) {
              const before = store.length;
              for (let i = store.length - 1; i >= 0; i--) {
                if (store[i].id === params[0] && store[i].project_id === params[1]) store.splice(i, 1);
              }
              return { meta: { changes: before - store.length } };
            } else if (sql.includes("UPDATE")) {
              const idx = store.findIndex((r) => r.id === params[params.length - 2] && r.project_id === params[params.length - 1]);
              if (idx >= 0) {
                if (sql.includes("updated_at = ?")) store[idx].updated_at = params[0];
                if (sql.includes("enabled = ?")) store[idx].enabled = params[params.length - 3];
                if (sql.includes("retention_days = ?")) store[idx].retention_days = params[1];
              }
              return { meta: { changes: idx >= 0 ? 1 : 0 } };
            } else if (sql.includes("INSERT INTO retention_purge_log")) {
              logs.push({ id: params[0], project_id: params[2], data_type: params[3], deleted_count: params[5], archived_count: params[6] });
            } else if (sql.includes("next_purge_at = DATE")) {
              const idx = store.findIndex((r) => r.id === params[2]);
              if (idx >= 0) store[idx].last_purged_at = params[0];
            }
            return { meta: { changes: 1 } };
          },
        }),
      }),
    },
    _store: store,
    _logs: logs,
  };
}

describe("custom-retention", () => {
  describe("createRetentionPolicy", () => {
    it("creates a policy", async () => {
      const env = makeEnv();
      const result = await createRetentionPolicy(env, { projectId: "p1", name: "30d messages", dataType: "messages", retentionDays: 30 });
      expect(result.created).toBe(true);
      expect(env._store[0].retention_days).toBe(30);
    });

    it("requires name and dataType", async () => {
      const env = makeEnv();
      const result = await createRetentionPolicy(env, { projectId: "p1" });
      expect(result.error).toContain("required");
    });

    it("validates dataType", async () => {
      const env = makeEnv();
      const result = await createRetentionPolicy(env, { projectId: "p1", name: "x", dataType: "invalid" });
      expect(result.error).toContain("must be one of");
    });

    it("validates retentionDays range", async () => {
      const env = makeEnv();
      const result = await createRetentionPolicy(env, { projectId: "p1", name: "x", dataType: "messages", retentionDays: 0 });
      expect(result.error).toContain("1-3650");
    });

    it("rejects duplicate per type+room", async () => {
      const env = makeEnv();
      await createRetentionPolicy(env, { projectId: "p1", name: "a", dataType: "messages" });
      const result = await createRetentionPolicy(env, { projectId: "p1", name: "b", dataType: "messages" });
      expect(result.error).toContain("already_exists");
    });
  });

  describe("getEffectiveRetention", () => {
    it("returns null when no policy", async () => {
      const env = makeEnv();
      const result = await getEffectiveRetention(env, { projectId: "p1", dataType: "messages" });
      expect(result).toBeNull();
    });

    it("returns global policy when no roomId", async () => {
      const env = makeEnv();
      await createRetentionPolicy(env, { projectId: "p1", name: "global", dataType: "messages", retentionDays: 30 });
      const result = await getEffectiveRetention(env, { projectId: "p1", dataType: "messages" });
      expect(result).not.toBeNull();
      expect(result.retentionDays).toBe(30);
    });
  });

  describe("recordPurge", () => {
    it("records purge log and updates policy", async () => {
      const env = makeEnv();
      const { id } = await createRetentionPolicy(env, { projectId: "p1", name: "a", dataType: "messages" });
      const log = await recordPurge(env, { policyId: id, projectId: "p1", dataType: "messages", deletedCount: 100 });
      expect(log.id).toBeTruthy();
    });
  });

  describe("getRetentionStats", () => {
    it("returns stats", async () => {
      const env = makeEnv();
      await createRetentionPolicy(env, { projectId: "p1", name: "a", dataType: "messages", retentionDays: 30 });
      await createRetentionPolicy(env, { projectId: "p1", name: "b", dataType: "events", retentionDays: 60 });
      const stats = await getRetentionStats(env, { projectId: "p1" });
      expect(stats.totalPolicies).toBe(2);
      expect(stats.byType.messages).toBeDefined();
      expect(stats.byType.events).toBeDefined();
    });
  });
});
