import { describe, it, expect, vi } from "vitest";
import { ensureDemoRoomSeeded, getDemoStatus, seedDemoRooms } from "./demo-room-seed.js";

describe("demo-room-seed", () => {
  it("A2-21: seeds a project-scoped starter room so later projects get one too", async () => {
    const inserts = [];
    const env = {
      DB: {
        prepare: vi.fn((sql) => ({
          bind: vi.fn((...args) => ({
            first: vi.fn(async () => ({ c: 0 })),
            run: vi.fn(async () => {
              inserts.push({ sql, args });
              return {};
            }),
          })),
        })),
      },
    };
    await seedDemoRooms(env, "proj_2");
    const roomInsert = inserts.find((i) => i.sql.includes("INSERT OR IGNORE INTO rooms"));
    expect(roomInsert.args[0]).toBe("general_proj_2");
    expect(roomInsert.args[1]).toBe("proj_2");
    const messageInsert = inserts.find(
      (i) => i.sql.includes("INSERT INTO messages") && i.args[0] === "proj_2",
    );
    expect(messageInsert.args[1]).toBe("general_proj_2");
  });

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
