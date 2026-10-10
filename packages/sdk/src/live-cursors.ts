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

export interface CursorBatchPoint {
  x: number;
  y: number;
  offsetMs: number;
}

const DEFAULT_BATCH_MS = 100;
const MAX_BATCH_POINTS = 24;

export function shouldSendCursor(input: {
  online?: number;
  presenceCount?: number;
  onlineUsers?: string[];
}): boolean {
  const known = Math.max(
    input.online ?? 0,
    input.presenceCount ?? 0,
    input.onlineUsers?.length ?? 0,
  );
  if (known <= 0) return true;
  return known > 1;
}

export function parseCursorBatchPoints(event: unknown): CursorBatchPoint[] | null {
  if (!event || typeof event !== "object") return null;
  const rec = event as Record<string, unknown>;
  if (!Array.isArray(rec.positions) || rec.positions.length === 0) return null;
  const points: CursorBatchPoint[] = [];
  for (const raw of rec.positions.slice(0, MAX_BATCH_POINTS)) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    const x = clampCursorCoordinate(Number(row.x));
    const y = clampCursorCoordinate(Number(row.y));
    const offsetMs = Math.max(0, Math.min(5_000, Number(row.offsetMs) || 0));
    if (!Number.isFinite(Number(row.x)) || !Number.isFinite(Number(row.y))) continue;
    points.push({ x, y, offsetMs });
  }
  return points.length ? points : null;
}

export function buildCursorBatchOutbound(
  points: CursorBatchPoint[],
  meta: Omit<LiveCursorPublishInput, "x" | "y">,
): Record<string, unknown> {
  const last = points[points.length - 1]!;
  const base = buildCursorOutbound({ ...meta, x: last.x, y: last.y });
  if (points.length === 1) return base;
  return {
    ...base,
    positions: points.map((p) => ({
      x: p.x,
      y: p.y,
      offsetMs: p.offsetMs,
    })),
  };
}

/** Collect mousemove samples and publish one cursor frame per interval. */
export function createCursorBatcher(batchIntervalMs = DEFAULT_BATCH_MS) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let batchStartedAt = 0;
  let points: CursorBatchPoint[] = [];
  let meta: Omit<LiveCursorPublishInput, "x" | "y"> = {};

  function flush(send: (frame: Record<string, unknown>) => void) {
    timer = null;
    if (points.length === 0) return;
    const frame = buildCursorBatchOutbound(points, meta);
    points = [];
    batchStartedAt = 0;
    send(frame);
  }

  return {
    publish(
      input: LiveCursorPublishInput,
      send: (frame: Record<string, unknown>) => void,
      opts?: { shouldSend?: boolean },
    ) {
      if (opts?.shouldSend === false) {
        points = [];
        batchStartedAt = 0;
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        return;
      }
      const now = Date.now();
      if (!batchStartedAt) batchStartedAt = now;
      points.push({
        x: clampCursorCoordinate(input.x),
        y: clampCursorCoordinate(input.y),
        offsetMs: now - batchStartedAt,
      });
      if (points.length > MAX_BATCH_POINTS) {
        points = points.slice(points.length - MAX_BATCH_POINTS);
      }
      meta = {
        pointer: input.pointer,
        color: input.color,
        label: input.label,
      };
      if (!timer) timer = setTimeout(() => flush(send), batchIntervalMs);
    },
    dispose() {
      if (timer) clearTimeout(timer);
      timer = null;
      points = [];
      batchStartedAt = 0;
    },
  };
}

/** Replay batched offsets so remotes see motion instead of a jump. */
export function createCursorDispenser(apply: (cursor: LiveCursor) => void) {
  const timers: ReturnType<typeof setTimeout>[] = [];

  return {
    ingest(event: unknown) {
      const base = parseLiveCursorEvent(event);
      if (!base) return;
      const points = parseCursorBatchPoints(event);
      if (!points || points.length <= 1) {
        apply(base);
        return;
      }
      for (const point of points) {
        const id = setTimeout(() => {
          apply({ ...base, x: point.x, y: point.y });
        }, point.offsetMs);
        timers.push(id);
      }
    },
    dispose() {
      for (const id of timers) clearTimeout(id);
      timers.length = 0;
    },
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
