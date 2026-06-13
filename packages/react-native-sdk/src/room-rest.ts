export const FLUXY_MAX_MESSAGE_LENGTH = 10_000;

export interface FluxyRoomMember {
  userId: string;
  role: string;
  joined_at?: string;
  joinedAt?: string;
  notifyEnabled?: boolean;
  preferences?: Record<string, unknown>;
}

export function normalizeRoomMember(raw: Record<string, unknown>): FluxyRoomMember {
  return {
    userId: String(raw.userId ?? raw.user_id ?? ''),
    role: String(raw.role ?? 'member'),
    joined_at: typeof raw.joined_at === 'string' ? raw.joined_at : undefined,
    joinedAt: typeof raw.joinedAt === 'string' ? raw.joinedAt : undefined,
    notifyEnabled: typeof raw.notifyEnabled === 'boolean' ? raw.notifyEnabled : undefined,
    preferences: typeof raw.preferences === 'object' && raw.preferences !== null ? raw.preferences as Record<string, unknown> : undefined,
  };
}

export function normalizeRoomMembers(raw: Record<string, unknown>[]): FluxyRoomMember[] {
  return raw.filter((r) => r && typeof r === 'object').map(normalizeRoomMember);
}
