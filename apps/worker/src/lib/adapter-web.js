/**
 * P22-A2: WebAdapter - formalizes existing web/REST message flow as an Adapter.
 * Adapted from Vercel Chat SDK's WebAdapter for FluxyChat's D1/DO architecture.
 *
 * Thread ID format: web:{userId}:{roomId}
 * Each browser session is treated as a DM thread scoped to the resolved user.
 */

import { Adapter, BaseFormatConverter, registerAdapter } from "./adapter.js";
import { StreamingMarkdownRenderer } from "./streaming-markdown.js";

// =============================================================================
// Web Format Converter
// =============================================================================

/**
 * Format converter for the Web adapter.
 * The Web "platform format" is markdown â€” the browser renders mdast directly.
 * No platform-specific markup translation is needed.
 */
export class WebFormatConverter extends BaseFormatConverter {
  /**
   * Convert platform text to mdast AST.
   * @param {string} text - Markdown text
   * @returns {Object} mdast Root node
   */
  toAst(text) {
    return super.toAst(text);
  }

  /**
   * Convert mdast AST to platform text.
   * @param {Object} ast - mdast Root node
   * @returns {string} Markdown text
   */
  fromAst(ast) {
    return super.fromAst(ast);
  }
}

// =============================================================================
// Web Adapter
// =============================================================================

/** @type {string} */
const ADAPTER_NAME = "web";

/**
 * Default thread ID derivation: web:{userId}:{roomId}
 * @param {{userId: string, roomId: string}} args
 * @returns {string}
 */
const defaultThreadIdFor = (args) =>
  `${ADAPTER_NAME}:${args.userId}:${args.roomId}`;

/**
 * WebAdapter - formalizes existing web/REST message flow.
 *
 * Speaks the WebSocket + REST protocol so FluxyChat can serve
 * a browser UI alongside Slack/Teams/Discord. The browser POSTs the
 * conversation, the user handler runs on the server, and its output streams
 * back via WebSocket.
 */
export class WebAdapter extends Adapter {
  /** @type {string} */
  name = ADAPTER_NAME;
  /** @type {string} */
  displayName = "Web (REST + WebSocket)";
  /** @type {string} */
  packageName = "@fluxy-chat/adapter-web";

  /** @type {string[]} */
  envVars = [];
  /** @type {string[]} */
  peerDeps = [];

  /** @type {import('./adapter.js').LockScope} */
  lockScope = "channel";

  /** @type {boolean} */
  supportsStreaming = true;
  /** @type {boolean} */
  supportsEdit = true;
  /** @type {boolean} */
  supportsDelete = true;
  /** @type {boolean} */
  supportsReactions = true;
  /** @type {boolean} */
  supportsThreads = true;
  /** @type {boolean} */
  supportsAttachments = true;

  /** @type {number} */
  maxMessageLength = 65536;

  /** @type {boolean} */
  persistThreadHistory = true;

  /** @type {WebFormatConverter} */
  formatConverter = new WebFormatConverter();

  /** @type {Function} Thread ID derivation function */
  threadIdFor;

  /**
   * @param {{threadIdFor?: Function}} [opts]
   */
  constructor(opts = {}) {
    super();
    this.threadIdFor = opts.threadIdFor ?? defaultThreadIdFor;
  }

  /**
   * Handle incoming webhook from web client.
   * For web, this is typically a REST POST /messages call.
   * @param {Request} request
   * @param {import('./adapter.js').WebhookOptions} [options]
   * @returns {Promise<Response>}
   */
  async handleWebhook(request, options) {
    // Web adapter doesn't use webhooks â€” messages come via REST/WebSocket.
    // This is called for compatibility; actual routing happens in messages-http.js.
    return new Response(JSON.stringify({ ok: true, adapter: "web" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  /**
   * Parse raw web message into normalized format.
   * @param {Object} raw - Raw message from REST/WebSocket
   * @returns {Object} Parsed message
   */
  parseMessage(raw) {
    const text = raw.content || "";
    return {
      id: raw.id || raw.clientMessageId,
      threadId: raw.roomId || raw.room_id,
      text,
      formatted: this.formatConverter.toAst(text),
      raw,
      author: {
        userId: raw.userId || raw.user_id || raw.senderId || "unknown",
        userName: raw.userName || raw.user_name || "unknown",
        fullName: raw.fullName || raw.full_name || "unknown",
        isBot: raw.kind === "agent" || raw.kind === "system",
        isMe: false,
      },
      metadata: {
        dateSent: raw.createdAt ? new Date(raw.createdAt) : new Date(),
        edited: !!raw.editedAt,
        editedAt: raw.editedAt ? new Date(raw.editedAt) : undefined,
      },
      attachments: raw.attachments || [],
    };
  }

  /**
   * Post message to web channel.
   * For web, this inserts into D1 and broadcasts via DO.
   * @param {string} threadId
   * @param {import('./adapter.js').AdapterPostableMessage} message
   * @returns {Promise<import('./adapter.js').RawMessage>}
   */
  async postMessage(threadId, message) {
    // This is a stub â€” actual posting happens in messages-http.js
    // The adapter interface exists for uniformity across platforms
    const id = crypto.randomUUID();
    return {
      id,
      threadId,
      raw: { id, threadId, content: this.formatConverter.renderPostable(message) },
    };
  }

  /**
   * Edit a web message.
   * @param {string} threadId
   * @param {string} messageId
   * @param {import('./adapter.js').AdapterPostableMessage} message
   * @returns {Promise<import('./adapter.js').RawMessage>}
   */
  async editMessage(threadId, messageId, message) {
    return {
      id: messageId,
      threadId,
      raw: { id: messageId, threadId, content: this.formatConverter.renderPostable(message) },
    };
  }

  /**
   * Delete a web message.
   * @param {string} threadId
   * @param {string} messageId
   * @returns {Promise<void>}
   */
  async deleteMessage(threadId, messageId) {
    // Actual deletion happens in messages-http.js
  }

  /**
   * Add reaction to a web message.
   * @param {string} threadId
   * @param {string} messageId
   * @param {string} emoji
   * @returns {Promise<void>}
   */
  async addReaction(threadId, messageId, emoji) {
    // Actual reaction handling happens in messages-http.js
  }

  /**
   * Remove reaction from a web message.
   * @param {string} threadId
   * @param {string} messageId
   * @param {string} emoji
   * @returns {Promise<void>}
   */
  async removeReaction(threadId, messageId, emoji) {
    // Actual reaction handling happens in messages-http.js
  }

  /**
   * Stream response back to web client via WebSocket.
   * @param {string} threadId
   * @param {AsyncIterable<string|import('./adapter.js').StreamChunk>} textStream
   * @param {Object} [options]
   * @returns {Promise<import('./adapter.js').RawMessage|null>}
   */
  async stream(threadId, textStream, options) {
    // Web streaming is handled by the existing WebSocket rooms.
    // This is a no-op; the client connects to WS directly.
    // For adapter uniformity, we document this as supported but handled externally.
    return null;
  }

  /**
   * Encode thread ID for web.
   * @param {{userId: string, roomId: string}} data
   * @returns {string} web:{userId}:{roomId}
   */
  encodeThreadId(data) {
    return this.threadIdFor(data);
  }

  /**
   * Decode thread ID from web.
   * @param {string} threadId - web:{userId}:{roomId}
   * @returns {{userId: string, roomId: string}}
   */
  decodeThreadId(threadId) {
    const parts = threadId.split(":");
    if (parts.length < 3 || parts[0] !== ADAPTER_NAME) {
      throw new Error(`Invalid web thread id: ${threadId}`);
    }
    const [, userId, ...rest] = parts;
    return { userId, roomId: rest.join(":") };
  }

  /**
   * Derive channel ID from thread ID.
   * Web has no separate "channel" concept â€” each room is its own thread.
   * @param {string} threadId
   * @returns {string}
   */
  channelIdFromThreadId(threadId) {
    return threadId;
  }

  /**
   * Check if a thread is a direct message conversation.
   * Web always treats conversations as DMs.
   * @param {string} threadId
   * @returns {boolean}
   */
  isDM(threadId) {
    return true;
  }

  /**
   * Get the visibility scope of a channel.
   * Web channels are always private.
   * @param {string} threadId
   * @returns {import('./adapter.js').ChannelVisibility}
   */
  getChannelVisibility(threadId) {
    return "private";
  }

  /**
   * Render formatted content to web format.
   * Web uses markdown directly â€” no conversion needed.
   * @param {Object} content - mdast AST
   * @returns {string}
   */
  renderFormatted(content) {
    return this.formatConverter.fromAst(content);
  }

  /**
   * Validate web adapter settings.
   * Web adapter has no required settings.
   * @param {Object} settings
   * @returns {{ok: boolean, error?: string}}
   */
  validateSettings(settings) {
    return { ok: true };
  }

  /**
   * Get adapter health status.
   * @param {import('./adapter.js').AdapterContext} context
   * @returns {Promise<{healthy: boolean, detail?: string}>}
   */
  async healthCheck(context) {
    return { healthy: true };
  }

  /** @type {boolean} */
  disconnected = false;

  async disconnect() {
    this.disconnected = true;
  }

  async postChannelMessage(channelId, message) {
    return this.postMessage(channelId, message);
  }

  async fetchChannelMessages(channelId, options = {}) {
    const limit = Math.min(Math.max(Number(options.limit) || 50, 1), 200);
    return {
      messages: [],
      nextCursor: undefined,
      hasMore: false,
      channelId,
      limit,
    };
  }

  async listThreads(channelId, options = {}) {
    return {
      threads: [],
      nextCursor: undefined,
      channelId,
      limit: options.limit ?? 20,
    };
  }
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Create a WebAdapter instance.
 * @param {{threadIdFor?: Function}} [opts]
 * @returns {WebAdapter}
 */
export function createWebAdapter(opts) {
  return new WebAdapter(opts);
}

// =============================================================================
// Registration
// =============================================================================

// Register web adapter
registerAdapter("web", new WebAdapter());
