import type {
  FluxyConfig,
  FluxyHostedOverlay,
  FluxyHostedRoomOverlay,
  FluxyRoomCapabilities,
  FluxyRoomExtensionSlot,
} from "./types.js";

const EXTENSION_KINDS = new Set<FluxyRoomExtensionSlot["kind"]>(["kv", "counter"]);
const MAX_ROOM_KEYS = 80;
const MAX_DENY = 50;
const MAX_EXTENSIONS = 5;

function sanitizeDeny(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    .map((s) => s.slice(0, 128))
    .slice(0, MAX_DENY);
}

function sanitizeCapabilities(raw: unknown): FluxyRoomCapabilities | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const out: FluxyRoomCapabilities = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === "boolean" && key.length <= 64) out[key] = value;
  }
  return Object.keys(out).length ? out : undefined;
}

function sanitizeExtensions(raw: unknown): FluxyRoomExtensionSlot[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: FluxyRoomExtensionSlot[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const id = typeof (item as { id?: unknown }).id === "string"
      ? (item as { id: string }).id.trim().slice(0, 64)
      : "";
    const kind = (item as { kind?: unknown }).kind;
    if (!id || seen.has(id)) continue;
    if (kind !== "kv" && kind !== "counter") continue;
    if (!EXTENSION_KINDS.has(kind)) continue;
    seen.add(id);
    out.push({ id, kind });
    if (out.length >= MAX_EXTENSIONS) break;
  }
  return out.length ? out : undefined;
}

export function sanitizeHostedRoomOverlay(raw: unknown): FluxyHostedRoomOverlay | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const overlay: FluxyHostedRoomOverlay = {};
  if (typeof row.anonymous === "boolean") overlay.anonymous = row.anonymous;
  if (typeof row.guestCanPublish === "boolean") overlay.guestCanPublish = row.guestCanPublish;
  const deny = sanitizeDeny(row.denySubstrings);
  if (deny.length) overlay.denySubstrings = deny;
  const capabilities = sanitizeCapabilities(row.capabilities);
  if (capabilities) overlay.capabilities = capabilities;
  const extensions = sanitizeExtensions(row.extensions);
  if (extensions) overlay.extensions = extensions;
  return Object.keys(overlay).length ? overlay : null;
}

export function sanitizeHostedRooms(
  raw: unknown,
): Record<string, FluxyHostedRoomOverlay> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, FluxyHostedRoomOverlay> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!key || key.length > 128) continue;
    const room = sanitizeHostedRoomOverlay(value);
    if (!room) continue;
    out[key] = room;
    if (Object.keys(out).length >= MAX_ROOM_KEYS) break;
  }
  return out;
}

/** Drop callbacks. Hosted Worker applies this JSON, not eval. */
export function toHostedOverlay(config: FluxyConfig | null | undefined): FluxyHostedOverlay {
  const hosted = config?.hostedPublish ?? {};
  const rooms = sanitizeHostedRooms(
    Object.fromEntries(
      Object.entries(config?.rooms ?? {}).map(([key, room]) => [
        key,
        {
          anonymous: room.anonymous,
          guestCanPublish: room.guestCanPublish,
          denySubstrings: room.denySubstrings,
          capabilities: room.capabilities,
          extensions: room.extensions,
        },
      ]),
    ),
  );
  const overlay: FluxyHostedOverlay = {
    denySubstrings: sanitizeDeny(hosted.denySubstrings),
    guestCanPublish: hosted.guestCanPublish !== false,
    iotAutoAgentId:
      typeof hosted.iotAutoAgentId === "string" && hosted.iotAutoAgentId.trim()
        ? hosted.iotAutoAgentId.trim().slice(0, 128)
        : hosted.iotAutoAgentId === null
          ? null
          : undefined,
  };
  if (Object.keys(rooms).length) overlay.rooms = rooms;
  return overlay;
}

export function parseHostedOverlayBody(body: unknown): FluxyHostedOverlay {
  const row = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const overlay: FluxyHostedOverlay = {
    denySubstrings: sanitizeDeny(row.denySubstrings),
    guestCanPublish: row.guestCanPublish !== false,
    iotAutoAgentId:
      typeof row.iotAutoAgentId === "string" && row.iotAutoAgentId.trim()
        ? row.iotAutoAgentId.trim().slice(0, 128)
        : row.iotAutoAgentId === null
          ? null
          : undefined,
    rooms: sanitizeHostedRooms(row.rooms),
  };
  return overlay;
}
