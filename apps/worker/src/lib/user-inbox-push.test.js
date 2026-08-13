import { describe, it, expect, vi } from "vitest";
import { notifyInboxUpdated, notifyInboxUpdatedForRoomMembers } from "./user-inbox-push.js";

function makeEnv() {
  const deliveries = [];
  return {
    env: {
      USER: {
        idFromName: (name) => name,
        get: () => ({
          fetch: async (_url, init) => {
            deliveries.push(JSON.parse(init.body));
            return new Response(JSON.stringify({ ok: true, delivered: 1 }));
          },
        }),
      },
      DB: {
        prepare(sql) {
          let params = [];
          return {
            bind(...p) {
              params = p;
              return this;
            },
            async all() {
              if (sql.includes("room_members")) {
                return {
                  results: [
                    { user_id: "u1", room_name: "General" },
                    { user_id: "u2", room_name: "General" },
                  ],
                };
              }
              return { results: [] };
            },
          };
        },
      },
    },
    deliveries,
  };
}

describe("user-inbox-push", () => {
  it("delivers inbox_updated to user DO", async () => {
    const { env, deliveries } = makeEnv();
    const result = await notifyInboxUpdated(env, {
      projectId: "p1",
      userId: "u1",
      roomId: "r1",
      roomName: "General",
      messageId: 42,
      preview: "hello",
    });
    expect(result.ok).toBe(true);
    expect(result.delivered).toBe(1);
    expect(deliveries[0].name).toBe("inbox_updated");
    expect(deliveries[0].data.roomId).toBe("r1");
  });

  it("fans out to room members except author", async () => {
    const { env, deliveries } = makeEnv();
    const result = await notifyInboxUpdatedForRoomMembers(env, {
      projectId: "p1",
      roomId: "r1",
      excludeUserId: "u1",
      messageId: 99,
    });
    expect(result.notified).toBe(1);
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0].userId).toBe("u2");
  });
});
