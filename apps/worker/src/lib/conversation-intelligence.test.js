import { describe, expect, it } from "vitest";
import {
  canViewIntelligence,
  isQuestion,
  extractIntentLabel,
  storeQuestion,
  markQuestionAnswered,
  markUnansweredQuestions,
  listQuestions,
  getQuestionStats,
  upsertIntentCluster,
  getIntentClusters,
  getTopIntents,
  getEscalationReasons,
  getResolutionTimes,
  getModerationTrends,
  createSnapshot,
  getSnapshots,
  generateWeeklyDigest,
} from "./conversation-intelligence.js";

function createIntelligenceEnv(overrides = {}) {
  const questions = [];
  const intents = [];
  const snapshots = [];
  const assignments = [];
  const modQueue = [];

  let idCounter = 1;
  function nextId() { return `id-${idCounter++}`; }

  return {
    questions, intents, snapshots, assignments, modQueue, nextId,
    DB: {
      prepare(sql) {
        return {
          bind(...args) {
            return {
              async first() {
                if (sql.includes("SELECT id, frequency, sample_message_ids FROM intent_clusters")) {
                  return intents.find((i) => i.project_id === args[0] && i.intent_label === args[1]) || null;
                }
                return null;
              },
              async all() {
                if (sql.includes("FROM conversation_questions")) {
                  let filtered = questions.filter((q) => q.project_id === args[0]);
                  const parts = sql.split("?");
                  if (sql.includes("AND room_id = ?")) {
                    const roomIdx = parts.findIndex((p, i) => i > 0 && p.includes("room_id"));
                    if (roomIdx > 0 && args[roomIdx]) filtered = filtered.filter((q) => q.room_id === args[roomIdx]);
                  }
                  if (sql.includes("AND answer_status = ?")) {
                    const statusIdx = parts.findIndex((p, i) => i > 0 && p.includes("answer_status"));
                    if (statusIdx > 0 && args[statusIdx]) filtered = filtered.filter((q) => q.answer_status === args[statusIdx]);
                  }
                  if (sql.includes("GROUP BY answer_status")) {
                    const groups = {};
                    for (const q of filtered) {
                      if (!groups[q.answer_status]) groups[q.answer_status] = { count: 0, confSum: 0 };
                      groups[q.answer_status].count++;
                      groups[q.answer_status].confSum += q.confidence;
                    }
                    return { results: Object.entries(groups).map(([status, g]) => ({ answer_status: status, count: g.count, avg_confidence: g.confSum / g.count })) };
                  }
                  return { results: filtered.slice().reverse() };
                }
                if (sql.includes("FROM intent_clusters")) {
                  let filtered = intents.filter((i) => i.project_id === args[0]);
                  if (sql.includes("AND frequency >= ?")) filtered = filtered.filter((i) => i.frequency >= args[1]);
                  filtered = filtered.sort((a, b) => b.frequency - a.frequency);
                  const limitIdx = sql.lastIndexOf("LIMIT ?");
                  if (limitIdx !== -1) {
                    const limitArgIdx = sql.substring(0, limitIdx).split("?").length - 1;
                    const limit = args[limitArgIdx];
                    if (typeof limit === "number") filtered = filtered.slice(0, limit);
                  }
                  return { results: filtered };
                }
                if (sql.includes("FROM conversation_assignments")) {
                  let filtered = assignments.filter((a) => a.project_id === args[0]);
                  if (sql.includes("escalation_reason IS NOT NULL")) {
                    filtered = filtered.filter((a) => a.escalation_reason);
                    const groups = {};
                    for (const a of filtered) {
                      groups[a.escalation_reason] = (groups[a.escalation_reason] || 0) + 1;
                    }
                    return { results: Object.entries(groups).map(([reason, count]) => ({ escalation_reason: reason, count })) };
                  }
                  if (sql.includes("resolved_at IS NOT NULL")) {
                    return { results: filtered.filter((a) => a.resolved_at) };
                  }
                  return { results: filtered };
                }
                if (sql.includes("FROM ai_moderation_queue")) {
                  if (sql.includes("categories")) {
                    return { results: modQueue.filter((m) => m.project_id === args[0] && m.categories).map((m) => ({ categories: m.categories })) };
                  }
                  const groups = {};
                  for (const m of modQueue.filter((m) => m.project_id === args[0])) {
                    groups[m.severity] = (groups[m.severity] || 0) + 1;
                  }
                  return { results: Object.entries(groups).map(([severity, count]) => ({ severity, count })) };
                }
                if (sql.includes("FROM intelligence_snapshots")) {
                  let filtered = snapshots.filter((s) => s.project_id === args[0]);
                  if (sql.includes("AND snapshot_type = ?")) filtered = filtered.filter((s) => s.snapshot_type === args[1]);
                  return { results: filtered };
                }
                return { results: [] };
              },
              async run() {
                if (sql.includes("INSERT INTO conversation_questions")) {
                  const id = nextId();
                  questions.push({ id: args[0], project_id: args[1], room_id: args[2], message_id: args[3], user_id: args[4], question_text: args[5], answer_status: "unanswered", confidence: args[6], created_at: args[7] });
                  return { meta: { changes: 1 } };
                }
                if (sql.includes("UPDATE conversation_questions SET answer_status = 'no_answer'")) {
                  let count = 0;
                  const cutoff = new Date(args[2]).getTime();
                  for (const q of questions) {
                    if (q.project_id === args[0] && q.room_id === args[1] && q.answer_status === "unanswered" && new Date(q.created_at).getTime() < cutoff) {
                      q.answer_status = "no_answer";
                      count++;
                    }
                  }
                  return { meta: { changes: count } };
                }
                if (sql.includes("UPDATE conversation_questions SET answer_status")) {
                  let count = 0;
                  for (const q of questions) {
                    if (q.project_id === args[4] && q.message_id === args[5] && q.answer_status === "unanswered") {
                      q.answer_status = args[0];
                      q.answer_message_id = args[1];
                      q.answer_agent_id = args[2];
                      q.answered_at = args[3];
                      count++;
                    }
                  }
                  return { meta: { changes: count } };
                }
                if (sql.includes("INSERT INTO intent_clusters")) {
                  const id = nextId();
                  intents.push({ id, project_id: args[0], room_id: args[1], intent_label: args[2], intent_description: args[3], frequency: args[4], sample_message_ids: args[5], first_seen: args[6], last_seen: args[7], created_at: args[8], updated_at: args[9] });
                  return { meta: { changes: 1 } };
                }
                if (sql.includes("UPDATE intent_clusters SET frequency")) {
                  const intent = intents.find((i) => i.id === args[4]);
                  if (intent) {
                    intent.frequency = args[0];
                    intent.sample_message_ids = args[1];
                    intent.last_seen = args[2];
                    intent.updated_at = args[3];
                  }
                  return { meta: { changes: 1 } };
                }
                if (sql.includes("INSERT INTO intelligence_snapshots")) {
                  const id = nextId();
                  snapshots.push({ id, project_id: args[0], snapshot_type: args[1], data: args[2], period_start: args[3], period_end: args[4], room_id: args[5], created_at: args[6] });
                  return { meta: { changes: 1 } };
                }
                return { meta: { changes: 0 } };
              }
            };
          }
        };
      }
    },
    ...overrides
  };
}

describe("canViewIntelligence", () => {
  it("allows owner", () => { expect(canViewIntelligence(["owner"])).toBe(true); });
  it("allows admin", () => { expect(canViewIntelligence(["admin"])).toBe(true); });
  it("allows moderator", () => { expect(canViewIntelligence(["moderator"])).toBe(true); });
  it("rejects viewer", () => { expect(canViewIntelligence(["viewer"])).toBe(false); });
  it("rejects undefined", () => { expect(canViewIntelligence(undefined)).toBe(false); });
  it("rejects empty", () => { expect(canViewIntelligence([])).toBe(false); });
});

describe("isQuestion", () => {
  it("detects question mark", () => { expect(isQuestion("How do I login?")).toBe(true); });
  it("detects 'how' start", () => { expect(isQuestion("How can I reset my password")).toBe(true); });
  it("detects 'what' start", () => { expect(isQuestion("What is the pricing")).toBe(true); });
  it("detects 'help' keyword", () => { expect(isQuestion("help me with billing")).toBe(true); });
  it("rejects plain statement", () => { expect(isQuestion("I like the product")).toBe(false); });
  it("rejects empty", () => { expect(isQuestion("")).toBe(false); });
  it("rejects null", () => { expect(isQuestion(null)).toBe(false); });
});

describe("extractIntentLabel", () => {
  it("labels bug report", () => { expect(extractIntentLabel("There is an error on login")).toBe("bug_report"); });
  it("labels how-to", () => { expect(extractIntentLabel("How do I set up webhooks")).toBe("how_to"); });
  it("labels billing inquiry", () => { expect(extractIntentLabel("What is the pricing for pro plan")).toBe("billing_inquiry"); });
  it("labels feature request", () => { expect(extractIntentLabel("I wish you had dark mode")).toBe("feature_request"); });
  it("labels account access", () => { expect(extractIntentLabel("I am locked out of my account")).toBe("account_access"); });
  it("labels status update", () => { expect(extractIntentLabel("What is the status of my ticket")).toBe("status_update"); });
  it("labels cancellation", () => { expect(extractIntentLabel("I want to cancel my subscription")).toBe("cancellation"); });
  it("labels integration", () => { expect(extractIntentLabel("Can you connect to slack")).toBe("integration"); });
  it("labels performance", () => { expect(extractIntentLabel("The app is very slow")).toBe("performance"); });
  it("labels positive feedback", () => { expect(extractIntentLabel("Thanks for the great support")).toBe("positive_feedback"); });
  it("labels complaint", () => { expect(extractIntentLabel("This is terrible service")).toBe("complaint"); });
  it("falls back to words", () => { expect(extractIntentLabel("random unrelated text")).toBeTruthy(); });
  it("handles empty", () => { expect(extractIntentLabel("")).toBe("unknown"); });
  it("handles null", () => { expect(extractIntentLabel(null)).toBe("unknown"); });
});

describe("storeQuestion", () => {
  it("stores a question", async () => {
    const env = createIntelligenceEnv();
    const result = await storeQuestion(env.DB, { projectId: "p1", roomId: "r1", messageId: 42, userId: "u1", questionText: "How do I login?" });
    expect(result.id).toBeTruthy();
    expect(env.questions).toHaveLength(1);
    expect(env.questions[0].question_text).toBe("How do I login?");
    expect(env.questions[0].confidence).toBe(0.9);
  });

  it("stores low-confidence for non-question", async () => {
    const env = createIntelligenceEnv();
    await storeQuestion(env.DB, { projectId: "p1", roomId: "r1", messageId: 42, userId: "u1", questionText: "Just a statement" });
    expect(env.questions[0].confidence).toBe(0.5);
  });
});

describe("markQuestionAnswered", () => {
  it("marks question answered by agent", async () => {
    const env = createIntelligenceEnv();
    env.questions.push({ id: "q1", project_id: "p1", room_id: "r1", message_id: 42, user_id: "u1", question_text: "How?", answer_status: "unanswered", confidence: 0.9, created_at: new Date().toISOString() });
    const updated = await markQuestionAnswered(env.DB, { projectId: "p1", messageId: 42, answerMessageId: 43, answerAgentId: "agent1" });
    expect(updated).toBe(1);
    expect(env.questions[0].answer_status).toBe("answered_by_agent");
    expect(env.questions[0].answer_agent_id).toBe("agent1");
  });

  it("marks question answered by AI", async () => {
    const env = createIntelligenceEnv();
    env.questions.push({ id: "q1", project_id: "p1", room_id: "r1", message_id: 42, user_id: "u1", question_text: "How?", answer_status: "unanswered", confidence: 0.9, created_at: new Date().toISOString() });
    await markQuestionAnswered(env.DB, { projectId: "p1", messageId: 42, answerMessageId: 43, answerAgentId: null });
    expect(env.questions[0].answer_status).toBe("answered_by_ai");
  });

  it("returns 0 when no matching question", async () => {
    const env = createIntelligenceEnv();
    const updated = await markQuestionAnswered(env.DB, { projectId: "p1", messageId: 999, answerMessageId: 43, answerAgentId: "a1" });
    expect(updated).toBe(0);
  });
});

describe("markUnansweredQuestions", () => {
  it("marks old unanswered questions as no_answer", async () => {
    const env = createIntelligenceEnv();
    const oldDate = new Date(Date.now() - 60 * 60_000).toISOString();
    env.questions.push({ id: "q1", project_id: "p1", room_id: "r1", message_id: 1, user_id: "u1", question_text: "Old?", answer_status: "unanswered", confidence: 0.9, created_at: oldDate });
    env.questions.push({ id: "q2", project_id: "p1", room_id: "r1", message_id: 2, user_id: "u1", question_text: "New?", answer_status: "unanswered", confidence: 0.9, created_at: new Date().toISOString() });
    const updated = await markUnansweredQuestions(env.DB, { projectId: "p1", roomId: "r1", olderThanMinutes: 30 });
    expect(updated).toBe(1);
    expect(env.questions[0].answer_status).toBe("no_answer");
    expect(env.questions[1].answer_status).toBe("unanswered");
  });
});

describe("listQuestions", () => {
  it("lists questions", async () => {
    const env = createIntelligenceEnv();
    env.questions.push({ id: "q1", project_id: "p1", room_id: "r1", message_id: 1, user_id: "u1", question_text: "Q1?", answer_status: "unanswered", confidence: 0.9, created_at: "2026-01-01T00:00:00Z" });
    env.questions.push({ id: "q2", project_id: "p1", room_id: "r2", message_id: 2, user_id: "u2", question_text: "Q2?", answer_status: "answered_by_agent", confidence: 0.9, created_at: "2026-01-02T00:00:00Z" });
    const result = await listQuestions(env.DB, { projectId: "p1", roomId: "r1" });
    expect(result).toHaveLength(1);
    expect(result[0].roomId).toBe("r1");
  });

  it("filters by status", async () => {
    const env = createIntelligenceEnv();
    env.questions.push({ id: "q1", project_id: "p1", room_id: "r1", message_id: 1, user_id: "u1", question_text: "Q1?", answer_status: "unanswered", confidence: 0.9, created_at: "2026-01-01T00:00:00Z" });
    env.questions.push({ id: "q2", project_id: "p1", room_id: "r1", message_id: 2, user_id: "u2", question_text: "Q2?", answer_status: "answered_by_agent", confidence: 0.9, created_at: "2026-01-02T00:00:00Z" });
    const result = await listQuestions(env.DB, { projectId: "p1", status: "unanswered" });
    expect(result).toHaveLength(1);
    expect(result[0].answerStatus).toBe("unanswered");
  });
});

describe("getQuestionStats", () => {
  it("returns stats grouped by status", async () => {
    const env = createIntelligenceEnv();
    env.questions.push({ id: "q1", project_id: "p1", room_id: "r1", message_id: 1, user_id: "u1", question_text: "Q1?", answer_status: "unanswered", confidence: 0.9, created_at: "2026-01-01T00:00:00Z" });
    env.questions.push({ id: "q2", project_id: "p1", room_id: "r1", message_id: 2, user_id: "u2", question_text: "Q2?", answer_status: "answered_by_agent", confidence: 0.8, created_at: "2026-01-02T00:00:00Z" });
    env.questions.push({ id: "q3", project_id: "p1", room_id: "r1", message_id: 3, user_id: "u3", question_text: "Q3?", answer_status: "unanswered", confidence: 0.7, created_at: "2026-01-03T00:00:00Z" });
    const stats = await getQuestionStats(env.DB, { projectId: "p1" });
    expect(stats.total).toBe(3);
    expect(stats.unanswered).toBe(2);
    expect(stats.answered_by_agent).toBe(1);
    expect(stats.avgConfidence).toBeCloseTo(0.8, 1);
  });
});

describe("upsertIntentCluster", () => {
  it("creates new intent cluster", async () => {
    const env = createIntelligenceEnv();
    const result = await upsertIntentCluster(env.DB, { projectId: "p1", roomId: "r1", intentLabel: "bug_report", sampleMessageId: 42 });
    expect(result.isNew).toBe(true);
    expect(result.frequency).toBe(1);
    expect(env.intents).toHaveLength(1);
  });

  it("increments existing intent frequency", async () => {
    const env = createIntelligenceEnv();
    env.intents.push({ id: "i1", project_id: "p1", room_id: "r1", intent_label: "bug_report", intent_description: null, frequency: 5, sample_message_ids: "[42]", first_seen: "2026-01-01T00:00:00Z", last_seen: "2026-01-01T00:00:00Z", created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" });
    const result = await upsertIntentCluster(env.DB, { projectId: "p1", roomId: "r1", intentLabel: "bug_report", sampleMessageId: 43 });
    expect(result.isNew).toBe(false);
    expect(result.frequency).toBe(6);
  });
});

describe("getIntentClusters", () => {
  it("lists clusters ordered by frequency", async () => {
    const env = createIntelligenceEnv();
    env.intents.push({ id: "i1", project_id: "p1", room_id: "r1", intent_label: "bug_report", intent_description: null, frequency: 5, sample_message_ids: "[]", first_seen: "2026-01-01T00:00:00Z", last_seen: "2026-01-01T00:00:00Z", created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" });
    env.intents.push({ id: "i2", project_id: "p1", room_id: "r1", intent_label: "how_to", intent_description: null, frequency: 10, sample_message_ids: "[]", first_seen: "2026-01-01T00:00:00Z", last_seen: "2026-01-01T00:00:00Z", created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" });
    const result = await getIntentClusters(env.DB, { projectId: "p1" });
    expect(result[0].intentLabel).toBe("how_to");
    expect(result[1].intentLabel).toBe("bug_report");
  });
});

describe("getTopIntents", () => {
  it("returns top N intents", async () => {
    const env = createIntelligenceEnv();
    for (let i = 0; i < 5; i++) {
      env.intents.push({ id: `i${i}`, project_id: "p1", room_id: "r1", intent_label: `intent_${i}`, intent_description: null, frequency: i + 1, sample_message_ids: "[]", first_seen: "2026-01-01T00:00:00Z", last_seen: "2026-01-01T00:00:00Z", created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" });
    }
    const result = await getTopIntents(env.DB, { projectId: "p1", limit: 3 });
    expect(result).toHaveLength(3);
    expect(result[0].frequency).toBe(5);
  });
});

describe("getEscalationReasons", () => {
  it("groups by reason", async () => {
    const env = createIntelligenceEnv();
    env.assignments.push({ project_id: "p1", room_id: "r1", escalation_reason: "SLA breach", created_at: "2026-01-01T00:00:00Z" });
    env.assignments.push({ project_id: "p1", room_id: "r1", escalation_reason: "SLA breach", created_at: "2026-01-02T00:00:00Z" });
    env.assignments.push({ project_id: "p1", room_id: "r1", escalation_reason: "Skill mismatch", created_at: "2026-01-03T00:00:00Z" });
    const result = await getEscalationReasons(env.DB, { projectId: "p1" });
    expect(result).toHaveLength(2);
    expect(result[0].reason).toBe("SLA breach");
    expect(result[0].count).toBe(2);
  });
});

describe("getResolutionTimes", () => {
  it("computes resolution time stats", async () => {
    const env = createIntelligenceEnv();
    const base = Date.now();
    env.assignments.push({ project_id: "p1", room_id: "r1", strategy_used: "round_robin", created_at: new Date(base - 600_000).toISOString(), resolved_at: new Date(base - 300_000).toISOString() });
    env.assignments.push({ project_id: "p1", room_id: "r1", strategy_used: "round_robin", created_at: new Date(base - 1_200_000).toISOString(), resolved_at: new Date(base - 600_000).toISOString() });
    const result = await getResolutionTimes(env.DB, { projectId: "p1" });
    expect(result.count).toBe(2);
    expect(result.minMs).toBe(300_000);
    expect(result.maxMs).toBe(600_000);
    expect(result.avgMs).toBe(450_000);
  });

  it("returns zeros when no resolved tasks", async () => {
    const env = createIntelligenceEnv();
    const result = await getResolutionTimes(env.DB, { projectId: "p1" });
    expect(result.count).toBe(0);
    expect(result.avgMs).toBe(0);
  });
});

describe("getModerationTrends", () => {
  it("returns severity and category breakdown", async () => {
    const env = createIntelligenceEnv();
    env.modQueue.push({ project_id: "p1", severity: "low", categories: '["spam"]' });
    env.modQueue.push({ project_id: "p1", severity: "high", categories: '["toxicity", "harassment"]' });
    env.modQueue.push({ project_id: "p1", severity: "low", categories: '["spam"]' });
    const result = await getModerationTrends(env.DB, { projectId: "p1" });
    expect(result.severityBreakdown).toHaveLength(2);
    expect(result.categoryBreakdown.length).toBeGreaterThan(0);
  });
});

describe("createSnapshot", () => {
  it("creates a snapshot", async () => {
    const env = createIntelligenceEnv();
    const result = await createSnapshot(env.DB, { projectId: "p1", snapshotType: "weekly_digest", data: { foo: 1 }, periodStart: "2026-01-01", periodEnd: "2026-01-07" });
    expect(result.id).toBeTruthy();
    expect(env.snapshots).toHaveLength(1);
  });
});

describe("getSnapshots", () => {
  it("lists snapshots", async () => {
    const env = createIntelligenceEnv();
    env.snapshots.push({ id: "s1", project_id: "p1", snapshot_type: "weekly_digest", data: "{}", period_start: "2026-01-01", period_end: "2026-01-07", room_id: null, created_at: "2026-01-07T00:00:00Z" });
    const result = await getSnapshots(env.DB, { projectId: "p1", snapshotType: "weekly_digest" });
    expect(result).toHaveLength(1);
  });
});

describe("generateWeeklyDigest", () => {
  it("generates digest with all sections", async () => {
    const env = createIntelligenceEnv();
    env.questions.push({ id: "q1", project_id: "p1", room_id: "r1", message_id: 1, user_id: "u1", question_text: "Q1?", answer_status: "unanswered", confidence: 0.9, created_at: "2026-01-01T00:00:00Z" });
    env.intents.push({ id: "i1", project_id: "p1", room_id: "r1", intent_label: "bug_report", intent_description: null, frequency: 10, sample_message_ids: "[]", first_seen: "2026-01-01T00:00:00Z", last_seen: "2026-01-07T00:00:00Z", created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-07T00:00:00Z" });
    env.modQueue.push({ project_id: "p1", severity: "medium", categories: '["spam"]' });
    const digest = await generateWeeklyDigest(env.DB, { projectId: "p1", periodStart: "2026-01-01", periodEnd: "2026-01-07" });
    expect(digest.periodStart).toBeTruthy();
    expect(digest.questions).toBeTruthy();
    expect(digest.topIntents).toBeTruthy();
    expect(digest.escalations).toBeTruthy();
    expect(digest.resolutionTimes).toBeTruthy();
    expect(digest.moderationTrends).toBeTruthy();
  });
});
