export const FLUXY_LEAVER_TTL_MS = 120_000;

export interface FluxyPresenceMember {
  userId: string;
  userInfo?: Record<string, unknown>;
}

export interface FluxyLeaver {
  userId: string;
  lastSeenAt: number;
  userInfo?: Record<string, unknown>;
}

export type FluxyAvatarRole = "self" | "other" | "leaver";

export interface FluxyPresenceAvatar {
  userId: string;
  role: FluxyAvatarRole;
  lastSeenAt: number | null;
  userInfo?: Record<string, unknown>;
}

export function rememberLeaver(
  leavers: Record<string, FluxyLeaver>,
  member: FluxyPresenceMember,
  now: number,
): Record<string, FluxyLeaver> {
  const userId = member.userId.trim();
  if (!userId) return leavers;
  return {
    ...leavers,
    [userId]: { userId, lastSeenAt: now, userInfo: member.userInfo },
  };
}

export function forgetLeaver(
  leavers: Record<string, FluxyLeaver>,
  userId: string,
): Record<string, FluxyLeaver> {
  if (!(userId in leavers)) return leavers;
  const next = { ...leavers };
  delete next[userId];
  return next;
}

export function pruneLeavers(
  leavers: Record<string, FluxyLeaver>,
  now: number,
  ttlMs: number = FLUXY_LEAVER_TTL_MS,
): Record<string, FluxyLeaver> {
  let changed = false;
  const next: Record<string, FluxyLeaver> = {};
  for (const [id, row] of Object.entries(leavers)) {
    if (now - row.lastSeenAt > ttlMs) {
      changed = true;
      continue;
    }
    next[id] = row;
  }
  return changed ? next : leavers;
}

export function selfFromMembers(
  members: FluxyPresenceMember[],
  selfUserId: string,
): FluxyPresenceMember | undefined {
  const id = selfUserId.trim();
  return members.find((m) => m.userId === id);
}

export function classifyPresenceAvatars(input: {
  selfUserId: string;
  members: FluxyPresenceMember[];
  leavers?: Record<string, FluxyLeaver>;
  now?: number;
  ttlMs?: number;
}): FluxyPresenceAvatar[] {
  const now = input.now ?? Date.now();
  const ttl = input.ttlMs ?? FLUXY_LEAVER_TTL_MS;
  const selfId = input.selfUserId.trim();
  const out: FluxyPresenceAvatar[] = [];
  const present = new Set<string>();
  for (const member of input.members) {
    present.add(member.userId);
    out.push({
      userId: member.userId,
      role: member.userId === selfId ? "self" : "other",
      lastSeenAt: null,
      userInfo: member.userInfo,
    });
  }
  for (const leaver of Object.values(input.leavers ?? {})) {
    if (present.has(leaver.userId)) continue;
    if (now - leaver.lastSeenAt > ttl) continue;
    out.push({
      userId: leaver.userId,
      role: "leaver",
      lastSeenAt: leaver.lastSeenAt,
      userInfo: leaver.userInfo,
    });
  }
  return out;
}
