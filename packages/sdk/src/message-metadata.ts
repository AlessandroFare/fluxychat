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

export declare function createMetadataStore(kv: KVNamespace): MetadataStore;

/**
 * Common metadata keys used by FluxyChat.
 */
export declare const METADATA_KEYS: {
  /** Whether the message was AI-generated */
  AI_GENERATED: "fluxy_ai_generated";
  /** Agent ID that generated the message */
  AGENT_ID: "fluxy_agent_id";
  /** Tool calls in the message */
  TOOL_CALLS: "fluxy_tool_calls";
  /** Token usage */
  TOKEN_USAGE: "fluxy_token_usage";
  /** Message source (web, mobile, api, etc.) */
  SOURCE: "fluxy_source";
  /** Thread/topic */
  THREAD_ID: "fluxy_thread_id";
  /** Reactions summary */
  REACTIONS: "fluxy_reactions";
  /** Read receipts */
  READ_BY: "fluxy_read_by";
  /** Edit history */
  EDIT_HISTORY: "fluxy_edit_history";
  /** Priority */
  PRIORITY: "fluxy_priority";
  /** Custom tags */
  TAGS: "fluxy_tags";
};

interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: { prefix?: string }): Promise<{ keys: Array<{ name: string }> }>;
}
