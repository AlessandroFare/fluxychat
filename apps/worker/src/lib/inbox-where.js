/**
 * Server-side inbox `where` filter (Portal §6 parity with packages/sdk/src/inbox-filter.ts).
 */

function matchOp(value, op) {
  if (!op) return true;
  if (op.eq !== undefined) {
    const expected = op.eq;
    return Array.isArray(expected) ? expected.includes(value) : value === expected;
  }
  if (op.neq !== undefined) {
    const expected = op.neq;
    return Array.isArray(expected) ? !expected.includes(value) : value !== expected;
  }
  if (op.in !== undefined) return op.in.includes(value);
  if (op.gt !== undefined && typeof value === "number") return value > op.gt;
  if (op.lt !== undefined && typeof value === "number") return value < op.lt;
  return true;
}

function matchWhere(row, where) {
  if (!where) return true;
  for (const key of Object.keys(where)) {
    if (!matchOp(row[key], where[key])) return false;
  }
  return true;
}

function roomEntryToFields(entry) {
  return {
    roomId: entry.roomId,
    roomName: entry.roomName,
    roomType: entry.roomType,
    unreadCount: entry.unreadCount,
    snoozedUntil: entry.snoozedUntil ?? null,
  };
}

function filterRoomEntries(entries, query) {
  if (!query?.roomId && !query?.where) return entries;
  return entries.filter((entry) => {
    if (query.roomId && entry.roomId !== query.roomId) return false;
    return matchWhere(roomEntryToFields(entry), query.where);
  });
}

function filterByRoomId(items, roomId) {
  if (!roomId) return items;
  return items.filter((item) => item.roomId === roomId);
}

/**
 * @param {object} summary
 * @param {{ roomId?: string, where?: Record<string, unknown> } | undefined} query
 */
export function applyInboxQuery(summary, query) {
  if (!query?.roomId && !query?.where) return summary;

  const unreadRooms = filterRoomEntries(summary.unreadRooms, query);
  const snoozedRooms = filterRoomEntries(summary.snoozedRooms, query);
  const mentions = filterByRoomId(summary.mentions, query.roomId);
  const followUps = filterByRoomId(summary.followUps, query.roomId);
  const threads = filterByRoomId(summary.threads || [], query.roomId);

  return {
    ...summary,
    mentions,
    unreadRooms,
    snoozedRooms,
    followUps,
    threads,
    counts: {
      mentions: mentions.length,
      unreadRooms: unreadRooms.length,
      snoozedRooms: snoozedRooms.length,
      followUps: followUps.length,
      threads: threads.length,
    },
  };
}

/**
 * @param {string | null} raw
 * @returns {{ ok: true, query: { roomId?: string, where?: Record<string, unknown> } } | { ok: false, error: string }}
 */
export function parseInboxQueryParams(roomId, whereRaw) {
  const query = {};
  if (roomId?.trim()) query.roomId = roomId.trim();
  if (whereRaw?.trim()) {
    try {
      const parsed = JSON.parse(whereRaw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return { ok: false, error: "invalid_where" };
      }
      query.where = parsed;
    } catch {
      return { ok: false, error: "invalid_where" };
    }
  }
  return { ok: true, query };
}
