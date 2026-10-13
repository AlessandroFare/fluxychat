import { describe, expect, it, vi } from "vitest";
import { ensureDemoSceneExtras } from "./demo-scene-extras.js";

describe("ensureDemoSceneExtras", () => {
  it("inserts colleague messages when missing", async () => {
    const inserts = [];
    const env = {
      DB: {
        prepare: vi.fn((sql) => {
          const stmt = {
            bind: vi.fn(() => stmt),
            first: vi.fn(async () => (sql.includes("COUNT") ? { c: 0 } : null)),
            run: vi.fn(async () => {
              inserts.push(sql);
              return {};
            }),
            all: vi.fn(async () => ({ results: [] })),
          };
          return stmt;
        }),
      },
    };

    const result = await ensureDemoSceneExtras(env, {
      projectId: "p1",
      roomId: "public-demo",
      agentId: "fluxybot",
      guestUserId: "demo-guest",
    });
    expect(result.ok).toBe(true);
    expect(inserts.some((sql) => sql.includes("INSERT INTO messages"))).toBe(true);
  });
});
