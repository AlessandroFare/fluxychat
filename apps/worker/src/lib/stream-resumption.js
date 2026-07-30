/**
 * P23-1: Stream Resumption — Worker Implementation
 * KV-backed store for resuming active streams after disconnect.
 */

const STREAM_PREFIX = "stream-resume:";
const DEFAULT_TTL_SECONDS = 600; // 10 minutes

/**
 * Create a stream resumption store backed by Cloudflare KV.
 * @param {Object} kv - KV namespace
 */
export function createStreamResumptionStore(kv) {
  return {
    async save(entry) {
      const key = `${STREAM_PREFIX}${entry.streamId}`;
      const data = JSON.stringify({
        ...entry,
        lastActivityAt: new Date().toISOString(),
      });
      await kv.put(key, data, { expirationTtl: DEFAULT_TTL_SECONDS });
    },

    async get(streamId) {
      const key = `${STREAM_PREFIX}${streamId}`;
      const raw = await kv.get(key, { type: "json" });
      if (!raw) return null;
      if (!raw.active) return null;
      return raw;
    },

    async deactivate(streamId) {
      const key = `${STREAM_PREFIX}${streamId}`;
      const raw = await kv.get(key, { type: "json" });
      if (raw) {
        raw.active = false;
        await kv.put(key, JSON.stringify(raw), { expirationTtl: 60 });
      }
    },

    async getActiveForRoom(roomId) {
      const list = await kv.list({ prefix: STREAM_PREFIX });
      const results = [];
      for (const { name } of list.keys) {
        const raw = await kv.get(name, { type: "json" });
        if (raw && raw.active && raw.roomId === roomId) {
          results.push(raw);
        }
      }
      return results;
    },

    async getActiveForUser(userId) {
      const list = await kv.list({ prefix: STREAM_PREFIX });
      const results = [];
      for (const { name } of list.keys) {
        const raw = await kv.get(name, { type: "json" });
        if (raw && raw.active && raw.userId === userId) {
          results.push(raw);
        }
      }
      return results;
    },

    async cleanup(maxAgeMs = 600_000) {
      const list = await kv.list({ prefix: STREAM_PREFIX });
      let cleaned = 0;
      const cutoff = Date.now() - maxAgeMs;
      for (const { name } of list.keys) {
        const raw = await kv.get(name, { type: "json" });
        if (!raw) continue;
        if (!raw.active || new Date(raw.lastActivityAt).getTime() < cutoff) {
          await kv.delete(name);
          cleaned++;
        }
      }
      return cleaned;
    },
  };
}

/**
 * Middleware that auto-saves stream entries for resumption.
 * @param {Object} resumptionStore - Stream resumption store
 * @param {Object} opts - Default metadata
 */
export function createStreamResumptionMiddleware(resumptionStore, opts = {}) {
  return {
    name: "stream-resumption",
    async *wrapStream(params, next) {
      const streamId = opts.streamId || crypto.randomUUID();
      const entry = {
        streamId,
        projectId: params.projectId || opts.projectId,
        roomId: params.roomId || opts.roomId,
        userId: params.userId || opts.userId,
        agentId: params.agentId || opts.agentId,
        runId: params.runId || opts.runId,
        content: "",
        active: true,
        startedAt: new Date().toISOString(),
        lastActivityAt: new Date().toISOString(),
      };

      await resumptionStore.save(entry);

      try {
        for await (const chunk of next()) {
          if (chunk.type === "text" && chunk.text) {
            entry.content += chunk.text;
            entry.lastActivityAt = new Date().toISOString();
            if (Math.random() < 0.2) {
              await resumptionStore.save(entry);
            }
          }
          yield chunk;
        }
        await resumptionStore.deactivate(streamId);
      } catch (err) {
        await resumptionStore.save(entry);
        throw err;
      }
    },
  };
}
