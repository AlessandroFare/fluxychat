export interface FluxyReactionUnique {
  total: number;
  clientIds: string[];
}

/** Ably `MessageReactionSummary.multiple` — counts per client, not a set. */
export interface FluxyReactionMultiple {
  total: number;
  clientIds: Record<string, number>;
  totalUnidentified: number;
  clipped: boolean;
  totalClientIds: number;
}

const CLIP_CLIENT_IDS = 100;

/** Ably `MessageReactionSummary`. Fold is distinct (one of each emoji per user); `unique` is the same map. */
export interface FluxyMessageReactionSummary {
  messageId: number;
  unique: Record<string, FluxyReactionUnique>;
  distinct: Record<string, FluxyReactionUnique>;
  multiple: Record<string, FluxyReactionMultiple>;
}

export function emptyReactionSummary(messageId: number): FluxyMessageReactionSummary {
  return { messageId, unique: {}, distinct: {}, multiple: {} };
}

function clipMultiple(row: FluxyReactionMultiple): FluxyReactionMultiple {
  const ids = Object.keys(row.clientIds);
  const totalClientIds = ids.length;
  if (totalClientIds <= CLIP_CLIENT_IDS) {
    return { ...row, clipped: false, totalClientIds };
  }
  const clientIds: Record<string, number> = {};
  for (const id of ids.slice(0, CLIP_CLIENT_IDS)) clientIds[id] = row.clientIds[id] ?? 0;
  return { ...row, clientIds, clipped: true, totalClientIds };
}

function bumpMultiple(
  multiple: Record<string, FluxyReactionMultiple>,
  emoji: string,
  userId: string,
  delta: number,
): Record<string, FluxyReactionMultiple> {
  const next = { ...multiple };
  const prev = next[emoji] ?? {
    total: 0,
    clientIds: {} as Record<string, number>,
    totalUnidentified: 0,
    clipped: false,
    totalClientIds: 0,
  };
  const clientIds = { ...prev.clientIds };
  const count = Math.max(0, (clientIds[userId] ?? 0) + delta);
  if (count === 0) delete clientIds[userId];
  else clientIds[userId] = count;
  const total = Math.max(0, prev.total + delta);
  if (total === 0 || Object.keys(clientIds).length === 0) {
    delete next[emoji];
    return next;
  }
  next[emoji] = clipMultiple({
    total,
    clientIds,
    totalUnidentified: prev.totalUnidentified,
    clipped: false,
    totalClientIds: Object.keys(clientIds).length,
  });
  return next;
}

function withMaps(
  messageId: number,
  unique: Record<string, FluxyReactionUnique>,
  multiple: Record<string, FluxyReactionMultiple>,
): FluxyMessageReactionSummary {
  return { messageId, unique, distinct: unique, multiple };
}

export function applyRawReaction(
  summaries: Map<number, FluxyMessageReactionSummary>,
  event: { messageId: number; userId: string; emoji: string; op: "add" | "remove" },
): FluxyMessageReactionSummary {
  const current = summaries.get(event.messageId) ?? emptyReactionSummary(event.messageId);
  const multiple = bumpMultiple(
    current.multiple,
    event.emoji,
    event.userId,
    event.op === "remove" ? -1 : 1,
  );
  const unique = { ...current.unique };
  const count = multiple[event.emoji]?.clientIds[event.userId] ?? 0;
  const prev = unique[event.emoji] ?? { total: 0, clientIds: [] as string[] };
  const ids = new Set(prev.clientIds);
  if (count === 0) ids.delete(event.userId);
  else ids.add(event.userId);
  if (ids.size === 0) delete unique[event.emoji];
  else unique[event.emoji] = { total: ids.size, clientIds: [...ids] };
  const next = withMaps(event.messageId, unique, multiple);
  summaries.set(event.messageId, next);
  return next;
}

export function summaryFromRows(
  messageId: number,
  rows: Array<{ emoji: string; userId: string }>,
): FluxyMessageReactionSummary {
  const summaries = new Map<number, FluxyMessageReactionSummary>();
  for (const row of rows) {
    applyRawReaction(summaries, {
      messageId,
      userId: row.userId,
      emoji: row.emoji,
      op: "add",
    });
  }
  return summaries.get(messageId) ?? emptyReactionSummary(messageId);
}

export function parseReactionSummary(
  messageId: number,
  body: {
    messageId?: number;
    unique?: FluxyMessageReactionSummary["unique"];
    distinct?: FluxyMessageReactionSummary["distinct"];
    multiple?: unknown;
  },
): FluxyMessageReactionSummary {
  const unique = body.unique && typeof body.unique === "object" ? body.unique : {};
  const distinct =
    body.distinct && typeof body.distinct === "object" ? body.distinct : unique;
  return {
    messageId: body.messageId ?? messageId,
    unique,
    distinct,
    multiple: parseMultiple(body.multiple),
  };
}

export function parseMultiple(raw: unknown): Record<string, FluxyReactionMultiple> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, FluxyReactionMultiple> = {};
  for (const [name, row] of Object.entries(raw as Record<string, unknown>)) {
    if (!row || typeof row !== "object") continue;
    const rec = row as Record<string, unknown>;
    let clientIds: Record<string, number> = {};
    if (rec.clientIds && typeof rec.clientIds === "object" && !Array.isArray(rec.clientIds)) {
      for (const [id, count] of Object.entries(rec.clientIds as Record<string, unknown>)) {
        clientIds[id] = Number(count) || 0;
      }
    } else if (Array.isArray(rec.clientIds)) {
      for (const id of rec.clientIds) {
        const key = String(id);
        clientIds[key] = (clientIds[key] ?? 0) + 1;
      }
    }
    out[name] = {
      total: Number(rec.total) || 0,
      clientIds,
      totalUnidentified: Number(rec.totalUnidentified) || 0,
      clipped: Boolean(rec.clipped),
      totalClientIds:
        rec.totalClientIds != null ? Number(rec.totalClientIds) || 0 : Object.keys(clientIds).length,
    };
  }
  return out;
}
