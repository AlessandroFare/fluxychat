import { describe, expect, it } from "vitest";
import { getRoomCatchUpForUser, markUnreadFromMessage } from "./room-catch-up.js";

function createDb() {
  const receipts = [];
  const messages = [];
  return {
    receipts,
    messages,
    db: {
      prepare(sql) {
        return {
          bind(...args) {
            return {
              async run() {
                if (sql.includes("DELETE FROM read_receipts")) {
                  const keep = receipts.filter(
                    (r) =>
                      !(
                        r.project_id === args[0] &&
                        r.room_id === args[1] &&
                        r.user_id === args[2] &&
                        r.message_id >= args[3]
                      ),
                  );
                  receipts.length = 0;
                  receipts.push(...keep);
                } else if (sql.includes("INSERT OR IGNORE INTO read_receipts")) {
                  const exists = receipts.some(
                    (r) =>
                      r.project_id === args[0] &&
                      r.room_id === args[1] &&
                      r.user_id === args[2] &&
                      r.message_id === args[3],
                  );
                  if (!exists) {
                    receipts.push({
                      project_id: args[0],
                      room_id: args[1],
                      user_id: args[2],
                      message_id: args[3],
                      created_at: args[4],
                    });
                  }
                }
                return { success: true };
              },
              async first() {
                if (sql.includes("MAX(message_id)")) {
                  const ids = receipts
                    .filter(
                      (r) =>
                        r.project_id === args[0] && r.room_id === args[1] && r.user_id === args[2],
                    )
                    .map((r) => r.message_id);
                  return { lastRead: ids.length ? Math.max(...ids) : 0 };
                }
                if (sql.includes("COUNT(*)")) {
                  const c = messages.filter(
                    (m) =>
                      m.project_id === args[0] &&
                      m.room_id === args[1] &&
                      m.id > args[2] &&
                      !m.deleted_at,
                  ).length;
                  return { c };
                }
                if (sql.includes("MIN(id)")) {
                  const ids = messages
                    .filter(
                      (m) =>
                        m.project_id === args[0] &&
                        m.room_id === args[1] &&
                        m.id > args[2] &&
                        !m.deleted_at,
                    )
                    .map((m) => m.id);
                  return { firstId: ids.length ? Math.min(...ids) : null };
                }
                return null;
              },
            };
          },
        };
      },
    },
  };
}

describe("room-catch-up markUnread", () => {
  it("rewinds the watermark to the previous message", async () => {
    const { db, receipts, messages } = createDb();
    receipts.push({ project_id: "p1", room_id: "r1", user_id: "ada", message_id: 10 });
    messages.push(
      { project_id: "p1", room_id: "r1", id: 7, deleted_at: null },
      { project_id: "p1", room_id: "r1", id: 8, deleted_at: null },
      { project_id: "p1", room_id: "r1", id: 9, deleted_at: null },
      { project_id: "p1", room_id: "r1", id: 10, deleted_at: null },
    );

    const before = await getRoomCatchUpForUser(db, { projectId: "p1", roomId: "r1", userId: "ada" });
    expect(before).toMatchObject({ unreadCount: 0, lastReadMessageId: 10 });

    const unread = await markUnreadFromMessage(db, {
      projectId: "p1",
      roomId: "r1",
      userId: "ada",
      messageId: 8,
    });
    expect(unread.ok).toBe(true);
    expect(unread.lastReadMessageId).toBe(7);
    expect(unread.firstUnreadMessageId).toBe(8);
    expect(unread.unreadCount).toBe(3);
  });
});
