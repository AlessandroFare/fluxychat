import { describe, it, expect } from "vitest";
import {
  isValidTopic,
  getPreference,
  listPreferences,
  upsertPreference,
  deletePreference,
  createSnoozeRule,
  listSnoozeRules,
  deleteSnoozeRule,
  isNotificationSnoozed,
  cleanExpiredSnoozeRules,
  priorityWeight,
  shouldBypassQuietHours,
} from "./notification-controls.js";

function createMockDb({ prefs = [], snoozeRules = [] } = {}) {
  let nextId = 1;
  return {
    prefs, snoozeRules,
    prepare(sql) {
      const self = this;
      return {
        bind(...args) {
          return {
            async all() {
              if (sql.includes("FROM user_notification_preferences")) {
                return { results: self.prefs.filter((p) => p.project_id === args[0] && p.user_id === args[1]) };
              }
              if (sql.includes("FROM notification_snooze_rules")) {
                if (sql.includes("snooze_until >")) {
                  return { results: self.snoozeRules.filter((r) => r.project_id === args[0] && r.user_id === args[1] && r.snooze_until > args[2]) };
                }
                return { results: self.snoozeRules.filter((r) => r.project_id === args[0] && r.user_id === args[1]) };
              }
              return { results: [] };
            },
            async first() {
              if (sql.includes("FROM user_notification_preferences")) {
                if (sql.includes("room_id IS NULL")) {
                  return self.prefs.find((p) => p.project_id === args[0] && p.user_id === args[1] && p.topic === args[2] && !p.room_id) || null;
                }
                return self.prefs.find((p) => p.project_id === args[0] && p.user_id === args[1] && p.topic === args[2] && p.room_id === args[3]) || null;
              }
              if (sql.includes("FROM notification_snooze_rules") && sql.includes("LIMIT 1")) {
                const match = self.snoozeRules.find((r) => r.project_id === args[0] && r.user_id === args[1] && r.snooze_until > args[2] && (!r.room_id || r.room_id === (args[3] || null)) && (!r.thread_id || r.thread_id === (args[4] || null)) && (!r.customer_id || r.customer_id === (args[5] || null)));
                return match ? { id: match.id } : null;
              }
              return null;
            },
            async run() {
              if (sql.includes("INSERT INTO user_notification_preferences")) {
                const pref = { id: `pref_${nextId++}`, project_id: args[1], user_id: args[2], topic: args[3], room_id: args[4], push_enabled: args[5], in_app_enabled: args[6], email_enabled: args[7], digest_frequency: args[8], priority_level: args[9], created_at: args[10], updated_at: args[11] };
                const idx = self.prefs.findIndex((p) => p.project_id === pref.project_id && p.user_id === pref.user_id && p.topic === pref.topic && p.room_id === pref.room_id);
                if (idx >= 0) { self.prefs[idx] = pref; } else { self.prefs.push(pref); }
                return { meta: { changes: 1 } };
              }
              if (sql.includes("DELETE FROM user_notification_preferences")) {
                const before = self.prefs.length;
                self.prefs = self.prefs.filter((p) => !(p.project_id === args[0] && p.user_id === args[1] && p.topic === args[2]));
                return { meta: { changes: before - self.prefs.length } };
              }
              if (sql.includes("INSERT INTO notification_snooze_rules")) {
                const rule = { id: `rule_${nextId++}`, project_id: args[1], user_id: args[2], room_id: args[3], thread_id: args[4], customer_id: args[5], snooze_until: args[6], reason: args[7], created_at: args[8], updated_at: args[9] };
                self.snoozeRules.push(rule);
                return { meta: { changes: 1 } };
              }
              if (sql.includes("DELETE FROM notification_snooze_rules") && sql.includes("snooze_until")) {
                const before = self.snoozeRules.length;
                self.snoozeRules = self.snoozeRules.filter((r) => !(r.project_id === args[0] && r.snooze_until <= args[1]));
                return { meta: { changes: before - self.snoozeRules.length } };
              }
              if (sql.includes("DELETE FROM notification_snooze_rules")) {
                const before = self.snoozeRules.length;
                self.snoozeRules = self.snoozeRules.filter((r) => !(r.id === args[0] && r.project_id === args[1] && r.user_id === args[2]));
                return { meta: { changes: before - self.snoozeRules.length } };
              }
              return { meta: { changes: 0 } };
            },
          };
        },
      };
    },
  };
}

describe("notification-controls", () => {
  describe("isValidTopic", () => {
    it("accepts valid topics", () => {
      expect(isValidTopic("message")).toBe(true);
      expect(isValidTopic("mention")).toBe(true);
      expect(isValidTopic("handoff")).toBe(true);
    });
    it("rejects invalid topics", () => {
      expect(isValidTopic("invalid")).toBe(false);
    });
  });

  describe("upsertPreference", () => {
    it("creates preference", async () => {
      const db = createMockDb();
      const result = await upsertPreference(db, { projectId: "p1", userId: "u1", topic: "mention" });
      expect(result.ok).toBe(true);
    });
    it("rejects invalid topic", async () => {
      const db = createMockDb();
      const result = await upsertPreference(db, { projectId: "p1", userId: "u1", topic: "bogus" });
      expect(result.ok).toBe(false);
      expect(result.error).toBe("invalid_topic");
    });
    it("rejects invalid digest", async () => {
      const db = createMockDb();
      const result = await upsertPreference(db, { projectId: "p1", userId: "u1", topic: "mention", digestFrequency: "invalid" });
      expect(result.ok).toBe(false);
      expect(result.error).toBe("invalid_digest_frequency");
    });
  });

  describe("listPreferences", () => {
    it("lists preferences", async () => {
      const db = createMockDb({ prefs: [{ id: "1", project_id: "p1", user_id: "u1", topic: "mention", room_id: null, push_enabled: 1, in_app_enabled: 1, email_enabled: 0, digest_frequency: "realtime", priority_level: "normal" }] });
      const prefs = await listPreferences(db, { projectId: "p1", userId: "u1" });
      expect(prefs).toHaveLength(1);
      expect(prefs[0].topic).toBe("mention");
    });
  });

  describe("deletePreference", () => {
    it("deletes preference", async () => {
      const db = createMockDb({ prefs: [{ id: "1", project_id: "p1", user_id: "u1", topic: "mention", room_id: null }] });
      const result = await deletePreference(db, { projectId: "p1", userId: "u1", topic: "mention" });
      expect(result.ok).toBe(true);
      expect(result.deleted).toBe(true);
    });
  });

  describe("createSnoozeRule", () => {
    it("creates rule", async () => {
      const db = createMockDb();
      const result = await createSnoozeRule(db, { projectId: "p1", userId: "u1", snoozeUntil: "2026-12-31T00:00:00Z" });
      expect(result.ok).toBe(true);
    });
    it("rejects missing snoozeUntil", async () => {
      const db = createMockDb();
      const result = await createSnoozeRule(db, { projectId: "p1", userId: "u1" });
      expect(result.ok).toBe(false);
    });
  });

  describe("listSnoozeRules", () => {
    it("lists rules", async () => {
      const db = createMockDb({ snoozeRules: [{ id: "r1", project_id: "p1", user_id: "u1", room_id: null, thread_id: null, customer_id: null, snooze_until: "2099-01-01T00:00:00Z", reason: "busy", created_at: "now", updated_at: "now" }] });
      const rules = await listSnoozeRules(db, { projectId: "p1", userId: "u1" });
      expect(rules).toHaveLength(1);
      expect(rules[0].reason).toBe("busy");
    });
  });

  describe("deleteSnoozeRule", () => {
    it("deletes rule", async () => {
      const db = createMockDb({ snoozeRules: [{ id: "r1", project_id: "p1", user_id: "u1" }] });
      const result = await deleteSnoozeRule(db, { projectId: "p1", userId: "u1", ruleId: "r1" });
      expect(result.ok).toBe(true);
    });
  });

  describe("isNotificationSnoozed", () => {
    it("returns true when snoozed", async () => {
      const db = createMockDb({ snoozeRules: [{ id: "r1", project_id: "p1", user_id: "u1", room_id: null, thread_id: null, customer_id: null, snooze_until: "2099-01-01T00:00:00Z" }] });
      const snoozed = await isNotificationSnoozed(db, { projectId: "p1", userId: "u1" });
      expect(snoozed).toBe(true);
    });
    it("returns false when not snoozed", async () => {
      const db = createMockDb();
      const snoozed = await isNotificationSnoozed(db, { projectId: "p1", userId: "u1" });
      expect(snoozed).toBe(false);
    });
  });

  describe("cleanExpiredSnoozeRules", () => {
    it("cleans expired rules", async () => {
      const db = createMockDb({ snoozeRules: [{ id: "r1", project_id: "p1", user_id: "u1", snooze_until: "2020-01-01T00:00:00Z" }] });
      const result = await cleanExpiredSnoozeRules(db, { projectId: "p1" });
      expect(result.ok).toBe(true);
    });
  });

  describe("priorityWeight", () => {
    it("returns correct weights", () => {
      expect(priorityWeight("urgent")).toBe(4);
      expect(priorityWeight("high")).toBe(3);
      expect(priorityWeight("normal")).toBe(2);
      expect(priorityWeight("low")).toBe(1);
      expect(priorityWeight("unknown")).toBe(2);
    });
  });

  describe("shouldBypassQuietHours", () => {
    it("bypasses for urgent", () => expect(shouldBypassQuietHours("urgent")).toBe(true));
    it("does not bypass for normal", () => expect(shouldBypassQuietHours("normal")).toBe(false));
  });
});
