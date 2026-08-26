export type LiveCursorPointer = "mouse" | "touch";

export interface LiveCursor {
  userId: string;
  roomId?: string;
  x: number;
  y: number;
  pointer: LiveCursorPointer;
  color?: string;
  label?: string;
  ts: number;
}

export interface LiveCursorPublishInput {
  x: number;
  y: number;
  pointer?: LiveCursorPointer;
  color?: string;
  label?: string;
}

const DEFAULT_THROTTLE_MS = 50;

export function clampCursorCoordinate(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(-1e6, Math.min(1e6, value));
}

export function parseLiveCursorEvent(event: unknown): LiveCursor | null {
  if (!event || typeof event !== "object") return null;
  const rec = event as Record<string, unknown>;
  if (rec.type !== "cursor") return null;
  const userId = typeof rec.userId === "string" ? rec.userId : "";
  const x = Number(rec.x);
  const y = Number(rec.y);
  if (!userId || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  return {
    userId,
    roomId: typeof rec.roomId === "string" ? rec.roomId : undefined,
    x,
    y,
    pointer: rec.pointer === "touch" ? "touch" : "mouse",
    color: typeof rec.color === "string" ? rec.color.slice(0, 32) : undefined,
    label: typeof rec.label === "string" ? rec.label.slice(0, 64) : undefined,
    ts: Number(rec.ts) || Date.now(),
  };
}

export function buildCursorOutbound(input: LiveCursorPublishInput): Record<string, unknown> {
  return {
    type: "cursor",
    x: clampCursorCoordinate(input.x),
    y: clampCursorCoordinate(input.y),
    pointer: input.pointer === "touch" ? "touch" : "mouse",
    ...(input.color ? { color: String(input.color).slice(0, 32) } : {}),
    ...(input.label ? { label: String(input.label).slice(0, 64) } : {}),
  };
}

export function createCursorThrottle(throttleMs = DEFAULT_THROTTLE_MS) {
  let lastSentAt = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: LiveCursorPublishInput | null = null;

  function flush(send: (input: LiveCursorPublishInput) => void) {
    timer = null;
    const next = pending;
    pending = null;
    if (!next) return;
    lastSentAt = Date.now();
    send(next);
  }

  return {
    publish(input: LiveCursorPublishInput, send: (input: LiveCursorPublishInput) => void) {
      const now = Date.now();
      const wait = throttleMs - (now - lastSentAt);
      if (wait <= 0) {
        lastSentAt = now;
        send(input);
        return;
      }
      pending = input;
      if (!timer) timer = setTimeout(() => flush(send), wait);
    },
    dispose() {
      if (timer) clearTimeout(timer);
      timer = null;
      pending = null;
    },
  };
}
