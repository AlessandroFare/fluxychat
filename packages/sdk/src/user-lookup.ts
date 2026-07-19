export interface UserProfile {
  userId: string;
  username?: string;
  fullName?: string;
  email?: string;
  avatarUrl?: string;
  bot?: boolean;
}

export interface UserLookupApi {
  getUser(userId: string): Promise<UserProfile | null>;
  getUsers(userIds: string[]): Promise<Map<string, UserProfile>>;
}

const STORE = new Map<string, UserProfile>();

export function registerUser(profile: UserProfile): void {
  STORE.set(profile.userId, profile);
}

export function createUserLookup(): UserLookupApi {
  return {
    async getUser(userId) {
      return STORE.get(userId) ?? null;
    },

    async getUsers(userIds) {
      const map = new Map<string, UserProfile>();
      for (const id of userIds) {
        const user = STORE.get(id);
        if (user) map.set(id, user);
      }
      return map;
    },
  };
}
