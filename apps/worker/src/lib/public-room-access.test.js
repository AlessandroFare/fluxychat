import { describe, it, expect, vi } from "vitest";
import { isPublicRoomInProject, ensurePublicRoomMembership } from "./public-room-access.js";
import { isRoomMember } from "./room-access.js";

function mockDb(handlers) {
  return {
    prepare: (sql) => ({
      bind: (...args) => ({
        first: () => handlers.first?.(sql, args) ?? Promise.resolve(null),
        run: () => handlers.run?.(sql, args) ?? Promise.resolve({}),
      }),
    }),
  };
}

describe("public-room-access", () => {
  it("detects public rooms in project", async () => {
    const db = mockDb({
      first: (sql, args) => {
        if (!sql.includes("type = 'public'")) return Promise.resolve(null);
        const roomId = args[0];
        return roomId === "room-1" ? Promise.resolve({ id: "room-1" }) : Promise.resolve(null);
      },
    });
    expect(await isPublicRoomInProject(db, "proj-1", "room-1")).toBe(true);
    expect(await isPublicRoomInProject(db, "proj-1", "private-1")).toBe(false);
  });

  it("lazy-joins public room on first access", async () => {
    const run = vi.fn().mockResolvedValue({});
    const db = mockDb({
      first: (sql) => {
        if (sql.includes("type = 'public'")) return Promise.resolve({ id: "pub" });
        if (sql.includes("room_members")) return Promise.resolve(null);
        return Promise.resolve(null);
      },
      run,
    });
    await ensurePublicRoomMembership({ DB: db }, "proj-1", "pub", "user-a");
    expect(run).toHaveBeenCalled();
  });

  it("isRoomMember grants access to public rooms without prior membership", async () => {
    const db = mockDb({
      first: (sql) => {
        if (sql.includes("room_members")) return Promise.resolve(null);
        if (sql.includes("FROM rooms")) return Promise.resolve({ id: "pub", type: "public" });
        return Promise.resolve(null);
      },
    });
    expect(await isRoomMember({ DB: db }, "proj-1", "pub", "user-a")).toBe(true);
  });
});
