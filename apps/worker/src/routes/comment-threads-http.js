/**
 * Contextual comments — Liveblocks Threads analogue.
 * GET/POST /rooms/:roomId/comment-threads
 * POST /rooms/:roomId/comment-threads/:threadId/comments
 * PATCH /rooms/:roomId/comment-threads/:threadId
 * DELETE /rooms/:roomId/comment-threads/:threadId
 * PATCH /rooms/:roomId/comment-threads/:threadId/comments/:commentId
 */
import { pickRouteDeps } from "./route-http-deps.js";
import {
  addCommentToThread,
  createCommentThread,
  deleteComment,
  deleteCommentThread,
  editComment,
  listCommentThreads,
  setCommentReaction,
  updateCommentThread,
} from "../lib/comment-threads.js";

export async function dispatchCommentThreadsRoutes(request, url, h) {
  const reactionMatch = url.pathname.match(
    /^\/rooms\/([^/]+)\/comment-threads\/([^/]+)\/comments\/([^/]+)\/reactions$/,
  );
  const commentItemMatch = url.pathname.match(
    /^\/rooms\/([^/]+)\/comment-threads\/([^/]+)\/comments\/([^/]+)$/,
  );
  const commentsMatch = url.pathname.match(
    /^\/rooms\/([^/]+)\/comment-threads\/([^/]+)\/comments$/,
  );
  const threadMatch = url.pathname.match(/^\/rooms\/([^/]+)\/comment-threads\/([^/]+)$/);
  const listMatch = url.pathname.match(/^\/rooms\/([^/]+)\/comment-threads$/);
  if (!reactionMatch && !commentItemMatch && !commentsMatch && !threadMatch && !listMatch) return null;

  const {
    env,
    json,
    corsHeaders,
    requestLogCtx,
    verifyJwtAndGetContext,
    logError,
    canAccessRoom,
    isValidId,
  } = pickRouteDeps(h, [
    "env",
    "json",
    "corsHeaders",
    "requestLogCtx",
    "verifyJwtAndGetContext",
    "logError",
    "canAccessRoom",
    "isValidId",
  ]);

  const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
    if (err instanceof Response) throw err;
    logError("auth.jwt_verify_failed", err, requestLogCtx);
    return null;
  });
  if (!auth) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  const roomId = decodeURIComponent(
    (reactionMatch || commentItemMatch || commentsMatch || threadMatch || listMatch)[1],
  );
  if (!isValidId(roomId)) {
    return json({ error: "invalid_room" }, { status: 400, headers: corsHeaders });
  }
  const allowed = await canAccessRoom(env, auth, roomId);
  if (!allowed) {
    return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
  }

  if (listMatch && request.method === "GET") {
    const threads = await listCommentThreads(env, {
      projectId: auth.projectId,
      roomId,
    });
    return json({ threads }, { status: 200, headers: corsHeaders });
  }

  if (listMatch && request.method === "POST") {
    let body = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }
    const result = await createCommentThread(env, {
      projectId: auth.projectId,
      roomId,
      userId: auth.userId,
      body: body.body ?? body.content,
      metadata: body.metadata,
    });
    if (!result.ok) {
      return json({ error: result.error }, { status: 400, headers: corsHeaders });
    }
    return json({ thread: result.thread }, { status: 201, headers: corsHeaders });
  }

  if (commentsMatch && request.method === "POST") {
    let body = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }
    const result = await addCommentToThread(env, {
      projectId: auth.projectId,
      roomId,
      threadId: decodeURIComponent(commentsMatch[2]),
      userId: auth.userId,
      body: body.body ?? body.content,
    });
    if (!result.ok) {
      const status = result.error === "thread_not_found" ? 404 : 400;
      return json({ error: result.error }, { status, headers: corsHeaders });
    }
    return json({ comment: result.comment }, { status: 201, headers: corsHeaders });
  }

  if (reactionMatch && (request.method === "POST" || request.method === "DELETE")) {
    let body = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }
    const result = await setCommentReaction(env, {
      projectId: auth.projectId,
      roomId,
      threadId: decodeURIComponent(reactionMatch[2]),
      commentId: decodeURIComponent(reactionMatch[3]),
      userId: auth.userId,
      emoji: body.emoji,
      remove: request.method === "DELETE",
    });
    if (!result.ok) {
      const status = result.error === "comment_not_found" ? 404 : 400;
      return json({ error: result.error }, { status, headers: corsHeaders });
    }
    return json({ comment: result.comment }, { status: 200, headers: corsHeaders });
  }

  if (commentItemMatch && request.method === "DELETE") {
    const result = await deleteComment(env, {
      projectId: auth.projectId,
      roomId,
      threadId: decodeURIComponent(commentItemMatch[2]),
      commentId: decodeURIComponent(commentItemMatch[3]),
      userId: auth.userId,
    });
    if (!result.ok) {
      const status =
        result.error === "comment_not_found" ? 404 : result.error === "forbidden" ? 403 : 400;
      return json({ error: result.error }, { status, headers: corsHeaders });
    }
    return json({ ok: true }, { status: 200, headers: corsHeaders });
  }

  if (commentItemMatch && request.method === "PATCH") {
    let body = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }
    const result = await editComment(env, {
      projectId: auth.projectId,
      roomId,
      threadId: decodeURIComponent(commentItemMatch[2]),
      commentId: decodeURIComponent(commentItemMatch[3]),
      userId: auth.userId,
      body: body.body ?? body.content,
    });
    if (!result.ok) {
      const status =
        result.error === "comment_not_found" ? 404 : result.error === "forbidden" ? 403 : 400;
      return json({ error: result.error }, { status, headers: corsHeaders });
    }
    return json({ comment: result.comment }, { status: 200, headers: corsHeaders });
  }

  if (threadMatch && request.method === "DELETE") {
    const result = await deleteCommentThread(env, {
      projectId: auth.projectId,
      roomId,
      threadId: decodeURIComponent(threadMatch[2]),
      userId: auth.userId,
    });
    if (!result.ok) {
      const status =
        result.error === "thread_not_found" ? 404 : result.error === "forbidden" ? 403 : 400;
      return json({ error: result.error }, { status, headers: corsHeaders });
    }
    return json({ ok: true }, { status: 200, headers: corsHeaders });
  }

  if (threadMatch && request.method === "PATCH") {
    let body = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }
    const result = await updateCommentThread(env, {
      projectId: auth.projectId,
      roomId,
      threadId: decodeURIComponent(threadMatch[2]),
      resolved: body.resolved,
      metadata: body.metadata,
    });
    if (!result.ok) {
      const status = result.error === "thread_not_found" ? 404 : 400;
      return json({ error: result.error }, { status, headers: corsHeaders });
    }
    return json({ ok: true }, { status: 200, headers: corsHeaders });
  }

  return json({ error: "method_not_allowed" }, { status: 405, headers: corsHeaders });
}
