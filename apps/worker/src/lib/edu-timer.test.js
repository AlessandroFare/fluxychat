import { describe, expect, it } from "vitest";
import {
  activateRoomTimer,
  getRoomTimer,
  resetRoomTimer,
  setRoomTimerMode,
  setRoomTimerTime,
  startRoomTimer,
  stopRoomTimer,
} from "./edu-timer.js";

function createMockDb(rows = []) {
  return {
    rows: [...rows],
    prepare(sql) {
      const self = this;
      return {
        bind(...args) {
          return {
            async first() {
              if (sql.includes("FROM room_edu_timers")) {
                return self.rows.find((r) => r.project_id === args[0] && r.room_id === args[1]) || null;
              }
              return null;
            },
            async run() {
              if (sql.includes("INSERT INTO room_edu_timers")) {
                const next = {
                  project_id: args[0],
                  room_id: args[1],
                  mode: args[2],
                  running: args[3],
                  time_ms: args[4],
                  accumulated_ms: args[5],
                  started_at: args[6],
                  updated_at: args[7],
                };
                const idx = self.rows.findIndex((r) => r.project_id === args[0] && r.room_id === args[1]);
                if (idx >= 0) self.rows[idx] = next;
                else self.rows.push(next);
              }
              return { meta: { changes: 1 } };
            },
          };
        },
      };
    },
  };
}

describe("edu-timer", () => {
  it("activates a countdown and reports remaining time", async () => {
    const db = createMockDb();
    const env = { DB: db };
    const result = await activateRoomTimer(env, {
      projectId: "p1",
      roomId: "class-1",
      userId: "teacher",
      mode: "timer",
      timeMs: 60_000,
      running: false,
    });
    expect(result.ok).toBe(true);
    expect(result.timer.mode).toBe("timer");
    expect(result.timer.running).toBe(false);
    expect(result.timer.timeMs).toBe(60_000);
  });

  it("starts a stopwatch from zero", async () => {
    const db = createMockDb();
    const env = { DB: db };
    await activateRoomTimer(env, {
      projectId: "p1",
      roomId: "class-1",
      userId: "teacher",
      stopwatch: true,
    });
    const started = await startRoomTimer(env, { projectId: "p1", roomId: "class-1", userId: "teacher" });
    expect(started.timer.mode).toBe("stopwatch");
    expect(started.timer.running).toBe(true);
  });

  it("setTime then stop keeps the frozen value", async () => {
    const db = createMockDb();
    const env = { DB: db };
    await activateRoomTimer(env, {
      projectId: "p1",
      roomId: "class-1",
      userId: "teacher",
      mode: "timer",
      timeMs: 10_000,
    });
    await setRoomTimerTime(env, { projectId: "p1", roomId: "class-1", userId: "teacher", timeMs: 5_000 });
    const stopped = await stopRoomTimer(env, { projectId: "p1", roomId: "class-1", userId: "teacher" });
    expect(stopped.timer.running).toBe(false);
    expect(stopped.timer.timeMs).toBe(5_000);
  });

  it("reset clears time but keeps mode", async () => {
    const db = createMockDb();
    const env = { DB: db };
    await activateRoomTimer(env, {
      projectId: "p1",
      roomId: "class-1",
      userId: "teacher",
      stopwatch: true,
      timeMs: 2_000,
    });
    const reset = await resetRoomTimer(env, { projectId: "p1", roomId: "class-1", userId: "teacher" });
    expect(reset.timer.mode).toBe("stopwatch");
    expect(reset.timer.timeMs).toBe(0);
    expect(reset.timer.running).toBe(false);
  });

  it("switchMode moves remaining time onto the new clock", async () => {
    const db = createMockDb();
    const env = { DB: db };
    await activateRoomTimer(env, {
      projectId: "p1",
      roomId: "class-1",
      userId: "teacher",
      mode: "timer",
      timeMs: 8_000,
    });
    const switched = await setRoomTimerMode(env, {
      projectId: "p1",
      roomId: "class-1",
      userId: "teacher",
      mode: "stopwatch",
    });
    expect(switched.timer.mode).toBe("stopwatch");
    expect(switched.timer.timeMs).toBe(8_000);
  });

  it("get returns a zeroed timer when none exists", async () => {
    const result = await getRoomTimer({ DB: createMockDb() }, { projectId: "p1", roomId: "class-1" });
    expect(result.timer.timeMs).toBe(0);
    expect(result.timer.running).toBe(false);
  });

  it("rejects invalid time", async () => {
    const result = await activateRoomTimer({ DB: createMockDb() }, {
      projectId: "p1",
      roomId: "class-1",
      userId: "teacher",
      timeMs: -1,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("invalid_time");
  });
});
