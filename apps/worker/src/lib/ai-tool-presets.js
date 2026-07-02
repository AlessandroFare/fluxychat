/**
 * P22-D1: AI Tool Presets
 * Adapted from Vercel Chat SDK's createChatTools with presets.
 *
 * Predefined tool presets for common chat-agent use cases:
 * - 'reader'    — read-only: fetch threads, messages, channel info, users
 * - 'messenger' — basic posting: post in thread/channel, DM, react, typing
 * - 'moderator' — full management: read + write + edit/delete + subscriptions
 *
 * Each preset defines which tools are available and whether they need approval.
 */

// =============================================================================
// Tool Names
// =============================================================================

/**
 * All available tool names.
 * @typedef {string} ToolName
 */

/** @type {const} */
export const TOOL_NAMES = {
  // Read tools
  FETCH_MESSAGES: "fetchMessages",
  FETCH_THREAD: "fetchThread",
  FETCH_CHANNEL_MESSAGES: "fetchChannelMessages",
  LIST_THREADS: "listThreads",
  GET_THREAD_PARTICIPANTS: "getThreadParticipants",
  GET_CHANNEL_INFO: "getChannelInfo",
  GET_USER: "getUser",

  // Write tools
  POST_MESSAGE: "postMessage",
  POST_CHANNEL_MESSAGE: "postChannelMessage",
  SEND_DIRECT_MESSAGE: "sendDirectMessage",
  EDIT_MESSAGE: "editMessage",
  DELETE_MESSAGE: "deleteMessage",
  ADD_REACTION: "addReaction",
  REMOVE_REACTION: "removeReaction",
  START_TYPING: "startTyping",
  SUBSCRIBE_THREAD: "subscribeThread",
  UNSUBSCRIBE_THREAD: "unsubscribeThread",
};

/**
 * Write tools that may need approval.
 * @type {Set<string>}
 */
export const WRITE_TOOLS = new Set([
  TOOL_NAMES.POST_MESSAGE,
  TOOL_NAMES.POST_CHANNEL_MESSAGE,
  TOOL_NAMES.SEND_DIRECT_MESSAGE,
  TOOL_NAMES.EDIT_MESSAGE,
  TOOL_NAMES.DELETE_MESSAGE,
  TOOL_NAMES.ADD_REACTION,
  TOOL_NAMES.REMOVE_REACTION,
  TOOL_NAMES.SUBSCRIBE_THREAD,
  TOOL_NAMES.UNSUBSCRIBE_THREAD,
]);

/**
 * Read-only tools (never need approval).
 * @type {Set<string>}
 */
export const READ_TOOLS = new Set([
  TOOL_NAMES.FETCH_MESSAGES,
  TOOL_NAMES.FETCH_THREAD,
  TOOL_NAMES.FETCH_CHANNEL_MESSAGES,
  TOOL_NAMES.LIST_THREADS,
  TOOL_NAMES.GET_THREAD_PARTICIPANTS,
  TOOL_NAMES.GET_CHANNEL_INFO,
  TOOL_NAMES.GET_USER,
  TOOL_NAMES.START_TYPING,
]);

// =============================================================================
// Presets
// =============================================================================

/**
 * @typedef {'reader' | 'messenger' | 'moderator'} ToolPreset
 */

/**
 * Preset tool configurations.
 * @type {Record<ToolPreset, {tools: string[], needsApproval: Record<string, boolean>}>}
 */
export const PRESETS = {
  reader: {
    tools: [
      TOOL_NAMES.FETCH_MESSAGES,
      TOOL_NAMES.FETCH_THREAD,
      TOOL_NAMES.FETCH_CHANNEL_MESSAGES,
      TOOL_NAMES.LIST_THREADS,
      TOOL_NAMES.GET_THREAD_PARTICIPANTS,
      TOOL_NAMES.GET_CHANNEL_INFO,
      TOOL_NAMES.GET_USER,
    ],
    needsApproval: {},
  },
  messenger: {
    tools: [
      TOOL_NAMES.FETCH_MESSAGES,
      TOOL_NAMES.FETCH_THREAD,
      TOOL_NAMES.GET_CHANNEL_INFO,
      TOOL_NAMES.GET_USER,
      TOOL_NAMES.POST_MESSAGE,
      TOOL_NAMES.POST_CHANNEL_MESSAGE,
      TOOL_NAMES.SEND_DIRECT_MESSAGE,
      TOOL_NAMES.ADD_REACTION,
      TOOL_NAMES.REMOVE_REACTION,
      TOOL_NAMES.START_TYPING,
    ],
    needsApproval: {
      [TOOL_NAMES.POST_MESSAGE]: false,
      [TOOL_NAMES.POST_CHANNEL_MESSAGE]: false,
      [TOOL_NAMES.SEND_DIRECT_MESSAGE]: false,
      [TOOL_NAMES.ADD_REACTION]: false,
      [TOOL_NAMES.REMOVE_REACTION]: false,
    },
  },
  moderator: {
    tools: [
      TOOL_NAMES.FETCH_MESSAGES,
      TOOL_NAMES.FETCH_CHANNEL_MESSAGES,
      TOOL_NAMES.FETCH_THREAD,
      TOOL_NAMES.LIST_THREADS,
      TOOL_NAMES.GET_THREAD_PARTICIPANTS,
      TOOL_NAMES.GET_CHANNEL_INFO,
      TOOL_NAMES.GET_USER,
      TOOL_NAMES.POST_MESSAGE,
      TOOL_NAMES.POST_CHANNEL_MESSAGE,
      TOOL_NAMES.SEND_DIRECT_MESSAGE,
      TOOL_NAMES.EDIT_MESSAGE,
      TOOL_NAMES.DELETE_MESSAGE,
      TOOL_NAMES.ADD_REACTION,
      TOOL_NAMES.REMOVE_REACTION,
      TOOL_NAMES.SUBSCRIBE_THREAD,
      TOOL_NAMES.UNSUBSCRIBE_THREAD,
      TOOL_NAMES.START_TYPING,
    ],
    needsApproval: {
      [TOOL_NAMES.POST_MESSAGE]: false,
      [TOOL_NAMES.POST_CHANNEL_MESSAGE]: false,
      [TOOL_NAMES.SEND_DIRECT_MESSAGE]: false,
      [TOOL_NAMES.ADD_REACTION]: false,
      [TOOL_NAMES.REMOVE_REACTION]: false,
      [TOOL_NAMES.EDIT_MESSAGE]: true,
      [TOOL_NAMES.DELETE_MESSAGE]: true,
      [TOOL_NAMES.SUBSCRIBE_THREAD]: false,
      [TOOL_NAMES.UNSUBSCRIBE_THREAD]: false,
    },
  },
};

// =============================================================================
// Tool Definitions
// =============================================================================

/**
 * Tool definitions with schemas.
 * @type {Record<string, {name: string, description: string, inputSchema: Object, category: 'read'|'write'}>}
 */
export const TOOL_DEFINITIONS = {
  [TOOL_NAMES.FETCH_MESSAGES]: {
    name: TOOL_NAMES.FETCH_MESSAGES,
    description: "Fetch messages from a thread. Returns messages in chronological order.",
    inputSchema: {
      type: "object",
      properties: {
        threadId: { type: "string", description: "Thread ID" },
        limit: { type: "number", description: "Max messages to fetch (default: 50)" },
        cursor: { type: "string", description: "Pagination cursor" },
      },
      required: ["threadId"],
    },
    category: "read",
  },
  [TOOL_NAMES.FETCH_THREAD]: {
    name: TOOL_NAMES.FETCH_THREAD,
    description: "Fetch thread metadata including channel ID and visibility.",
    inputSchema: {
      type: "object",
      properties: {
        threadId: { type: "string", description: "Thread ID" },
      },
      required: ["threadId"],
    },
    category: "read",
  },
  [TOOL_NAMES.FETCH_CHANNEL_MESSAGES]: {
    name: TOOL_NAMES.FETCH_CHANNEL_MESSAGES,
    description: "Fetch top-level messages from a channel (not thread replies).",
    inputSchema: {
      type: "object",
      properties: {
        channelId: { type: "string", description: "Channel ID" },
        limit: { type: "number", description: "Max messages to fetch (default: 50)" },
        cursor: { type: "string", description: "Pagination cursor" },
      },
      required: ["channelId"],
    },
    category: "read",
  },
  [TOOL_NAMES.LIST_THREADS]: {
    name: TOOL_NAMES.LIST_THREADS,
    description: "List threads in a channel, most recently active first.",
    inputSchema: {
      type: "object",
      properties: {
        channelId: { type: "string", description: "Channel ID" },
        limit: { type: "number", description: "Max threads to fetch (default: 20)" },
        cursor: { type: "string", description: "Pagination cursor" },
      },
      required: ["channelId"],
    },
    category: "read",
  },
  [TOOL_NAMES.GET_THREAD_PARTICIPANTS]: {
    name: TOOL_NAMES.GET_THREAD_PARTICIPANTS,
    description: "Get unique human participants in a thread.",
    inputSchema: {
      type: "object",
      properties: {
        threadId: { type: "string", description: "Thread ID" },
      },
      required: ["threadId"],
    },
    category: "read",
  },
  [TOOL_NAMES.GET_CHANNEL_INFO]: {
    name: TOOL_NAMES.GET_CHANNEL_INFO,
    description: "Fetch channel metadata including name, visibility, and member count.",
    inputSchema: {
      type: "object",
      properties: {
        channelId: { type: "string", description: "Channel ID" },
      },
      required: ["channelId"],
    },
    category: "read",
  },
  [TOOL_NAMES.GET_USER]: {
    name: TOOL_NAMES.GET_USER,
    description: "Look up user information by user ID.",
    inputSchema: {
      type: "object",
      properties: {
        userId: { type: "string", description: "Platform user ID" },
      },
      required: ["userId"],
    },
    category: "read",
  },
  [TOOL_NAMES.POST_MESSAGE]: {
    name: TOOL_NAMES.POST_MESSAGE,
    description: "Post a message to a thread.",
    inputSchema: {
      type: "object",
      properties: {
        threadId: { type: "string", description: "Thread ID" },
        content: { type: "string", description: "Message content (markdown supported)" },
      },
      required: ["threadId", "content"],
    },
    category: "write",
  },
  [TOOL_NAMES.POST_CHANNEL_MESSAGE]: {
    name: TOOL_NAMES.POST_CHANNEL_MESSAGE,
    description: "Post a message to a channel top-level (not in a thread).",
    inputSchema: {
      type: "object",
      properties: {
        channelId: { type: "string", description: "Channel ID" },
        content: { type: "string", description: "Message content (markdown supported)" },
      },
      required: ["channelId", "content"],
    },
    category: "write",
  },
  [TOOL_NAMES.SEND_DIRECT_MESSAGE]: {
    name: TOOL_NAMES.SEND_DIRECT_MESSAGE,
    description: "Send a direct message to a user.",
    inputSchema: {
      type: "object",
      properties: {
        userId: { type: "string", description: "Target user ID" },
        content: { type: "string", description: "Message content (markdown supported)" },
      },
      required: ["userId", "content"],
    },
    category: "write",
  },
  [TOOL_NAMES.EDIT_MESSAGE]: {
    name: TOOL_NAMES.EDIT_MESSAGE,
    description: "Edit an existing message.",
    inputSchema: {
      type: "object",
      properties: {
        threadId: { type: "string", description: "Thread ID" },
        messageId: { type: "string", description: "Message ID" },
        content: { type: "string", description: "New message content" },
      },
      required: ["threadId", "messageId", "content"],
    },
    category: "write",
  },
  [TOOL_NAMES.DELETE_MESSAGE]: {
    name: TOOL_NAMES.DELETE_MESSAGE,
    description: "Delete a message.",
    inputSchema: {
      type: "object",
      properties: {
        threadId: { type: "string", description: "Thread ID" },
        messageId: { type: "string", description: "Message ID" },
      },
      required: ["threadId", "messageId"],
    },
    category: "write",
  },
  [TOOL_NAMES.ADD_REACTION]: {
    name: TOOL_NAMES.ADD_REACTION,
    description: "Add an emoji reaction to a message.",
    inputSchema: {
      type: "object",
      properties: {
        threadId: { type: "string", description: "Thread ID" },
        messageId: { type: "string", description: "Message ID" },
        emoji: { type: "string", description: "Emoji (e.g., '👍', 'heart')" },
      },
      required: ["threadId", "messageId", "emoji"],
    },
    category: "write",
  },
  [TOOL_NAMES.REMOVE_REACTION]: {
    name: TOOL_NAMES.REMOVE_REACTION,
    description: "Remove an emoji reaction from a message.",
    inputSchema: {
      type: "object",
      properties: {
        threadId: { type: "string", description: "Thread ID" },
        messageId: { type: "string", description: "Message ID" },
        emoji: { type: "string", description: "Emoji to remove" },
      },
      required: ["threadId", "messageId", "emoji"],
    },
    category: "write",
  },
  [TOOL_NAMES.START_TYPING]: {
    name: TOOL_NAMES.START_TYPING,
    description: "Show typing indicator in a thread.",
    inputSchema: {
      type: "object",
      properties: {
        threadId: { type: "string", description: "Thread ID" },
        status: { type: "string", description: "Status text (optional)" },
      },
      required: ["threadId"],
    },
    category: "read",
  },
  [TOOL_NAMES.SUBSCRIBE_THREAD]: {
    name: TOOL_NAMES.SUBSCRIBE_THREAD,
    description: "Subscribe to future messages in a thread.",
    inputSchema: {
      type: "object",
      properties: {
        threadId: { type: "string", description: "Thread ID" },
      },
      required: ["threadId"],
    },
    category: "write",
  },
  [TOOL_NAMES.UNSUBSCRIBE_THREAD]: {
    name: TOOL_NAMES.UNSUBSCRIBE_THREAD,
    description: "Unsubscribe from a thread.",
    inputSchema: {
      type: "object",
      properties: {
        threadId: { type: "string", description: "Thread ID" },
      },
      required: ["threadId"],
    },
    category: "write",
  },
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get tools for a preset.
 * @param {ToolPreset} preset - Preset name
 * @returns {string[]} Tool names
 */
export function getPresetTools(preset) {
  return PRESETS[preset]?.tools || [];
}

/**
 * Check if a tool needs approval in a preset.
 * @param {ToolPreset} preset - Preset name
 * @param {string} toolName - Tool name
 * @returns {boolean}
 */
export function needsApproval(preset, toolName) {
  const presetConfig = PRESETS[preset];
  if (!presetConfig) return true;
  if (presetConfig.needsApproval[toolName] !== undefined) {
    return presetConfig.needsApproval[toolName];
  }
  // Default: write tools need approval, read tools don't
  return WRITE_TOOLS.has(toolName);
}

/**
 * Get tool definition by name.
 * @param {string} toolName
 * @returns {Object|undefined}
 */
export function getToolDefinition(toolName) {
  return TOOL_DEFINITIONS[toolName];
}

/**
 * List all available presets.
 * @returns {Array<{name: string, description: string, toolCount: number}>}
 */
export function listPresets() {
  return [
    {
      name: "reader",
      description: "Read-only access: fetch threads, messages, channel info, users",
      toolCount: PRESETS.reader.tools.length,
    },
    {
      name: "messenger",
      description: "Basic posting: post in thread/channel, DM, react, typing",
      toolCount: PRESETS.messenger.tools.length,
    },
    {
      name: "moderator",
      description: "Full management: read + write + edit/delete + subscriptions",
      toolCount: PRESETS.moderator.tools.length,
    },
  ];
}

/**
 * Build tool list for a preset with optional overrides.
 * @param {ToolPreset} preset - Preset name
 * @param {Object} [overrides] - Per-tool overrides
 * @param {Record<string, boolean>} [overrides.needsApproval] - Override approval requirements
 * @param {Record<string, string>} [overrides.description] - Override descriptions
 * @param {Record<string, string>} [overrides.title] - Override titles
 * @returns {Array<Object>} Tool definitions with resolved approval settings
 */
export function buildToolList(preset, overrides = {}) {
  const presetConfig = PRESETS[preset];
  if (!presetConfig) return [];

  return presetConfig.tools
    .map((toolName) => {
      const def = TOOL_DEFINITIONS[toolName];
      if (!def) return null;

      const approvalOverride = overrides.needsApproval?.[toolName];
      const requiresApproval =
        approvalOverride !== undefined ? approvalOverride : needsApproval(preset, toolName);

      return {
        ...def,
        description: overrides.description?.[toolName] || def.description,
        title: overrides.title?.[toolName] || toolName,
        needsApproval: requiresApproval,
      };
    })
    .filter(Boolean);
}
