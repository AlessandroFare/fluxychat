import { describe, it, expect } from "vitest";
import {
  upsertAutoRule,
  listAutoRules,
  evaluateAndAct,
  getAutoActionHistory,
  appealAutoAction,
  getAutoModStats,
} from "./autonomous-moderation.js";

function createMockDb({ rules = [], actions = [] } = {}) {
  return {
    rules: [...rules], actions: [...actions],
    prepare(sql) {
      const self = this;
      return {
        bind(...args) {
          return {
            async all() {
              if (sql.includes("FROM moderation_auto_rules WHERE project_id")) {
                return { results: self.rules.filter((r) => r.project_id === args[0]) };
              }
              if (sql.includes("FROM moderation_auto_actions WHERE project_id")) {
                let filtered = self.actions.filter((a) => a.project_id === args[0]);
                if (sql.includes("user_id = ?")) filtered = filtered.filter((a) => a.user_id === args[1]);
                if (sql.includes("room_id = ?")) {
                  const roomIdx = sql.indexOf("room_id = ?");
                  const beforeRoom = sql.substring(0, roomIdx);
                  const paramIdx = (beforeRoom.match(/\?/g) || []).length;
                  filtered = filtered.filter((a) => a.room_id === args[paramIdx]);
                }
                return { results: filtered.slice(0, 50) };
              }
              if (sql.includes("GROUP BY action")) {
                const counts = {};
                for (const a of self.actions.filter((a) => a.project_id === args[0])) {
                  counts[a.action] = (counts[a.action] || 0) + 1;
                }
                return { results: Object.entries(counts).map(([action, cnt]) => ({ action, cnt })) };
              }
              if (sql.includes("GROUP BY severity")) {
                const counts = {};
                for (const a of self.actions.filter((a) => a.project_id === args[0])) {
                  counts[a.severity] = (counts[a.severity] || 0) + 1;
                }
                return { results: Object.entries(counts).map(([severity, cnt]) => ({ severity, cnt })) };
              }
              return { results: [] };
            },
            async first() {
              if (sql.includes("SELECT * FROM moderation_auto_rules WHERE id")) {
                return self.rules.find((r) => r.id === args[0]) || null;
              }
              if (sql.includes("SELECT * FROM moderation_auto_actions WHERE id")) {
                return self.actions.find((a) => a.id === args[0] && a.project_id === args[1]) || null;
              }
              if (sql.includes("SELECT id FROM moderation_auto_actions") && sql.includes("datetime")) {
                return self.actions.find((a) => a.project_id === args[0] && a.user_id === args[1]) || null;
              }
              if (sql.includes("SELECT COUNT(*)") && sql.includes("moderation_auto_actions") && sql.includes("appealed")) {
                return { cnt: self.actions.filter((a) => a.project_id === args[0] && a.appealed).length };
              }
              if (sql.includes("SELECT COUNT(*)") && sql.includes("moderation_auto_actions")) {
                return { cnt: self.actions.filter((a) => a.project_id === args[0]).length };
              }
              if (sql.includes("SELECT COUNT(*)") && sql.includes("moderation_auto_rules")) {
                return { cnt: self.rules.filter((r) => r.project_id === args[0] && r.is_active).length };
              }
              if (sql.includes("SELECT appeal_enabled")) {
                return self.rules.find((r) => r.id === args[0]) || null;
              }
              if (sql.includes("SELECT project_id FROM api_tokens")) {
                return { project_id: "p1" };
              }
              return null;
            },
            async run() {
              if (sql.includes("INSERT INTO moderation_auto_rules")) {
                self.rules.push({
                  id: args[0], project_id: args[1], name: args[2], description: args[3],
                  severity_min: args[4], confidence_min: args[5], action: args[6],
                  mute_duration_minutes: args[7], timeout_duration_minutes: args[8],
                  cooldown_minutes: args[9], max_actions_per_hour: args[10],
                  notify_admins: args[11], notify_user: args[12], appeal_enabled: args[13],
                  is_active: 1, created_at: args[14], updated_at: args[15],
                });
                return { meta: { changes: 1 } };
              }
              if (sql.includes("UPDATE moderation_auto_rules")) {
                const r = self.rules.find((r) => r.id === args[14] && r.project_id === args[15]);
                if (r) {
                  r.name = args[0]; r.description = args[1]; r.severity_min = args[2];
                  r.confidence_min = args[3]; r.action = args[4]; r.updated_at = args[14];
                }
                return { meta: { changes: 1 } };
              }
              if (sql.includes("INSERT INTO moderation_auto_actions")) {
                self.actions.push({
                  id: args[0], project_id: args[1], room_id: args[2], user_id: args[3],
                  message_id: args[4], rule_id: args[5], action: args[6], severity: args[7],
                  confidence: args[8], reason: args[9], ai_raw_response: args[10],
                  applied_at: args[11], expires_at: args[12], appealed: 0, appeal_result: null,
                });
                return { meta: { changes: 1 } };
              }
              if (sql.includes("UPDATE moderation_auto_actions SET appealed")) {
                const a = self.actions.find((a) => a.id === args[1]);
                if (a) { a.appealed = 1; a.appeal_result = "pending"; }
                return { meta: { changes: 1 } };
              }
              return { meta: { changes: 0 } };
            },
          };
        },
      };
    },
  };
}

describe("autonomous-moderation", () => {
  describe("upsertAutoRule", () => {
    it("creates a rule", async () => {
      const db = createMockDb();
      const result = await upsertAutoRule({ DB: db }, {
        projectId: "p1", name: "Ban toxic", action: "ban", severityMin: "high", confidenceMin: 0.9,
      });
      expect(result.ok).toBe(true);
      expect(result.id).toBeTruthy();
      expect(db.rules.length).toBe(1);
    });
    it("updates existing rule", async () => {
      const db = createMockDb({ rules: [{ id: "r1", project_id: "p1" }] });
      const result = await upsertAutoRule({ DB: db }, {
        projectId: "p1", id: "r1", name: "Updated", action: "mute",
      });
      expect(result.ok).toBe(true);
    });
    it("rejects missing name", async () => {
      const db = createMockDb();
      const result = await upsertAutoRule({ DB: db }, {
        projectId: "p1", name: "  ", action: "warn",
      });
      expect(result.ok).toBe(false);
    });
    it("rejects invalid action", async () => {
      const db = createMockDb();
      const result = await upsertAutoRule({ DB: db }, {
        projectId: "p1", name: "Test", action: "invalid",
      });
      expect(result.ok).toBe(false);
    });
  });

  describe("listAutoRules", () => {
    it("returns rules", async () => {
      const db = createMockDb({
        rules: [{ id: "r1", project_id: "p1", name: "Rule 1", is_active: 1 }],
      });
      const result = await listAutoRules({ DB: db }, { projectId: "p1" });
      expect(result.ok).toBe(true);
      expect(result.rules.length).toBe(1);
    });
  });

  describe("evaluateAndAct", () => {
    it("takes action when severity+confidence match", async () => {
      const db = createMockDb({
        rules: [{
          id: "r1", project_id: "p1", name: "Mute toxic", is_active: 1,
          severity_min: "high", confidence_min: 0.7, action: "mute",
          cooldown_minutes: 5, max_actions_per_hour: 10,
          mute_duration_minutes: 30, timeout_duration_minutes: 60,
          notify_admins: 1, notify_user: 1, appeal_enabled: 1,
        }],
      });
      const result = await evaluateAndAct({ DB: db }, {
        projectId: "p1", roomId: "r1", userId: "u1",
        severity: "high", confidence: 0.9, reason: "toxic content",
      });
      expect(result.ok).toBe(true);
      expect(result.action).toBe("mute");
      expect(result.actionId).toBeTruthy();
      expect(result.expiresAt).toBeTruthy();
    });
    it("returns none when no rules match", async () => {
      const db = createMockDb({
        rules: [{
          id: "r1", project_id: "p1", name: "Ban critical", is_active: 1,
          severity_min: "critical", confidence_min: 0.95, action: "ban",
          cooldown_minutes: 5, max_actions_per_hour: 10,
        }],
      });
      const result = await evaluateAndAct({ DB: db }, {
        projectId: "p1", roomId: "r1", userId: "u1",
        severity: "low", confidence: 0.5,
      });
      expect(result.ok).toBe(true);
      expect(result.action).toBe("none");
    });
    it("returns cooldown when recent action exists", async () => {
      const db = createMockDb({
        rules: [{
          id: "r1", project_id: "p1", name: "Warn", is_active: 1,
          severity_min: "medium", confidence_min: 0.5, action: "warn",
          cooldown_minutes: 10, max_actions_per_hour: 10,
        }],
        actions: [{
          id: "a1", project_id: "p1", user_id: "u1",
          applied_at: new Date().toISOString(),
        }],
      });
      const result = await evaluateAndAct({ DB: db }, {
        projectId: "p1", roomId: "r1", userId: "u1",
        severity: "medium", confidence: 0.8,
      });
      expect(result.ok).toBe(true);
      expect(result.action).toBe("cooldown");
    });
  });

  describe("appealAutoAction", () => {
    it("allows appeal", async () => {
      const db = createMockDb({
        actions: [{ id: "a1", project_id: "p1", user_id: "u1", appealed: 0, rule_id: "r1" }],
        rules: [{ id: "r1", appeal_enabled: 1 }],
      });
      const result = await appealAutoAction({ DB: db }, {
        projectId: "p1", actionId: "a1", userId: "u1",
      });
      expect(result.ok).toBe(true);
    });
    it("rejects duplicate appeal", async () => {
      const db = createMockDb({
        actions: [{ id: "a1", project_id: "p1", user_id: "u1", appealed: 1 }],
      });
      const result = await appealAutoAction({ DB: db }, {
        projectId: "p1", actionId: "a1", userId: "u1",
      });
      expect(result.ok).toBe(false);
      expect(result.error).toBe("already_appealed");
    });
    it("rejects appeal by wrong user", async () => {
      const db = createMockDb({
        actions: [{ id: "a1", project_id: "p1", user_id: "u1", appealed: 0 }],
      });
      const result = await appealAutoAction({ DB: db }, {
        projectId: "p1", actionId: "a1", userId: "u2",
      });
      expect(result.ok).toBe(false);
    });
  });

  describe("getAutoModStats", () => {
    it("returns stats", async () => {
      const db = createMockDb({
        rules: [{ id: "r1", project_id: "p1", is_active: 1 }],
        actions: [
          { project_id: "p1", action: "mute", severity: "high", appealed: 0 },
          { project_id: "p1", action: "warn", severity: "medium", appealed: 1 },
        ],
      });
      const result = await getAutoModStats({ DB: db }, { projectId: "p1" });
      expect(result.ok).toBe(true);
      expect(result.totalActions).toBe(2);
      expect(result.activeRules).toBe(1);
      expect(result.totalAppeals).toBe(1);
    });
  });
});
