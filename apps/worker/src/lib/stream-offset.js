/**
 * Character-offset resume for in-flight room streams (MCP/Agents-style).
 * The DO holds the latest buffer; clients send the last applied offset.
 */

export function streamCheckpoint(content) {
  const text = typeof content === "string" ? content : "";
  return { content: text, offset: text.length };
}

/**
 * @param {string} content full server buffer
 * @param {number} [clientOffset]
 */
export function streamTail(content, clientOffset) {
  const text = typeof content === "string" ? content : "";
  const parsed = Number(clientOffset);
  const from = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  if (from <= 0) {
    return { content: text, offset: text.length, resumeFrom: 0, caughtUp: false };
  }
  if (from >= text.length) {
    return { content: "", offset: text.length, resumeFrom: from, caughtUp: true };
  }
  return {
    content: text.slice(from),
    offset: text.length,
    resumeFrom: from,
    caughtUp: false,
  };
}

export function applyStreamTailToLocal(localContent, payload) {
  const local = typeof localContent === "string" ? localContent : "";
  const tail = typeof payload?.content === "string" ? payload.content : "";
  const resumeFrom = Number(payload?.resumeFrom);
  if (!Number.isFinite(resumeFrom) || resumeFrom <= 0) {
    return tail || local;
  }
  if (local.length >= resumeFrom) {
    return local.slice(0, resumeFrom) + tail;
  }
  return local + tail;
}
