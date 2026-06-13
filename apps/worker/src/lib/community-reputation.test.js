import { describe, it, expect } from "vitest";
import {
  getReputation, upsertReputation, addWarning,
  getLeaderboard, getReputationEvents,
  createSpamRule, listSpamRules, evaluateSpam,
  getContestLeaderboard, getReputationStats,
} from "../lib/community-reputation.js";

function mockDb(rows = []) {
  const run = async () => ({ meta: { changes: 1 } });
  const first = async () => rows[0] || null;
  const all = async () => ({ results: rows });
  return {
    prepare: () => ({
      bind: () => ({ run, first, all }),
    }),
  };
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

describe("community-reputation", () => {
  describe("getReputation", () => {
    it("returns formatted reputation", async () => {
      const env = { DB: mockDb([{
        id: "r1", project_id: "p1", user_id: "u1", score: 150, level: 2,
        trusted: 0, warnings: 1, mutes: 0, last_active_at: "2026-01-01", created_at: "2026-01-01",
      }])};
      const rep = await getReputation(env, { projectId: "p1", userId: "u1" });
      expect(rep.score).toBe(150);
      expect(rep.levelName).toBe("member");
      expect(rep.warnings).toBe(1);
    });

    it("returns null for unknown user", async () => {
      const env = { DB: mockDb([]) };
      const rep = await getReputation(env, { projectId: "p1", userId: "unknown" });
      expect(rep).toBeNull();
    });
  });

  describe("upsertReputation", () => {
    it("creates reputation for new user", async () => {
      const env = { DB: mockDbRouter([
        { first: null }, // getReputation returns null
        { first: null }, // INSERT
        { first: null }, // INSERT reputation_events
      ])};
      const result = await upsertReputation(env, {
        projectId: "p1", userId: "u1", points: 5, eventType: "message_sent",
      });
      expect(result.score).toBe(5);
      expect(result.level).toBe(1);
      expect(result.trusted).toBe(false);
    });

    it("increments score for existing user", async () => {
      const existing = { id: "r1", project_id: "p1", user_id: "u1", score: 180, level: 2, trusted: 0, warnings: 0, mutes: 0, last_active_at: "2026-01-01", created_at: "2026-01-01" };
      const env = { DB: mockDbRouter([
        { first: existing }, // getReputation
        { first: null },     // UPDATE
        { first: null },     // INSERT reputation_events
      ])};
      const result = await upsertReputation(env, {
        projectId: "p1", userId: "u1", points: 30, eventType: "message_liked",
      });
      expect(result.score).toBe(210);
      expect(result.level).toBe(3);
      expect(result.trusted).toBe(true);
    });
  });

  describe("addWarning", () => {
    it("warns on first warning", async () => {
      const env = { DB: mockDb([{
        id: "r1", project_id: "p1", user_id: "u1", score: 100, level: 2,
        trusted: 0, warnings: 0, mutes: 0, last_active_at: "2026-01-01", created_at: "2026-01-01",
      }])};
      const result = await addWarning(env, { projectId: "p1", userId: "u1" });
      expect(result.warnings).toBe(1);
      expect(result.action).toBe("warn");
    });

    it("mutes on third warning", async () => {
      const env = { DB: mockDb([{
        id: "r1", project_id: "p1", user_id: "u1", score: 100, level: 2,
        trusted: 0, warnings: 2, mutes: 0, last_active_at: "2026-01-01", created_at: "2026-01-01",
      }])};
      const result = await addWarning(env, { projectId: "p1", userId: "u1" });
      expect(result.warnings).toBe(3);
      expect(result.mutes).toBe(1);
      expect(result.action).toBe("mute");
    });

    it("bans on fifth warning", async () => {
      const env = { DB: mockDb([{
        id: "r1", project_id: "p1", user_id: "u1", score: 100, level: 2,
        trusted: 0, warnings: 4, mutes: 1, last_active_at: "2026-01-01", created_at: "2026-01-01",
      }])};
      const result = await addWarning(env, { projectId: "p1", userId: "u1" });
      expect(result.warnings).toBe(5);
      expect(result.action).toBe("ban");
    });

    it("throws for unknown user", async () => {
      const env = { DB: mockDb([]) };
      await expect(addWarning(env, { projectId: "p1", userId: "unknown" }))
        .rejects.toThrow("User has no reputation record");
    });
  });

  describe("getLeaderboard", () => {
    it("returns sorted leaderboard", async () => {
      const env = { DB: mockDb([
        { id: "r1", project_id: "p1", user_id: "u1", score: 500, level: 4, trusted: 1, warnings: 0, mutes: 0, last_active_at: "2026-01-01", created_at: "2026-01-01" },
        { id: "r2", project_id: "p1", user_id: "u2", score: 200, level: 3, trusted: 1, warnings: 0, mutes: 0, last_active_at: "2026-01-01", created_at: "2026-01-01" },
      ])};
      const lb = await getLeaderboard(env, { projectId: "p1", limit: 10 });
      expect(lb).toHaveLength(2);
      expect(lb[0].score).toBe(500);
      expect(lb[0].levelName).toBe("moderator");
    });
  });

  describe("createSpamRule", () => {
    it("creates spam rule", async () => {
      const env = { DB: mockDb() };
      const rule = await createSpamRule(env, {
        projectId: "p1", ruleName: "No Links", ruleType: "link_detection",
        config: { maxLinks: 2 }, action: "mute",
      });
      expect(rule.id).toBeDefined();
      expect(rule.ruleType).toBe("link_detection");
      expect(rule.action).toBe("mute");
    });

    it("rejects invalid rule type", async () => {
      const env = { DB: mockDb() };
      await expect(createSpamRule(env, {
        projectId: "p1", ruleName: "Bad", ruleType: "invalid",
      })).rejects.toThrow("Invalid rule type");
    });
  });

  describe("listSpamRules", () => {
    it("lists enabled rules", async () => {
      const env = { DB: mockDb([
        { id: "r1", project_id: "p1", rule_name: "No Links", rule_type: "link_detection", config: "{}", action: "warn", enabled: 1, created_at: "2026-01-01" },
      ])};
      const rules = await listSpamRules(env, { projectId: "p1" });
      expect(rules).toHaveLength(1);
    });
  });

  describe("evaluateSpam", () => {
    it("detects keyword violations", async () => {
      const env = { DB: mockDb([
        { id: "r1", project_id: "p1", rule_name: "No Bad Words", rule_type: "keyword_filter", config: '{"keywords":["spam","scam"]}', action: "warn", enabled: 1, created_at: "2026-01-01" },
      ])};
      const result = await evaluateSpam(env, {
        projectId: "p1", content: "This is spam content", userId: "u1",
      });
      expect(result.isSpam).toBe(true);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].matchedKeyword).toBe("spam");
    });

    it("detects caps ratio violations", async () => {
      const env = { DB: mockDb([
        { id: "r1", project_id: "p1", rule_name: "No Shouting", rule_type: "caps_ratio", config: '{"threshold":0.7}', action: "warn", enabled: 1, created_at: "2026-01-01" },
      ])};
      const result = await evaluateSpam(env, {
        projectId: "p1", content: "STOP SHOUTING AT ME RIGHT NOW", userId: "u1",
      });
      expect(result.isSpam).toBe(true);
      expect(result.violations[0].ratio).toBeGreaterThan(0.7);
    });

    it("passes clean content", async () => {
      const env = { DB: mockDb([
        { id: "r1", project_id: "p1", rule_name: "No Links", rule_type: "link_detection", config: "{}", action: "warn", enabled: 1, created_at: "2026-01-01" },
      ])};
      const result = await evaluateSpam(env, {
        projectId: "p1", content: "Hello everyone!", userId: "u1",
      });
      expect(result.isSpam).toBe(false);
      expect(result.violations).toHaveLength(0);
    });
  });

  describe("getReputationStats", () => {
    it("returns stats", async () => {
      const env = { DB: mockDbRouter([
        { first: { total: 100 } },
        { all: [
          { level: 1, count: 60 },
          { level: 2, count: 25 },
          { level: 3, count: 10 },
          { level: 4, count: 5 },
        ]},
        { all: [
          { event_type: "message_sent", count: 500, total_points: 500 },
        ]},
        { first: { cnt: 15 } },
      ])};
      const stats = await getReputationStats(env, { projectId: "p1" });
      expect(stats.totalUsers).toBe(100);
      expect(stats.spamDetected).toBe(15);
    });
  });
});
