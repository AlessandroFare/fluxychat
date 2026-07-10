/**
 * P24-14: Message Metadata
 * Arbitrary key-value metadata on messages.
 */

export interface MessageMetadataMap {
  [key: string]: unknown;
}

export interface MetadataStore {
  /** Set metadata on a message */
  set(messageId: string, key: string, value: unknown): Promise<void>;
  /** Get metadata from a message */
  get(messageId: string, key: string): Promise<unknown>;
  /** Get all metadata for a message */
  getAll(messageId: string): Promise<MessageMetadataMap>;
  /** Delete a metadata key */
  delete(messageId: string, key: string): Promise<void>;
  /** Delete all metadata for a message */
  deleteAll(messageId: string): Promise<void>;
  /** Query messages by metadata key/value */
  query(projectId: string, key: string, value: unknown): Promise<string[]>;
}

export function createMetadataStore(kv: KVNamespace): MetadataStore {
  throw new Error("createMetadataStore not implemented in SDK - use worker runtime");
}

/**
 * Common metadata keys used by FluxyChat.
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
} as const;

interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: { prefix?: string }): Promise<{ keys: Array<{ name: string }> }>;
}
