import { describe, it, expect, vi } from "vitest";
import { ensureDemoRoomSeeded, getDemoStatus } from "./demo-room-seed.js";

describe("demo-room-seed", () => {
  it("getDemoStatus reflects env", () => {
    const status = getDemoStatus({
      DEMO_ENABLED: "true",
      DEMO_ROOM_ID: "public-demo",
      DEMO_API_KEY: "fc_key",
      DEMO_AGENT_NAME: "FluxyBot",
    });
    expect(status.ready).toBe(true);
    expect(status.roomId).toBe("public-demo");
  });

  it("seeds welcome messages when room is empty", async () => {
    const inserts = [];
    const env = {
      DB: {
        prepare: vi.fn((sql) => ({
          bind: vi.fn(() => ({
            first: vi.fn(async () =>
              sql.includes("COUNT") ? { c: 0 } : null,
            ),
            run: vi.fn(async () => {
              if (sql.includes("INSERT INTO messages")) inserts.push(sql);
              return {};
            }),
          })),
        })),
      },
    };

    const result = await ensureDemoRoomSeeded(env, "p1", "public-demo");
    expect(result.seeded).toBe(true);
    expect(result.messageCount).toBe(3);
    expect(inserts.length).toBe(3);
  });

  it("skips seed when messages exist", async () => {
    const env = {
      DB: {
        prepare: vi.fn(() => ({
          bind: vi.fn(() => ({
            first: vi.fn(async () => ({ c: 5 })),
            run: vi.fn(),
          })),
        })),
      },
    };
    const result = await ensureDemoRoomSeeded(env, "p1", "public-demo");
    expect(result.seeded).toBe(false);
    expect(result.messageCount).toBe(5);
  });
});
