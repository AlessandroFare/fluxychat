import { describe, expect, it } from "vitest";
import {
  createBreakout,
  joinBreakout,
  MAX_ACTIVE_BREAKOUTS,
  parseBreakoutInput,
  setBreakoutTime,
} from "./breakout-rooms.js";

describe("breakout-rooms", () => {
  it("requires a name", () => {
    expect(parseBreakoutInput({}).ok).toBe(false);
    expect(parseBreakoutInput({ name: "Group A" }).ok).toBe(true);
  });

  it("blocks more than the active cap", async () => {
    const env = {
      DB: {
        prepare() {
          return {
            bind() {
              return {
                async first() {
                  return { cnt: MAX_ACTIVE_BREAKOUTS };
                },
                async run() {
                  return { meta: { changes: 1 } };
                },
              };
            },
          };
        },
      },
    };
    const result = await createBreakout(env, {
      projectId: "p1",
      parentRoomId: "r1",
      name: "Overflow",
      createdBy: "teacher",
    });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("too_many_breakouts");
  });

  it("joins a member and extends auto-close", async () => {
    const env = {
      DB: {
        prepare(sql) {
          return {
            bind() {
              return {
                async first() {
                  if (sql.includes("member_count") || sql.includes("FROM breakout_rooms")) {
                    return { id: "brk_1", parent_room_id: "r1", status: "active", member_count: 0, cnt: 1 };
                  }
                  return { cnt: 1 };
                },
                async run() {
                  return { meta: { changes: 1 } };
                },
                async all() {
                  return { results: [] };
                },
              };
            },
          };
        },
      },
    };
    const joined = await joinBreakout(env, { projectId: "p1", breakoutId: "brk_1", userId: "u1" });
    expect(joined.ok).toBe(true);
    const timed = await setBreakoutTime(env, { projectId: "p1", breakoutId: "brk_1", userId: "t", minutes: 15 });
    expect(timed.ok).toBe(true);
    expect(timed.autoCloseAt).toBeTruthy();
  });
});
