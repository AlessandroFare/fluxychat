const STREAM_PUSH_FLUSH_MS = 150;

export async function roomStreamOp(env, roomId, body) {
  const id = env.ROOM.idFromName(roomId);
  const res = await env.ROOM.get(id).fetch("https://internal/stream", {
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
    async onDelta(_delta, fullContent) {
      if (!messageId) return;
      const now = Date.now();
      if (now - lastPushMs < STREAM_PUSH_FLUSH_MS) return;
      lastPushMs = now;
      await roomStreamOp(env, roomId, {
        projectId,
        userId,
        op: "delta",
        messageId,
        content: fullContent,
      });
    },
    async onEnd(fullContent) {
      if (!messageId) {
        await this.onStart("");
        messageId = this.getMessageId();
      }
      const res = await roomStreamOp(env, roomId, {
        projectId,
        userId,
        op: "end",
        messageId,
        content: fullContent,
      });
      if (!res.ok) {
        throw new Error(res.error || "stream_end_failed");
      }
      return messageId;
    },
  };
}
