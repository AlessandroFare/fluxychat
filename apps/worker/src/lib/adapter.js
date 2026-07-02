/**
 * P22-A1: Adapter interface for multi-platform integration.
 * Adapted from Vercel Chat SDK's Adapter pattern for FluxyChat's D1/DO architecture.
 *
 * Each adapter implements this interface to integrate a new platform.
 * The core dispatches to adapters based on channel type.
 *
 * Thread ID format: {adapter}:{channel}:{thread}
 * Examples: web:{userId}:{roomId}, slack:{channelId}:{threadTs}
 */

import { remark } from "remark";
import remarkGfm from "remark-gfm";
import remarkStringify from "remark-stringify";

// =============================================================================
// Errors
// =============================================================================

/**
 * Thrown when an optional adapter method is called but not implemented
 * by the specific platform adapter.
 */
export class NotImplementedError extends Error {
  constructor(message) {
    super(message);
    this.name = "NotImplementedError";
  }
}

// =============================================================================
// Core Types
// =============================================================================

/**
 * @template TThreadId - Platform-specific thread ID data type
 * @template TRawMessage - Platform-specific raw message type
 */

/** Lock scope determines which messages contend for the same lock */
/** @typedef {'thread' | 'channel'} LockScope */

/** Channel visibility scope */
/** @typedef {'private' | 'workspace' | 'external' | 'unknown'} ChannelVisibility */

/**
 * @typedef {Object} Author
 * @property {string} userId - Unique user ID
 * @property {string} userName - Username/handle
 * @property {string} fullName - Display name
 * @property {boolean|'unknown'} isBot - Whether the author is a bot
 * @property {boolean} isMe - Whether this was sent by this bot
 */

/**
 * @typedef {Object} UserInfo
 * @property {string} userId - Platform-specific user ID
 * @property {string} userName - Username/handle
 * @property {string} fullName - Display name
 * @property {boolean} isBot - Whether the user is a bot
 * @property {string} [avatarUrl] - Avatar URL
 * @property {string} [email] - Email address
 */

/**
 * @typedef {Object} MessageMetadata
 * @property {Date} dateSent - When the message was sent
 * @property {boolean} edited - Whether the message has been edited
 * @property {Date} [editedAt] - When the message was last edited
 */

/**
 * @typedef {Object} RawMessage
 * @property {string} id - Internal message ID
 * @property {TRawMessage} raw - Platform-specific raw response
 * @property {string} threadId - Thread ID
 */

/**
 * @typedef {Object} SentMessage
 * @property {string} id - Message ID
 * @property {string} threadId - Thread ID
 * @property {string} text - Text content
 * @property {Object} formatted - mdast AST
 * @property {Author} author - Author info
 * @property {MessageMetadata} metadata - Metadata
 * @property {Function} edit - Edit this message
 * @property {Function} delete - Delete this message
 * @property {Function} addReaction - Add reaction
 * @property {Function} removeReaction - Remove reaction
 */

/**
 * @typedef {Object} StreamChunk
 * @property {string} type - 'markdown_text' | 'task_update' | 'plan_update'
 * @property {string} [text] - Text content (for markdown_text)
 * @property {string} [id] - Task ID (for task_update)
 * @property {string} [title] - Task title (for task_update)
 * @property {'pending'|'in_progress'|'complete'|'error'} [status] - Task status
 */

/**
 * @typedef {Object} ThreadInfo
 * @property {string} id - Thread ID
 * @property {string} channelId - Channel ID
 * @property {boolean} [isDM] - Whether this is a DM
 * @property {ChannelVisibility} [channelVisibility] - Channel visibility
 * @property {Record<string,unknown>} metadata - Platform metadata
 */

/**
 * @typedef {Object} FetchOptions
 * @property {string} [cursor] - Pagination cursor
 * @property {'forward'|'backward'} [direction] - Fetch direction
 * @property {number} [limit] - Max messages to fetch
 */

/**
 * @typedef {Object} FetchResult
 * @property {Array} messages - Messages in chronological order
 * @property {string} [nextCursor] - Cursor for next page
 */

/**
 * @typedef {Object} WebhookOptions
 * @property {Function} [waitUntil] - Run task in background
 */

/**
 * @typedef {Object} AdapterContext
 * @property {Object} env - Cloudflare Worker environment bindings
 * @property {Object} ctx - ExecutionContext
 * @property {string} projectId - Current project ID
 * @property {string} [channelId] - Channel config ID from D1
 * @property {Object} [channelConfig] - Full channel config row
 */

/**
 * Postable message input for adapter methods.
 * @typedef {string|{raw?: string, markdown?: string, ast?: Object, card?: Object, fallbackText?: string}} AdapterPostableMessage
 */

// =============================================================================
// Format Converter Interface
// =============================================================================

/**
 * Format converter for platform-specific message formatting.
 * Converts between markdown, mdast AST, and platform format.
 */
export class BaseFormatConverter {
  /**
   * Convert platform text to mdast AST.
   * @param {string} text - Platform-specific text
   * @returns {Object} mdast Root node
   */
  toAst(text) {
    return remark().use(remarkGfm).parse(text);
  }

  /**
   * Convert mdast AST to platform text.
   * @param {Object} ast - mdast Root node
   * @returns {string} Platform-specific text
   */
  fromAst(ast) {
    return remark().use(remarkGfm).use(remarkStringify).stringify(ast);
  }

  /**
   * Render an AdapterPostableMessage to a string for posting.
   * @param {AdapterPostableMessage} message - Message to render
   * @returns {string} Rendered text
   */
  renderPostable(message) {
    if (typeof message === "string") return message;
    if (message.raw) return message.raw;
    if (message.markdown) return message.markdown;
    if (message.ast) return this.fromAst(message.ast);
    if (message.card) return message.fallbackText ?? "";
    return "";
  }
}

// =============================================================================
// Base Adapter Class
// =============================================================================

/**
 * Base adapter class. All platform adapters extend this.
 *
 * @template TThreadId - Platform-specific thread ID data type
 * @template TRawMessage - Platform-specific raw message type
 */
export class Adapter {
  /** @type {string} Unique adapter name (e.g., 'web', 'slack', 'whatsapp') */
  name;

  /** @type {string} Human-readable name */
  displayName;

  /** @type {string} npm package name */
  packageName;

  /** @type {string[]} Required environment variables */
  envVars = [];

  /** @type {string[]} Peer dependencies */
  peerDeps = [];

  /** @type {LockScope} Default lock scope */
  lockScope = "channel";

  /** @type {boolean} Whether adapter supports streaming */
  supportsStreaming = false;

  /** @type {boolean} Whether adapter supports message editing */
  supportsEdit = true;

  /** @type {boolean} Whether adapter supports message deletion */
  supportsDelete = true;

  /** @type {boolean} Whether adapter supports reactions */
  supportsReactions = true;

  /** @type {boolean} Whether adapter supports threads */
  supportsThreads = false;

  /** @type {boolean} Whether adapter supports attachments */
  supportsAttachments = true;

  /** @type {number} Max message length */
  maxMessageLength = 4096;

  /** @type {boolean} Whether to persist thread history in state */
  persistThreadHistory = false;

  /** @type {BaseFormatConverter} Format converter instance */
  formatConverter;

  /**
   * Initialize the adapter with a chat instance.
   * @param {Object} chat - Chat instance
   * @returns {Promise<void>}
   */
  async initialize(chat) {
    // Override in subclass
  }

  /**
   * Handle an incoming webhook/request from the platform.
   *
   * @param {Request} request - Raw incoming request
   * @param {WebhookOptions} [options] - Options
   * @param {Function} [options.waitUntil] - `waitUntil: (task: Promise<unknown>) => void`
   *   Portable background task tracking. On Cloudflare Workers, pass `ctx.waitUntil`.
   *   On Next.js, pass `(p) => after(() => p)`. Default: execute the promise immediately.
   * @returns {Promise<Response>}
   */
  async handleWebhook(request, options) {
    throw new Error("Adapter.handleWebhook must be implemented");
  }

  /**
   * Parse a raw platform message into normalized format.
   * @param {TRawMessage} raw - Platform-specific raw message
   * @returns {Object} Parsed message with text, formatted, author, metadata
   */
  parseMessage(raw) {
    throw new Error("Adapter.parseMessage must be implemented");
  }

  /**
   * Post a message to a thread.
   * @param {string} threadId - Thread ID
   * @param {AdapterPostableMessage} message - Message to post
   * @returns {Promise<RawMessage>}
   */
  async postMessage(threadId, message) {
    throw new Error("Adapter.postMessage must be implemented");
  }

  /**
   * Edit an existing message.
   * @param {string} threadId - Thread ID
   * @param {string} messageId - Message ID
   * @param {AdapterPostableMessage} message - Updated message
   * @returns {Promise<RawMessage>}
   */
  async editMessage(threadId, messageId, message) {
    throw new Error("Adapter.editMessage must be implemented");
  }

  /**
   * Delete a message.
   * @param {string} threadId - Thread ID
   * @param {string} messageId - Message ID
   * @returns {Promise<void>}
   */
  async deleteMessage(threadId, messageId) {
    throw new Error("Adapter.deleteMessage must be implemented");
  }

  /**
   * Add a reaction to a message.
   * @param {string} threadId - Thread ID
   * @param {string} messageId - Message ID
   * @param {string} emoji - Emoji
   * @returns {Promise<void>}
   */
  async addReaction(threadId, messageId, emoji) {
    throw new Error("Adapter.addReaction must be implemented");
  }

  /**
   * Remove a reaction from a message.
   * @param {string} threadId - Thread ID
   * @param {string} messageId - Message ID
   * @param {string} emoji - Emoji
   * @returns {Promise<void>}
   */
  async removeReaction(threadId, messageId, emoji) {
    throw new Error("Adapter.removeReaction must be implemented");
  }

  /**
   * Stream a response back to the platform.
   * @param {string} threadId - Thread ID
   * @param {AsyncIterable<string|StreamChunk>} textStream - Token stream
   * @param {Object} [options] - Stream options
   * @returns {Promise<RawMessage|null>} Raw message or null to use fallback
   */
  async stream(threadId, textStream, options) {
    throw new Error("Adapter.stream must be implemented");
  }

  /**
   * Show typing indicator.
   * @param {string} threadId - Thread ID
   * @param {string} [status] - Status text
   * @returns {Promise<void>}
   */
  async startTyping(threadId, status) {
    // No-op by default
  }

  /**
   * Fetch messages from a thread.
   * @param {string} threadId - Thread ID
   * @param {FetchOptions} [options] - Fetch options
   * @returns {Promise<FetchResult>}
   */
  async fetchMessages(threadId, options) {
    return { messages: [] };
  }

  /**
   * Fetch thread metadata.
   * @param {string} threadId - Thread ID
   * @returns {Promise<ThreadInfo>}
   */
  async fetchThread(threadId) {
    return {
      id: threadId,
      channelId: this.channelIdFromThreadId(threadId),
      isDM: true,
      metadata: {},
    };
  }

  /**
   * Look up user information.
   * @param {string} userId - Platform user ID
   * @returns {Promise<UserInfo|null>}
   */
  async getUser(userId) {
    return null;
  }

  /**
   * Encode platform-specific data into a thread ID string.
   * @param {TThreadId} platformData - Platform-specific data
   * @returns {string} Encoded thread ID
   */
  encodeThreadId(platformData) {
    throw new Error("Adapter.encodeThreadId must be implemented");
  }

  /**
   * Decode a thread ID string back to platform-specific data.
   * @param {string} threadId - Encoded thread ID
   * @returns {TThreadId} Decoded data
   */
  decodeThreadId(threadId) {
    throw new Error("Adapter.decodeThreadId must be implemented");
  }

  /**
   * Derive channel ID from a thread ID.
   * Default: first two colon-separated parts.
   * @param {string} threadId - Thread ID
   * @returns {string} Channel ID
   */
  channelIdFromThreadId(threadId) {
    const parts = threadId.split(":");
    return parts.length >= 2 ? `${parts[0]}:${parts[1]}` : threadId;
  }

  /**
   * Check if a thread is a direct message conversation.
   * @param {string} threadId - Thread ID
   * @returns {boolean}
   */
  isDM(threadId) {
    return true;
  }

  /**
   * Get the visibility scope of a channel.
   * @param {string} threadId - Thread ID
   * @returns {ChannelVisibility}
   */
  getChannelVisibility(threadId) {
    return "unknown";
  }

  /**
   * Render formatted content to platform-specific string.
   * @param {Object} content - mdast AST
   * @returns {string}
   */
  renderFormatted(content) {
    return this.formatConverter.fromAst(content);
  }

  /**
   * Validate adapter configuration.
   * @param {Object} settings - Channel config settings
   * @returns {{ok: boolean, error?: string}}
   */
  validateSettings(settings) {
    return { ok: true };
  }

  /**
   * Get adapter health status.
   * @param {AdapterContext} context - Adapter context
   * @returns {Promise<{healthy: boolean, detail?: string}>}
   */
  async healthCheck(context) {
    return { healthy: true };
  }

  /**
   * Cleanup hook called when Chat instance is shutdown.
   * @returns {Promise<void>}
   */
  async disconnect() {
    // No-op by default
  }

  // ===========================================================================
  // Optional adapter methods
  //
  // These have default implementations that throw NotImplementedError.
  // Specific adapters override the ones they support.
  // ===========================================================================

  /**
   * Open a direct message conversation with a user.
   * @param {string} userId - Platform-specific user ID
   * @returns {Promise<string>} Thread ID for the DM conversation
   */
  async openDM(userId) {
    throw new NotImplementedError(
      `${this.name}.openDM is not implemented`,
    );
  }

  /**
   * Post an ephemeral message visible only to a specific user.
   *
   * When native ephemeral isn't supported (adapter throws NotImplementedError),
   * the caller can pass `{ fallbackToDM: true }` in options to automatically
   * fall back to sending a DM to the user.
   *
   * @param {string} threadId - Thread ID
   * @param {AdapterPostableMessage} message - Message content
   * @param {string} userId - User who should see the message
   * @param {Object} [options] - Options
   * @param {boolean} [options.fallbackToDM=false] - Fall back to DM if native ephemeral isn't supported
   * @returns {Promise<{id: string, threadId: string, raw: *, usedFallback: boolean}>} Ephemeral message result
   */
  async postEphemeral(threadId, message, userId, options = {}) {
    const { fallbackToDM = false } = options;

    try {
      const result = await this._postEphemeralImpl(threadId, message, userId);
      return { ...result, usedFallback: false };
    } catch (err) {
      if (err instanceof NotImplementedError && fallbackToDM) {
        // Fall back to DM: open a DM with the user, then post the message there
        const dmThreadId = await this.openDM(userId);
        const raw = await this.postMessage(dmThreadId, message);
        return {
          id: raw.id,
          threadId: dmThreadId,
          raw: raw.raw,
          usedFallback: true,
        };
      }
      throw err;
    }
  }

  /**
   * Internal implementation of postEphemeral. Override in subclass.
   * @protected
   * @param {string} threadId
   * @param {AdapterPostableMessage} message
   * @param {string} userId
   * @returns {Promise<{id: string, threadId: string, raw: *}>}
   */
  async _postEphemeralImpl(threadId, message, userId) {
    throw new NotImplementedError(
      `${this.name}.postEphemeral is not implemented`,
    );
  }

  /**
   * Post a top-level message to a channel (not in a thread).
   *
   * This is distinct from `postMessage()` which posts into a specific thread.
   * Use this to post a new top-level message to a channel that is not a reply.
   *
   * @param {string} channelId - Channel ID
   * @param {AdapterPostableMessage} message - Message content
   * @returns {Promise<RawMessage>}
   */
  async postChannelMessage(channelId, message) {
    throw new NotImplementedError(
      `${this.name}.postChannelMessage is not implemented`,
    );
  }

  /**
   * Fetch channel metadata.
   * @param {string} channelId - Channel ID
   * @returns {Promise<Object>} Channel info with id, name, isDM, memberCount, channelVisibility
   */
  async fetchChannelInfo(channelId) {
    throw new NotImplementedError(
      `${this.name}.fetchChannelInfo is not implemented`,
    );
  }

  /**
   * Fetch top-level channel messages (not thread replies).
   * @param {string} channelId - Channel ID
   * @param {FetchOptions} [options] - Fetch options (cursor, direction, limit)
   * @returns {Promise<FetchResult>}
   */
  async fetchChannelMessages(channelId, options) {
    throw new NotImplementedError(
      `${this.name}.fetchChannelMessages is not implemented`,
    );
  }

  /**
   * Fetch a single message by ID.
   * @param {string} threadId - Thread ID containing the message
   * @param {string} messageId - Platform-specific message ID
   * @returns {Promise<Object|null>} Message or null if not found
   */
  async fetchMessage(threadId, messageId) {
    throw new NotImplementedError(
      `${this.name}.fetchMessage is not implemented`,
    );
  }

  /**
   * Extract subject/title from a raw platform message.
   * @param {TRawMessage} raw - Platform-specific raw message
   * @returns {Promise<Object|null>} Message subject with title, type, url, etc.
   */
  async fetchSubject(raw) {
    throw new NotImplementedError(
      `${this.name}.fetchSubject is not implemented`,
    );
  }

  /**
   * List channel members.
   * @param {string} channelId - Channel ID
   * @returns {Promise<Array<{userId: string, userName: string, fullName: string}>>}
   */
  async getChannelMembers(channelId) {
    throw new NotImplementedError(
      `${this.name}.getChannelMembers is not implemented`,
    );
  }

  /**
   * List thread participants.
   * @param {string} threadId - Thread ID
   * @returns {Promise<Array<{userId: string, userName: string, fullName: string}>>}
   */
  async getThreadMembers(threadId) {
    throw new NotImplementedError(
      `${this.name}.getThreadMembers is not implemented`,
    );
  }

  /**
   * Reconstruct `fetchData` closure on an attachment after deserialization.
   *
   * Called during message rehydration for queue/debounce strategies.
   * Uses `fetchMetadata` and adapter auth context to rebuild the download closure.
   *
   * Default implementation returns the serialized data as-is.
   * Override in subclass to rebuild `fetchData` using platform-specific auth.
   *
   * @param {Object} attachment - Serialized attachment with optional fetchMetadata
   * @returns {Object} Attachment with potentially reconstructed fetchData closure
   */
  async rehydrateAttachment(attachment) {
    // Default: return as-is. Adapters with platform-specific auth
    // (e.g., Slack private file URLs) should override this to rebuild
    // fetchData using fetchMetadata + adapter credentials.
    return attachment;
  }

  /**
   * List threads in a channel.
   *
   * Returns lightweight thread summaries for efficiency.
   * Default implementation throws NotImplementedError.
   *
   * @param {string} channelId - Channel ID
   * @param {Object} [options] - List options
   * @param {string} [options.cursor] - Pagination cursor
   * @param {number} [options.limit] - Max threads to return
   * @returns {Promise<{threads: Array, nextCursor?: string}>}
   */
  async listThreads(channelId, options) {
    throw new NotImplementedError(
      `${this.name}.listThreads is not implemented`,
    );
  }

  /**
   * Open a modal/dialog form (platform-specific).
   * @param {Object} modal - Modal element to display
   * @param {string} [contextId] - Optional context ID for server-side stored context
   * @returns {Promise<{viewId: string}>}
   */
  async openModal(modal, contextId) {
    throw new NotImplementedError(
      `${this.name}.openModal is not implemented`,
    );
  }
}

// =============================================================================
// Adapter Registry
// =============================================================================

/** @type {Map<string, Adapter>} */
const adapterRegistry = new Map();

/**
 * Register an adapter for a channel type.
 * @param {string} channelType - Channel type slug
 * @param {Adapter} adapter - Adapter instance
 */
export function registerAdapter(channelType, adapter) {
  adapterRegistry.set(channelType, adapter);
}

/**
 * Get an adapter by channel type.
 * @param {string} channelType - Channel type slug
 * @returns {Adapter|undefined}
 */
export function getAdapter(channelType) {
  return adapterRegistry.get(channelType);
}

/**
 * List all registered adapters.
 * @returns {Array<Object>}
 */
export function listAdapters() {
  return Array.from(adapterRegistry.entries()).map(([slug, adapter]) => ({
    slug,
    name: adapter.displayName || adapter.name,
    packageName: adapter.packageName,
    envVars: adapter.envVars,
    peerDeps: adapter.peerDeps,
    lockScope: adapter.lockScope,
    supportsStreaming: adapter.supportsStreaming,
    supportsEdit: adapter.supportsEdit,
    supportsDelete: adapter.supportsDelete,
    supportsReactions: adapter.supportsReactions,
    supportsThreads: adapter.supportsThreads,
    supportsAttachments: adapter.supportsAttachments,
    maxMessageLength: adapter.maxMessageLength,
    persistThreadHistory: adapter.persistThreadHistory,
  }));
}

/**
 * Resolve the adapter for a channel config.
 * @param {Object} channelConfig - Channel config row from D1
 * @returns {Adapter|null}
 */
export function resolveAdapter(channelConfig) {
  if (!channelConfig?.channel_type) return null;
  return adapterRegistry.get(channelConfig.channel_type) || null;
}

/**
 * Dispatch an incoming webhook to the appropriate adapter.
 * @param {Request} request - Raw incoming request
 * @param {AdapterContext} context - Adapter context
 * @returns {Promise<Response>}
 */
export async function dispatchWebhook(request, context) {
  const adapter = resolveAdapter(context.channelConfig);
  if (!adapter) {
    return new Response(JSON.stringify({ error: "adapter_not_found" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    return await adapter.handleWebhook(request);
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err?.message || err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

/**
 * Send a message via the appropriate adapter.
 * @param {string} channelType - Channel type
 * @param {string} threadId - Thread ID
 * @param {AdapterPostableMessage} message - Message to send
 * @returns {Promise<RawMessage|null>}
 */
export async function sendViaAdapter(channelType, threadId, message) {
  const adapter = getAdapter(channelType);
  if (!adapter) return null;
  return adapter.postMessage(threadId, message);
}

/**
 * Edit a message via the appropriate adapter.
 * @param {string} channelType - Channel type
 * @param {string} threadId - Thread ID
 * @param {string} messageId - Message ID
 * @param {AdapterPostableMessage} message - Updated message
 * @returns {Promise<RawMessage|null>}
 */
export async function editViaAdapter(channelType, threadId, messageId, message) {
  const adapter = getAdapter(channelType);
  if (!adapter) return null;
  return adapter.editMessage(threadId, messageId, message);
}

/**
 * Delete a message via the appropriate adapter.
 * @param {string} channelType - Channel type
 * @param {string} threadId - Thread ID
 * @param {string} messageId - Message ID
 * @returns {Promise<boolean>}
 */
export async function deleteViaAdapter(channelType, threadId, messageId) {
  const adapter = getAdapter(channelType);
  if (!adapter) return false;
  try {
    await adapter.deleteMessage(threadId, messageId);
    return true;
  } catch {
    return false;
  }
}

// Re-export remark utilities for format converters
export { remark, remarkGfm, remarkStringify };
