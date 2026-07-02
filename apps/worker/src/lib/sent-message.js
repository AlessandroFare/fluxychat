/**
 * P22-E4: SentMessage Factory
 * Creates message objects with edit/delete/addReaction/removeReaction methods.
 *
 * After posting a message, the returned SentMessage provides a clean API
 * for common operations without tracking message IDs separately.
 *
 * @example
 * ```js
 * const sent = await postMessage(threadId, "Hello!");
 * await sent.edit("Hello, world!");
 * await sent.addReaction("👍");
 * await sent.delete();
 * ```
 */

// =============================================================================
// SentMessage
// =============================================================================

/**
 * Create a SentMessage with methods bound to a specific message.
 * @param {Object} opts
 * @param {string} opts.id - Message ID
 * @param {string} opts.threadId - Thread ID
 * @param {string} opts.text - Text content
 * @param {Object} [opts.formatted] - mdast AST
 * @param {Object} [opts.author] - Author info
 * @param {Object} [opts.metadata] - Metadata
 * @param {Array} [opts.attachments] - Attachments
 * @param {Function} opts.onEdit - Edit handler: (newContent) => Promise<SentMessage>
 * @param {Function} opts.onDelete - Delete handler: () => Promise<void>
 * @param {Function} opts.onAddReaction - Add reaction handler: (emoji) => Promise<void>
 * @param {Function} opts.onRemoveReaction - Remove reaction handler: (emoji) => Promise<void>
 * @returns {Object} SentMessage with methods
 */
export function createSentMessage({
  id,
  threadId,
  text,
  formatted,
  author,
  metadata,
  attachments,
  onEdit,
  onDelete,
  onAddReaction,
  onRemoveReaction,
}) {
  const message = {
    _type: "sent_message",
    id,
    threadId,
    text,
    formatted,
    author: author || {},
    metadata: metadata || { dateSent: new Date(), edited: false },
    attachments: attachments || [],
    reactions: [],

    /**
     * Edit this message.
     * @param {string|Object} newContent - New text or PostableMessage
     * @returns {Promise<Object>} Updated SentMessage
     */
    async edit(newContent) {
      if (!onEdit) throw new Error("edit not supported");
      const content = typeof newContent === "string" ? newContent : newContent.text || newContent.raw || "";
      const result = await onEdit(content);
      // Update in place
      message.text = content;
      message.metadata.edited = true;
      message.metadata.editedAt = new Date();
      return message;
    },

    /**
     * Delete this message.
     * @returns {Promise<void>}
     */
    async delete() {
      if (!onDelete) throw new Error("delete not supported");
      await onDelete();
    },

    /**
     * Add a reaction to this message.
     * @param {string} emoji
     * @returns {Promise<void>}
     */
    async addReaction(emoji) {
      if (!onAddReaction) throw new Error("addReaction not supported");
      await onAddReaction(emoji);
      // Track locally
      if (!message.reactions.some((r) => r.emoji === emoji && r.userId === message.author?.userId)) {
        message.reactions.push({ emoji, userId: message.author?.userId || "unknown" });
      }
    },

    /**
     * Remove a reaction from this message.
     * @param {string} emoji
     * @returns {Promise<void>}
     */
    async removeReaction(emoji) {
      if (!onRemoveReaction) throw new Error("removeReaction not supported");
      await onRemoveReaction(emoji);
      // Track locally
      message.reactions = message.reactions.filter(
        (r) => !(r.emoji === emoji && r.userId === message.author?.userId)
      );
    },

    /**
     * Serialize to JSON.
     * @returns {Object}
     */
    toJSON() {
      return {
        _type: "sent_message",
        id: message.id,
        threadId: message.threadId,
        text: message.text,
        formatted: message.formatted,
        author: message.author,
        metadata: message.metadata,
        attachments: message.attachments,
        reactions: message.reactions,
      };
    },
  };

  return message;
}

// =============================================================================
// Placeholder SentMessage (for async/streaming contexts)
// =============================================================================

/**
 * Create a placeholder SentMessage for streaming or deferred content.
 * The message ID is assigned later when the stream completes.
 *
 * @param {Object} opts
 * @param {string} opts.threadId - Thread ID
 * @param {Function} opts.onEdit - Edit handler
 * @param {Function} opts.onDelete - Delete handler
 * @param {Function} opts.onAddReaction - Add reaction handler
 * @param {Function} opts.onRemoveReaction - Remove reaction handler
 * @returns {Object} Placeholder SentMessage
 */
export function createPlaceholderSentMessage({
  threadId,
  onEdit,
  onDelete,
  onAddReaction,
  onRemoveReaction,
}) {
  const placeholder = {
    _type: "sent_message",
    id: "",
    threadId,
    text: "",
    formatted: null,
    author: {},
    metadata: { dateSent: new Date(), edited: false },
    attachments: [],
    reactions: [],
    _pending: true,

    /**
     * Update the placeholder with actual message data.
     * @param {Object} data - Message data from adapter
     */
    _resolve(data) {
      placeholder.id = data.id;
      placeholder.text = data.text || "";
      placeholder.formatted = data.formatted;
      placeholder.author = data.author || {};
      placeholder._pending = false;
    },

    async edit(newContent) {
      if (placeholder._pending) throw new Error("message still pending");
      return placeholder.edit(newContent);
    },

    async delete() {
      if (placeholder._pending) throw new Error("message still pending");
      return placeholder.delete();
    },

    async addReaction(emoji) {
      if (placeholder._pending) throw new Error("message still pending");
      return placeholder.addReaction(emoji);
    },

    async removeReaction(emoji) {
      if (placeholder._pending) throw new Error("message still pending");
      return placeholder.removeReaction(emoji);
    },

    toJSON() {
      return {
        _type: "sent_message",
        id: placeholder.id,
        threadId: placeholder.threadId,
        text: placeholder.text,
        formatted: placeholder.formatted,
        author: placeholder.author,
        metadata: placeholder.metadata,
        attachments: placeholder.attachments,
        reactions: placeholder.reactions,
        _pending: placeholder._pending,
      };
    },
  };

  return placeholder;
}

// =============================================================================
// Null SentMessage (for no-op contexts)
// =============================================================================

/**
 * Create a null/empty SentMessage for contexts where message posting
 * is a no-op (e.g., web adapter streaming).
 *
 * @param {string} id
 * @param {string} threadId
 * @returns {Object}
 */
export function createNullSentMessage(id, threadId) {
  return createSentMessage({
    id,
    threadId,
    text: "",
    onEdit: async () => {},
    onDelete: async () => {},
    onAddReaction: async () => {},
    onRemoveReaction: async () => {},
  });
}
