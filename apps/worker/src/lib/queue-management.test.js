import { describe, expect, it, vi } from "vitest";
import {
  canManageQueueRules,
  listQueueRules,
  getQueueRule,
  createQueueRule,
  updateQueueRule,
  deleteQueueRule,
  listAgentCapacities,
  getAgentCapacity,
  upsertAgentCapacity,
  adjustAgentLoad,
  autoAssignTask,
  escalateBreachedTasks,
  getQueueStats,
  listAssignments,
  findActiveRule,
  findBestAgent,
} from "./queue-management.js";

function createQueueEnv(overrides = {}) {
  const rules = [];
  const agents = [];
  const assignments = [];
  const tasks = [];

  return {
    DB: {
      prepare(sql) {
        return {
          bind(...args) {
            return {
              async first() {
                if (sql.includes("SELECT * FROM queue_rules WHERE project_id = ? AND id = ?")) {
                  return rules.find((r) => r.project_id === args[0] && r.id === args[1]) || null;
                }
                if (sql.includes("SELECT * FROM queue_rules WHERE project_id = ? AND enabled = 1")) {
                  const enabled = rules.filter((r) => r.project_id === args[0] && r.enabled === 1);
                  enabled.sort((a, b) => (b.priority || 0) - (a.priority || 0));
                  return enabled[0] || null;
                }
                if (sql.includes("SELECT * FROM queue_rules WHERE project_id = ?")) {
                  const filtered = rules.filter((r) => r.project_id === args[0] && r.enabled === 1);
                  filtered.sort((a, b) => (b.priority || 0) - (a.priority || 0));
                  return filtered[0] || null;
                }
                if (sql.includes("SELECT * FROM agent_capacity WHERE project_id = ? AND user_id = ?")) {
                  return agents.find((a) => a.project_id === args[0] && a.user_id === args[1]) || null;
                }
                if (sql.includes("SELECT SUM(current_load) AS total_load")) {
                  const available = agents.filter((a) => a.project_id === args[0] && a.is_available === 1);
                  return {
                    total_load: available.reduce((s, a) => s + (a.current_load || 0), 0),
                    total_capacity: available.reduce((s, a) => s + (a.max_concurrent || 0), 0),
                  };
                }
                if (sql.includes("SELECT COUNT(*) AS breached FROM agent_tasks")) {
                  const now = Date.now();
                  const breached = tasks.filter(
                    (t) =>
                      t.project_id === args[0] &&
                      ["open", "claimed"].includes(t.status) &&
                      t.sla_due_at &&
                      Date.parse(t.sla_due_at) < now,
                  );
                  return { breached: breached.length };
                }
                return null;
              },
              async all() {
                if (sql.includes("SELECT * FROM queue_rules WHERE project_id = ?")) {
                  return { results: rules.filter((r) => r.project_id === args[0]) };
                }
                if (sql.includes("SELECT * FROM agent_capacity WHERE project_id = ?")) {
                  return { results: agents.filter((a) => a.project_id === args[0]) };
                }
                if (sql.includes("SELECT * FROM conversation_assignments WHERE project_id = ?")) {
                  let filtered = assignments.filter((a) => a.project_id === args[0]);
                  if (sql.includes("AND room_id = ?")) {
                    filtered = filtered.filter((a) => a.room_id === args[1]);
                  }
                  return { results: filtered };
                }
                if (sql.includes("SELECT status, COUNT(*) AS cnt FROM agent_tasks")) {
                  const counts = {};
                  for (const t of tasks.filter((t) => t.project_id === args[0])) {
                    counts[t.status] = (counts[t.status] || 0) + 1;
                  }
                  return { results: Object.entries(counts).map(([status, cnt]) => ({ status, cnt })) };
                }
                if (sql.includes("SELECT is_available, COUNT(*) AS cnt FROM agent_capacity")) {
                  const counts = {};
                  for (const a of agents.filter((a) => a.project_id === args[0])) {
                    const key = a.is_available === 1 ? "available" : "unavailable";
                    counts[key] = (counts[key] || 0) + 1;
                  }
                  return {
                    results: Object.entries(counts).map(([is_available, cnt]) => ({
                      is_available: is_available === "available" ? 1 : 0,
                      cnt,
                    })),
                  };
                }
                if (sql.includes("SELECT strategy_used, COUNT(*) AS cnt FROM conversation_assignments")) {
                  const counts = {};
                  for (const a of assignments.filter((a) => a.project_id === args[0])) {
                    counts[a.strategy_used] = (counts[a.strategy_used] || 0) + 1;
                  }
                  return {
                    results: Object.entries(counts).map(([strategy_used, cnt]) => ({ strategy_used, cnt })),
                  };
                }
                if (sql.includes("FROM agent_tasks t") && sql.includes("t.sla_due_at < ?")) {
                  const now = Date.parse(args[1]);
                  return {
                    results: tasks.filter(
                      (t) =>
                        t.project_id === args[0] &&
                        ["open", "claimed"].includes(t.status) &&
                        t.sla_due_at &&
                        Date.parse(t.sla_due_at) < now,
                    ),
                  };
                }
                return { results: [] };
              },
              async run() {
                if (sql.includes("INSERT INTO queue_rules")) {
                  // SQL: INSERT INTO queue_rules (...11 columns..., enabled, created_at, updated_at) VALUES (?,...10?..., 1, ?, ?)
                  // enabled is literal 1, not a ?. So bind args shift: args[0..10]=cols, args[11]=created_at, args[12]=updated_at
                  const rule = {
                    id: args[0],
                    project_id: args[1],
                    name: args[2],
                    description: args[3],
                    strategy: args[4],
                    priority: args[5],
                    sla_minutes: args[6],
                    escalation_sla_minutes: args[7],
                    required_capabilities: args[8],
                    fallback_strategy: args[9],
                    fallback_agent_user_id: args[10],
                    enabled: 1,
                    created_at: args[11],
                    updated_at: args[12],
                  };
                  rules.push(rule);
                  return { meta: { changes: 1 } };
                }
                if (sql.includes("UPDATE queue_rules SET")) {
                  const ruleId = args[args.length - 1];
                  const projectId = args[args.length - 2];
                  const idx = rules.findIndex((r) => r.id === ruleId && r.project_id === projectId);
                  if (idx >= 0) {
                    rules[idx].name = args[0];
                    rules[idx].description = args[1];
                    rules[idx].strategy = args[2];
                    rules[idx].priority = args[3];
                    rules[idx].sla_minutes = args[4];
                    rules[idx].escalation_sla_minutes = args[5];
                    rules[idx].required_capabilities = args[6];
                    rules[idx].fallback_strategy = args[7];
                    rules[idx].fallback_agent_user_id = args[8];
                    rules[idx].updated_at = args[10];
                    if (args.length > 12) rules[idx].enabled = args[11];
                    return { meta: { changes: 1 } };
                  }
                  return { meta: { changes: 0 } };
                }
                if (sql.includes("DELETE FROM queue_rules")) {
                  const idx = rules.findIndex((r) => r.id === args[1] && r.project_id === args[0]);
                  if (idx >= 0) {
                    rules.splice(idx, 1);
                    return { meta: { changes: 1 } };
                  }
                  return { meta: { changes: 0 } };
                }
                if (sql.includes("INSERT INTO agent_capacity")) {
                  // SQL: INSERT INTO agent_capacity (id, project_id, user_id, max_concurrent, current_load, capabilities, is_available, round_robin_index, last_assigned_at, created_at, updated_at)
                  // VALUES (?, ?, ?, ?, 0, ?, ?, 0, NULL, ?, ?)
                  // bind args: id, projectId, userId, maxConcurrent, caps, isAvailable, now, now
                  const cap = {
                    id: args[0],
                    project_id: args[1],
                    user_id: args[2],
                    max_concurrent: args[3],
                    current_load: 0,
                    capabilities: args[4],
                    is_available: args[5],
                    round_robin_index: 0,
                    last_assigned_at: null,
                    created_at: args[6],
                    updated_at: args[7],
                  };
                  agents.push(cap);
                  return { meta: { changes: 1 } };
                }
                if (sql.includes("UPDATE agent_capacity SET current_load")) {
                  const userId = args[3];
                  const projectId = args[2];
                  const idx = agents.findIndex((a) => a.user_id === userId && a.project_id === projectId);
                  if (idx >= 0) {
                    agents[idx].current_load = Math.max(0, (agents[idx].current_load || 0) + args[0]);
                    agents[idx].updated_at = args[1];
                    return { meta: { changes: 1 } };
                  }
                  return { meta: { changes: 0 } };
                }
                if (sql.includes("UPDATE agent_capacity SET max_concurrent")) {
                  // userId is always last arg, projectId second-to-last
                  const userId = args[args.length - 1];
                  const projectId = args[args.length - 2];
                  const idx = agents.findIndex((a) => a.user_id === userId && a.project_id === projectId);
                  if (idx >= 0) {
                    agents[idx].max_concurrent = args[0];
                    agents[idx].capabilities = args[1] !== undefined ? args[1] : agents[idx].capabilities;
                    agents[idx].is_available = args[2] !== undefined ? args[2] : agents[idx].is_available;
                    agents[idx].updated_at = args[3];
                    return { meta: { changes: 1 } };
                  }
                  return { meta: { changes: 0 } };
                }
                if (sql.includes("UPDATE agent_tasks") && sql.includes("SET status = 'claimed'") && sql.includes("assignee_user_id = ?")) {
                  const taskId = args[4];
                  const projectId = args[5];
                  const idx = tasks.findIndex((t) => t.id === taskId && t.project_id === projectId);
                  if (idx >= 0) {
                    tasks[idx].status = "claimed";
                    tasks[idx].assignee_user_id = args[0];
                    tasks[idx].claimed_at = args[1];
                    tasks[idx].sla_due_at = args[2];
                    tasks[idx].updated_at = args[3];
                    return { meta: { changes: 1 } };
                  }
                  return { meta: { changes: 0 } };
                }
                if (sql.includes("INSERT INTO conversation_assignments")) {
                  const assignment = {
                    id: args[0],
                    project_id: args[1],
                    room_id: args[2],
                    task_id: args[3],
                    agent_task_id: args[4],
                    assigned_to_user_id: args[5],
                    assigned_by: args[6],
                    strategy_used: args[7],
                    sla_due_at: args[8],
                    escalated_at: args[9],
                    escalated_to_user_id: args[10],
                    escalation_reason: args[11],
                    resolved_at: args[12],
                    created_at: args[13],
                  };
                  assignments.push(assignment);
                  return { meta: { changes: 1 } };
                }
                if (sql.includes("UPDATE agent_tasks") && sql.includes("assignee_user_id = ?") && sql.includes("WHERE id = ? AND project_id = ?")) {
                  const taskId = args[args.length - 1];
                  const projectId = args[args.length - 2];
                  const idx = tasks.findIndex((t) => t.id === taskId && t.project_id === projectId);
                  if (idx >= 0) {
                    tasks[idx].assignee_user_id = args[0];
                    tasks[idx].claimed_at = args[1];
                    tasks[idx].sla_due_at = args[2];
                    tasks[idx].updated_at = args[3];
                    return { meta: { changes: 1 } };
                  }
                  return { meta: { changes: 0 } };
                }
                if (sql.includes("UPDATE agent_tasks SET sla_due_at")) {
                  const taskId = args[2];
                  const projectId = args[3];
                  const idx = tasks.findIndex((t) => t.id === taskId && t.project_id === projectId);
                  if (idx >= 0) {
                    tasks[idx].sla_due_at = args[0];
                    tasks[idx].updated_at = args[1];
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
    _agents: agents,
    _assignments: assignments,
    _tasks: tasks,
    ...overrides,
  };
}

describe("P17-A: Queue Management + Workload Balancing", () => {
  describe("canManageQueueRules", () => {
    it("allows owner", () => {
      expect(canManageQueueRules(["owner"])).toBe(true);
    });
    it("allows admin", () => {
      expect(canManageQueueRules(["admin"])).toBe(true);
    });
    it("allows moderator", () => {
      expect(canManageQueueRules(["moderator"])).toBe(true);
    });
    it("rejects member", () => {
      expect(canManageQueueRules(["member"])).toBe(false);
    });
    it("rejects null", () => {
      expect(canManageQueueRules(null)).toBe(false);
    });
  });

  describe("createQueueRule", () => {
    it("creates a rule with defaults", async () => {
      const env = createQueueEnv();
      const result = await createQueueRule(env, {
        projectId: "p1",
        name: "Default Routing",
      });
      expect(result.ok).toBe(true);
      expect(result.rule.name).toBe("Default Routing");
      expect(result.rule.strategy).toBe("first_responder");
      expect(result.rule.slaMinutes).toBe(15);
      expect(result.rule.enabled).toBe(true);
      expect(env._rules.length).toBe(1);
    });
    it("rejects empty name", async () => {
      const env = createQueueEnv();
      const result = await createQueueRule(env, { projectId: "p1", name: "" });
      expect(result.ok).toBe(false);
      expect(result.error).toBe("name_required");
    });
  });

  describe("listQueueRules", () => {
    it("lists rules by project", async () => {
      const env = createQueueEnv();
      await createQueueRule(env, { projectId: "p1", name: "Rule A", priority: 1 });
      await createQueueRule(env, { projectId: "p2", name: "Rule B", priority: 5 });
      const result = await listQueueRules(env, { projectId: "p1" });
      expect(result.length).toBe(1);
      expect(result[0].name).toBe("Rule A");
    });
  });

  describe("getQueueRule", () => {
    it("returns rule by id", async () => {
      const env = createQueueEnv();
      const created = await createQueueRule(env, { projectId: "p1", name: "Test" });
      const rule = await getQueueRule(env, { projectId: "p1", ruleId: created.rule.id });
      expect(rule).not.toBeNull();
      expect(rule.name).toBe("Test");
    });
    it("returns null for missing", async () => {
      const env = createQueueEnv();
      const rule = await getQueueRule(env, { projectId: "p1", ruleId: "nonexistent" });
      expect(rule).toBeNull();
    });
  });

  describe("updateQueueRule", () => {
    it("updates fields", async () => {
      const env = createQueueEnv();
      const created = await createQueueRule(env, { projectId: "p1", name: "Original" });
      const result = await updateQueueRule(env, {
        projectId: "p1",
        ruleId: created.rule.id,
        name: "Updated",
        strategy: "round_robin",
        slaMinutes: 30,
      });
      expect(result.ok).toBe(true);
      expect(result.rule.name).toBe("Updated");
      expect(result.rule.strategy).toBe("round_robin");
      expect(result.rule.slaMinutes).toBe(30);
    });
    it("returns not_found for missing", async () => {
      const env = createQueueEnv();
      const result = await updateQueueRule(env, { projectId: "p1", ruleId: "x", name: "y" });
      expect(result.ok).toBe(false);
      expect(result.error).toBe("not_found");
    });
  });

  describe("deleteQueueRule", () => {
    it("deletes an existing rule", async () => {
      const env = createQueueEnv();
      const created = await createQueueRule(env, { projectId: "p1", name: "Del" });
      const result = await deleteQueueRule(env, { projectId: "p1", ruleId: created.rule.id });
      expect(result.ok).toBe(true);
      expect(env._rules.length).toBe(0);
    });
    it("returns not_found for missing", async () => {
      const env = createQueueEnv();
      const result = await deleteQueueRule(env, { projectId: "p1", ruleId: "x" });
      expect(result.ok).toBe(false);
      expect(result.error).toBe("not_found");
    });
  });

  describe("upsertAgentCapacity", () => {
    it("creates agent capacity", async () => {
      const env = createQueueEnv();
      const result = await upsertAgentCapacity(env, {
        projectId: "p1",
        userId: "u1",
        maxConcurrent: 10,
        capabilities: ["billing"],
      });
      expect(result.ok).toBe(true);
      expect(result.capacity.maxConcurrent).toBe(10);
      expect(result.capacity.currentLoad).toBe(0);
      expect(env._agents.length).toBe(1);
    });
    it("updates existing capacity", async () => {
      const env = createQueueEnv();
      await upsertAgentCapacity(env, { projectId: "p1", userId: "u1", maxConcurrent: 5 });
      const result = await upsertAgentCapacity(env, {
        projectId: "p1",
        userId: "u1",
        maxConcurrent: 15,
        capabilities: ["technical"],
      });
      expect(result.ok).toBe(true);
      expect(result.capacity.maxConcurrent).toBe(15);
      expect(env._agents.length).toBe(1);
    });
  });

  describe("adjustAgentLoad", () => {
    it("increments load", async () => {
      const env = createQueueEnv();
      await upsertAgentCapacity(env, { projectId: "p1", userId: "u1" });
      await adjustAgentLoad(env, { projectId: "p1", userId: "u1", delta: 3 });
      const cap = await getAgentCapacity(env, { projectId: "p1", userId: "u1" });
      expect(cap.currentLoad).toBe(3);
    });
    it("clamps at zero", async () => {
      const env = createQueueEnv();
      await upsertAgentCapacity(env, { projectId: "p1", userId: "u1" });
      await adjustAgentLoad(env, { projectId: "p1", userId: "u1", delta: -10 });
      const cap = await getAgentCapacity(env, { projectId: "p1", userId: "u1" });
      expect(cap.currentLoad).toBe(0);
    });
  });

  describe("findActiveRule", () => {
    it("returns highest priority enabled rule", async () => {
      const env = createQueueEnv();
      await createQueueRule(env, { projectId: "p1", name: "Low", priority: 1 });
      await createQueueRule(env, { projectId: "p1", name: "High", priority: 10 });
      expect(env._rules.length).toBe(2);
      const rule = await findActiveRule(env, { projectId: "p1" });
      expect(rule).not.toBeNull();
      expect(rule.name).toBe("High");
    });
    it("returns null when no rules", async () => {
      const env = createQueueEnv();
      const rule = await findActiveRule(env, { projectId: "p1" });
      expect(rule).toBeNull();
    });
  });

  describe("findBestAgent", () => {
    it("first_responder picks earliest last_assigned", async () => {
      const env = createQueueEnv();
      await upsertAgentCapacity(env, { projectId: "p1", userId: "u1", isAvailable: true, maxConcurrent: 5 });
      await upsertAgentCapacity(env, { projectId: "p1", userId: "u2", isAvailable: true, maxConcurrent: 5 });
      expect(env._agents.length).toBe(2);
      expect(env._agents[0].is_available).toBe(1);
      expect(env._agents[1].is_available).toBe(1);
      const caps = await listAgentCapacities(env, { projectId: "p1" });
      expect(caps.length).toBe(2);
      expect(caps[0].isAvailable).toBe(true);
      const available = caps.filter((a) => a.isAvailable && a.currentLoad < a.maxConcurrent);
      expect(available.length).toBe(2);
      const result = await findBestAgent(env, { projectId: "p1", strategy: "first_responder" });
      expect(result.ok).toBe(true);
      expect(result.userId).toBe("u1");
    });
    it("least_busy picks lowest load", async () => {
      const env = createQueueEnv();
      await upsertAgentCapacity(env, { projectId: "p1", userId: "u1", isAvailable: true, maxConcurrent: 5 });
      await upsertAgentCapacity(env, { projectId: "p1", userId: "u2", isAvailable: true, maxConcurrent: 5 });
      await adjustAgentLoad(env, { projectId: "p1", userId: "u1", delta: 3 });
      const caps = await listAgentCapacities(env, { projectId: "p1" });
      expect(caps.length).toBe(2);
      const result = await findBestAgent(env, { projectId: "p1", strategy: "least_busy" });
      expect(result.ok).toBe(true);
      expect(result.userId).toBe("u2");
    });
    it("skill_based matches capabilities", async () => {
      const env = createQueueEnv();
      await upsertAgentCapacity(env, {
        projectId: "p1",
        userId: "u1",
        isAvailable: true,
        maxConcurrent: 5,
        capabilities: ["billing"],
      });
      await upsertAgentCapacity(env, {
        projectId: "p1",
        userId: "u2",
        isAvailable: true,
        maxConcurrent: 5,
        capabilities: ["technical"],
      });
      const caps = await listAgentCapacities(env, { projectId: "p1" });
      expect(caps.length).toBe(2);
      expect(caps[1].capabilities).toContain("technical");
      const result = await findBestAgent(env, {
        projectId: "p1",
        strategy: "skill_based",
        requiredCapabilities: ["technical"],
      });
      expect(result.ok).toBe(true);
      expect(result.userId).toBe("u2");
    });
    it("excludes full agents", async () => {
      const env = createQueueEnv();
      await upsertAgentCapacity(env, { projectId: "p1", userId: "u1", isAvailable: true, maxConcurrent: 1 });
      await adjustAgentLoad(env, { projectId: "p1", userId: "u1", delta: 1 });
      const result = await findBestAgent(env, { projectId: "p1", strategy: "least_busy" });
      expect(result.ok).toBe(false);
      expect(result.error).toBe("no_available_agents");
    });
    it("uses fallback agent when no agents available", async () => {
      const env = createQueueEnv();
      const result = await findBestAgent(env, {
        projectId: "p1",
        strategy: "least_busy",
        fallbackAgentUserId: "fallback-u1",
      });
      expect(result.ok).toBe(true);
      expect(result.userId).toBe("fallback-u1");
      expect(result.strategy).toBe("fallback");
    });
    it("skill_based returns null when no match", async () => {
      const env = createQueueEnv();
      await upsertAgentCapacity(env, {
        projectId: "p1",
        userId: "u1",
        isAvailable: true,
        maxConcurrent: 5,
        capabilities: ["billing"],
      });
      const result = await findBestAgent(env, {
        projectId: "p1",
        strategy: "skill_based",
        requiredCapabilities: ["nonexistent"],
      });
      expect(result.ok).toBe(false);
    });
  });

  describe("autoAssignTask", () => {
    it("assigns task to best agent", async () => {
      const env = createQueueEnv();
      await createQueueRule(env, {
        projectId: "p1",
        name: "Default",
        strategy: "least_busy",
        slaMinutes: 15,
      });
      await upsertAgentCapacity(env, { projectId: "p1", userId: "u1", isAvailable: true, maxConcurrent: 5 });
      env._tasks.push({
        id: "task-1",
        project_id: "p1",
        room_id: "r1",
        status: "open",
        assignee_user_id: null,
        sla_due_at: new Date(Date.now() + 15 * 60_000).toISOString(),
      });
      const result = await autoAssignTask(env, {
        projectId: "p1",
        taskId: "task-1",
        roomId: "r1",
      });
      expect(result.ok).toBe(true);
      expect(result.assignedToUserId).toBe("u1");
      expect(result.strategy).toBe("least_busy");
      expect(env._tasks[0].status).toBe("claimed");
      expect(env._tasks[0].assignee_user_id).toBe("u1");
      expect(env._assignments.length).toBe(1);
      const cap = await getAgentCapacity(env, { projectId: "p1", userId: "u1" });
      expect(cap.currentLoad).toBe(1);
    });
    it("skips manual strategy", async () => {
      const env = createQueueEnv();
      await createQueueRule(env, { projectId: "p1", name: "Manual", strategy: "manual" });
      const result = await autoAssignTask(env, { projectId: "p1", taskId: "t1", roomId: "r1" });
      expect(result.ok).toBe(false);
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe("manual_or_no_rule");
    });
  });

  describe("escalateBreachedTasks", () => {
    it("reassigns breached tasks", async () => {
      const env = createQueueEnv();
      await createQueueRule(env, { projectId: "p1", name: "Default", strategy: "least_busy", slaMinutes: 15 });
      await upsertAgentCapacity(env, { projectId: "p1", userId: "u1", isAvailable: true, maxConcurrent: 5 });
      await upsertAgentCapacity(env, { projectId: "p1", userId: "u2", isAvailable: true, maxConcurrent: 5 });
      const past = new Date(Date.now() - 60_000).toISOString();
      env._tasks.push({
        id: "task-old",
        project_id: "p1",
        room_id: "r1",
        status: "open",
        assignee_user_id: "u1",
        sla_due_at: past,
      });
      const result = await escalateBreachedTasks(env, { projectId: "p1" });
      expect(result.escalated).toBe(1);
      expect(result.details[0].taskId).toBe("task-old");
    });
  });

  describe("getQueueStats", () => {
    it("returns aggregated stats", async () => {
      const env = createQueueEnv();
      await createQueueRule(env, { projectId: "p1", name: "R1" });
      await upsertAgentCapacity(env, { projectId: "p1", userId: "u1", isAvailable: true, maxConcurrent: 5 });
      env._tasks.push(
        { id: "t1", project_id: "p1", status: "open", sla_due_at: null },
        { id: "t2", project_id: "p1", status: "claimed", sla_due_at: null },
        { id: "t3", project_id: "p1", status: "resolved", sla_due_at: null },
      );
      const stats = await getQueueStats(env, { projectId: "p1" });
      expect(stats.tasks.open).toBe(1);
      expect(stats.tasks.claimed).toBe(1);
      expect(stats.tasks.resolved).toBe(1);
      expect(stats.agents.available).toBe(1);
      expect(stats.rules).toBe(1);
    });
  });

  describe("listAssignments", () => {
    it("lists all assignments", async () => {
      const env = createQueueEnv();
      env._assignments.push({
        id: "a1",
        project_id: "p1",
        room_id: "r1",
        assigned_to_user_id: "u1",
        assigned_by: "system",
        strategy_used: "least_busy",
        created_at: new Date().toISOString(),
      });
      const result = await listAssignments(env, { projectId: "p1" });
      expect(result.length).toBe(1);
    });
  });
});
