import { describe, expect, it } from "vitest";
import {
  addCommentToThread,
  createCommentThread,
  deleteComment,
  deleteCommentThread,
  editComment,
  listCommentThreads,
  sanitizeCommentMetadata,
  setCommentReaction,
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
                  } else if (sql.includes("UPDATE room_comment_thread_comments SET reactions_json")) {
                    const row = comments.find((c) => c.id === args[1]);
                    if (row) row.reactions_json = args[0];
                  } else if (sql.includes("UPDATE room_comment_thread_comments SET body")) {
                    const row = comments.find((c) => c.id === args[2]);
                    if (row) {
                      row.body = args[0];
                      row.edited_at = args[1];
                    }
                  } else if (sql.includes("DELETE FROM room_comment_thread_comments")) {
                    const keep = sql.includes("WHERE id = ?")
                      ? comments.filter(
                          (c) =>
                            !(c.id === args[0] && c.project_id === args[1] && c.room_id === args[2]),
                        )
                      : comments.filter(
                          (c) =>
                            !(c.thread_id === args[0] && c.project_id === args[1] && c.room_id === args[2]),
                        );
                    comments.length = 0;
                    comments.push(...keep);
                  } else if (sql.includes("DELETE FROM room_comment_threads")) {
                    const keep = threads.filter(
                      (t) => !(t.id === args[0] && t.project_id === args[1] && t.room_id === args[2]),
                    );
                    threads.length = 0;
                    threads.push(...keep);
                  }
                  return { success: true };
                },
                async first() {
                  if (sql.includes("FROM room_comment_thread_comments")) {
                    return comments.find(
                      (c) =>
                        c.id === args[0] &&
                        c.thread_id === args[1] &&
                        c.project_id === args[2] &&
                        c.room_id === args[3],
                    ) || null;
                  }
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

  it("edits own comment and deletes own thread; rejects others", async () => {
    const { env } = createEnv();
    const created = await createCommentThread(env, {
      projectId: "p1",
      roomId: "r1",
      userId: "ada",
      body: "Look here",
    });
    const edited = await editComment(env, {
      projectId: "p1",
      roomId: "r1",
      threadId: created.thread.id,
      commentId: created.thread.comments[0].id,
      userId: "ada",
      body: "Look there",
    });
    expect(edited.ok).toBe(true);
    expect(edited.comment.body).toBe("Look there");
    expect(edited.comment.editedAt).toBeTruthy();

    const stolen = await editComment(env, {
      projectId: "p1",
      roomId: "r1",
      threadId: created.thread.id,
      commentId: created.thread.comments[0].id,
      userId: "bob",
      body: "nope",
    });
    expect(stolen).toEqual({ ok: false, error: "forbidden" });

    const denied = await deleteCommentThread(env, {
      projectId: "p1",
      roomId: "r1",
      threadId: created.thread.id,
      userId: "bob",
    });
    expect(denied).toEqual({ ok: false, error: "forbidden" });

    const deleted = await deleteCommentThread(env, {
      projectId: "p1",
      roomId: "r1",
      threadId: created.thread.id,
      userId: "ada",
    });
    expect(deleted.ok).toBe(true);
    const after = await listCommentThreads(env, { projectId: "p1", roomId: "r1" });
    expect(after).toEqual([]);
  });

  it("deletes own comment and keeps the thread", async () => {
    const { env } = createEnv();
    const created = await createCommentThread(env, {
      projectId: "p1",
      roomId: "r1",
      userId: "ada",
      body: "Look here",
    });
    const added = await addCommentToThread(env, {
      projectId: "p1",
      roomId: "r1",
      threadId: created.thread.id,
      userId: "bob",
      body: "Agreed",
    });
    const stolen = await deleteComment(env, {
      projectId: "p1",
      roomId: "r1",
      threadId: created.thread.id,
      commentId: added.comment.id,
      userId: "ada",
    });
    expect(stolen).toEqual({ ok: false, error: "forbidden" });

    const deleted = await deleteComment(env, {
      projectId: "p1",
      roomId: "r1",
      threadId: created.thread.id,
      commentId: added.comment.id,
      userId: "bob",
    });
    expect(deleted.ok).toBe(true);
    const after = await listCommentThreads(env, { projectId: "p1", roomId: "r1" });
    expect(after).toHaveLength(1);
    expect(after[0].comments).toHaveLength(1);
    expect(after[0].comments[0].userId).toBe("ada");
  });

  it("adds and removes a comment reaction", async () => {
    const { env } = createEnv();
    const created = await createCommentThread(env, {
      projectId: "p1",
      roomId: "r1",
      userId: "ada",
      body: "Look here",
    });
    const commentId = created.thread.comments[0].id;
    const added = await setCommentReaction(env, {
      projectId: "p1",
      roomId: "r1",
      threadId: created.thread.id,
      commentId,
      userId: "bob",
      emoji: "👍",
    });
    expect(added.ok).toBe(true);
    expect(added.comment.reactions["👍"]).toEqual(["bob"]);
    const gone = await setCommentReaction(env, {
      projectId: "p1",
      roomId: "r1",
      threadId: created.thread.id,
      commentId,
      userId: "bob",
      emoji: "👍",
      remove: true,
    });
    expect(gone.comment.reactions["👍"]).toBeUndefined();
  });
});
