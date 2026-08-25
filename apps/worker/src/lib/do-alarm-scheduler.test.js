import { describe, expect, it } from "vitest";
import {
  ALARM_JOBS_KEY,
  parseAlarmJobs,
  earliestDueAt,
  splitDueAlarmJobs,
  scheduleDoAlarmJob,
  cancelDoAlarmJob,
  takeDueDoAlarmJobs,
} from "./do-alarm-scheduler.js";

function makeStorage() {
  const store = new Map();
  const alarms = { when: null };
  return {
    alarms,
    async get(k) {
      return store.get(k);
    },
    async put(k, v) {
      store.set(k, v);
    },
    async setAlarm(when) {
      alarms.when = when;
    },
    async deleteAlarm() {
      alarms.when = null;
    },
  };
}

describe("do-alarm-scheduler", () => {
  it("earliestDueAt is the min of named jobs", () => {
    const jobs = parseAlarmJobs({
      expiry: { dueAt: 200, kind: "expiry" },
      cleanup: { dueAt: 50, kind: "cleanup" },
    });
    expect(earliestDueAt(jobs)).toBe(50);
  });

  it("a later job does not clobber an earlier alarm slot", async () => {
    const storage = makeStorage();
    await scheduleDoAlarmJob(storage, "expiry", 1_000, "expiry");
    await scheduleDoAlarmJob(storage, "cleanup", 5_000, "cleanup");
    expect(storage.alarms.when).toBe(1_000);

    const jobs = parseAlarmJobs(await storage.get(ALARM_JOBS_KEY));
    expect(jobs.size).toBe(2);
  });

  it("takeDue pops only ready jobs and re-arms the rest", async () => {
    const storage = makeStorage();
    await scheduleDoAlarmJob(storage, "a", 10, "a");
    await scheduleDoAlarmJob(storage, "b", 90, "b");
    const due = await takeDueDoAlarmJobs(storage, 20);
    expect(due.map((j) => j.id)).toEqual(["a"]);
    expect(storage.alarms.when).toBe(90);
  });

  it("cancel clears the slot when the queue is empty", async () => {
    const storage = makeStorage();
    await scheduleDoAlarmJob(storage, "only", 10, "only");
    await cancelDoAlarmJob(storage, "only");
    expect(storage.alarms.when).toBeNull();
  });

  it("splitDueAlarmJobs sorts due jobs by time", () => {
    const jobs = parseAlarmJobs({
      late: { dueAt: 30, kind: "late" },
      early: { dueAt: 10, kind: "early" },
    });
    const { due } = splitDueAlarmJobs(jobs, 40);
    expect(due.map((j) => j.id)).toEqual(["early", "late"]);
  });
});
