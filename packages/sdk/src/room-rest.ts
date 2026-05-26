import type { FluxyRoomMember } from "./index";

export const FLUXY_MAX_MESSAGE_LENGTH = 4000;

export function normalizeRoomMember(raw: Record<string, unknown>): FluxyRoomMember | null {
  const userId = String(raw.userId ?? raw.user_id ?? "").trim();
  if (!userId) return null;
  const role = String(raw.role ?? "member").trim() || "member";
  const joined_at =
    typeof raw.joined_at === "string"
      ? raw.joined_at
      : typeof raw.joinedAt === "string"
        ? raw.joinedAt
        : undefined;
  const joinedAt =
    typeof raw.joinedAt === "string"
      ? raw.joinedAt
      : joined_at;
  const notifyEnabled =
    typeof raw.notifyEnabled === "boolean"
      ? raw.notifyEnabled
      : raw.notify_enabled !== 0 && raw.notify_enabled !== false;
  const preferences =
    raw.preferences && typeof raw.preferences === "object" && !Array.isArray(raw.preferences)
      ? (raw.preferences as Record<string, unknown>)
      : undefined;
  return {
    userId,
    role,
    joined_at: joinedAt,
    joinedAt,
    notifyEnabled,
    preferences,
  };
}

export function normalizeRoomMembers(rows: unknown[]): FluxyRoomMember[] {
  const out: FluxyRoomMember[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const member = normalizeRoomMember(row as Record<string, unknown>);
    if (member) out.push(member);
  }
  return out;
}
