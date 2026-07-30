export type TranscriptRole = "user" | "assistant" | "system";

export interface TranscriptEntry {
  id: string;
  userKey: string;
  role: TranscriptRole;
  text: string;
  platform: string;
  threadId: string;
  timestamp: number;
  platformMessageId?: string;
}

export interface AppendInput {
  text: string;
  role: TranscriptRole;
  platformMessageId?: string;
}

export interface AppendOptions {
  userKey: string;
}

export interface ListQuery {
  userKey: string;
  platforms?: string[];
  threadId?: string;
  roles?: TranscriptRole[];
  limit?: number;
}

export interface DeleteTarget {
  userKey: string;
}

export interface TranscriptsConfig {
  retention?: string | number;
  maxPerUser?: number;
}

export interface TranscriptsApi {
  append(
    threadId: string,
    platform: string,
    message: AppendInput | { content: string; id?: string; role?: TranscriptRole },
    options?: AppendOptions,
  ): Promise<TranscriptEntry | null>;
  list(query: ListQuery): Promise<TranscriptEntry[]>;
  count(query: { userKey: string }): Promise<number>;
  delete(target: DeleteTarget): Promise<{ deleted: number }>;
}

export interface TranscriptStore {
  appendToList<T>(key: string, value: T, options?: { maxLength?: number; ttlMs?: number }): Promise<void>;
  getList<T>(key: string): Promise<T[]>;
}

const KEY_PREFIX = "transcripts:user:";
const DEFAULT_MAX_PER_USER = 200;
const DEFAULT_LIST_LIMIT = 50;
const DURATION_RE = /^(\d+)([smhd])$/;
const TOMBSTONE_MARKER = "__fluxyTombstone";

type Tombstone = { [TOMBSTONE_MARKER]: true };

function isTombstone(value: unknown): value is Tombstone {
  return typeof value === "object" && value !== null && (value as Record<string, unknown>)[TOMBSTONE_MARKER] === true;
}

const MS_PER_UNIT = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 } as const;

function parseDuration(value: string | number | undefined): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value === "number") return value;
  const match = DURATION_RE.exec(value);
  if (!match) throw new Error(`Invalid duration: ${value} (expected ms or "<n>[smhd]")`);
  const n = Number.parseInt(match[1], 10);
  const unit = match[2] as keyof typeof MS_PER_UNIT;
  return n * MS_PER_UNIT[unit];
}

function keyFor(userKey: string): string {
  return `${KEY_PREFIX}${userKey}`;
}

export function createTranscriptsApi(config?: TranscriptsConfig): TranscriptsApi {
  const maxPerUser = config?.maxPerUser ?? DEFAULT_MAX_PER_USER;
  const retentionMs = parseDuration(config?.retention);

  const store: Record<string, Array<{ value: unknown; expiresAt: number | null }>> = {};

  const memoryStore: TranscriptStore = {
    async appendToList<T>(key: string, value: T, options?: { maxLength?: number; ttlMs?: number }): Promise<void> {
      if (!store[key]) store[key] = [];
      const expiresAt = options?.ttlMs != null ? Date.now() + options.ttlMs : null;
      store[key].push({ value, expiresAt });
      if (options?.maxLength != null && store[key].length > options.maxLength) {
        store[key] = store[key].slice(store[key].length - options.maxLength);
      }
    },
    async getList<T>(key: string): Promise<T[]> {
      const entries = store[key] || [];
      const now = Date.now();
      store[key] = entries.filter((e) => e.expiresAt === null || e.expiresAt > now);
      return store[key].map((e) => e.value as T);
    },
  };

  const api: TranscriptsApi = {
    async append(
      threadId: string,
      platform: string,
      message: AppendInput | { content: string; id?: string; role?: TranscriptRole },
      options?: AppendOptions,
    ): Promise<TranscriptEntry | null> {
      const isInput = "role" in message && typeof message.role === "string";
      let userKey: string | undefined;
      let role: TranscriptRole;
      let platformMessageId: string | undefined;
      let text: string;

      if (isInput) {
        const input = message as AppendInput;
        userKey = options?.userKey;
        role = input.role;
        platformMessageId = input.platformMessageId;
        text = input.text;
        if (!userKey) throw new Error("transcripts.append: options.userKey required for AppendInput");
      } else {
        const msg = message as { content: string; id?: string; role?: TranscriptRole };
        userKey = options?.userKey;
        if (!userKey) return null;
        role = msg.role ?? "user";
        platformMessageId = msg.id;
        text = msg.content;
      }

      const entry: TranscriptEntry = {
        id: crypto.randomUUID(),
        userKey,
        role,
        text,
        platform,
        threadId,
        timestamp: Date.now(),
      };
      if (platformMessageId) entry.platformMessageId = platformMessageId;

      await memoryStore.appendToList(keyFor(userKey), entry, {
        maxLength: maxPerUser,
        ttlMs: retentionMs,
      });

      return entry;
    },

    async list(query: ListQuery): Promise<TranscriptEntry[]> {
      const raw = await memoryStore.getList<TranscriptEntry | Tombstone>(keyFor(query.userKey));
      let filtered = raw.filter((entry): entry is TranscriptEntry => !isTombstone(entry));

      if (query.platforms?.length) {
        const platforms = new Set(query.platforms);
        filtered = filtered.filter((m) => platforms.has(m.platform));
      }
      if (query.threadId !== undefined) {
        filtered = filtered.filter((m) => m.threadId === query.threadId);
      }
      if (query.roles?.length) {
        const roles = new Set(query.roles);
        filtered = filtered.filter((m) => roles.has(m.role));
      }

      const limit = query.limit ?? DEFAULT_LIST_LIMIT;
      if (filtered.length > limit) {
        filtered = filtered.slice(filtered.length - limit);
      }
      return filtered;
    },

    async count(query: { userKey: string }): Promise<number> {
      const raw = await memoryStore.getList(keyFor(query.userKey));
      return raw.filter((entry) => !isTombstone(entry)).length;
    },

    async delete(target: DeleteTarget): Promise<{ deleted: number }> {
      const key = keyFor(target.userKey);
      const existing = await memoryStore.getList(key);
      const previous = existing.filter((entry) => !isTombstone(entry)).length;
      const tombstone: Tombstone = { [TOMBSTONE_MARKER]: true };
      await memoryStore.appendToList(key, tombstone, { maxLength: 1, ttlMs: retentionMs });
      return { deleted: previous };
    },
  };

  return api;
}
