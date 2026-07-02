/**
 * P24-14: Message Metadata — Worker Implementation
 */

const METADATA_PREFIX = "meta:";

/**
 * Create a metadata store backed by KV.
 * @param {Object} kv
 */
export function createMetadataStore(kv) {
  return {
    async set(messageId, key, value) {
      const metaKey = `${METADATA_PREFIX}${messageId}:${key}`;
      await kv.put(metaKey, JSON.stringify(value));
    },

    async get(messageId, key) {
      const metaKey = `${METADATA_PREFIX}${messageId}:${key}`;
      const raw = await kv.get(metaKey, { type: "json" });
      return raw;
    },

    async getAll(messageId) {
      const prefix = `${METADATA_PREFIX}${messageId}:`;
      const list = await kv.list({ prefix });
      const result = {};
      for (const { name } of list.keys) {
        const key = name.replace(prefix, "");
        const value = await kv.get(name, { type: "json" });
        result[key] = value;
      }
      return result;
    },

    async delete(messageId, key) {
      const metaKey = `${METADATA_PREFIX}${messageId}:${key}`;
      await kv.delete(metaKey);
    },

    async deleteAll(messageId) {
      const prefix = `${METADATA_PREFIX}${messageId}:`;
      const list = await kv.list({ prefix });
      for (const { name } of list.keys) {
        await kv.delete(name);
      }
    },

    async query(projectId, key, value) {
      // KV doesn't support complex queries efficiently
      // In production, use D1 for indexed queries
      return [];
    },
  };
}

/**
 * Common metadata keys.
 */
export const METADATA_KEYS = {
  AI_GENERATED: "fluxy_ai_generated",
  AGENT_ID: "fluxy_agent_id",
  TOOL_CALLS: "fluxy_tool_calls",
  TOKEN_USAGE: "fluxy_token_usage",
  SOURCE: "fluxy_source",
  THREAD_ID: "fluxy_thread_id",
  REACTIONS: "fluxy_reactions",
  READ_BY: "fluxy_read_by",
  EDIT_HISTORY: "fluxy_edit_history",
  PRIORITY: "fluxy_priority",
  TAGS: "fluxy_tags",
};
