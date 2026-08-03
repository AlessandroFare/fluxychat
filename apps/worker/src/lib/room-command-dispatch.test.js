import { describe, it, expect, vi } from "vitest";
import { tryDispatchSlashCommand } from "./room-command-dispatch.js";

vi.mock("./room-shard.js", () => ({
  fanoutRoomInternal: vi.fn(async () => {}),
}));

describe("room-command-dispatch", () => {
  it("handles /clear without persisting a message", async () => {
    const env = { DB: { prepare: vi.fn() } };
    const result = await tryDispatchSlashCommand(env, {
      projectId: "p1",
      roomId: "r1",
      userId: "u1",
      content: "/clear",
    });
    expect(result.handled).toBe(true);
    expect(result.ok).toBe(true);
    expect(result.suppressMessage).toBe(true);
    expect(env.DB.prepare).not.toHaveBeenCalled();
  });

  it("returns error for unknown slash command", async () => {
    const env = {
      DB: {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue({ role: "member" }),
            all: vi.fn().mockResolvedValue({ results: [] }),
            run: vi.fn().mockResolvedValue({}),
          }),
        }),
      },
    };
    const result = await tryDispatchSlashCommand(env, {
      projectId: "p1",
      roomId: "r1",
      userId: "u1",
      content: "/not-a-real-command",
    });
    expect(result.handled).toBe(true);
    expect(result.ok).toBe(false);
  });
});
