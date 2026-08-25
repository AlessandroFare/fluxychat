/** Apply a mid-stream resume payload onto the local message body. */
export function applyStreamTailToLocal(
  localContent: string | undefined,
  payload: { content?: string; resumeFrom?: number },
): string {
  const local = typeof localContent === "string" ? localContent : "";
  const tail = typeof payload.content === "string" ? payload.content : "";
  const resumeFrom = Number(payload.resumeFrom);
  if (!Number.isFinite(resumeFrom) || resumeFrom <= 0) {
    return tail || local;
  }
  if (local.length >= resumeFrom) {
    return local.slice(0, resumeFrom) + tail;
  }
  return local + tail;
}
