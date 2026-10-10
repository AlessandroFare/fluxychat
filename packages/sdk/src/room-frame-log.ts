export interface FluxyFrameLogEntry<T = { type?: string }> {
  at: number;
  event: T;
}

/** Ring buffer of the last N inbound frames (labs debug pane). */
export function createRoomFrameLog<T = { type?: string }>(limit = 24) {
  const max = Math.max(1, Math.min(200, Math.floor(limit)));
  const entries: FluxyFrameLogEntry<T>[] = [];
  return {
    push(event: T, at = Date.now()) {
      entries.push({ at, event });
      if (entries.length > max) entries.splice(0, entries.length - max);
    },
    list(): FluxyFrameLogEntry<T>[] {
      return entries.slice();
    },
    clear() {
      entries.length = 0;
    },
  };
}
