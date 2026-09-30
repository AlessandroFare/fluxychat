const ROOM_ID_RE = /^[a-zA-Z0-9_-]{1,128}$/;

/** Map a Pusher/Ably/Stream/PartyKit channel name to a FluxyChat room id. */
export function roomIdFromChannelName(name: string): string {
  const trimmed = String(name || "").trim();
  const stripped = trimmed.replace(/^(private-|presence-|public-)/, "");
  const slug = stripped.replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 128);
  if (ROOM_ID_RE.test(slug)) return slug;
  return `ch_${slug.replace(/[^a-zA-Z0-9]/g, "").slice(0, 120) || "imported"}`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function extractContent(data: unknown): string {
  if (typeof data === "string") {
    const trimmed = data.trim();
    if (!trimmed) return "";
    try {
      return extractContent(JSON.parse(trimmed));
    } catch {
      return trimmed;
    }
  }
  const rec = asRecord(data);
  if (!rec) return "";
  for (const key of ["content", "text", "message", "body", "data"]) {
    const v = rec[key];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (v && typeof v === "object") {
      const nested = extractContent(v);
      if (nested) return nested;
    }
  }
  return "";
}

export interface FluxyMigrateImportRow {
  roomId: string;
  content: string;
  userId?: string;
  createdAt?: string;
}

function pushRow(
  out: FluxyMigrateImportRow[],
  cap: number,
  row: { channel?: unknown; roomId?: unknown; data?: unknown; content?: unknown; userId?: unknown; timestamp?: unknown; createdAt?: unknown; name?: unknown },
) {
  if (out.length >= cap) return;
  const channel = String(row.channel ?? row.roomId ?? row.name ?? "").trim();
  const content = extractContent(row.content ?? row.data);
  if (!channel || !content) return;
  const userId = row.userId != null ? String(row.userId).trim() : "";
  const createdAt = String(row.createdAt ?? row.timestamp ?? "").trim();
  out.push({
    roomId: roomIdFromChannelName(channel),
    content,
    ...(userId ? { userId } : {}),
    ...(createdAt ? { createdAt } : {}),
  });
}

/**
 * Turn a vendor dump into rows for `pnpm import-chat-history`. Cap 400.
 * This does not scrape vendors. You supply JSON you already exported.
 */
export function migrateVendorExportToImportRows(raw: unknown, cap = 400): FluxyMigrateImportRow[] {
  const limit = Math.min(Math.max(Number(cap) || 400, 1), 400);
  const out: FluxyMigrateImportRow[] = [];
  if (Array.isArray(raw)) {
    for (const item of raw) {
      const rec = asRecord(item);
      if (rec) pushRow(out, limit, rec);
      if (out.length >= limit) break;
    }
    return out;
  }
  const root = asRecord(raw);
  if (!root) return out;
  if (Array.isArray(root.messages)) {
    return migrateVendorExportToImportRows(root.messages, limit);
  }
  const channels = asRecord(root.channels);
  if (channels) {
    for (const [channelName, payload] of Object.entries(channels)) {
      const rec = asRecord(payload);
      const events = Array.isArray(rec?.events)
        ? rec.events
        : Array.isArray(rec?.messages)
          ? rec.messages
          : [];
      for (const ev of events) {
        const event = asRecord(ev) || {};
        pushRow(out, limit, {
          channel: channelName,
          data: event.data ?? event.message ?? event,
          userId: event.userId ?? event.user_id,
          timestamp: event.timestamp ?? event.createdAt,
        });
        if (out.length >= limit) return out;
      }
    }
  }
  const items = Array.isArray(root.items) ? root.items : [];
  for (const item of items) {
    const rec = asRecord(item);
    if (rec) {
      pushRow(out, limit, {
        channel: rec.channelId ?? rec.channel ?? rec.name,
        data: rec.data ?? rec,
        userId: rec.clientId ?? rec.userId,
        timestamp: rec.timestamp,
      });
    }
    if (out.length >= limit) break;
  }
  return out;
}
