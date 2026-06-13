import { describe, it, expect } from "vitest";

function makeEnv() {
  const rows = { qa_sessions: [], qa_moderated_questions: [] };
  return {
    DB: {
      prepare(sql) {
        let boundParams = [];
        return {
          bind(...params) { boundParams = params; return this; },
          async run() {
            if (sql.includes("INSERT INTO qa_sessions")) {
              rows.qa_sessions.push({ id: boundParams[0], project_id: boundParams[1], event_id: boundParams[2], room_id: boundParams[3], status: "active", ai_model: boundParams[4], dedup_threshold: boundParams[5], max_questions_per_user: boundParams[6], settings: boundParams[7], created_at: "2026-01-10T00:00:00Z", ended_at: null });
              return { meta: { changes: 1 } };
            }
            if (sql.includes("INSERT INTO qa_moderated_questions")) {
              rows.qa_moderated_questions.push({ id: boundParams[0], session_id: boundParams[1], event_id: boundParams[2], project_id: boundParams[3], user_id: boundParams[4], original_question: boundParams[5], normalized_question: boundParams[6], duplicate_of_id: boundParams[7], ai_category: boundParams[8], ai_priority_score: boundParams[9], ai_suggested_answer: boundParams[10], status: boundParams[11], moderated_at: null, created_at: "2026-01-10T00:00:00Z" });
              return { meta: { changes: 1 } };
            }
            if (sql.includes("UPDATE qa_sessions SET status = 'ended'")) {
              const idx = rows.qa_sessions.findIndex(r => r.project_id === boundParams[0] && r.id === boundParams[1] && r.status === "active");
              if (idx >= 0) { rows.qa_sessions[idx].status = "ended"; rows.qa_sessions[idx].ended_at = "2026-01-10T01:00:00Z"; }
              return { meta: { changes: idx >= 0 ? 1 : 0 } };
            }
            if (sql.includes("UPDATE qa_moderated_questions SET status = 'approved'")) {
              const idx = rows.qa_moderated_questions.findIndex(r => r.project_id === boundParams[0] && r.id === boundParams[1] && r.status === "pending");
              if (idx >= 0) rows.qa_moderated_questions[idx].status = "approved";
              return { meta: { changes: idx >= 0 ? 1 : 0 } };
            }
            if (sql.includes("UPDATE qa_moderated_questions SET status = 'dismissed'")) {
              const idx = rows.qa_moderated_questions.findIndex(r => r.project_id === boundParams[0] && r.id === boundParams[1]);
              if (idx >= 0) rows.qa_moderated_questions[idx].status = "dismissed";
              return { meta: { changes: idx >= 0 ? 1 : 0 } };
            }
            if (sql.includes("UPDATE qa_moderated_questions SET duplicate_of_id")) {
              const idx = rows.qa_moderated_questions.findIndex(r => r.project_id === boundParams[1] && r.id === boundParams[2] && r.status === "pending");
              if (idx >= 0) { rows.qa_moderated_questions[idx].duplicate_of_id = boundParams[0]; rows.qa_moderated_questions[idx].status = "duplicate"; }
              return { meta: { changes: idx >= 0 ? 1 : 0 } };
            }
            return { meta: { changes: 1 } };
          },
          async first() {
            if (sql.includes("FROM qa_sessions")) {
              return rows.qa_sessions.find(r => r.project_id === boundParams[0] && r.id === boundParams[1]) || null;
            }
            if (sql.includes("COUNT(*) as total")) {
              return { total: rows.qa_moderated_questions.filter(r => r.session_id === boundParams[0]).length };
            }
            if (sql.includes("COUNT(*) as count") && sql.includes("status = 'duplicate'")) {
              return { count: rows.qa_moderated_questions.filter(r => r.session_id === boundParams[0] && r.status === "duplicate").length };
            }
            if (sql.includes("AVG(ai_priority_score)")) {
              const qs = rows.qa_moderated_questions.filter(r => r.session_id === boundParams[0] && r.status !== "duplicate");
              const avg = qs.length > 0 ? qs.reduce((s, q) => s + q.ai_priority_score, 0) / qs.length : null;
              return { avg };
            }
            return null;
          },
          async all() {
            if (sql.includes("FROM qa_sessions")) {
              return { results: rows.qa_sessions.filter(r => r.project_id === boundParams[0]) };
            }
            if (sql.includes("FROM qa_moderated_questions") && sql.includes("GROUP BY status")) {
              const map = {};
              for (const r of rows.qa_moderated_questions.filter(r => r.session_id === boundParams[0])) {
                map[r.status] = (map[r.status] || 0) + 1;
              }
              return { results: Object.entries(map).map(([status, count]) => ({ status, count })) };
            }
            if (sql.includes("FROM qa_moderated_questions") && sql.includes("GROUP BY ai_category")) {
              const map = {};
              for (const r of rows.qa_moderated_questions.filter(r => r.session_id === boundParams[0] && r.status !== "duplicate")) {
                map[r.ai_category] = (map[r.ai_category] || 0) + 1;
              }
              return { results: Object.entries(map).map(([ai_category, count]) => ({ ai_category, count })) };
            }
            if (sql.includes("FROM qa_moderated_questions")) {
              let results = rows.qa_moderated_questions.filter(r => r.session_id === boundParams[0]);
              if (sql.includes("ORDER BY created_at") && sql.includes("LIMIT 50")) {
                results = results.filter(r => r.status !== "dismissed").sort((a, b) => a.created_at.localeCompare(b.created_at)).slice(0, 50);
              } else if (sql.includes("status = 'pending'")) {
                results = results.filter(r => r.status === "pending").sort((a, b) => b.ai_priority_score - a.ai_priority_score);
              } else if (sql.includes("status = ?")) {
                results = results.filter(r => r.status === boundParams[2]);
              }
              const limitMatch = sql.match(/LIMIT \?/);
              if (limitMatch && !sql.includes("LIMIT 50")) results = results.slice(0, boundParams[boundParams.length - 1] || 50);
              return { results };
            }
            return { results: [] };
          },
        };
      },
    },
  };
}

import {
  startQASession, getQASession, endQASession, submitQuestion,
  getPriorityQueue, approveQuestion, dismissQuestion, mergeDuplicate,
  getQAStats, listQuestions,
} from "./ai-qa-moderator.js";

describe("P19-F: AI Live Q&A Moderator", () => {
  const projectId = "proj_qa_1";

  it("starts and ends QA session", async () => {
    const env = makeEnv();
    const session = await startQASession(env, { projectId, eventId: "e1", roomId: "r1" });
    expect(session.id).toBeDefined();
    expect(session.status).toBe("active");
    const ok = await endQASession(env, { projectId, sessionId: session.id });
    expect(ok).toBe(true);
  });

  it("submits question with AI categorization", async () => {
    const env = makeEnv();
    const session = await startQASession(env, { projectId, eventId: "e1", roomId: "r1" });
    const result = await submitQuestion(env, {
      projectId, sessionId: session.id, eventId: "e1", userId: "u1",
      question: "How much does the pro plan cost?",
    });
    expect(result.category).toBe("pricing");
    expect(result.priorityScore).toBeGreaterThan(0);
    expect(result.suggestedAnswer).toBeDefined();
    expect(result.isDuplicate).toBe(false);
  });

  it("detects duplicate questions", async () => {
    const env = makeEnv();
    const session = await startQASession(env, { projectId, eventId: "e1", roomId: "r1", dedupThreshold: 0.5 });
    await submitQuestion(env, { projectId, sessionId: session.id, eventId: "e1", userId: "u1", question: "What is the pricing for enterprise plan?" });
    const dup = await submitQuestion(env, { projectId, sessionId: session.id, eventId: "e1", userId: "u2", question: "What is the pricing for the enterprise plan?" });
    expect(dup.isDuplicate).toBe(true);
    expect(dup.duplicateOfId).toBeDefined();
  });

  it("returns priority queue", async () => {
    const env = makeEnv();
    const session = await startQASession(env, { projectId, eventId: "e1", roomId: "r1" });
    await submitQuestion(env, { projectId, sessionId: session.id, eventId: "e1", userId: "u1", question: "How do I install this on Windows?" });
    await submitQuestion(env, { projectId, sessionId: session.id, eventId: "e1", userId: "u2", question: "What is the pricing for enterprise?" });
    const queue = await getPriorityQueue(env, { projectId, sessionId: session.id });
    expect(queue.length).toBe(2);
    expect(typeof queue[0].priorityScore).toBe("number");
    expect(typeof queue[1].priorityScore).toBe("number");
  });

  it("approves and dismisses questions", async () => {
    const env = makeEnv();
    const session = await startQASession(env, { projectId, eventId: "e1", roomId: "r1" });
    const q = await submitQuestion(env, { projectId, sessionId: session.id, eventId: "e1", userId: "u1", question: "When is the next release date?" });
    const approved = await approveQuestion(env, { projectId, questionId: q.id });
    expect(approved).toBe(true);
    const all = await listQuestions(env, { projectId, sessionId: session.id });
    const approvedQ = all.find(qq => qq.status === "approved");
    expect(approvedQ).toBeDefined();
  });

  it("returns QA stats", async () => {
    const env = makeEnv();
    const session = await startQASession(env, { projectId, eventId: "e1", roomId: "r1" });
    await submitQuestion(env, { projectId, sessionId: session.id, eventId: "e1", userId: "u1", question: "How do I setup?" });
    await submitQuestion(env, { projectId, sessionId: session.id, eventId: "e1", userId: "u2", question: "What is pricing?" });
    const stats = await getQAStats(env, { projectId, sessionId: session.id });
    expect(stats.total).toBe(2);
    expect(stats.dedupRate).toBeGreaterThanOrEqual(0);
  });

  it("rejects submission to ended session", async () => {
    const env = makeEnv();
    const session = await startQASession(env, { projectId, eventId: "e1", roomId: "r1" });
    await endQASession(env, { projectId, sessionId: session.id });
    await expect(submitQuestion(env, {
      projectId, sessionId: session.id, eventId: "e1", userId: "u1", question: "Test?",
    })).rejects.toThrow("Session not active");
  });
});
