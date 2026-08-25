/** Highest room seq on a WS frame or resume log row. */
export function highestRoomSeq(value: unknown): number {
  if (value == null || typeof value !== "object") return 0;
  const rec = value as Record<string, unknown>;
  let max = 0;
  for (const key of ["lastSeq", "currentSeq", "seq"] as const) {
    const n = Number(rec[key]);
    if (Number.isFinite(n) && n > max) max = n;
  }
  if (Array.isArray(rec.events)) {
    for (const event of rec.events) max = Math.max(max, highestRoomSeq(event));
  }
  if (Array.isArray(rec.messages)) {
    for (const message of rec.messages) max = Math.max(max, highestRoomSeq(message));
  }
  return max;
}

/**
 * Map a `room_message_events` row (WS resume `events[]`) onto a client event.
 */
export function resumeLogEventToClientEvent(event: unknown): Record<string, unknown> | null {
  if (event == null || typeof event !== "object") return null;
  const row = event as Record<string, unknown>;
  const payload =
    row.payload != null && typeof row.payload === "object" && !Array.isArray(row.payload)
      ? (row.payload as Record<string, unknown>)
      : {};
  const eventType = String(row.eventType || "");
  const id = payload.id ?? row.messageId;
  const seq = row.seq;
  if (eventType === "delete") {
    return { type: "delete", id, seq, ...payload };
  }
  if (eventType === "update") {
    return { type: "edit", id, seq, ...payload };
  }
  if (eventType === "create" || eventType === "") {
    return { type: "message", id, seq, ...payload };
  }
  return null;
}
