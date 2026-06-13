import { describe, expect, it } from "vitest";
import {
  canManageEscalationRules,
  listEscalationRules,
  getEscalationRule,
  createEscalationRule,
  updateEscalationRule,
  deleteEscalationRule,
  listEscalationEvents,
  getEscalationStats,
  hasEscalationEvent,
  recordEscalationEvent,
  resolveEscalationEvent,
  processTaskEscalation,
  runEscalationScan,
} from "./escalation-rules.js";

function createEscalationEnv(overrides = {}) {
  const rules = [];
  const events = [];

  return {
    DB: {
      prepare(sql) {
        return {
          bind(...args) {
            return {
              async first() {
                if (sql.includes("SELECT * FROM escalation_rules WHERE project_id = ? AND id = ?")) {
                  return rules.find((r) => r.project_id === args[0] && r.id === args[1]) || null;
                }
                if (sql.includes("SELECT 1 AS ok FROM escalation_events") && sql.includes("WHERE")) {
                  const match = events.find(
                    (e) =>
                      e.project_id === args[0] &&
                      e.task_id === args[1] &&
                      e.rule_id === args[2] &&
                      e.repeat_count === args[3],
                  );
                  return match ? { ok: 1 } : null;
                }
                if (sql.includes("SELECT COUNT(*) AS cnt FROM escalation_events") && sql.includes("resolved_at IS NULL")) {
                  return { cnt: events.filter((e) => e.project_id === args[0] && !e.resolved_at).length };
                }
                if (sql.includes("SELECT COUNT(*) AS cnt FROM escalation_events") && sql.includes("project_id = ?")) {
                  return { cnt: events.filter((e) => e.project_id === args[0]).length };
                }
                if (sql.includes("SELECT COUNT(*) AS total, SUM")) {
                  const total = rules.filter((r) => r.project_id === args[0]).length;
                  const active = rules.filter((r) => r.project_id === args[0] && r.enabled === 1).length;
                  return { total, active };
                }
                return null;
              },
              async all() {
                if (sql.includes("FROM escalation_rules") && sql.includes("WHERE project_id = ?")) {
                  let filtered = rules.filter((r) => r.project_id === args[0]);
                  if (sql.includes("AND enabled = 1")) {
                    filtered = filtered.filter((r) => r.enabled === 1);
                  }
                  if (sql.includes("trigger_after_minutes <= ?")) {
                    filtered = filtered.filter((r) => r.trigger_after_minutes <= args[1]);
                  }
                  filtered.sort((a, b) => a.trigger_after_minutes - b.trigger_after_minutes);
                  return { results: filtered };
                }
                if (sql.includes("SELECT * FROM escalation_events WHERE project_id = ?")) {
                  let filtered = events.filter((e) => e.project_id === args[0]);
                  if (sql.includes("AND task_id = ?")) {
                    filtered = filtered.filter((e) => e.task_id === args[1]);
                  }
                  return { results: filtered };
                }
                if (sql.includes("SELECT * FROM escalation_events") && sql.includes("ORDER BY triggered_at DESC LIMIT 1")) {
                  const match = events
                    .filter(
                      (e) =>
                        e.project_id === args[0] &&
                        e.task_id === args[1] &&
                        e.rule_id === args[2],
                    )
                    .sort((a, b) => Date.parse(b.triggered_at) - Date.parse(a.triggered_at));
                  return match[0] || null;
                }
                if (sql.includes("SELECT action, COUNT(*) AS cnt FROM escalation_events")) {
                  const counts = {};
                  for (const e of events.filter((e) => e.project_id === args[0])) {
                    counts[e.action] = (counts[e.action] || 0) + 1;
                  }
                  return { results: Object.entries(counts).map(([action, cnt]) => ({ action, cnt })) };
                }
                if (sql.includes("FROM agent_tasks t") && sql.includes("WHERE t.status IN ('open', 'claimed')")) {
                  return { results: [] };
                }
                return { results: [] };
              },
              async run() {
                if (sql.includes("INSERT INTO escalation_rules")) {
                  const rule = {
                    id: args[0],
                    project_id: args[1],
                    name: args[2],
                    description: args[3],
                    enabled: 1,
                    priority: args[4],
                    trigger_after_minutes: args[5],
                    action: args[6],
                    target_user_id: args[7],
                    target_role: args[8],
                    notification_message: args[9],
                    room_announce: args[10],
                    repeat_interval_minutes: args[11],
                    max_repeats: args[12],
                    created_at: args[13],
                    updated_at: args[14],
                  };
                  rules.push(rule);
                  return { meta: { changes: 1 } };
                }
                if (sql.includes("UPDATE escalation_rules SET")) {
                  const ruleId = args[args.length - 1];
                  const projectId = args[args.length - 2];
                  const idx = rules.findIndex((r) => r.id === ruleId && r.project_id === projectId);
                  if (idx >= 0) {
                    rules[idx].name = args[0];
                    rules[idx].description = args[1];
                    rules[idx].priority = args[2];
                    rules[idx].trigger_after_minutes = args[3];
                    rules[idx].action = args[4];
                    rules[idx].target_user_id = args[5];
                    rules[idx].target_role = args[6];
                    rules[idx].notification_message = args[7];
                    rules[idx].repeat_interval_minutes = args[8];
                    rules[idx].max_repeats = args[9];
                    rules[idx].updated_at = args[10];
                    return { meta: { changes: 1 } };
                  }
                  return { meta: { changes: 0 } };
                }
                if (sql.includes("DELETE FROM escalation_rules")) {
                  const idx = rules.findIndex((r) => r.id === args[1] && r.project_id === args[0]);
                  if (idx >= 0) {
                    rules.splice(idx, 1);
                    return { meta: { changes: 1 } };
                  }
                  return { meta: { changes: 0 } };
                }
                if (sql.includes("INSERT INTO escalation_events")) {
                  // SQL: INSERT INTO escalation_events (id, project_id, room_id, task_id, rule_id, tier_index, action, target_user_id, triggered_at, resolved_at, repeat_count, notification_sent, error, created_at)
                  // VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, 0, NULL, ?)
                  // bind: id, projectId, roomId, taskId, ruleId, tierIndex, action, targetUserId, now, repeatCount, now
                  const event = {
                    id: args[0],
                    project_id: args[1],
                    room_id: args[2],
                    task_id: args[3],
                    rule_id: args[4],
                    tier_index: args[5],
                    action: args[6],
                    target_user_id: args[7],
                    triggered_at: args[8],
                    resolved_at: null,
                    repeat_count: args[9],
                    notification_sent: 0,
                    error: null,
                    created_at: args[10],
                  };
                  events.push(event);
                  return { meta: { changes: 1 } };
                }
                if (sql.includes("UPDATE escalation_events SET resolved_at")) {
                  const eventId = args[1];
                  const idx = events.findIndex((e) => e.id === eventId);
                  if (idx >= 0) {
                    events[idx].resolved_at = args[0];
                    return { meta: { changes: 1 } };
                  }
                  return { meta: { changes: 0 } };
                }
                return { meta: { changes: 0 } };
              },
            };
          },
        };
      },
    },
    _rules: rules,
    _events: events,
    ...overrides,
  };
}

describe("P17-B: Escalation Design with SLA + Reminders", () => {
  describe("canManageEscalationRules", () => {
    it("allows owner", () => {
      expect(canManageEscalationRules(["owner"])).toBe(true);
    });
    it("allows admin", () => {
      expect(canManageEscalationRules(["admin"])).toBe(true);
    });
    it("allows moderator", () => {
      expect(canManageEscalationRules(["moderator"])).toBe(true);
    });
    it("rejects member", () => {
      expect(canManageEscalationRules(["member"])).toBe(false);
    });
    it("rejects null", () => {
      expect(canManageEscalationRules(null)).toBe(false);
    });
  });

  describe("createEscalationRule", () => {
    it("creates a rule with defaults", async () => {
      const env = createEscalationEnv();
      const result = await createEscalationRule(env, {
        projectId: "p1",
        name: "Notify Supervisor",
      });
      expect(result.ok).toBe(true);
      expect(result.rule.name).toBe("Notify Supervisor");
      expect(result.rule.action).toBe("notify_supervisor");
      expect(result.rule.triggerAfterMinutes).toBe(15);
      expect(result.rule.enabled).toBe(true);
      expect(result.rule.maxRepeats).toBe(0);
      expect(env._rules.length).toBe(1);
    });
    it("rejects empty name", async () => {
      const env = createEscalationEnv();
      const result = await createEscalationRule(env, { projectId: "p1", name: "" });
      expect(result.ok).toBe(false);
      expect(result.error).toBe("name_required");
    });
    it("creates with custom options", async () => {
      const env = createEscalationEnv();
      const result = await createEscalationRule(env, {
        projectId: "p1",
        name: "Reassign to L2",
        triggerAfterMinutes: 30,
        action: "reassign",
        targetRole: "senior_agent",
        notificationMessage: "Task needs L2 support",
        roomAnnounce: true,
        repeatIntervalMinutes: 15,
        maxRepeats: 3,
      });
      expect(result.ok).toBe(true);
      expect(result.rule.triggerAfterMinutes).toBe(30);
      expect(result.rule.action).toBe("reassign");
      expect(result.rule.targetRole).toBe("senior_agent");
      expect(result.rule.notificationMessage).toBe("Task needs L2 support");
      expect(result.rule.roomAnnounce).toBe(true);
      expect(result.rule.repeatIntervalMinutes).toBe(15);
      expect(result.rule.maxRepeats).toBe(3);
    });
  });

  describe("listEscalationRules", () => {
    it("lists rules sorted by trigger time", async () => {
      const env = createEscalationEnv();
      await createEscalationRule(env, { projectId: "p1", name: "Tier 2", triggerAfterMinutes: 30 });
      await createEscalationRule(env, { projectId: "p1", name: "Tier 1", triggerAfterMinutes: 10 });
      await createEscalationRule(env, { projectId: "p2", name: "Other", triggerAfterMinutes: 5 });
      const rules = await listEscalationRules(env, { projectId: "p1" });
      expect(rules.length).toBe(2);
      expect(rules[0].name).toBe("Tier 1");
      expect(rules[1].name).toBe("Tier 2");
    });
  });

  describe("getEscalationRule", () => {
    it("returns rule by id", async () => {
      const env = createEscalationEnv();
      const created = await createEscalationRule(env, { projectId: "p1", name: "Test" });
      const rule = await getEscalationRule(env, { projectId: "p1", ruleId: created.rule.id });
      expect(rule).not.toBeNull();
      expect(rule.name).toBe("Test");
    });
    it("returns null for missing", async () => {
      const env = createEscalationEnv();
      const rule = await getEscalationRule(env, { projectId: "p1", ruleId: "nonexistent" });
      expect(rule).toBeNull();
    });
  });

  describe("updateEscalationRule", () => {
    it("updates fields", async () => {
      const env = createEscalationEnv();
      const created = await createEscalationRule(env, { projectId: "p1", name: "Original" });
      const result = await updateEscalationRule(env, {
        projectId: "p1",
        ruleId: created.rule.id,
        name: "Updated",
        action: "reassign",
        triggerAfterMinutes: 60,
      });
      expect(result.ok).toBe(true);
      expect(result.rule.name).toBe("Updated");
      expect(result.rule.action).toBe("reassign");
      expect(result.rule.triggerAfterMinutes).toBe(60);
    });
    it("returns not_found for missing", async () => {
      const env = createEscalationEnv();
      const result = await updateEscalationRule(env, { projectId: "p1", ruleId: "x", name: "y" });
      expect(result.ok).toBe(false);
      expect(result.error).toBe("not_found");
    });
  });

  describe("deleteEscalationRule", () => {
    it("deletes an existing rule", async () => {
      const env = createEscalationEnv();
      const created = await createEscalationRule(env, { projectId: "p1", name: "Del" });
      const result = await deleteEscalationRule(env, { projectId: "p1", ruleId: created.rule.id });
      expect(result.ok).toBe(true);
      expect(env._rules.length).toBe(0);
    });
    it("returns not_found for missing", async () => {
      const env = createEscalationEnv();
      const result = await deleteEscalationRule(env, { projectId: "p1", ruleId: "x" });
      expect(result.ok).toBe(false);
    });
  });

  describe("recordEscalationEvent", () => {
    it("records an event", async () => {
      const env = createEscalationEnv();
      const result = await recordEscalationEvent(env, {
        projectId: "p1",
        roomId: "r1",
        taskId: "t1",
        ruleId: "rule1",
        tierIndex: 0,
        action: "notify_supervisor",
        targetUserId: "sup1",
      });
      expect(result.id).toBeDefined();
      expect(result.triggeredAt).toBeDefined();
      expect(env._events.length).toBe(1);
      expect(env._events[0].action).toBe("notify_supervisor");
      expect(env._events[0].target_user_id).toBe("sup1");
    });
  });

  describe("resolveEscalationEvent", () => {
    it("resolves an event", async () => {
      const env = createEscalationEnv();
      const recorded = await recordEscalationEvent(env, {
        projectId: "p1",
        roomId: "r1",
        taskId: "t1",
        ruleId: "rule1",
        action: "notify_supervisor",
      });
      const result = await resolveEscalationEvent(env, {
        eventId: recorded.id,
        projectId: "p1",
      });
      expect(result.ok).toBe(true);
      expect(env._events[0].resolved_at).toBeDefined();
    });
  });

  describe("hasEscalationEvent", () => {
    it("returns true when event exists", async () => {
      const env = createEscalationEnv();
      await recordEscalationEvent(env, {
        projectId: "p1",
        roomId: "r1",
        taskId: "t1",
        ruleId: "rule1",
        action: "notify_supervisor",
        repeatCount: 0,
      });
      const exists = await hasEscalationEvent(env, {
        projectId: "p1",
        taskId: "t1",
        ruleId: "rule1",
        repeatCount: 0,
      });
      expect(exists).toBe(true);
    });
    it("returns false when no event", async () => {
      const env = createEscalationEnv();
      const exists = await hasEscalationEvent(env, {
        projectId: "p1",
        taskId: "t1",
        ruleId: "rule1",
        repeatCount: 0,
      });
      expect(exists).toBe(false);
    });
  });

  describe("listEscalationEvents", () => {
    it("lists events for project", async () => {
      const env = createEscalationEnv();
      await recordEscalationEvent(env, {
        projectId: "p1",
        roomId: "r1",
        taskId: "t1",
        ruleId: "rule1",
        action: "notify_supervisor",
      });
      await recordEscalationEvent(env, {
        projectId: "p2",
        roomId: "r2",
        taskId: "t2",
        ruleId: "rule2",
        action: "reassign",
      });
      const events = await listEscalationEvents(env, { projectId: "p1" });
      expect(events.length).toBe(1);
      expect(events[0].action).toBe("notify_supervisor");
    });
    it("filters by taskId", async () => {
      const env = createEscalationEnv();
      await recordEscalationEvent(env, {
        projectId: "p1",
        roomId: "r1",
        taskId: "t1",
        ruleId: "rule1",
        action: "notify_supervisor",
      });
      await recordEscalationEvent(env, {
        projectId: "p1",
        roomId: "r1",
        taskId: "t2",
        ruleId: "rule1",
        action: "reassign",
      });
      const events = await listEscalationEvents(env, { projectId: "p1", taskId: "t1" });
      expect(events.length).toBe(1);
    });
  });

  describe("getEscalationStats", () => {
    it("returns aggregated stats", async () => {
      const env = createEscalationEnv();
      await createEscalationRule(env, { projectId: "p1", name: "Rule1" });
      await recordEscalationEvent(env, {
        projectId: "p1",
        roomId: "r1",
        taskId: "t1",
        ruleId: "rule1",
        action: "notify_supervisor",
      });
      await recordEscalationEvent(env, {
        projectId: "p1",
        roomId: "r1",
        taskId: "t1",
        ruleId: "rule1",
        action: "reassign",
      });
      const stats = await getEscalationStats(env, { projectId: "p1" });
      expect(stats.events.total).toBe(2);
      expect(stats.events.pending).toBe(2);
      expect(stats.events.byAction.notify_supervisor).toBe(1);
      expect(stats.events.byAction.reassign).toBe(1);
      expect(stats.rules.total).toBe(1);
      expect(stats.rules.active).toBe(1);
    });
  });

  describe("processTaskEscalation", () => {
    it("triggers escalation for task older than rule threshold", async () => {
      const env = createEscalationEnv();
      await createEscalationRule(env, {
        projectId: "p1",
        name: "After 10min",
        triggerAfterMinutes: 10,
        action: "notify_supervisor",
        targetUserId: "sup1",
      });
      const past = new Date(Date.now() - 15 * 60_000).toISOString();
      const result = await processTaskEscalation(env, {
        projectId: "p1",
        task: { id: "t1", room_id: "r1", created_at: past },
      });
      expect(result.processed).toBe(1);
      expect(result.actions[0].action).toBe("notify_supervisor");
      expect(env._events.length).toBe(1);
    });
    it("does not trigger for task younger than threshold", async () => {
      const env = createEscalationEnv();
      await createEscalationRule(env, {
        projectId: "p1",
        name: "After 60min",
        triggerAfterMinutes: 60,
        action: "notify_supervisor",
      });
      const recent = new Date(Date.now() - 5 * 60_000).toISOString();
      const result = await processTaskEscalation(env, {
        projectId: "p1",
        task: { id: "t1", room_id: "r1", created_at: recent },
      });
      expect(result.processed).toBe(0);
      expect(env._events.length).toBe(0);
    });
    it("does not double-fire same rule", async () => {
      const env = createEscalationEnv();
      await createEscalationRule(env, {
        projectId: "p1",
        name: "After 10min",
        triggerAfterMinutes: 10,
        action: "notify_supervisor",
      });
      const past = new Date(Date.now() - 15 * 60_000).toISOString();
      await processTaskEscalation(env, {
        projectId: "p1",
        task: { id: "t1", room_id: "r1", created_at: past },
      });
      const result2 = await processTaskEscalation(env, {
        projectId: "p1",
        task: { id: "t1", room_id: "r1", created_at: past },
      });
      expect(result2.processed).toBe(0);
      expect(env._events.length).toBe(1);
    });
    it("handles multiple tiers", async () => {
      const env = createEscalationEnv();
      await createEscalationRule(env, {
        projectId: "p1",
        name: "Tier 1",
        triggerAfterMinutes: 10,
        action: "notify_supervisor",
      });
      await createEscalationRule(env, {
        projectId: "p1",
        name: "Tier 2",
        triggerAfterMinutes: 30,
        action: "reassign",
      });
      const past = new Date(Date.now() - 35 * 60_000).toISOString();
      const result = await processTaskEscalation(env, {
        projectId: "p1",
        task: { id: "t1", room_id: "r1", created_at: past },
      });
      expect(result.processed).toBe(2);
      expect(env._events.length).toBe(2);
    });
  });

  describe("runEscalationScan", () => {
    it("scans and processes tasks", async () => {
      const env = createEscalationEnv();
      const result = await runEscalationScan(env, { projectId: "p1" });
      expect(result.scanned).toBe(0);
      expect(result.escalated).toBe(0);
    });
  });
});
