/**
 * P22-F8: Thread State Store (Per-Thread KV with TTL)
 * Cloudflare KV-backed thread-local state management.
 */

export function createThreadStateStore(kv) {
  return {
    async get(threadId) {
      const key = `thread-state:${threadId}`;
      const raw = await kv.get(key, { type: "json" });
      if (!raw) return null;
      if (raw.expiresAt && new Date(raw.expiresAt) < new Date()) {
        await kv.delete(key);
        return null;
      }
      return raw;
    },

    async set(threadId, state, ttlMs) {
      const key = `thread-state:${threadId}`;
      const entry = {
        threadId,
        state,
        expiresAt: ttlMs ? new Date(Date.now() + ttlMs).toISOString() : null,
        updatedAt: new Date().toISOString(),
      };
      const options = ttlMs ? { expirationTtl: Math.ceil(ttlMs / 1000) } : {};
      await kv.put(key, JSON.stringify(entry), options);
    },

    async delete(threadId) {
      const key = `thread-state:${threadId}`;
      await kv.delete(key);
    },
  };
}
