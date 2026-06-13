import { describe, it, expect } from "vitest";
import {
  generateRoomSummary,
  computeRoomPriorities,
  generateSuggestedResponses,
  getInboxView,
} from "./inbox-zero.js";

function createMockDb({ messages = [], summaries = [], priorities = [], suggestions = [], roomMemory = [] } = {}) {
  return {
    messages: [...messages], summaries: [...summaries], priorities: [...priorities],
    suggestions: [...suggestions], roomMemory: [...roomMemory],
    prepare(sql) {
      const self = this;
      const normalizedSql = sql.replace(/\s+/g, " ");
      return {
        bind(...args) {
          return {
            async all() {
              if (normalizedSql.includes("FROM messages") && normalizedSql.includes("ORDER BY created_at DESC") && !normalizedSql.includes("GROUP BY")) {
                const filtered = self.messages.filter((m) => m.room_id === args[0] && m.project_id === args[1]);
                const limit = Number(args[2]) || 20;
                return { results: filtered.slice(-limit) };
              }
              if (normalizedSql.includes("GROUP BY room_id")) {
                const groups = {};
                for (const m of self.messages.filter((m) => m.project_id === args[0])) {
                  if (!groups[m.room_id]) groups[m.room_id] = { room_id: m.room_id, unread_count: 0, last_message_at: null };
                  groups[m.room_id].unread_count++;
                  if (!groups[m.room_id].last_message_at || m.created_at > groups[m.room_id].last_message_at) {
                    groups[m.room_id].last_message_at = m.created_at;
                  }
                }
                return { results: Object.values(groups).slice(0, 50) };
              }
              if (normalizedSql.includes("FROM inbox_priorities")) {
                return { results: self.priorities.filter((p) => p.project_id === args[0] && p.user_id === args[1]).sort((a, b) => b.priority_score - a.priority_score).slice(0, 20) };
              }
              if (normalizedSql.includes("FROM inbox_summaries")) {
                return { results: self.summaries.filter((s) => s.project_id === args[0] && s.room_id === args[1] && s.user_id === args[2]).slice(0, 1) };
              }
              if (normalizedSql.includes("FROM suggested_responses")) {
                return { results: self.suggestions.filter((s) => s.project_id === args[0] && s.room_id === args[1] && s.user_id === args[2]).slice(0, 3) };
              }
              if (normalizedSql.includes("FROM room_memory")) {
                return { results: self.roomMemory.filter((m) => m.room_id === args[0] && m.project_id === args[1]) };
              }
              return { results: [] };
            },
            async first() {
              if (normalizedSql.includes("COUNT(*)") && normalizedSql.includes("messages") && normalizedSql.includes("LIKE")) {
                const search = (args[2] || "").replace(/%/g, "");
                const cnt = self.messages.filter((m) => m.room_id === args[0] && m.project_id === args[1] && m.content.includes(search)).length;
                return { cnt };
              }
              if (normalizedSql.includes("FROM inbox_summaries") && normalizedSql.includes("ORDER BY")) {
                const found = self.summaries.find((s) => s.project_id === args[0] && s.room_id === args[1] && s.user_id === args[2]);
                return found || null;
              }
              if (normalizedSql.includes("FROM room_memory")) {
                const found = self.roomMemory.find((m) => m.room_id === args[0] && m.project_id === args[1]);
                return found || null;
              }
              if (normalizedSql.includes("SELECT project_id FROM api_tokens")) {
                return { project_id: "p1" };
              }
              return null;
            },
            async run() {
              if (normalizedSql.includes("INSERT INTO inbox_summaries")) {
                self.summaries.push({ id: args[0], project_id: args[1], room_id: args[2], user_id: args[3], summary: args[4], key_points: args[5], action_items: args[6], message_count: args[7], generated_at: args[11] });
                return { meta: { changes: 1 } };
              }
              if (normalizedSql.includes("INSERT INTO inbox_priorities")) {
                self.priorities.push({ id: args[0], project_id: args[1], room_id: args[2], user_id: args[3], priority_score: args[4], priority_reason: args[5], has_mention: args[6], has_question: args[7], unread_count: args[8], last_message_at: args[9], sentiment: args[10], computed_at: args[11] });
                return { meta: { changes: 1 } };
              }
              if (normalizedSql.includes("INSERT INTO suggested_responses")) {
                self.suggestions.push({ id: args[0], project_id: args[1], room_id: args[2], user_id: args[3], response_text: args[4], generated_at: args[7] });
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

describe("inbox-zero", () => {
  describe("generateRoomSummary", () => {
    it("generates summary from messages", async () => {
      const db = createMockDb({
        messages: [
          { id: 1, room_id: "r1", project_id: "p1", user_id: "u1", content: "Hello team", created_at: "2026-06-11T10:00:00Z" },
          { id: 2, room_id: "r1", project_id: "p1", user_id: "u2", content: "Meeting at 3pm", created_at: "2026-06-11T10:01:00Z" },
          { id: 3, room_id: "r1", project_id: "p1", user_id: "u1", content: "Got it, thanks!", created_at: "2026-06-11T10:02:00Z" },
        ],
      });
      const result = await generateRoomSummary({ DB: db }, {
        projectId: "p1", roomId: "r1", userId: "u1",
      });
      expect(result.ok).toBe(true);
      expect(result.summary).toBeTruthy();
      expect(result.messageCount).toBe(3);
    });
    it("returns null for empty room", async () => {
      const db = createMockDb({ messages: [] });
      const result = await generateRoomSummary({ DB: db }, {
        projectId: "p1", roomId: "r1", userId: "u1",
      });
      expect(result.ok).toBe(true);
      expect(result.summary).toBeNull();
    });
  });

  describe("computeRoomPriorities", () => {
    it("computes priorities with scores", async () => {
      const db = createMockDb({
        messages: [
          { id: 1, room_id: "r1", project_id: "p1", user_id: "u2", content: "@u1 help?", created_at: new Date().toISOString() },
          { id: 2, room_id: "r2", project_id: "p1", user_id: "u2", content: "Hello", created_at: new Date().toISOString() },
        ],
      });
      const result = await computeRoomPriorities({ DB: db }, { projectId: "p1", userId: "u1" });
      expect(result.ok).toBe(true);
      expect(result.priorities.length).toBe(2);
      expect(result.priorities[0].score).toBeGreaterThan(0);
    });
  });

  describe("generateSuggestedResponses", () => {
    it("generates suggestions from messages", async () => {
      const db = createMockDb({
        messages: [
          { id: 1, room_id: "r1", project_id: "p1", user_id: "u2", content: "Can you review the PR?", created_at: "2026-06-11T10:00:00Z" },
        ],
      });
      const result = await generateSuggestedResponses({ DB: db }, {
        projectId: "p1", roomId: "r1", userId: "u1",
      });
      expect(result.ok).toBe(true);
      expect(Array.isArray(result.suggestions)).toBe(true);
    });
  });

  describe("getInboxView", () => {
    it("returns inbox with priorities and summaries", async () => {
      const db = createMockDb({
        priorities: [
          { id: "p1", project_id: "p1", room_id: "r1", user_id: "u1", priority_score: 15, priority_reason: "has_mention", has_mention: 1, has_question: 0, unread_count: 5, last_message_at: "2026-06-11T10:00:00Z", sentiment: null },
        ],
        summaries: [
          { id: "s1", project_id: "p1", room_id: "r1", user_id: "u1", summary: "Team discussed pricing", key_points: '["pricing","Q2"]', action_items: '["review proposal"]' },
        ],
        suggestions: [
          { project_id: "p1", room_id: "r1", user_id: "u1", response_text: "I'll review it now" },
        ],
      });
      const result = await getInboxView({ DB: db }, { projectId: "p1", userId: "u1" });
      expect(result.ok).toBe(true);
      expect(result.inbox.length).toBe(1);
      expect(result.needsAttention).toBe(1);
      expect(result.inbox[0].summary).toBe("Team discussed pricing");
      expect(result.inbox[0].suggestedResponses.length).toBe(1);
    });
  });
});
