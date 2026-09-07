/** Throttle DO stream deltas (lower = snappier live UI; DO still batches DB writes). */
const STREAM_PUSH_FLUSH_MS = 80;

import { markdownTextChunk } from "./stream-chunks.js";
import { getRoomStubForProject } from "./room-shard.js";

export function isStreamStoppedError(err) {
  const code = err && typeof err === "object" ? err.code : null;
  const msg = err instanceof Error ? err.message : String(err || "");
  return code === "stream_stopped" || msg === "stream_stopped";
}

function throwIfStopped(res, messageId) {
  if (res?.ok) return;
  if (messageId && (res?.error === "stream_not_active" || res?.error === "stream_stopped")) {
    const err = new Error("stream_stopped");
    err.code = "stream_stopped";
    throw err;
  }
}

export async function roomStreamOp(env, roomId, body) {
  const projectId = body?.projectId;
  const stub = projectId
    ? await getRoomStubForProject(env, projectId, roomId, body.userId)
    : env.ROOM.get(env.ROOM.idFromName(roomId));
  const res = await stub.fetch("https://internal/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, error: json.error || `stream_op_failed_${res.status}` };
  }
  return json;
}

export function createAgentStreamHooks(env, { projectId, roomId, userId, parentId = null }) {
  let messageId = null;
  let lastPushMs = 0;

  return {
    getMessageId() {
      return messageId;
    },
    clearMessageId() {
      messageId = null;
    },
    async onStart(content) {
      const res = await roomStreamOp(env, roomId, {
        projectId,
        userId,
        op: "start",
        content: content || "",
        parentId,
      });
      if (!res.ok) {
        throw new Error(res.error || "stream_start_failed");
      }
      messageId = res.id;
      return messageId;
    },
    async onDelta(_delta, fullContent, { force = false } = {}) {
      if (!messageId) return;
      const now = Date.now();
      if (!force && now - lastPushMs < STREAM_PUSH_FLUSH_MS) return;
      lastPushMs = now;
      // P22-E2: Wrap delta as structured stream chunk
      const chunk = markdownTextChunk(fullContent);
      await roomStreamOp(env, roomId, {
        projectId,
        userId,
        op: "delta",
        messageId,
        content: fullContent,
        chunk,
      }).then((res) => throwIfStopped(res, messageId));
    },
    async onEnd(fullContent) {
      if (!messageId) {
        await this.onStart("");
        messageId = this.getMessageId();
      }
      if (messageId && typeof fullContent === "string" && fullContent.length > 0) {
        await this.onDelta("", fullContent, { force: true });
      }
      const res = await roomStreamOp(env, roomId, {
        projectId,
        userId,
        op: "end",
        messageId,
        content: fullContent,
      });
      if (!res.ok) {
        throwIfStopped(res, messageId);
        throw new Error(res.error || "stream_end_failed");
      }
      return messageId;
    },
  };
}
