import { describe, expect, it } from "vitest";
import {
  getInboxSummary,
  upsertRoomSnooze,
  createFollowUp,
  resolveSnoozeUntil,
  clearRoomSnooze,
} from "./inbox.js";

describe("resolveSnoozeUntil", () => {
  it("parses minutes offset", () => {
    const until = resolveSnoozeUntil({ minutes: 60 });
    expect(until).toBeTruthy();
    const diff = new Date(until).getTime() - Date.now();
    expect(diff).toBeGreaterThan(3_500_000);
    expect(diff).toBeLessThan(3_700_000);
  });

  it("parses explicit until ISO", () => {
    expect(resolveSnoozeUntil({ until: "2026-12-01T10:00:00.000Z" })).toBe(
      "2026-12-01T10:00:00.000Z",
    );
  });
});

describe("getInboxSummary", () => {
  it("returns mentions and unread rooms", async () => {
    const env = createInboxEnv();
    const summary = await getInboxSummary(env, {
      projectId: "proj_1",
      userId: "user_1",
      roles: ["member"],
    });
    expect(summary.mentions).toHaveLength(1);
    expect(summary.mentions[0].isUnread).toBe(true);
    expect(summary.unreadRooms).toHaveLength(1);
    expect(summary.unreadRooms[0].unreadCount).toBe(2);
    expect(summary.followUps).toHaveLength(0);
  });

  it("hides snoozed rooms from unread list", async () => {
    const env = createInboxEnv();
    await upsertRoomSnooze(env, {
      projectId: "proj_1",
      userId: "user_1",
      roomId: "room_1",
      snoozeUntil: new Date(Date.now() + 3_600_000).toISOString(),
    });
    const summary = await getInboxSummary(env, {
      projectId: "proj_1",
      userId: "user_1",
      roles: ["member"],
    });
    expect(summary.unreadRooms).toHaveLength(0);
    expect(summary.snoozedRooms).toHaveLength(1);
    await clearRoomSnooze(env, { projectId: "proj_1", userId: "user_1", roomId: "room_1" });
  });
});

describe("createFollowUp", () => {
  it("inserts an open follow-up", async () => {
    const env = createInboxEnv();
    const result = await createFollowUp(env, {
      projectId: "proj_1",
      userId: "user_1",
      roomId: "room_1",
      messageId: 5,
      note: "Reply tomorrow",
    });
    expect(result.ok).toBe(true);
    const summary = await getInboxSummary(env, {
      projectId: "proj_1",
      userId: "user_1",
      roles: ["member"],
    });
    expect(summary.followUps).toHaveLength(1);
    expect(summary.followUps[0].note).toBe("Reply tomorrow");
  });
});

function createInboxEnv() {
  const rooms = [{ id: "room_1", project_id: "proj_1", type: "group", name: "General" }];
  const members = [{ room_id: "room_1", user_id: "user_1" }];
  const messages = [
    { id: 1, project_id: "proj_1", room_id: "room_1", user_id: "alice", content: "hi", created_at: "2026-06-08T09:00:00.000Z", deleted_at: null },
    { id: 2, project_id: "proj_1", room_id: "room_1", user_id: "bob", content: "hey @user_1", created_at: "2026-06-08T09:01:00.000Z", deleted_at: null },
    { id: 3, project_id: "proj_1", room_id: "room_1", user_id: "bob", content: "ping", created_at: "2026-06-08T09:02:00.000Z", deleted_at: null },
  ];
  const mentions = [
    { message_id: 2, project_id: "proj_1", room_id: "room_1", mentioned_user_id: "user_1", created_at: "2026-06-08T09:01:00.000Z" },
  ];
  const readReceipts = [{ project_id: "proj_1", room_id: "room_1", user_id: "user_1", message_id: 1 }];
  const snoozes = [];
  const followUps = [];

  return {
    DB: {
      prepare(sql) {
        return {
          bind(...args) {
            return {
              async first() {
                if (sql.includes("MAX(message_id) as lastRead FROM read_receipts")) {
                  const [, , userId] = args;
                  const row = readReceipts.find((r) => r.user_id === userId);
                  return row ? { lastRead: row.message_id } : null;
                }
                if (sql.includes("COUNT(*) as c FROM messages")) {
                  const [, , lastRead] = args;
                  const c = messages.filter(
                    (m) => m.id > lastRead && !m.deleted_at,
                  ).length;
                  return { c };
                }
                if (sql.includes("MIN(id) as firstId")) {
                  const [, , lastRead] = args;
                  const ids = messages.filter((m) => m.id > lastRead).map((m) => m.id);
                  return ids.length ? { firstId: Math.min(...ids) } : null;
                }
                if (sql.includes("ORDER BY id DESC LIMIT 1")) {
                  const [, roomId] = args;
                  const m = [...messages].reverse().find((x) => x.room_id === roomId);
                  return m || null;
                }
                return null;
              },
              async all() {
                if (sql.includes("FROM rooms r") && sql.includes("room_members")) {
                  return { results: rooms };
                }
                if (sql.includes("SELECT id, name, type FROM rooms")) {
                  return { results: rooms };
                }
                if (sql.includes("FROM message_mentions")) {
                  return {
                    results: mentions.map((mm) => {
                      const m = messages.find((x) => x.id === mm.message_id);
                      const r = rooms.find((x) => x.id === mm.room_id);
                      return {
                        ...mm,
                        author_id: m?.user_id,
                        content: m?.content,
                        room_name: r?.name,
                        room_type: r?.type,
                      };
                    }),
                  };
                }
                if (sql.includes("FROM inbox_snoozes")) {
                  const now = args[2];
                  return {
                    results: snoozes.filter((s) => s.snooze_until > now),
                  };
                }
                if (sql.includes("FROM inbox_follow_ups")) {
                  return { results: followUps.filter((f) => f.status === "open") };
                }
                return { results: [] };
              },
              async run() {
                if (sql.includes("INSERT INTO inbox_snoozes")) {
                  const [, userId, roomId, snoozeUntil] = args;
                  const idx = snoozes.findIndex((s) => s.user_id === userId && s.room_id === roomId);
                  const row = { user_id: userId, room_id: roomId, snooze_until: snoozeUntil };
                  if (idx >= 0) snoozes[idx] = row;
                  else snoozes.push(row);
                }
                if (sql.includes("DELETE FROM inbox_snoozes")) {
                  const [, userId, roomId] = args;
                  const idx = snoozes.findIndex((s) => s.user_id === userId && s.room_id === roomId);
                  if (idx >= 0) snoozes.splice(idx, 1);
                }
                if (sql.includes("INSERT INTO inbox_follow_ups")) {
                  followUps.push({
                    id: args[0],
                    project_id: args[1],
                    user_id: args[2],
                    room_id: args[3],
                    message_id: args[4],
                    note: args[5],
                    due_at: args[6],
                    status: "open",
                    created_at: args[7],
                  });
                }
                return { meta: { changes: 1 } };
              },
            };
          },
        };
      },
    },
  };
}
