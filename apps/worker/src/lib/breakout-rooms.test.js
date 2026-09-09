import { describe, expect, it } from "vitest";
import { createBreakout, MAX_ACTIVE_BREAKOUTS, parseBreakoutInput } from "./breakout-rooms.js";

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
});
