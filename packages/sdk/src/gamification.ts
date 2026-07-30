export interface XpEvent {
  userId: string;
  amount: number;
  reason: string;
  timestamp: string;
}

export interface Badge {
  id: string;
  name: string;
  description?: string;
  iconUrl?: string;
  awardedAt?: string;
}

export interface LeaderboardEntry {
  userId: string;
  username?: string;
  avatarUrl?: string;
  totalXp: number;
  badges: number;
  rank: number;
}

export interface GamificationApi {
  awardXp(userId: string, amount: number, reason: string): void;
  getXp(userId: string): number;
  getHistory(userId: string): XpEvent[];
  awardBadge(userId: string, badge: Badge): void;
  getBadges(userId: string): Badge[];
  getLeaderboard(limit?: number): LeaderboardEntry[];
}

export function createGamification(): GamificationApi {
  const xpStore = new Map<string, { total: number; history: XpEvent[]; badges: Badge[] }>();

  function ensure(userId: string) {
    if (!xpStore.has(userId)) xpStore.set(userId, { total: 0, history: [], badges: [] });
    return xpStore.get(userId)!;
  }

  return {
    awardXp(userId, amount, reason) {
      const record = ensure(userId);
      record.total += amount;
      record.history.push({ userId, amount, reason, timestamp: new Date().toISOString() });
    },

    getXp(userId) {
      return ensure(userId).total;
    },

    getHistory(userId) {
      return [...ensure(userId).history];
    },

    awardBadge(userId, badge) {
      const record = ensure(userId);
      if (!record.badges.some((b) => b.id === badge.id)) {
        record.badges.push({ ...badge, awardedAt: new Date().toISOString() });
      }
    },

    getBadges(userId) {
      return [...ensure(userId).badges];
    },

    getLeaderboard(limit = 10) {
      const entries: LeaderboardEntry[] = [];
      for (const [userId, record] of xpStore) {
        entries.push({
          userId,
          totalXp: record.total,
          badges: record.badges.length,
          rank: 0,
        });
      }
      entries.sort((a, b) => b.totalXp - a.totalXp);
      return entries.slice(0, limit).map((e, i) => ({ ...e, rank: i + 1 }));
    },
  };
}
