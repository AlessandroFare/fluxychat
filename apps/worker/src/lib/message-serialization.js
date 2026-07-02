/**
 * P22-E3: Message Serialization
 * Serialize/deserialize messages with _type discriminator for runtime identification.
 *
 * Enables:
 * - Message persistence in workflow engines
 * - Cross-system transfer
 * - Time-travel debugging
 * - Replay and audit
 */

import { remark } from "remark";
import remarkGfm from "remark-gfm";

// =============================================================================
// Types
// =============================================================================

/**
 * @typedef {Object} SerializedMessage
 * @property {'message'} _type - Type discriminator
 * @property {string} id - Message ID
 * @property {string} threadId - Thread ID
 * @property {string} text - Text content
 * @property {Object} [formatted] - mdast AST (serialized)
 * @property {Object} author - Author info
 * @property {Object} metadata - Metadata
 * @property {Array} [attachments] - Attachments
 * @property {Array} [reactions] - Reactions
 */

/**
 * @typedef {Object} SerializedThread
 * @property {'thread'} _type - Type discriminator
 * @property {string} id - Thread ID
 * @property {string} channelId - Channel ID
 * @property {boolean} isDM - Whether DM
 * @property {Object} metadata - Thread metadata
 */

/**
 * @typedef {Object} SerializedChannel
 * @property {'channel'} _type - Type discriminator
 * @property {string} id - Channel ID
 * @property {string} [name] - Channel name
 * @property {boolean} isDM - Whether DM
 * @property {Object} metadata - Channel metadata
 */

// =============================================================================
// Serialization
// =============================================================================

/**
 * Serialize a message to a plain JSON object.
 * @param {Object} message - Message object
 * @returns {SerializedMessage}
 */
export function serializeMessage(message) {
  return {
    _type: "message",
    id: message.id,
    threadId: message.threadId,
    text: message.text,
    formatted: message.formatted ? serializeAst(message.formatted) : undefined,
    author: {
      userId: message.author?.userId,
      userName: message.author?.userName,
      fullName: message.author?.fullName,
      isBot: message.author?.isBot,
      isMe: message.author?.isMe,
    },
    metadata: {
      dateSent: message.metadata?.dateSent instanceof Date
        ? message.metadata.dateSent.toISOString()
        : message.metadata?.dateSent,
      edited: message.metadata?.edited ?? false,
      editedAt: message.metadata?.editedAt instanceof Date
        ? message.metadata.editedAt.toISOString()
        : message.metadata?.editedAt,
    },
    attachments: message.attachments || [],
    reactions: message.reactions || [],
  };
}

/**
 * Deserialize a message from a plain JSON object.
 * @param {SerializedMessage} data
 * @returns {Object}
 */
export function deserializeMessage(data) {
  if (!data || data._type !== "message") {
    throw new Error("Invalid message: missing _type discriminator");
  }

  return {
    id: data.id,
    threadId: data.threadId,
    text: data.text,
    formatted: data.formatted ? deserializeAst(data.formatted) : undefined,
    author: data.author,
    metadata: {
      dateSent: data.metadata?.dateSent ? new Date(data.metadata.dateSent) : new Date(),
      edited: data.metadata?.edited ?? false,
      editedAt: data.metadata?.editedAt ? new Date(data.metadata.editedAt) : undefined,
    },
    attachments: data.attachments || [],
    reactions: data.reactions || [],
  };
}

/**
 * Serialize a thread to a plain JSON object.
 * @param {Object} thread
 * @returns {SerializedThread}
 */
export function serializeThread(thread) {
  return {
    _type: "thread",
    id: thread.id,
    channelId: thread.channelId,
    isDM: thread.isDM,
    metadata: thread.metadata || {},
  };
}

/**
 * Deserialize a thread from a plain JSON object.
 * @param {SerializedThread} data
 * @returns {Object}
 */
export function deserializeThread(data) {
  if (!data || data._type !== "thread") {
    throw new Error("Invalid thread: missing _type discriminator");
  }
  return data;
}

/**
 * Serialize a channel to a plain JSON object.
 * @param {Object} channel
 * @returns {SerializedChannel}
 */
export function serializeChannel(channel) {
  return {
    _type: "channel",
    id: channel.id,
    name: channel.name,
    isDM: channel.isDM,
    metadata: channel.metadata || {},
  };
}

/**
 * Deserialize a channel from a plain JSON object.
 * @param {SerializedChannel} data
 * @returns {Object}
 */
export function deserializeChannel(data) {
  if (!data || data._type !== "channel") {
    throw new Error("Invalid channel: missing _type discriminator");
  }
  return data;
}

// =============================================================================
// AST Serialization
// =============================================================================

/**
 * Serialize an mdast AST to a JSON-safe object.
 * @param {Object} ast - mdast Root node
 * @returns {Object}
 */
export function serializeAst(ast) {
  if (!ast) return null;
  // mdast is already JSON-safe, just return it
  return JSON.parse(JSON.stringify(ast));
}

/**
 * Deserialize a JSON object back to an mdast AST.
 * @param {Object} data - Serialized AST
 * @returns {Object}
 */
export function deserializeAst(data) {
  if (!data) return null;
  // mdast is already the right shape, just return it
  return data;
}

/**
 * Parse markdown text to mdast AST.
 * @param {string} text
 * @returns {Object}
 */
export function parseMarkdown(text) {
  return remark().use(remarkGfm).parse(text);
}

/**
 * Stringify mdast AST to markdown text.
 * @param {Object} ast
 * @returns {string}
 */
export function stringifyMarkdown(ast) {
  return remark().use(remarkGfm).stringify(ast);
}

// =============================================================================
// Generic Serializer
// =============================================================================

/**
 * Registry of type discriminators and their (de)serializers.
 * @type {Map<string, {serialize: Function, deserialize: Function}>}
 */
const typeRegistry = new Map([
  ["message", { serialize: serializeMessage, deserialize: deserializeMessage }],
  ["thread", { serialize: serializeThread, deserialize: deserializeThread }],
  ["channel", { serialize: serializeChannel, deserialize: deserializeChannel }],
]);

/**
 * Register a custom type serializer.
 * @param {string} type - Type discriminator
 * @param {{serialize: Function, deserialize: Function}} handlers
 */
export function registerSerializer(type, handlers) {
  typeRegistry.set(type, handlers);
}

/**
 * Serialize any registered type.
 * @param {string} type - Type discriminator
 * @param {Object} value - Value to serialize
 * @returns {Object|null}
 */
export function serialize(type, value) {
  const handlers = typeRegistry.get(type);
  if (!handlers) return null;
  return handlers.serialize(value);
}

/**
 * Deserialize any registered type.
 * @param {Object} data - Data with _type discriminator
 * @returns {Object|null}
 */
export function deserialize(data) {
  if (!data?._type) return null;
  const handlers = typeRegistry.get(data._type);
  if (!handlers) return null;
  return handlers.deserialize(data);
}
