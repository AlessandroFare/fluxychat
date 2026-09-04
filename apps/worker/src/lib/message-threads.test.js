import { describe, it, expect } from "vitest";
import { listRoomThreads, listUserThreads, assertChatThreadDepth, parseReplyParentId } from "./message-threads.js";

function createEnv({ rooms, members, messages }) {
  return {
    DB: {
      prepare: (sql) => ({
        bind: (...args) => ({
          all: () => {
            if (sql.includes("GROUP BY parent_id")) {
              const projectId = args[0];
              const roomId = args[1];
              const byParent = new Map();
              for (const m of messages) {
                if (
                  m.project_id !== projectId ||
                  m.room_id !== roomId ||
                  m.deleted_at ||
                  m.parent_id == null
                ) {
                  continue;
                }
                const cur = byParent.get(m.parent_id) || {
                  parent_id: m.parent_id,
                  reply_count: 0,
                  last_reply_at: m.created_at,
                  last_reply_id: m.id,
                };
                cur.reply_count += 1;
                if (m.created_at > cur.last_reply_at) {
                  cur.last_reply_at = m.created_at;
                  cur.last_reply_id = m.id;
                }
                byParent.set(m.parent_id, cur);
              }
              return Promise.resolve({ results: [...byParent.values()] });
            }
            if (sql.includes("AND EXISTS") && sql.includes("r.parent_id = m.id")) {
              const projectId = args[0];
              const roomId = args[1];
              const rows = messages.filter(
                (m) =>
                  m.project_id === projectId &&
                  m.room_id === roomId &&
                  !m.deleted_at &&
                  messages.some(
                    (r) =>
                      r.parent_id === m.id &&
                      r.project_id === projectId &&
                      r.room_id === roomId &&
                      !r.deleted_at,
                  ),
              );
              return Promise.resolve({
                results: rows.map((m) => ({
                  id: m.id,
                  parent_id: m.parent_id,
                  user_id: m.user_id,
                  content: m.content,
                  created_at: m.created_at,
                })),
              });
            }
            if (sql.includes("FROM rooms r") && sql.includes("room_members")) {
              const projectId = args[0];
              const userId = args[1];
              const ids = members
                .filter((m) => m.user_id === userId)
                .map((m) => m.room_id);
              return Promise.resolve({
                results: rooms
                  .filter((r) => r.project_id === projectId && ids.includes(r.id))
                  .map((r) => ({ id: r.id })),
              });
            }
            if (sql.includes("parent_id IS NOT NULL") && sql.includes("ORDER BY created_at DESC")) {
              const projectId = args[0];
              const userId = args[1];
              const roomIds = args.slice(2, -1);
              const limit = args[args.length - 1];
              const rows = messages
                .filter(
                  (m) =>
                    m.project_id === projectId &&
                    m.user_id === userId &&
                    !m.deleted_at &&
                    roomIds.includes(m.room_id) &&
                    (m.parent_id != null ||
                      messages.some((r) => r.parent_id === m.id && !r.deleted_at)),
                )
                .sort((a, b) => b.created_at.localeCompare(a.created_at))
                .slice(0, limit)
                .map((m) => ({
                  id: m.id,
                  room_id: m.room_id,
                  parent_id: m.parent_id,
                  created_at: m.created_at,
                }));
              return Promise.resolve({ results: rows });
            }
            if (sql.includes("parent_id IN")) {
              const projectId = args[0];
              const roomId = args[1];
              const parentIds = args.slice(2);
              return Promise.resolve({
                results: messages
                  .filter(
                    (m) =>
                      m.project_id === projectId &&
                      m.room_id === roomId &&
                      !m.deleted_at &&
                      parentIds.includes(m.parent_id),
                  )
                  .map((m) => ({ id: m.id })),
              });
            }
            if (sql.includes("id IN (") && sql.includes("ORDER BY created_at ASC")) {
              const projectId = args[0];
              const roomId = args[1];
              const ids = args.slice(2);
              return Promise.resolve({
                results: messages
                  .filter(
                    (m) =>
                      m.project_id === projectId &&
                      m.room_id === roomId &&
                      !m.deleted_at &&
                      ids.includes(m.id),
                  )
                  .sort((a, b) => a.created_at.localeCompare(b.created_at))
                  .map((m) => ({
                    id: m.id,
                    user_id: m.user_id,
                    content: m.content,
                    created_at: m.created_at,
                    parent_id: m.parent_id,
                  })),
              });
            }
            return Promise.resolve({ results: [] });
          },
          first: () => {
            if (sql.includes("SELECT id, parent_id FROM messages")) {
              const projectId = args[0];
              const roomId = args[1];
              const id = args[2];
              const m = messages.find(
                (row) =>
                  row.project_id === projectId &&
                  row.room_id === roomId &&
                  row.id === id &&
                  !row.deleted_at,
              );
              return Promise.resolve(
                m ? { id: m.id, parent_id: m.parent_id } : null,
              );
            }
            if (sql.includes("FROM messages") && sql.includes("LIMIT 1")) {
              const projectId = args[0];
              const roomId = args[1];
              const id = args[2];
              const m = messages.find(
                (row) =>
                  row.project_id === projectId &&
                  row.room_id === roomId &&
                  row.id === id &&
                  !row.deleted_at,
              );
              return Promise.resolve(
                m
                  ? {
                      id: m.id,
                      user_id: m.user_id,
                      content: m.content,
                      created_at: m.created_at,
                      parent_id: m.parent_id,
                    }
                  : null,
              );
            }
            return Promise.resolve(null);
          },
        }),
      }),
    },
  };
}

describe("listUserThreads", () => {
  it("returns threads with reply stats and unread count", async () => {
    const env = createEnv({
      rooms: [{ id: "room-a", project_id: "p1" }],
      members: [{ room_id: "room-a", user_id: "u1" }],
      messages: [
        {
          id: 1,
          project_id: "p1",
          room_id: "room-a",
          user_id: "u2",
          content: "Root question?",
          parent_id: null,
          created_at: "2026-01-01T10:00:00Z",
          deleted_at: null,
        },
        {
          id: 2,
          project_id: "p1",
          room_id: "room-a",
          user_id: "u1",
          content: "My reply",
          parent_id: 1,
          created_at: "2026-01-01T10:05:00Z",
          deleted_at: null,
        },
        {
          id: 3,
          project_id: "p1",
          room_id: "room-a",
          user_id: "u2",
          content: "Follow-up",
          parent_id: 1,
          created_at: "2026-01-01T10:10:00Z",
          deleted_at: null,
        },
      ],
    });

    const { threads } = await listUserThreads(env, {
      projectId: "p1",
      userId: "u1",
      roles: ["member"],
    });

    expect(threads).toHaveLength(1);
    expect(threads[0].rootMessageId).toBe(1);
    expect(threads[0].replyCount).toBe(2);
    expect(threads[0].unreadCount).toBe(1);
    expect(threads[0].lastReply.messageId).toBe(3);
  });
});

describe("parseReplyParentId", () => {
  it("accepts replyTo, parentId, and threadParentId", () => {
    expect(parseReplyParentId({ replyTo: 9 })).toBe(9);
    expect(parseReplyParentId({ parentId: 9 })).toBe(9);
    expect(parseReplyParentId({ threadParentId: "9" })).toBe(9);
    expect(parseReplyParentId({})).toBeNull();
  });
});

describe("assertChatThreadDepth", () => {
  it("rejects a reply past max depth", async () => {
    const chain = [];
    for (let i = 1; i <= 10; i++) {
      chain.push({
        id: i,
        project_id: "p1",
        room_id: "room-a",
        user_id: "u1",
        content: `m${i}`,
        parent_id: i === 1 ? null : i - 1,
        created_at: `2026-01-01T10:00:${String(i).padStart(2, "0")}Z`,
        deleted_at: null,
      });
    }
    const env = createEnv({
      rooms: [{ id: "room-a", project_id: "p1" }],
      members: [{ room_id: "room-a", user_id: "u1" }],
      messages: chain,
    });
    const ok = await assertChatThreadDepth(env, {
      projectId: "p1",
      roomId: "room-a",
      parentId: 1,
    });
    expect(ok.ok).toBe(true);
    const deep = await assertChatThreadDepth(env, {
      projectId: "p1",
      roomId: "room-a",
      parentId: 9,
    });
    expect(deep).toEqual({ ok: false, error: "thread_depth_exceeded" });
  });
});

describe("listRoomThreads", () => {
  const fixtures = {
    rooms: [{ id: "room-a", project_id: "p1" }],
    members: [{ room_id: "room-a", user_id: "u1" }],
    messages: [
      {
        id: 1,
        project_id: "p1",
        room_id: "room-a",
        user_id: "u2",
        content: "Root",
        parent_id: null,
        created_at: "2026-01-01T10:00:00Z",
        deleted_at: null,
      },
      {
        id: 2,
        project_id: "p1",
        room_id: "room-a",
        user_id: "u1",
        content: "Reply",
        parent_id: 1,
        created_at: "2026-01-01T10:05:00Z",
        deleted_at: null,
      },
      {
        id: 3,
        project_id: "p1",
        room_id: "room-a",
        user_id: "u2",
        content: "Nested",
        parent_id: 2,
        created_at: "2026-01-01T10:10:00Z",
        deleted_at: null,
      },
    ],
  };

  it("lists root threads and does not leak spawnSeq", async () => {
    const env = createEnv(fixtures);
    const page = await listRoomThreads(env, { projectId: "p1", roomId: "room-a" });
    expect(page.ok).toBe(true);
    expect(page.threads).toHaveLength(1);
    expect(page.threads[0].id).toBe(1);
    expect(page.threads[0].parentThreadId).toBeNull();
    expect(page.threads[0].messageCount).toBe(1);
    expect(page.threads[0]).not.toHaveProperty("spawnSeq");
    expect(page.hasMore).toBe(false);
    expect(page.nextCursor).toBeNull();
  });

  it("lists nested threads with parent=", async () => {
    const env = createEnv(fixtures);
    const page = await listRoomThreads(env, {
      projectId: "p1",
      roomId: "room-a",
      parent: 1,
    });
    expect(page.threads.map((t) => t.id)).toEqual([2]);
    expect(page.threads[0].parentThreadId).toBe(1);
    expect(page.threads[0].rootThreadId).toBe(1);
    expect(page.threads[0].depth).toBe(1);
  });

  it("pages with the opaque nextCursor, not an id-derived cursor", async () => {
    const extra = {
      ...fixtures,
      messages: [
        ...fixtures.messages,
        {
          id: 10,
          project_id: "p1",
          room_id: "room-a",
          user_id: "u2",
          content: "Other root",
          parent_id: null,
          created_at: "2026-01-01T09:00:00Z",
          deleted_at: null,
        },
        {
          id: 11,
          project_id: "p1",
          room_id: "room-a",
          user_id: "u1",
          content: "Other reply",
          parent_id: 10,
          created_at: "2026-01-01T09:05:00Z",
          deleted_at: null,
        },
      ],
    };
    const env = createEnv(extra);
    const first = await listRoomThreads(env, { projectId: "p1", roomId: "room-a", limit: 1 });
    expect(first.threads).toHaveLength(1);
    expect(first.hasMore).toBe(true);
    expect(first.nextCursor).toBeTruthy();
    const second = await listRoomThreads(env, {
      projectId: "p1",
      roomId: "room-a",
      limit: 1,
      cursor: first.nextCursor,
    });
    expect(second.threads).toHaveLength(1);
    expect(second.threads[0].id).not.toBe(first.threads[0].id);
  });

  it("rejects a junk cursor", async () => {
    const env = createEnv(fixtures);
    const page = await listRoomThreads(env, {
      projectId: "p1",
      roomId: "room-a",
      cursor: "not-a-cursor",
    });
    expect(page).toEqual({ ok: false, error: "invalid_cursor" });
  });
});
