import { describe, expect, it } from "vitest";
import {
  cancelAgentSchedule,
  claimDueAgentSchedules,
  completeAgentScheduleFire,
  cronFieldMatches,
  earliestAgentScheduleDueAt,
  nextCronOccurrence,
  parseCronExpression,
  upsertAgentSchedule,
  validateAgentScheduleInput,
  withAgentScheduleRows,
} from "./agent-schedules.js";

describe("agent schedules", () => {
  it("parses 5-field cron", () => {
    expect(parseCronExpression("*/5 * * * *").ok).toBe(true);
    expect(parseCronExpression("0 9 * * 1").ok).toBe(true);
    expect(parseCronExpression("too short").ok).toBe(false);
  });

  it("matches cron field lists and steps", () => {
    expect(cronFieldMatches("*", 12, 0, 59)).toBe(true);
    expect(cronFieldMatches("*/15", 0, 0, 59)).toBe(true);
    expect(cronFieldMatches("*/15", 15, 0, 59)).toBe(true);
    expect(cronFieldMatches("*/15", 7, 0, 59)).toBe(false);
    expect(cronFieldMatches("1,15,30", 15, 0, 59)).toBe(true);
    expect(cronFieldMatches("10-12", 11, 0, 59)).toBe(true);
  });

  it("finds the next UTC cron minute", () => {
    const after = Date.UTC(2026, 7, 25, 10, 0, 0);
    const next = nextCronOccurrence("5 * * * *", after);
    expect(next).toBe(Date.UTC(2026, 7, 25, 10, 5, 0));
  });

  it("rejects short delays and upserts delay schedules", () => {
    expect(validateAgentScheduleInput({ kind: "delay", agentId: "a", delayMs: 100 }).ok).toBe(false);
    const rows = [];
    const out = upsertAgentSchedule(rows, {
      kind: "delay",
      agentId: "bot-1",
      projectId: "p1",
      roomId: "r1",
      delayMs: 5_000,
      prompt: "standup",
      idempotencyKey: "standup-1",
    }, 1_000);
    expect(out.ok).toBe(true);
    expect(out.created).toBe(true);
    expect(out.schedule.nextRunAt).toBe(6_000);

    const again = upsertAgentSchedule(rows, {
      kind: "delay",
      agentId: "bot-1",
      projectId: "p1",
      roomId: "r1",
      delayMs: 9_000,
      idempotencyKey: "standup-1",
    }, 1_000);
    expect(again.created).toBe(false);
    expect(again.schedule.id).toBe(out.schedule.id);
  });

  it("claims due rows once until stuck", () => {
    const rows = [];
    upsertAgentSchedule(rows, {
      kind: "delay",
      agentId: "bot-1",
      projectId: "p",
      roomId: "r",
      delayMs: 1_000,
    }, 0);
    expect(claimDueAgentSchedules(rows, 500)).toHaveLength(0);
    const first = claimDueAgentSchedules(rows, 1_000);
    expect(first).toHaveLength(1);
    expect(claimDueAgentSchedules(rows, 1_100)).toHaveLength(0);
    const stuck = claimDueAgentSchedules(rows, 1_000 + 5 * 60 * 1000);
    expect(stuck).toHaveLength(1);
  });

  it("completes delay and advances cron", () => {
    const delay = {
      kind: "delay",
      status: "running",
      failCount: 0,
    };
    completeAgentScheduleFire(delay, { ok: true, now: 10, runId: "run-1" });
    expect(delay.status).toBe("done");

    const cron = {
      kind: "cron",
      status: "running",
      cronExpression: "0 * * * *",
      failCount: 0,
    };
    completeAgentScheduleFire(cron, { ok: true, now: Date.UTC(2026, 7, 25, 10, 0, 0), runId: "run-2" });
    expect(cron.status).toBe("pending");
    expect(cron.nextRunAt).toBe(Date.UTC(2026, 7, 25, 11, 0, 0));
  });

  it("retries failed delay with backoff", () => {
    const delay = { kind: "delay", status: "running", failCount: 0, nextRunAt: 0 };
    completeAgentScheduleFire(delay, { ok: false, now: 1_000, error: "boom" });
    expect(delay.status).toBe("pending");
    expect(delay.nextRunAt).toBeGreaterThan(1_000);
  });

  it("marks fatal delay fires as failed", () => {
    const delay = { kind: "delay", status: "running", failCount: 0, nextRunAt: 0 };
    completeAgentScheduleFire(delay, { ok: false, now: 1_000, error: "oom", retry: false });
    expect(delay.status).toBe("failed");
  });

  it("cancels and reports earliest due", () => {
    const rows = [];
    const a = upsertAgentSchedule(rows, { kind: "delay", agentId: "a", delayMs: 8_000 }, 0);
    upsertAgentSchedule(rows, { kind: "delay", agentId: "b", delayMs: 3_000 }, 0);
    expect(earliestAgentScheduleDueAt(rows)).toBe(3_000);
    cancelAgentSchedule(rows, a.schedule.id);
    expect(earliestAgentScheduleDueAt(rows)).toBe(3_000);
  });

  it("persists through KV storage", async () => {
    const bag = new Map();
    const storage = {
      async get(k) {
        return bag.get(k);
      },
      async put(k, v) {
        bag.set(k, v);
      },
    };
    await withAgentScheduleRows(storage, (rows) => {
      return upsertAgentSchedule(rows, {
        kind: "delay",
        agentId: "bot",
        delayMs: 2_000,
        projectId: "p",
        roomId: "r",
      }, 0);
    });
    const listed = await withAgentScheduleRows(storage, (rows) => ({ rows, listed: rows }));
    expect(listed.listed).toHaveLength(1);
    expect(listed.listed[0].agentId).toBe("bot");
  });
});
