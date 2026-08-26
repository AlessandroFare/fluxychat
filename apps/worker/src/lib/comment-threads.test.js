import { describe, expect, it } from "vitest";
import {
  addCommentToThread,
  createCommentThread,
  listCommentThreads,
  sanitizeCommentMetadata,
  updateCommentThread,
} from "./comment-threads.js";

function createEnv() {
  const threads = [];
  const comments = [];
  return {
    threads,
    comments,
    env: {
      DB: {
        prepare(sql) {
          return {
            bind(...args) {
              return {
                async run() {
                  if (sql.includes("INSERT INTO room_comment_threads")) {
                    threads.push({
                      id: args[0],
                      project_id: args[1],
                      room_id: args[2],
                      created_by: args[3],
                      metadata: args[4],
                      resolved: 0,
                      created_at: args[5],
                      updated_at: args[6],
                    });
                  } else if (sql.includes("INSERT INTO room_comment_thread_comments")) {
                    comments.push({
                      id: args[0],
                      thread_id: args[1],
                      project_id: args[2],
                      room_id: args[3],
                      user_id: args[4],
                      body: args[5],
                      created_at: args[6],
                      edited_at: null,
                    });
                  } else if (sql.includes("UPDATE room_comment_threads SET metadata")) {
                    const row = threads.find((t) => t.id === args[args.length - 1]);
                    if (row) {
                      row.metadata = args[0];
                      if (sql.includes("resolved")) row.resolved = args[1];
                      row.updated_at = sql.includes("resolved") ? args[2] : args[1];
                    }
                  } else if (sql.includes("UPDATE room_comment_threads SET updated_at")) {
                    const row = threads.find((t) => t.id === args[1]);
                    if (row) row.updated_at = args[0];
                  }
                  return { success: true };
                },
                async first() {
                  if (sql.includes("FROM room_comment_threads WHERE id")) {
                    return threads.find(
                      (t) => t.id === args[0] && t.project_id === args[1] && t.room_id === args[2],
                    ) || null;
                  }
                  return null;
                },
                async all() {
                  if (sql.includes("FROM room_comment_threads")) {
                    return {
                      results: threads.filter(
                        (t) => t.project_id === args[0] && t.room_id === args[1],
                      ),
                    };
                  }
                  if (sql.includes("FROM room_comment_thread_comments")) {
                    return {
                      results: comments.filter(
                        (c) => c.project_id === args[0] && c.room_id === args[1],
                      ),
                    };
                  }
                  return { results: [] };
                },
              };
            },
          };
        },
      },
      ROOM: {
        idFromName: () => ({}),
        get: () => ({ fetch: async () => new Response(null, { status: 204 }) }),
      },
    },
  };
}

describe("comment-threads", () => {
  it("allowlists pin metadata", () => {
    expect(sanitizeCommentMetadata({ x: 12, y: 40, sceneId: "s1", quote: "hi", xss: "<script>" })).toEqual({
      x: 12,
      y: 40,
      sceneId: "s1",
      quote: "hi",
    });
  });

  it("creates, lists, comments, and resolves a thread", async () => {
    const { env } = createEnv();
    const created = await createCommentThread(env, {
      projectId: "p1",
      roomId: "r1",
      userId: "ada",
      body: "Look here",
      metadata: { x: 8, y: 16 },
    });
    expect(created.ok).toBe(true);
    expect(created.thread.comments).toHaveLength(1);

    const listed = await listCommentThreads(env, { projectId: "p1", roomId: "r1" });
    expect(listed).toHaveLength(1);
    expect(listed[0].metadata).toEqual({ x: 8, y: 16 });

    const added = await addCommentToThread(env, {
      projectId: "p1",
      roomId: "r1",
      threadId: created.thread.id,
      userId: "bob",
      body: "Agreed",
    });
    expect(added.ok).toBe(true);

    const resolved = await updateCommentThread(env, {
      projectId: "p1",
      roomId: "r1",
      threadId: created.thread.id,
      resolved: true,
    });
    expect(resolved.ok).toBe(true);

    const after = await listCommentThreads(env, { projectId: "p1", roomId: "r1" });
    expect(after[0].resolved).toBe(true);
    expect(after[0].comments).toHaveLength(2);
  });
});
