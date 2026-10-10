import { describe, expect, it } from "vitest";
import { assertRoomSlowModeAllowed, parseSlowModeSeconds } from "./room-config.js";

describe("room slow mode", () => {
  it("clamps Stream cooldown seconds", () => {
    expect(parseSlowModeSeconds(0)).toBe(0);
    expect(parseSlowModeSeconds(10)).toBe(10);
    expect(parseSlowModeSeconds(99999)).toBe(3600);
    expect(parseSlowModeSeconds(-1)).toBeNull();
  });

  it("blocks a send inside the cooldown window", async () => {
    const env = {
      DB: {
        prepare(sql) {
          return {
            bind() {
              return {
                async first() {
                  if (sql.includes("FROM room_config")) {
                    return { config_json: JSON.stringify({ slowModeSeconds: 30 }) };
                  }
                  return { created_at: new Date(Date.now() - 1000).toISOString() };
                },
              };
            },
          };
        },
      },
    };
    const blocked = await assertRoomSlowModeAllowed(env, {
      projectId: "p1",
      roomId: "r1",
      userId: "ada",
    });
    expect(blocked.ok).toBe(false);
    expect(blocked.error).toBe("slow_mode");
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });
});
