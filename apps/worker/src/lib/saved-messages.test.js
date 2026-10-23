import { describe, expect, it } from "vitest";
import { listSavedMessages, saveMessage, unsaveMessage } from "./saved-messages.js";

function createEnv(seed = {}) {
  const saved = [];
  const messages = seed.messages || [];
  const rooms = seed.rooms || [];
  return {
    saved,
    env: {
      DB: {
        prepare(sql) {
          return {
            bind(...args) {
              return {
                async run() {
                  if (sql.includes("INSERT OR IGNORE INTO saved_messages")) {
                    const [projectId, userId, messageId, roomId, createdAt] = args;
                    const exists = saved.some(
                      (row) =>
                        row.project_id === projectId &&
                        row.user_id === userId &&
                        row.message_id === messageId,
                    );
                    if (!exists) {
                      saved.push({
                        project_id: projectId,
                        user_id: userId,
                        message_id: messageId,
                        room_id: roomId,
                        created_at: createdAt,
                      });
                    }
                  } else if (sql.includes("DELETE FROM saved_messages")) {
                    const [projectId, userId, messageId] = args;
                    for (let i = saved.length - 1; i >= 0; i -= 1) {
                      const row = saved[i];
                      if (
                        row.project_id === projectId &&
                        row.user_id === userId &&
                        row.message_id === messageId
                      ) {
                        saved.splice(i, 1);
                      }
                    }
                  }
                  return { meta: {} };
                },
                async all() {
                  if (!sql.includes("FROM saved_messages")) return { results: [] };
                  const [projectId, userId] = args;
                  const results = saved
                    .filter(
                      (row) => row.project_id === projectId && row.user_id === userId,
                    )
                    .map((row) => {
                      const message =
                        messages.find((m) => m.id === row.message_id) || {};
                      const room = rooms.find((r) => r.id === row.room_id);
                      return {
                        message_id: row.message_id,
                        room_id: row.room_id,
                        saved_at: row.created_at,
                        content: message.content,
                        author_id: message.user_id,
                        created_at: message.created_at,
                        deleted_at: message.deleted_at ?? null,
                        room_name: room?.name ?? null,
                      };
                    })
                    .sort((a, b) => String(b.saved_at).localeCompare(String(a.saved_at)));
                  return { results };
                },
              };
            },
          };
        },
      },
    },
  };
}

describe("saved-messages", () => {
  it("saves once (idempotent), lists with room name, unsaves", async () => {
    const { env, saved } = createEnv({
      messages: [
        {
          id: 7,
          content: "hello   world",
          user_id: "u2",
          created_at: "2026-01-01T00:00:00.000Z",
          deleted_at: null,
        },
      ],
      rooms: [{ id: "r1", name: "general" }],
    });

    expect(
      (await saveMessage(env, { projectId: "p1", userId: "u1", messageId: 7, roomId: "r1" }))
        .ok,
    ).toBe(true);
    await saveMessage(env, { projectId: "p1", userId: "u1", messageId: 7, roomId: "r1" });
    expect(saved).toHaveLength(1);

    const list = await listSavedMessages(env, { projectId: "p1", userId: "u1" });
    expect(list.items).toEqual([
      expect.objectContaining({
        messageId: 7,
        roomName: "general",
        authorId: "u2",
        preview: "hello world",
      }),
    ]);

    await unsaveMessage(env, { projectId: "p1", userId: "u1", messageId: 7 });
    expect((await listSavedMessages(env, { projectId: "p1", userId: "u1" })).items).toEqual([]);
  });

  it("filters soft-deleted messages and rejects invalid ids", async () => {
    const { env } = createEnv({
      messages: [
        { id: 1, content: "gone", user_id: "u2", created_at: "x", deleted_at: "2026-02-01" },
        { id: 2, content: "kept", user_id: "u2", created_at: "y", deleted_at: null },
      ],
    });
    await saveMessage(env, { projectId: "p1", userId: "u1", messageId: 1, roomId: "r1" });
    await saveMessage(env, { projectId: "p1", userId: "u1", messageId: 2, roomId: "r1" });
    const list = await listSavedMessages(env, { projectId: "p1", userId: "u1" });
    expect(list.items.map((item) => item.messageId)).toEqual([2]);

    expect(
      (await saveMessage(env, { projectId: "p1", userId: "u1", messageId: 0, roomId: "r1" })).ok,
    ).toBe(false);
    expect(
      (await unsaveMessage(env, { projectId: "p1", userId: "", messageId: 2 })).ok,
    ).toBe(false);
  });
});
