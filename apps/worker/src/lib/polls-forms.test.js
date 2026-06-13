import { describe, it, expect } from "vitest";
import {
  createPoll,
  votePoll,
  getPollResults,
  closePoll,
  createForm,
  submitForm,
  getFormResults,
} from "./polls-forms.js";

function createMockDb({ polls = [], options = [], votes = [], forms = [], submissions = [] } = {}) {
  return {
    polls: [...polls], options: [...options], votes: [...votes],
    forms: [...forms], submissions: [...submissions],
    prepare(sql) {
      const self = this;
      return {
        bind(...args) {
          return {
            async all() {
              if (sql.includes("FROM poll_options WHERE poll_id")) {
                return { results: self.options.filter((o) => o.poll_id === args[0]) };
              }
              if (sql.includes("FROM poll_votes WHERE poll_id")) {
                if (sql.includes("option_id")) {
                  return { results: self.votes.filter((v) => v.poll_id === args[0] && v.option_id === args[1]) };
                }
                return { results: self.votes.filter((v) => v.poll_id === args[0]) };
              }
              if (sql.includes("FROM form_submissions WHERE form_id")) {
                return { results: self.submissions.filter((s) => s.form_id === args[0]) };
              }
              return { results: [] };
            },
            async first() {
              if (sql.includes("SELECT * FROM polls WHERE id")) {
                return self.polls.find((p) => p.id === args[0]) || null;
              }
              if (sql.includes("SELECT id FROM poll_options WHERE id")) {
                return self.options.find((o) => o.id === args[0] && o.poll_id === args[1]) || null;
              }
              if (sql.includes("COUNT(DISTINCT user_id)")) {
                const unique = new Set(self.votes.filter((v) => v.poll_id === args[0]).map((v) => v.user_id));
                return { cnt: unique.size };
              }
              if (sql.includes("COUNT(*)") && sql.includes("poll_votes")) {
                return { cnt: self.votes.filter((v) => v.poll_id === args[0] && v.option_id === args[1]).length };
              }
              if (sql.includes("SELECT * FROM forms WHERE id")) {
                return self.forms.find((f) => f.id === args[0]) || null;
              }
              if (sql.includes("SELECT id FROM form_submissions WHERE form_id")) {
                return self.submissions.find((s) => s.form_id === args[0] && s.user_id === args[1]) || null;
              }
              if (sql.includes("COUNT(*)") && sql.includes("form_submissions")) {
                return { cnt: self.submissions.filter((s) => s.form_id === args[0]).length };
              }
              if (sql.includes("SELECT project_id FROM api_tokens")) {
                return { project_id: "p1" };
              }
              return null;
            },
            async run() {
              if (sql.includes("INSERT INTO polls")) {
                self.polls.push({
                  id: args[0], project_id: args[1], room_id: args[2], created_by: args[3],
                  title: args[4], description: args[5], poll_type: args[6],
                  is_anonymous: args[7], max_selections: args[8], expires_at: args[9],
                  created_at: args[10], is_closed: 0, closed_at: null,
                });
                return { meta: { changes: 1 } };
              }
              if (sql.includes("INSERT INTO poll_options")) {
                self.options.push({ id: args[0], poll_id: args[1], option_text: args[2], sort_order: args[3], color: args[4] });
                return { meta: { changes: 1 } };
              }
              if (sql.includes("DELETE FROM poll_votes")) {
                const before = self.votes.length;
                self.votes = self.votes.filter((v) => !(v.poll_id === args[0] && v.user_id === args[1]));
                return { meta: { changes: before - self.votes.length } };
              }
              if (sql.includes("INSERT INTO poll_votes")) {
                self.votes.push({ id: args[0], poll_id: args[1], option_id: args[2], user_id: args[3], created_at: args[4] });
                return { meta: { changes: 1 } };
              }
              if (sql.includes("UPDATE polls SET is_closed")) {
                for (const p of self.polls) {
                  if (p.id === args[1]) { p.is_closed = 1; p.closed_at = args[0]; }
                }
                return { meta: { changes: 1 } };
              }
              if (sql.includes("INSERT INTO forms")) {
                self.forms.push({
                  id: args[0], project_id: args[1], room_id: args[2], created_by: args[3],
                  title: args[4], description: args[5], form_schema: args[6],
                  is_anonymous: args[7], expires_at: args[8], created_at: args[9],
                  is_closed: 0, closed_at: null,
                });
                return { meta: { changes: 1 } };
              }
              if (sql.includes("INSERT INTO form_submissions")) {
                self.submissions.push({ id: args[0], form_id: args[1], user_id: args[2], response_json: args[3], created_at: args[4] });
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

describe("polls-forms", () => {
  describe("createPoll", () => {
    it("creates a poll with options", async () => {
      const db = createMockDb();
      const result = await createPoll({ DB: db }, {
        projectId: "p1", roomId: "r1", createdBy: "u1",
        title: "Favorite color?", options: ["Red", "Blue", "Green"],
      });
      expect(result.ok).toBe(true);
      expect(result.id).toBeTruthy();
      expect(db.polls.length).toBe(1);
      expect(db.options.length).toBe(3);
    });
    it("creates rating poll with auto options", async () => {
      const db = createMockDb();
      const result = await createPoll({ DB: db }, {
        projectId: "p1", roomId: "r1", createdBy: "u1",
        title: "Rate us", pollType: "rating", options: ["x"],
      });
      expect(result.ok).toBe(true);
      expect(db.options.length).toBe(5);
    });
    it("creates yes_no poll", async () => {
      const db = createMockDb();
      const result = await createPoll({ DB: db }, {
        projectId: "p1", roomId: "r1", createdBy: "u1",
        title: "Agreed?", pollType: "yes_no", options: ["x"],
      });
      expect(result.ok).toBe(true);
      expect(db.options.length).toBe(2);
    });
    it("rejects missing title", async () => {
      const db = createMockDb();
      const result = await createPoll({ DB: db }, {
        projectId: "p1", roomId: "r1", createdBy: "u1", title: "  ", options: ["A"],
      });
      expect(result.ok).toBe(false);
    });
    it("rejects missing options", async () => {
      const db = createMockDb();
      const result = await createPoll({ DB: db }, {
        projectId: "p1", roomId: "r1", createdBy: "u1", title: "Q", options: [],
      });
      expect(result.ok).toBe(false);
    });
  });

  describe("votePoll", () => {
    it("records a vote", async () => {
      const db = createMockDb({
        polls: [{ id: "poll1", project_id: "p1", created_by: "u1", is_closed: 0, expires_at: null, poll_type: "single", max_selections: 1 }],
        options: [{ id: "opt1", poll_id: "poll1" }],
      });
      const result = await votePoll({ DB: db }, {
        projectId: "p1", pollId: "poll1", optionIds: ["opt1"], userId: "u2",
      });
      expect(result.ok).toBe(true);
      expect(db.votes.length).toBe(1);
    });
    it("rejects vote on closed poll", async () => {
      const db = createMockDb({
        polls: [{ id: "poll1", project_id: "p1", created_by: "u1", is_closed: 1, expires_at: null, poll_type: "single", max_selections: 1 }],
      });
      const result = await votePoll({ DB: db }, {
        projectId: "p1", pollId: "poll1", optionIds: ["opt1"], userId: "u2",
      });
      expect(result.ok).toBe(false);
      expect(result.error).toBe("poll_closed");
    });
    it("rejects author voting own poll", async () => {
      const db = createMockDb({
        polls: [{ id: "poll1", project_id: "p1", created_by: "u1", is_closed: 0, expires_at: null, poll_type: "single", max_selections: 1 }],
      });
      const result = await votePoll({ DB: db }, {
        projectId: "p1", pollId: "poll1", optionIds: ["opt1"], userId: "u1",
      });
      expect(result.ok).toBe(false);
      expect(result.error).toBe("cannot_vote_own_poll");
    });
  });

  describe("getPollResults", () => {
    it("returns results with counts", async () => {
      const db = createMockDb({
        polls: [{ id: "poll1", project_id: "p1", created_by: "u1", title: "Q", description: null, poll_type: "single", is_anonymous: 0, is_closed: 0, expires_at: null, created_at: "2026-01-01", closed_at: null, max_selections: 1 }],
        options: [{ id: "opt1", poll_id: "poll1", option_text: "A", sort_order: 0, color: null }, { id: "opt2", poll_id: "poll1", option_text: "B", sort_order: 1, color: null }],
        votes: [{ poll_id: "poll1", option_id: "opt1", user_id: "u1" }, { poll_id: "poll1", option_id: "opt1", user_id: "u2" }, { poll_id: "poll1", option_id: "opt2", user_id: "u3" }],
      });
      const result = await getPollResults({ DB: db }, { projectId: "p1", pollId: "poll1" });
      expect(result.ok).toBe(true);
      expect(result.totalVoters).toBe(3);
      expect(result.options[0].votes).toBe(2);
      expect(result.options[1].votes).toBe(1);
    });
  });

  describe("closePoll", () => {
    it("closes a poll", async () => {
      const db = createMockDb({
        polls: [{ id: "poll1", project_id: "p1", created_by: "u1", is_closed: 0 }],
      });
      const result = await closePoll({ DB: db }, { projectId: "p1", pollId: "poll1", userId: "u1" });
      expect(result.ok).toBe(true);
    });
    it("rejects non-author closing", async () => {
      const db = createMockDb({
        polls: [{ id: "poll1", project_id: "p1", created_by: "u1", is_closed: 0 }],
      });
      const result = await closePoll({ DB: db }, { projectId: "p1", pollId: "poll1", userId: "u2" });
      expect(result.ok).toBe(false);
    });
  });

  describe("createForm", () => {
    it("creates a form", async () => {
      const db = createMockDb();
      const result = await createForm({ DB: db }, {
        projectId: "p1", roomId: "r1", createdBy: "u1",
        title: "Feedback", schema: { fields: [{ name: "rating", type: "number" }] },
      });
      expect(result.ok).toBe(true);
      expect(db.forms.length).toBe(1);
    });
    it("rejects missing fields", async () => {
      const db = createMockDb();
      const result = await createForm({ DB: db }, {
        projectId: "p1", roomId: "r1", createdBy: "u1",
        title: "Feedback", schema: { fields: [] },
      });
      expect(result.ok).toBe(false);
    });
  });

  describe("submitForm", () => {
    it("submits a response", async () => {
      const db = createMockDb({
        forms: [{ id: "f1", project_id: "p1", is_closed: 0, expires_at: null, form_schema: "{}" }],
      });
      const result = await submitForm({ DB: db }, {
        projectId: "p1", formId: "f1", userId: "u1", response: { rating: 5 },
      });
      expect(result.ok).toBe(true);
      expect(db.submissions.length).toBe(1);
    });
    it("rejects duplicate submission", async () => {
      const db = createMockDb({
        forms: [{ id: "f1", project_id: "p1", is_closed: 0, expires_at: null, form_schema: "{}" }],
        submissions: [{ form_id: "f1", user_id: "u1" }],
      });
      const result = await submitForm({ DB: db }, {
        projectId: "p1", formId: "f1", userId: "u1", response: { rating: 5 },
      });
      expect(result.ok).toBe(false);
      expect(result.error).toBe("already_submitted");
    });
  });

  describe("getFormResults", () => {
    it("returns form with submissions", async () => {
      const db = createMockDb({
        forms: [{ id: "f1", project_id: "p1", title: "Feedback", description: null, form_schema: '{"fields":[]}', is_anonymous: 0, is_closed: 0, expires_at: null, created_by: "u1", created_at: "2026-01-01" }],
        submissions: [{ id: "s1", form_id: "f1", user_id: "u1", response_json: '{"rating":5}', created_at: "2026-01-01" }],
      });
      const result = await getFormResults({ DB: db }, { projectId: "p1", formId: "f1" });
      expect(result.ok).toBe(true);
      expect(result.totalSubmissions).toBe(1);
      expect(result.submissions[0].response.rating).toBe(5);
    });
  });
});
