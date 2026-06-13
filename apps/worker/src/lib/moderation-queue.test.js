import { describe, expect, it } from "vitest";
import {
  canModerateQueue,
  getPriorityQueue,
  bulkReviewEvents,
  submitFeedback,
  getFeedbackStats,
  getSlaConfigs,
  upsertSlaConfig,
  scanSlaBreaches,
  getUnresolvedBreaches,
  resolveBreach,
  getReviewHistory,
} from "./moderation-queue.js";

function createModQueueEnv() {
  const queue = [];
  const feedback = [];
  const slaConfigs = [];
  const slaBreaches = [];
  const moderationEvents = [];
  const messages = [];

  return {
    queue, feedback, slaConfigs, slaBreaches, moderationEvents, messages,
    DB: {
      prepare(sql) {
        const isSelect = sql.trimStart().startsWith("SELECT");
        const isInsert = sql.includes("INSERT INTO");
        const isUpdate = sql.includes("UPDATE");
        const isCount = sql.includes("COUNT(*)");

        return {
          bind(...args) {
            return {
              async first() {
                if (isCount) {
                  let items = queue.filter((e) => e.project_id === args[0]);
                  return { cnt: items.length };
                }
                if (sql.includes("FROM ai_moderation_queue WHERE id = ?")) {
                  return queue.find((e) => e.id === args[0] && e.project_id === args[1]) || null;
                }
                if (sql.includes("FROM moderation_feedback WHERE queue_event_id = ?")) {
                  return feedback.find((f) => f.queue_event_id === args[0] && f.moderator_id === args[1]) || null;
                }
                if (sql.includes("FROM moderation_sla_breaches WHERE queue_event_id = ?")) {
                  return slaBreaches.find((b) => b.queue_event_id === args[0]) || null;
                }
                return null;
              },
              async all() {
                if (sql.includes("FROM ai_moderation_queue")) {
                  let items = queue.filter((e) => e.project_id === args[0]);
                  if (sql.includes("AND room_id")) items = items.filter((e) => e.room_id === args[1]);
                  if (sql.includes("AND severity")) items = items.filter((e) => e.severity === args[sql.includes("AND room_id") ? 2 : 1]);
                  if (sql.includes("reviewed_by IS NULL")) items = items.filter((e) => !e.reviewed_by);
                  if (sql.includes("reviewed_by IS NOT NULL")) items = items.filter((e) => e.reviewed_by);
                  if (sql.includes("reviewed_by =")) {
                    const revIdx = sql.split("?").findIndex((p, i) => i > 0 && p.includes("reviewed_by ="));
                    items = items.filter((e) => e.reviewed_by === args[revIdx]);
                  }
                  if (sql.includes("created_at <")) {
                    const ctIdx = sql.split("?").findIndex((p, i) => i > 0 && p.includes("created_at <"));
                    const cutoff = new Date(args[ctIdx]).getTime();
                    items = items.filter((e) => new Date(e.created_at).getTime() < cutoff);
                  }
                  return { results: items };
                }
                if (sql.includes("FROM moderation_feedback")) {
                  let items = feedback.filter((f) => f.project_id === args[0]);
                  if (sql.includes("COUNT(*)")) {
                    const groups = {};
                    for (const f of items) { groups[f.feedback_type] = (groups[f.feedback_type] || 0) + 1; }
                    return { results: Object.entries(groups).map(([t, c]) => ({ feedback_type: t, count: c })) };
                  }
                  return { results: items };
                }
                if (sql.includes("FROM moderation_sla_config")) {
                  return { results: slaConfigs.filter((c) => c.project_id === args[0]) };
                }
                if (sql.includes("FROM moderation_sla_breaches")) {
                  let items = slaBreaches.filter((b) => b.project_id === args[0]);
                  if (sql.includes("resolved_at IS NULL")) items = items.filter((b) => !b.resolved_at);
                  return { results: items };
                }
                return { results: [] };
              },
              async run() {
                if (isInsert && sql.includes("ai_moderation_queue")) {
                  queue.push({
                    id: args[0], project_id: args[1], room_id: args[2], message_id: args[3],
                    user_id: args[4], content: args[5], severity: args[6], categories: args[7],
                    reason: args[8], confidence: args[9], suggested_action: args[10],
                    auto_action_taken: args[11], source_message_id: args[13],
                    reviewed_by: null, reviewed_at: null, review_action: null, review_notes: null,
                    created_at: args[14], updated_at: args[15],
                  });
                  return { meta: { changes: 1 } };
                }
                if (isUpdate && sql.includes("reviewed_by")) {
                  const evt = queue.find((e) => e.id === args[5]);
                  if (evt) { evt.reviewed_by = args[0]; evt.reviewed_at = args[1]; evt.review_action = args[2]; evt.review_notes = args[3]; }
                  return { meta: { changes: evt ? 1 : 0 } };
                }
                if (isInsert && sql.includes("moderation_feedback")) {
                  feedback.push({ id: args[0], project_id: args[1], queue_event_id: args[2], moderator_id: args[3], feedback_type: args[4], reason: args[5], category_accuracy: args[6], created_at: args[7] });
                  return { meta: { changes: 1 } };
                }
                if (isInsert && sql.includes("moderation_sla_config")) {
                  const existing = slaConfigs.find((c) => c.project_id === args[1] && c.severity === args[2]);
                  if (existing) { existing.sla_minutes = args[3]; existing.escalation_enabled = args[4]; existing.escalation_severity = args[5]; }
                  else { slaConfigs.push({ id: args[0], project_id: args[1], severity: args[2], sla_minutes: args[3], escalation_enabled: args[4], escalation_severity: args[5], enabled: 1 }); }
                  return { meta: { changes: 1 } };
                }
                if (isInsert && sql.includes("moderation_sla_breaches")) {
                  slaBreaches.push({ id: args[0], project_id: args[1], queue_event_id: args[2], severity: args[3], sla_minutes: args[4], breached_at: args[5], escalated_to: null, resolved_at: null, created_at: args[6] });
                  return { meta: { changes: 1 } };
                }
                if (isInsert && sql.includes("moderation_events")) {
                  moderationEvents.push({ project_id: args[0], room_id: args[1], user_id: args[2], action: args[3], reason: args[4] });
                  return { meta: { changes: 1 } };
                }
                if (isUpdate && sql.includes("resolved_at")) {
                  const b = slaBreaches.find((x) => x.id === args[1] && x.project_id === args[2] && !x.resolved_at);
                  if (b) b.resolved_at = args[0];
                  return { meta: { changes: b ? 1 : 0 } };
                }
                if (isUpdate && sql.includes("messages")) {
                  return { meta: { changes: 1 } };
                }
                return { meta: { changes: 0 } };
              }
            };
          }
        };
      }
    }
  };
}

function pushEvt(env, overrides = {}) {
  const id = `evt-${env.queue.length + 1}`;
  env.queue.push({
    id, project_id: "p1", room_id: "r1", message_id: 1, user_id: "u1", content: "test",
    severity: "medium", categories: '["spam"]', reason: "spam", confidence: 0.8,
    suggested_action: "flag", auto_action_taken: null, reviewed_by: null, reviewed_at: null,
    review_action: null, review_notes: null, source_message_id: 1,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    ...overrides
  });
  return id;
}

describe("canModerateQueue", () => {
  it("allows owner", () => { expect(canModerateQueue(["owner"])).toBe(true); });
  it("allows admin", () => { expect(canModerateQueue(["admin"])).toBe(true); });
  it("allows moderator", () => { expect(canModerateQueue(["moderator"])).toBe(true); });
  it("rejects viewer", () => { expect(canModerateQueue(["viewer"])).toBe(false); });
  it("rejects undefined", () => { expect(canModerateQueue(undefined)).toBe(false); });
});

describe("getPriorityQueue", () => {
  it("returns events sorted by priority score", async () => {
    const env = createModQueueEnv();
    pushEvt(env, { severity: "low", confidence: 0.5, created_at: new Date(Date.now() - 3600_000).toISOString() });
    pushEvt(env, { severity: "critical", confidence: 0.95, created_at: new Date().toISOString() });
    const result = await getPriorityQueue(env, { projectId: "p1" });
    expect(result.ok).toBe(true);
    expect(result.events).toHaveLength(2);
    expect(result.events[0].severity).toBe("critical");
    expect(result.events[0].priorityScore).toBeGreaterThan(result.events[1].priorityScore);
  });

  it("filters by pending", async () => {
    const env = createModQueueEnv();
    pushEvt(env, { reviewed_by: null });
    pushEvt(env, { reviewed_by: "mod1", reviewed_at: "2026-01-01", review_action: "confirm" });
    const result = await getPriorityQueue(env, { projectId: "p1", pending: true });
    expect(result.events).toHaveLength(1);
    expect(result.events[0].reviewedBy).toBeNull();
  });
});

describe("bulkReviewEvents", () => {
  it("bulk confirms events", async () => {
    const env = createModQueueEnv();
    const id1 = pushEvt(env, { suggested_action: "flag" });
    const id2 = pushEvt(env, { suggested_action: "warn" });
    const result = await bulkReviewEvents(env, { projectId: "p1", eventIds: [id1, id2], moderatorId: "mod1", action: "confirm" });
    expect(result.ok).toBe(true);
    expect(result.processed).toBe(2);
    expect(result.failed).toBe(0);
    expect(env.queue.find((e) => e.id === id1).review_action).toBe("confirm");
    expect(env.queue.find((e) => e.id === id2).review_action).toBe("confirm");
  });

  it("bulk dismisses events", async () => {
    const env = createModQueueEnv();
    const id1 = pushEvt(env);
    await bulkReviewEvents(env, { projectId: "p1", eventIds: [id1], moderatorId: "mod1", action: "dismiss" });
    expect(env.queue.find((e) => e.id === id1).review_action).toBe("dismiss");
  });

  it("returns error for empty eventIds", async () => {
    const env = createModQueueEnv();
    const result = await bulkReviewEvents(env, { projectId: "p1", eventIds: [], moderatorId: "mod1", action: "confirm" });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("eventIds_required");
  });

  it("counts failed for missing events", async () => {
    const env = createModQueueEnv();
    const result = await bulkReviewEvents(env, { projectId: "p1", eventIds: ["nonexistent"], moderatorId: "mod1", action: "confirm" });
    expect(result.failed).toBe(1);
    expect(result.processed).toBe(0);
  });
});

describe("submitFeedback", () => {
  it("submits true_positive feedback", async () => {
    const env = createModQueueEnv();
    const evtId = pushEvt(env);
    const result = await submitFeedback(env, { projectId: "p1", queueEventId: evtId, moderatorId: "mod1", feedbackType: "true_positive" });
    expect(result.ok).toBe(true);
    expect(env.feedback).toHaveLength(1);
    expect(env.feedback[0].feedback_type).toBe("true_positive");
  });

  it("rejects duplicate feedback", async () => {
    const env = createModQueueEnv();
    const evtId = pushEvt(env);
    await submitFeedback(env, { projectId: "p1", queueEventId: evtId, moderatorId: "mod1", feedbackType: "true_positive" });
    const result = await submitFeedback(env, { projectId: "p1", queueEventId: evtId, moderatorId: "mod1", feedbackType: "false_positive" });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("feedback_already_submitted");
  });

  it("rejects invalid type", async () => {
    const env = createModQueueEnv();
    const evtId = pushEvt(env);
    const result = await submitFeedback(env, { projectId: "p1", queueEventId: evtId, moderatorId: "mod1", feedbackType: "bad" });
    expect(result.ok).toBe(false);
  });
});

describe("getFeedbackStats", () => {
  it("computes stats", async () => {
    const env = createModQueueEnv();
    env.feedback.push(
      { id: "f1", project_id: "p1", queue_event_id: "e1", moderator_id: "m1", feedback_type: "true_positive", reason: null, category_accuracy: "{}", created_at: new Date().toISOString() },
      { id: "f2", project_id: "p1", queue_event_id: "e2", moderator_id: "m1", feedback_type: "false_positive", reason: null, category_accuracy: "{}", created_at: new Date().toISOString() },
      { id: "f3", project_id: "p1", queue_event_id: "e3", moderator_id: "m2", feedback_type: "true_positive", reason: null, category_accuracy: "{}", created_at: new Date().toISOString() },
    );
    const result = await getFeedbackStats(env, { projectId: "p1" });
    expect(result.ok).toBe(true);
    expect(result.stats.total).toBe(3);
    expect(result.stats.truePositive).toBe(2);
    expect(result.stats.falsePositive).toBe(1);
  });
});

describe("upsertSlaConfig", () => {
  it("creates config", async () => {
    const env = createModQueueEnv();
    const result = await upsertSlaConfig(env, { projectId: "p1", severity: "high", slaMinutes: 30 });
    expect(result.ok).toBe(true);
    expect(env.slaConfigs).toHaveLength(1);
    expect(env.slaConfigs[0].sla_minutes).toBe(30);
  });

  it("updates existing", async () => {
    const env = createModQueueEnv();
    await upsertSlaConfig(env, { projectId: "p1", severity: "high", slaMinutes: 30 });
    await upsertSlaConfig(env, { projectId: "p1", severity: "high", slaMinutes: 60 });
    expect(env.slaConfigs).toHaveLength(1);
    expect(env.slaConfigs[0].sla_minutes).toBe(60);
  });

  it("rejects invalid severity", async () => {
    const env = createModQueueEnv();
    const result = await upsertSlaConfig(env, { projectId: "p1", severity: "bad" });
    expect(result.ok).toBe(false);
  });
});

describe("scanSlaBreaches", () => {
  it("detects breaches", async () => {
    const env = createModQueueEnv();
    env.slaConfigs.push({ id: "c1", project_id: "p1", severity: "high", sla_minutes: 15, escalation_enabled: 1, escalation_severity: "critical", enabled: 1 });
    pushEvt(env, { severity: "high", reviewed_by: null, created_at: new Date(Date.now() - 30 * 60_000).toISOString() });
    const result = await scanSlaBreaches(env, { projectId: "p1" });
    expect(result.ok).toBe(true);
    expect(result.breached).toBe(1);
  });

  it("skips already-breached", async () => {
    const env = createModQueueEnv();
    env.slaConfigs.push({ id: "c1", project_id: "p1", severity: "high", sla_minutes: 15, escalation_enabled: 0, escalation_severity: null, enabled: 1 });
    const evtId = pushEvt(env, { severity: "high", reviewed_by: null, created_at: new Date(Date.now() - 30 * 60_000).toISOString() });
    env.slaBreaches.push({ id: "b1", project_id: "p1", queue_event_id: evtId, severity: "high", sla_minutes: 15, breached_at: "2026-01-01", escalated_to: null, resolved_at: null, created_at: "2026-01-01" });
    const result = await scanSlaBreaches(env, { projectId: "p1" });
    expect(result.breached).toBe(0);
  });

  it("skips within SLA window", async () => {
    const env = createModQueueEnv();
    env.slaConfigs.push({ id: "c1", project_id: "p1", severity: "high", sla_minutes: 60, escalation_enabled: 0, escalation_severity: null, enabled: 1 });
    pushEvt(env, { severity: "high", reviewed_by: null, created_at: new Date(Date.now() - 10 * 60_000).toISOString() });
    const result = await scanSlaBreaches(env, { projectId: "p1" });
    expect(result.breached).toBe(0);
  });
});

describe("getUnresolvedBreaches", () => {
  it("returns unresolved only", async () => {
    const env = createModQueueEnv();
    env.slaBreaches.push(
      { id: "b1", project_id: "p1", queue_event_id: "e1", severity: "high", sla_minutes: 15, breached_at: "2026-01-01", escalated_to: null, resolved_at: null, created_at: "2026-01-01" },
      { id: "b2", project_id: "p1", queue_event_id: "e2", severity: "medium", sla_minutes: 60, breached_at: "2026-01-02", escalated_to: null, resolved_at: "2026-01-03", created_at: "2026-01-02" },
    );
    const result = await getUnresolvedBreaches(env, { projectId: "p1" });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("b1");
  });
});

describe("resolveBreach", () => {
  it("resolves", async () => {
    const env = createModQueueEnv();
    env.slaBreaches.push({ id: "b1", project_id: "p1", queue_event_id: "e1", severity: "high", sla_minutes: 15, breached_at: "2026-01-01", escalated_to: null, resolved_at: null, created_at: "2026-01-01" });
    const result = await resolveBreach(env, { projectId: "p1", breachId: "b1" });
    expect(result.resolved).toBe(true);
    expect(env.slaBreaches[0].resolved_at).toBeTruthy();
  });

  it("returns false for already resolved", async () => {
    const env = createModQueueEnv();
    env.slaBreaches.push({ id: "b1", project_id: "p1", queue_event_id: "e1", severity: "high", sla_minutes: 15, breached_at: "2026-01-01", escalated_to: null, resolved_at: "2026-01-02", created_at: "2026-01-01" });
    const result = await resolveBreach(env, { projectId: "p1", breachId: "b1" });
    expect(result.resolved).toBe(false);
  });
});

describe("getReviewHistory", () => {
  it("returns reviewed events", async () => {
    const env = createModQueueEnv();
    pushEvt(env, { reviewed_by: "mod1", reviewed_at: "2026-01-01", review_action: "confirm" });
    pushEvt(env, { reviewed_by: null });
    const result = await getReviewHistory(env, { projectId: "p1" });
    expect(result).toHaveLength(1);
    expect(result[0].reviewedBy).toBe("mod1");
  });

  it("filters by moderator", async () => {
    const env = createModQueueEnv();
    pushEvt(env, { reviewed_by: "mod1", reviewed_at: "2026-01-01", review_action: "confirm" });
    pushEvt(env, { reviewed_by: "mod2", reviewed_at: "2026-01-02", review_action: "dismiss" });
    const result = await getReviewHistory(env, { projectId: "p1", moderatorId: "mod1" });
    expect(result).toHaveLength(1);
    expect(result[0].reviewedBy).toBe("mod1");
  });
});
