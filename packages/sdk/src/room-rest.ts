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
  return { userId, role, joined_at };
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
