import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAuthMatrixDeps } from "./auth-matrix-deps.js";
import { dispatchCommentThreadsRoutes } from "./comment-threads-http.js";
import * as lib from "../lib/comment-threads.js";

vi.mock("../lib/comment-threads.js", () => ({
  listCommentThreads: vi.fn(async () => []),
  createCommentThread: vi.fn(async () => ({ ok: true, thread: { id: "cth_1" } })),
  addCommentToThread: vi.fn(async () => ({ ok: true, comment: { id: "cmt_1" } })),
  updateCommentThread: vi.fn(async () => ({ ok: true })),
  deleteCommentThread: vi.fn(async () => ({ ok: true })),
  editComment: vi.fn(async () => ({ ok: true, comment: { id: "cmt_1" } })),
  deleteComment: vi.fn(async () => ({ ok: true })),
  setCommentReaction: vi.fn(async () => ({ ok: true, comment: { id: "cmt_1" } })),
}));

function deps(overrides = {}) {
  return createAuthMatrixDeps({
    verifyJwt: async () => ({ userId: "user_bob", projectId: "p1" }),
    ...overrides,
  });
}

function request(path, { method = "GET", body } = {}, h) {
  const init = { method, headers: {} };
  if (body !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  return dispatchCommentThreadsRoutes(
    new Request(`http://127.0.0.1:8787${path}`, init),
    new URL(`http://127.0.0.1:8787${path}`),
    h,
  );
}

const THREADS = "/rooms/room_1/comment-threads";
const THREAD = `${THREADS}/cth_1`;
const COMMENTS = `${THREAD}/comments`;
const COMMENT = `${COMMENTS}/cmt_1`;

describe("comment thread routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("401s without a JWT", async () => {
    const res = await request(THREADS, {}, createAuthMatrixDeps());
    expect(res.status).toBe(401);
  });

  it("403s when the room is not accessible", async () => {
    const res = await request(THREADS, {}, deps({ extra: { canAccessRoom: async () => false } }));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("forbidden");
  });

  it("400s on an invalid room id", async () => {
    const res = await request("/rooms/bad%20room/comment-threads", {}, deps());
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_room");
  });

  it("GET lists threads for the project room", async () => {
    lib.listCommentThreads.mockResolvedValueOnce([{ id: "cth_1" }]);
    const res = await request(THREADS, {}, deps());
    expect(res.status).toBe(200);
    expect((await res.json()).threads).toEqual([{ id: "cth_1" }]);
    expect(lib.listCommentThreads).toHaveBeenCalledWith(expect.anything(), {
      projectId: "p1",
      roomId: "room_1",
    });
  });

  it("POST creates a thread from body or content alias", async () => {
    const res = await request(
      THREADS,
      { method: "POST", body: { content: "first note", metadata: { x: 1, y: 2 } } },
      deps(),
    );
    expect(res.status).toBe(201);
    expect((await res.json()).thread).toEqual({ id: "cth_1" });
    expect(lib.createCommentThread).toHaveBeenCalledWith(expect.anything(), {
      projectId: "p1",
      roomId: "room_1",
      userId: "user_bob",
      body: "first note",
      metadata: { x: 1, y: 2 },
    });
  });

  it("POST 400s when the lib rejects the thread body", async () => {
    lib.createCommentThread.mockResolvedValueOnce({ ok: false, error: "body_required" });
    const res = await request(THREADS, { method: "POST", body: {} }, deps());
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("body_required");
  });

  it("POST comments decodes the thread id and 404s on unknown threads", async () => {
    const ok = await request(COMMENTS, { method: "POST", body: { body: "hello" } }, deps());
    expect(ok.status).toBe(201);
    expect(lib.addCommentToThread).toHaveBeenCalledWith(expect.anything(), {
      projectId: "p1",
      roomId: "room_1",
      threadId: "cth_1",
      userId: "user_bob",
      body: "hello",
    });

    lib.addCommentToThread.mockResolvedValueOnce({ ok: false, error: "thread_not_found" });
    const missing = await request(COMMENTS, { method: "POST", body: { body: "hello" } }, deps());
    expect(missing.status).toBe(404);
    expect((await missing.json()).error).toBe("thread_not_found");
  });

  it("PATCH comment 403s on someone else's comment and 200s on edits", async () => {
    lib.editComment.mockResolvedValueOnce({ ok: false, error: "forbidden" });
    const forbidden = await request(COMMENT, { method: "PATCH", body: { body: "nope" } }, deps());
    expect(forbidden.status).toBe(403);

    const edited = await request(COMMENT, { method: "PATCH", body: { body: "typo fix" } }, deps());
    expect(edited.status).toBe(200);
    expect((await edited.json()).comment).toEqual({ id: "cmt_1" });
  });

  it("DELETE comment 404s when missing and 200s when removed", async () => {
    lib.deleteComment.mockResolvedValueOnce({ ok: false, error: "comment_not_found" });
    const missing = await request(COMMENT, { method: "DELETE" }, deps());
    expect(missing.status).toBe(404);

    const removed = await request(COMMENT, { method: "DELETE" }, deps());
    expect(removed.status).toBe(200);
    expect(await removed.json()).toEqual({ ok: true });
  });

  it("reactions POST adds and DELETE removes the given emoji", async () => {
    const added = await request(`${COMMENT}/reactions`, { method: "POST", body: { emoji: "👍" } }, deps());
    expect(added.status).toBe(200);
    expect(lib.setCommentReaction).toHaveBeenCalledWith(expect.anything(), {
      projectId: "p1",
      roomId: "room_1",
      threadId: "cth_1",
      commentId: "cmt_1",
      userId: "user_bob",
      emoji: "👍",
      remove: false,
    });

    const removed = await request(`${COMMENT}/reactions`, { method: "DELETE", body: { emoji: "👍" } }, deps());
    expect(removed.status).toBe(200);
    expect(lib.setCommentReaction).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ remove: true }),
    );
  });

  it("PATCH thread resolves and 404s on unknown threads", async () => {
    const ok = await request(THREAD, { method: "PATCH", body: { resolved: true } }, deps());
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ ok: true });

    lib.updateCommentThread.mockResolvedValueOnce({ ok: false, error: "thread_not_found" });
    const missing = await request(THREAD, { method: "PATCH", body: { resolved: true } }, deps());
    expect(missing.status).toBe(404);
  });

  it("DELETE thread 403s for non-creators and 200s for the creator", async () => {
    lib.deleteCommentThread.mockResolvedValueOnce({ ok: false, error: "forbidden" });
    const forbidden = await request(THREAD, { method: "DELETE" }, deps());
    expect(forbidden.status).toBe(403);

    const removed = await request(THREAD, { method: "DELETE" }, deps());
    expect(removed.status).toBe(200);
    expect(await removed.json()).toEqual({ ok: true });
  });

  it("405s unsupported methods on a matched path", async () => {
    const res = await request(THREADS, { method: "PUT" }, deps());
    expect(res.status).toBe(405);
    expect((await res.json()).error).toBe("method_not_allowed");
  });
});
