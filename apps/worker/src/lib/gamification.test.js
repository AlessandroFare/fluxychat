import { describe, it, expect } from "vitest";
import {
  initDefaultBadges,
  awardXP,
  getUserProfile,
  getLeaderboard,
  listBadges,
} from "./gamification.js";

function createMockDb({ badges = [], userGamification = [], userBadges = [], xpLog = [] } = {}) {
  return {
    badges: [...badges], userGamification: [...userGamification],
    userBadges: [...userBadges], xpLog: [...xpLog],
    prepare(sql) {
      const self = this;
      return {
        bind(...args) {
          return {
            async all() {
              if (sql.includes("FROM gamification_badges WHERE project_id")) {
                if (sql.includes("is_active")) {
                  return { results: self.badges.filter((b) => b.project_id === args[0] && b.is_active) };
                }
                return { results: self.badges.filter((b) => b.project_id === args[0]) };
              }
              if (sql.includes("FROM user_badges ub")) {
                return {
                  results: self.userBadges
                    .filter((ub) => ub.project_id === args[0] && ub.user_id === args[1])
                    .map((ub) => {
                      const badge = self.badges.find((b) => b.id === ub.badge_id);
                      return { name: badge?.name, icon: badge?.icon, badge_type: badge?.badge_type, xp_reward: badge?.xp_reward, earned_at: ub.earned_at };
                    }),
                };
              }
              if (sql.includes("ORDER BY xp_total DESC")) {
                const filtered = self.userGamification.filter((u) => u.project_id === args[0]);
                return { results: filtered.sort((a, b) => b.xp_total - a.xp_total).slice(0, args[2] || 50) };
              }
              return { results: [] };
            },
            async first() {
              if (sql.includes("SELECT COUNT(*)") && sql.includes("gamification_badges")) {
                return { cnt: self.badges.filter((b) => b.project_id === args[0]).length };
              }
              if (sql.includes("SELECT * FROM user_gamification WHERE project_id")) {
                return self.userGamification.find((u) => u.project_id === args[0] && u.user_id === args[1]) || null;
              }
              if (sql.includes("SELECT id FROM user_badges WHERE")) {
                return self.userBadges.find((ub) => ub.project_id === args[0] && ub.user_id === args[1] && ub.badge_id === args[2]) || null;
              }
              if (sql.includes("SELECT project_id FROM api_tokens")) {
                return { project_id: "p1" };
              }
              return null;
            },
            async run() {
              if (sql.includes("INSERT INTO gamification_badges")) {
                self.badges.push({ id: args[0], project_id: args[1], name: args[2], description: args[3], icon: args[4], badge_type: args[5], xp_reward: args[6], criteria_json: args[7], is_active: 1 });
                return { meta: { changes: 1 } };
              }
              if (sql.includes("INSERT INTO user_gamification")) {
                self.userGamification.push({
                  id: args[0], project_id: args[1], user_id: args[2], room_id: args[3],
                  xp_total: args[4], level: args[5], messages_count: args[6], reactions_given: args[7],
                  reactions_received: args[8], polls_voted: args[9], forms_submitted: args[10],
                  handoffs_completed: args[11], current_streak: args[12], longest_streak: args[13],
                  last_active_date: args[14], created_at: args[15], updated_at: args[16],
                });
                return { meta: { changes: 1 } };
              }
              if (sql.includes("UPDATE user_gamification SET")) {
                const u = self.userGamification.find((u) => u.project_id === args[7] && u.user_id === args[8]);
                if (u) {
                  u.xp_total = args[0]; u.level = args[1];
                  u.current_streak = args[4]; u.longest_streak = args[5];
                  u.last_active_date = args[6]; u.updated_at = args[7];
                  // increment counter
                  if (sql.includes("messages_count = messages_count")) u.messages_count = (u.messages_count || 0) + 1;
                  if (sql.includes("reactions_given = reactions_given")) u.reactions_given = (u.reactions_given || 0) + 1;
                  if (sql.includes("reactions_received = reactions_received")) u.reactions_received = (u.reactions_received || 0) + 1;
                  if (sql.includes("polls_voted = polls_voted")) u.polls_voted = (u.polls_voted || 0) + 1;
                  if (sql.includes("forms_submitted = forms_submitted")) u.forms_submitted = (u.forms_submitted || 0) + 1;
                  if (sql.includes("handoffs_completed = handoffs_completed")) u.handoffs_completed = (u.handoffs_completed || 0) + 1;
                }
                return { meta: { changes: 1 } };
              }
              if (sql.includes("UPDATE user_gamification SET xp_total")) {
                const u = self.userGamification.find((u) => u.project_id === args[1] && u.user_id === args[2]);
                if (u) u.xp_total = (u.xp_total || 0) + args[0];
                return { meta: { changes: 1 } };
              }
              if (sql.includes("INSERT INTO xp_log")) {
                self.xpLog.push({ id: args[0], project_id: args[1], user_id: args[2], xp_amount: args[3], source: args[4], reference_id: args[5], created_at: args[6] });
                return { meta: { changes: 1 } };
              }
              if (sql.includes("INSERT INTO user_badges")) {
                self.userBadges.push({ id: args[0], project_id: args[1], user_id: args[2], badge_id: args[3], earned_at: args[4] });
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

describe("gamification", () => {
  describe("initDefaultBadges", () => {
    it("creates default badges", async () => {
      const db = createMockDb();
      const result = await initDefaultBadges({ DB: db }, { projectId: "p1" });
      expect(result.ok).toBe(true);
      expect(result.created).toBe(11);
      expect(db.badges.length).toBe(11);
    });
    it("skips if badges already exist", async () => {
      const db = createMockDb({ badges: [{ id: "b1", project_id: "p1" }] });
      const result = await initDefaultBadges({ DB: db }, { projectId: "p1" });
      expect(result.ok).toBe(true);
      expect(result.created).toBe(0);
    });
  });

  describe("awardXP", () => {
    it("awards XP for message", async () => {
      const db = createMockDb({
        userGamification: [{
          id: "u1", project_id: "p1", user_id: "u1", room_id: null,
          xp_total: 0, level: 1, messages_count: 0, reactions_given: 0,
          reactions_received: 0, polls_voted: 0, forms_submitted: 0,
          handoffs_completed: 0, current_streak: 0, longest_streak: 0,
          last_active_date: null, created_at: "2026-01-01", updated_at: "2026-01-01",
        }],
      });
      const result = await awardXP({ DB: db }, {
        projectId: "p1", userId: "u1", source: "message",
      });
      expect(result.ok).toBe(true);
      expect(result.xp).toBe(5);
      expect(result.totalXP).toBe(5);
    });
    it("rejects invalid source", async () => {
      const db = createMockDb();
      const result = await awardXP({ DB: db }, {
        projectId: "p1", userId: "u1", source: "invalid",
      });
      expect(result.ok).toBe(false);
    });
    it("creates user record if not exists", async () => {
      const db = createMockDb();
      const result = await awardXP({ DB: db }, {
        projectId: "p1", userId: "new_user", source: "message",
      });
      expect(result.ok).toBe(true);
      expect(db.userGamification.length).toBe(1);
    });
  });

  describe("getUserProfile", () => {
    it("returns profile with badges", async () => {
      const db = createMockDb({
        userGamification: [{
          id: "u1", project_id: "p1", user_id: "u1", room_id: null,
          xp_total: 100, level: 2, messages_count: 20, reactions_given: 5,
          reactions_received: 10, polls_voted: 3, forms_submitted: 1,
          handoffs_completed: 0, current_streak: 5, longest_streak: 7,
          last_active_date: "2026-06-11", created_at: "2026-01-01", updated_at: "2026-06-11",
        }],
        userBadges: [{ project_id: "p1", user_id: "u1", badge_id: "b1", earned_at: "2026-06-01" }],
        badges: [{ id: "b1", name: "First Message", icon: "💬", badge_type: "milestone", xp_reward: 10 }],
      });
      const result = await getUserProfile({ DB: db }, { projectId: "p1", userId: "u1" });
      expect(result.ok).toBe(true);
      expect(result.profile.xpTotal).toBe(100);
      expect(result.badges.length).toBe(1);
    });
    it("returns null profile for unknown user", async () => {
      const db = createMockDb();
      const result = await getUserProfile({ DB: db }, { projectId: "p1", userId: "unknown" });
      expect(result.ok).toBe(true);
      expect(result.profile).toBeNull();
    });
  });

  describe("getLeaderboard", () => {
    it("returns sorted leaderboard", async () => {
      const db = createMockDb({
        userGamification: [
          { project_id: "p1", user_id: "u1", xp_total: 200, level: 3, current_streak: 5, messages_count: 40 },
          { project_id: "p1", user_id: "u2", xp_total: 500, level: 4, current_streak: 10, messages_count: 100 },
          { project_id: "p1", user_id: "u3", xp_total: 100, level: 2, current_streak: 2, messages_count: 20 },
        ],
      });
      const result = await getLeaderboard({ DB: db }, { projectId: "p1" });
      expect(result.ok).toBe(true);
      expect(result.leaderboard[0].userId).toBe("u2");
      expect(result.leaderboard[0].rank).toBe(1);
      expect(result.leaderboard[1].userId).toBe("u1");
    });
  });

  describe("listBadges", () => {
    it("returns project badges", async () => {
      const db = createMockDb({
        badges: [
          { id: "b1", project_id: "p1", name: "First Message", description: "Send first", icon: "💬", badge_type: "milestone", xp_reward: 10, is_active: 1 },
          { id: "b2", project_id: "p1", name: "Chatterbox", description: "100 msgs", icon: "🗣️", badge_type: "achievement", xp_reward: 50, is_active: 1 },
        ],
      });
      const result = await listBadges({ DB: db }, { projectId: "p1" });
      expect(result.ok).toBe(true);
      expect(result.badges.length).toBe(2);
    });
  });
});
