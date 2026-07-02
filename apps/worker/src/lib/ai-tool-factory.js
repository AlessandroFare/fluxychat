/**
 * P22-D2: AI Tool Factory for Vercel AI SDK integration.
 * Adapted from Vercel Chat SDK's createChatTools() pattern.
 *
 * Converts FluxyChat tool definitions into Vercel AI SDK executable tool objects
 * with description, parameters schema, and execute functions.
 *
 * @example
 * ```js
 * import { createChatTools } from "./ai-tool-factory.js";
 * import { generateText } from "ai";
 *
 * const tools = createChatTools({ chat, preset: "messenger" });
 * const result = await generateText({ model, tools, prompt: "..." });
 * ```
 */

import {
  TOOL_NAMES,
  TOOL_DEFINITIONS,
  PRESETS,
  WRITE_TOOLS,
  needsApproval as presetNeedsApproval,
} from "./ai-tool-presets.js";

// =============================================================================
// Types
// =============================================================================

/**
 * @typedef {import("./ai-tool-presets.js").ToolPreset} ToolPreset
 */

/**
 * @typedef {boolean | Partial<Record<string, boolean>>} ApprovalConfig
 * - `true` — every write tool needs approval (default)
 * - `false` — no write tool needs approval
 * - object — per-tool override; unspecified write tools default to `true`
 */

/**
 * @typedef {Object} ChatBinding
 * @property {Function} thread - Get thread handle: `thread(threadId)`
 * @property {Function} channel - Get channel handle: `channel(channelId)`
 * @property {Function} getAdapter - Get adapter by name: `getAdapter(name)`
 * @property {Function} getUser - Look up user: `getUser(userId)`
 * @property {Function} openDM - Open DM: `openDM(userId)` → returns thread handle
 */

/**
 * @typedef {Object} ToolOptions
 * @property {boolean} [needsApproval] - Whether this tool needs approval
 */

/**
 * @typedef {Object} ToolOverrides
 * @property {string} [description] - Override description
 * @property {string} [title] - Override title
 * @property {boolean} [needsApproval] - Override approval requirement
 * @property {boolean} [enabled] - Whether tool is enabled
 */

/**
 * @typedef {Object} ChatToolsOptions
 * @property {ChatBinding} chat - Chat instance the tools dispatch operations against
 * @property {ToolPreset|ToolPreset[]} [preset] - Restrict tools to a preset
 * @property {ApprovalConfig} [requireApproval] - Whether write operations require approval (default: true)
 * @property {Partial<Record<string, ToolOverrides>>} [overrides] - Per-tool overrides
 */

// =============================================================================
// Constants
// =============================================================================

/** Fields that cannot be overridden. */
const PROTECTED_TOOL_FIELDS = new Set([
  "args",
  "execute",
  "id",
  "inputSchema",
  "outputSchema",
  "supportsDeferredResults",
  "type",
]);

// =============================================================================
// Helpers
// =============================================================================

/**
 * Resolve approval for a write tool from the ApprovalConfig.
 * @param {string} toolName
 * @param {ApprovalConfig} config
 * @returns {boolean}
 */
function resolveApproval(toolName, config) {
  if (typeof config === "boolean") {
    return config;
  }
  return config[toolName] ?? true;
}

/**
 * Resolve which tools are included by the preset.
 * @param {ToolPreset|ToolPreset[]} preset
 * @returns {Set<string>|null}
 */
function resolvePresetTools(preset) {
  if (!preset) return null;
  const presets = Array.isArray(preset) ? preset : [preset];
  const tools = new Set();
  for (const p of presets) {
    for (const t of PRESETS[p]?.tools || []) {
      tools.add(t);
    }
  }
  return tools;
}

/**
 * Apply safe overrides to a tool, skipping protected fields.
 * @param {Object} tool
 * @param {ToolOverrides|undefined} overrides
 * @returns {Object}
 */
function applyOverrides(tool, overrides) {
  if (!overrides) return tool;
  const safeOverrides = Object.fromEntries(
    Object.entries(overrides).filter(
      ([key]) => !PROTECTED_TOOL_FIELDS.has(key),
    ),
  );
  return { ...tool, ...safeOverrides };
}

// =============================================================================
// Tool Builders
// =============================================================================

/**
 * Convert a JSON Schema (from TOOL_DEFINITIONS) to a plain parameters object
 * suitable for Vercel AI SDK `tool()` function.
 * @param {Object} inputSchema
 * @returns {Object}
 */
function schemaToParameters(inputSchema) {
  return inputSchema;
}

// =============================================================================
// Tool Factory Functions
// =============================================================================

/**
 * Build the fetchMessages tool.
 * @param {ChatBinding} chat
 * @returns {Object}
 */
function buildFetchMessages(chat) {
  const def = TOOL_DEFINITIONS[TOOL_NAMES.FETCH_MESSAGES];
  return {
    description: def.description,
    parameters: schemaToParameters(def.inputSchema),
    execute: async ({ threadId, limit, cursor, direction }) => {
      const thread = chat.thread(threadId);
      const result = await thread.adapter.fetchMessages(threadId, {
        limit,
        cursor,
        direction,
      });
      return {
        messages: result.messages.map(projectMessage),
        nextCursor: result.nextCursor,
      };
    },
  };
}

/**
 * Build the fetchChannelMessages tool.
 * @param {ChatBinding} chat
 * @returns {Object}
 */
function buildFetchChannelMessages(chat) {
  const def = TOOL_DEFINITIONS[TOOL_NAMES.FETCH_CHANNEL_MESSAGES];
  return {
    description: def.description,
    parameters: schemaToParameters(def.inputSchema),
    execute: async ({ channelId, limit, cursor, direction }) => {
      const adapterName = channelId.split(":")[0];
      const adapter = adapterName ? chat.getAdapter(adapterName) : undefined;
      if (!adapter?.fetchChannelMessages) {
        throw new Error(
          `Adapter "${adapterName}" does not support fetching channel messages`,
        );
      }
      const result = await adapter.fetchChannelMessages(channelId, {
        limit,
        cursor,
        direction,
      });
      return {
        messages: result.messages.map(projectMessage),
        nextCursor: result.nextCursor,
      };
    },
  };
}

/**
 * Build the fetchThread tool.
 * @param {ChatBinding} chat
 * @returns {Object}
 */
function buildFetchThread(chat) {
  const def = TOOL_DEFINITIONS[TOOL_NAMES.FETCH_THREAD];
  return {
    description: def.description,
    parameters: schemaToParameters(def.inputSchema),
    execute: async ({ threadId }) => {
      const thread = chat.thread(threadId);
      const info = await thread.adapter.fetchThread(threadId);
      return {
        id: info.id,
        channelId: info.channelId,
        channelName: info.channelName,
        channelVisibility: info.channelVisibility,
        isDM: info.isDM ?? false,
      };
    },
  };
}

/**
 * Build the listThreads tool.
 * @param {ChatBinding} chat
 * @returns {Object}
 */
function buildListThreads(chat) {
  const def = TOOL_DEFINITIONS[TOOL_NAMES.LIST_THREADS];
  return {
    description: def.description,
    parameters: schemaToParameters(def.inputSchema),
    execute: async ({ channelId, limit, cursor }) => {
      const adapterName = channelId.split(":")[0];
      const adapter = adapterName ? chat.getAdapter(adapterName) : undefined;
      if (!adapter?.listThreads) {
        throw new Error(
          `Adapter "${adapterName}" does not support listing threads`,
        );
      }
      const result = await adapter.listThreads(channelId, { limit, cursor });
      return {
        threads: (result.threads || []).map((t) => ({
          id: t.id,
          replyCount: t.replyCount,
          lastReplyAt: t.lastReplyAt?.toISOString?.(),
          rootMessage: projectMessage(t.rootMessage),
        })),
        nextCursor: result.nextCursor,
      };
    },
  };
}

/**
 * Build the getThreadParticipants tool.
 * @param {ChatBinding} chat
 * @returns {Object}
 */
function buildGetThreadParticipants(chat) {
  const def = TOOL_DEFINITIONS[TOOL_NAMES.GET_THREAD_PARTICIPANTS];
  return {
    description: def.description,
    parameters: schemaToParameters(def.inputSchema),
    execute: async ({ threadId }) => {
      const thread = chat.thread(threadId);
      if (thread.getParticipants) {
        const participants = await thread.getParticipants();
        return {
          participants: participants.map((author) => ({
            userId: author.userId,
            userName: author.userName,
            fullName: author.fullName,
            isBot: author.isBot,
          })),
        };
      }
      // Fallback: use adapter method if available
      if (thread.adapter.getThreadMembers) {
        const members = await thread.adapter.getThreadMembers(threadId);
        return { participants: members || [] };
      }
      return { participants: [] };
    },
  };
}

/**
 * Build the getChannelInfo tool.
 * @param {ChatBinding} chat
 * @returns {Object}
 */
function buildGetChannelInfo(chat) {
  const def = TOOL_DEFINITIONS[TOOL_NAMES.GET_CHANNEL_INFO];
  return {
    description: def.description,
    parameters: schemaToParameters(def.inputSchema),
    execute: async ({ channelId }) => {
      const channel = chat.channel(channelId);
      if (channel?.fetchMetadata) {
        const info = await channel.fetchMetadata();
        return {
          id: info.id,
          name: info.name,
          isDM: info.isDM ?? false,
          memberCount: info.memberCount,
          channelVisibility: info.channelVisibility,
        };
      }
      // Fallback: use adapter method
      const adapterName = channelId.split(":")[0];
      const adapter = adapterName ? chat.getAdapter(adapterName) : undefined;
      if (adapter?.fetchChannelInfo) {
        const info = await adapter.fetchChannelInfo(channelId);
        return info;
      }
      throw new Error(`Channel info not available for "${channelId}"`);
    },
  };
}

/**
 * Build the getUser tool.
 * @param {ChatBinding} chat
 * @returns {Object}
 */
function buildGetUser(chat) {
  const def = TOOL_DEFINITIONS[TOOL_NAMES.GET_USER];
  return {
    description: def.description,
    parameters: schemaToParameters(def.inputSchema),
    execute: async ({ userId }) => {
      const user = await chat.getUser(userId);
      if (!user) return null;
      return {
        userId: user.userId,
        userName: user.userName,
        fullName: user.fullName,
        email: user.email,
        isBot: user.isBot,
        avatarUrl: user.avatarUrl,
      };
    },
  };
}

/**
 * Build the startTyping tool.
 * @param {ChatBinding} chat
 * @returns {Object}
 */
function buildStartTyping(chat) {
  const def = TOOL_DEFINITIONS[TOOL_NAMES.START_TYPING];
  return {
    description: def.description,
    parameters: schemaToParameters(def.inputSchema),
    execute: async ({ threadId, status }) => {
      const thread = chat.thread(threadId);
      await thread.adapter.startTyping(threadId, status);
      return { typing: true, threadId };
    },
  };
}

/**
 * Build the postMessage tool.
 * @param {ChatBinding} chat
 * @param {ToolOptions} options
 * @returns {Object}
 */
function buildPostMessage(chat, options = {}) {
  const def = TOOL_DEFINITIONS[TOOL_NAMES.POST_MESSAGE];
  return {
    description: def.description,
    needsApproval: options.needsApproval ?? true,
    parameters: schemaToParameters(def.inputSchema),
    execute: async ({ threadId, content }) => {
      const thread = chat.thread(threadId);
      const sent = await thread.post(content);
      return {
        messageId: sent.id,
        threadId: sent.threadId,
      };
    },
  };
}

/**
 * Build the postChannelMessage tool.
 * @param {ChatBinding} chat
 * @param {ToolOptions} options
 * @returns {Object}
 */
function buildPostChannelMessage(chat, options = {}) {
  const def = TOOL_DEFINITIONS[TOOL_NAMES.POST_CHANNEL_MESSAGE];
  return {
    description: def.description,
    needsApproval: options.needsApproval ?? true,
    parameters: schemaToParameters(def.inputSchema),
    execute: async ({ channelId, content }) => {
      const channel = chat.channel(channelId);
      const sent = await channel.post(content);
      return {
        messageId: sent.id,
        threadId: sent.threadId,
      };
    },
  };
}

/**
 * Build the sendDirectMessage tool.
 * @param {ChatBinding} chat
 * @param {ToolOptions} options
 * @returns {Object}
 */
function buildSendDirectMessage(chat, options = {}) {
  const def = TOOL_DEFINITIONS[TOOL_NAMES.SEND_DIRECT_MESSAGE];
  return {
    description: def.description,
    needsApproval: options.needsApproval ?? true,
    parameters: schemaToParameters(def.inputSchema),
    execute: async ({ userId, content }) => {
      const dm = await chat.openDM(userId);
      const sent = await dm.post(content);
      return {
        messageId: sent.id,
        threadId: sent.threadId,
      };
    },
  };
}

/**
 * Build the editMessage tool.
 * @param {ChatBinding} chat
 * @param {ToolOptions} options
 * @returns {Object}
 */
function buildEditMessage(chat, options = {}) {
  const def = TOOL_DEFINITIONS[TOOL_NAMES.EDIT_MESSAGE];
  return {
    description: def.description,
    needsApproval: options.needsApproval ?? true,
    parameters: schemaToParameters(def.inputSchema),
    execute: async ({ threadId, messageId, content }) => {
      const thread = chat.thread(threadId);
      const result = await thread.adapter.editMessage(
        threadId,
        messageId,
        content,
      );
      return { messageId: result.id, threadId: result.threadId };
    },
  };
}

/**
 * Build the deleteMessage tool.
 * @param {ChatBinding} chat
 * @param {ToolOptions} options
 * @returns {Object}
 */
function buildDeleteMessage(chat, options = {}) {
  const def = TOOL_DEFINITIONS[TOOL_NAMES.DELETE_MESSAGE];
  return {
    description: def.description,
    needsApproval: options.needsApproval ?? true,
    parameters: schemaToParameters(def.inputSchema),
    execute: async ({ threadId, messageId }) => {
      const thread = chat.thread(threadId);
      await thread.adapter.deleteMessage(threadId, messageId);
      return { deleted: true, messageId, threadId };
    },
  };
}

/**
 * Build the addReaction tool.
 * @param {ChatBinding} chat
 * @param {ToolOptions} options
 * @returns {Object}
 */
function buildAddReaction(chat, options = {}) {
  const def = TOOL_DEFINITIONS[TOOL_NAMES.ADD_REACTION];
  return {
    description: def.description,
    needsApproval: options.needsApproval ?? true,
    parameters: schemaToParameters(def.inputSchema),
    execute: async ({ threadId, messageId, emoji }) => {
      const thread = chat.thread(threadId);
      await thread.adapter.addReaction(threadId, messageId, emoji);
      return { added: true, emoji, messageId, threadId };
    },
  };
}

/**
 * Build the removeReaction tool.
 * @param {ChatBinding} chat
 * @param {ToolOptions} options
 * @returns {Object}
 */
function buildRemoveReaction(chat, options = {}) {
  const def = TOOL_DEFINITIONS[TOOL_NAMES.REMOVE_REACTION];
  return {
    description: def.description,
    needsApproval: options.needsApproval ?? true,
    parameters: schemaToParameters(def.inputSchema),
    execute: async ({ threadId, messageId, emoji }) => {
      const thread = chat.thread(threadId);
      await thread.adapter.removeReaction(threadId, messageId, emoji);
      return { removed: true, emoji, messageId, threadId };
    },
  };
}

/**
 * Build the subscribeThread tool.
 * @param {ChatBinding} chat
 * @param {ToolOptions} options
 * @returns {Object}
 */
function buildSubscribeThread(chat, options = {}) {
  const def = TOOL_DEFINITIONS[TOOL_NAMES.SUBSCRIBE_THREAD];
  return {
    description: def.description,
    needsApproval: options.needsApproval ?? true,
    parameters: schemaToParameters(def.inputSchema),
    execute: async ({ threadId }) => {
      const thread = chat.thread(threadId);
      if (thread.subscribe) {
        await thread.subscribe();
      }
      return { subscribed: true, threadId };
    },
  };
}

/**
 * Build the unsubscribeThread tool.
 * @param {ChatBinding} chat
 * @param {ToolOptions} options
 * @returns {Object}
 */
function buildUnsubscribeThread(chat, options = {}) {
  const def = TOOL_DEFINITIONS[TOOL_NAMES.UNSUBSCRIBE_THREAD];
  return {
    description: def.description,
    needsApproval: options.needsApproval ?? true,
    parameters: schemaToParameters(def.inputSchema),
    execute: async ({ threadId }) => {
      const thread = chat.thread(threadId);
      if (thread.unsubscribe) {
        await thread.unsubscribe();
      }
      return { subscribed: false, threadId };
    },
  };
}

// =============================================================================
// Message Projection
// =============================================================================

/**
 * Project a message to a plain object for tool results.
 * @param {Object} message
 * @returns {Object}
 */
function projectMessage(message) {
  if (!message) return null;
  return {
    id: message.id,
    threadId: message.threadId,
    text: message.text,
    author: message.author
      ? {
          userId: message.author.userId,
          userName: message.author.userName,
          fullName: message.author.fullName,
          isBot: message.author.isBot,
          isMe: message.author.isMe,
        }
      : undefined,
    dateSent: message.metadata?.dateSent?.toISOString?.(),
    edited: message.metadata?.edited,
    isMention: message.isMention,
    attachments: (message.attachments ?? []).map((att) => ({
      type: att.type,
      name: att.name,
      mimeType: att.mimeType,
      url: att.url,
    })),
  };
}

// =============================================================================
// Main Factory
// =============================================================================

/**
 * Create a set of Chat SDK tools for the Vercel AI SDK.
 *
 * Lets an AI agent operate inside a workspace: read messages, post replies,
 * send DMs, react, edit, delete, and manage thread subscriptions across
 * every adapter the supplied ChatBinding has registered.
 *
 * Write operations require user approval by default. Control this globally
 * or per-tool via `requireApproval`. Use `preset` to scope the toolset.
 *
 * @param {ChatToolsOptions} options
 * @returns {Record<string, Object>} Map of tool name to AI SDK tool definition
 *
 * @example
 * ```js
 * const tools = createChatTools({ chat, preset: 'messenger' });
 * const result = await generateText({ model, tools, prompt: '...' });
 * ```
 *
 * @example Granular approval
 * ```js
 * createChatTools({
 *   chat,
 *   preset: 'moderator',
 *   requireApproval: {
 *     deleteMessage: true,
 *     editMessage: true,
 *     postMessage: false,
 *     addReaction: false,
 *   },
 * })
 * ```
 */
export function createChatTools({ chat, requireApproval = true, preset, overrides } = {}) {
  if (!chat) {
    throw new Error(
      "createChatTools requires a `chat` instance. Pass your Chat instance as the `chat` option.",
    );
  }

  const approval = (name) => ({
    needsApproval: resolveApproval(name, requireApproval),
  });
  const allowed = preset ? resolvePresetTools(preset) : null;

  // Each entry is built lazily so a preset filter skips both the
  // approval() lookup and the underlying tool construction.
  const factories = {
    [TOOL_NAMES.FETCH_MESSAGES]: () => buildFetchMessages(chat),
    [TOOL_NAMES.FETCH_CHANNEL_MESSAGES]: () => buildFetchChannelMessages(chat),
    [TOOL_NAMES.FETCH_THREAD]: () => buildFetchThread(chat),
    [TOOL_NAMES.LIST_THREADS]: () => buildListThreads(chat),
    [TOOL_NAMES.GET_THREAD_PARTICIPANTS]: () => buildGetThreadParticipants(chat),
    [TOOL_NAMES.GET_CHANNEL_INFO]: () => buildGetChannelInfo(chat),
    [TOOL_NAMES.GET_USER]: () => buildGetUser(chat),
    [TOOL_NAMES.START_TYPING]: () => buildStartTyping(chat),
    [TOOL_NAMES.POST_MESSAGE]: () => buildPostMessage(chat, approval(TOOL_NAMES.POST_MESSAGE)),
    [TOOL_NAMES.POST_CHANNEL_MESSAGE]: () =>
      buildPostChannelMessage(chat, approval(TOOL_NAMES.POST_CHANNEL_MESSAGE)),
    [TOOL_NAMES.SEND_DIRECT_MESSAGE]: () =>
      buildSendDirectMessage(chat, approval(TOOL_NAMES.SEND_DIRECT_MESSAGE)),
    [TOOL_NAMES.EDIT_MESSAGE]: () => buildEditMessage(chat, approval(TOOL_NAMES.EDIT_MESSAGE)),
    [TOOL_NAMES.DELETE_MESSAGE]: () => buildDeleteMessage(chat, approval(TOOL_NAMES.DELETE_MESSAGE)),
    [TOOL_NAMES.ADD_REACTION]: () => buildAddReaction(chat, approval(TOOL_NAMES.ADD_REACTION)),
    [TOOL_NAMES.REMOVE_REACTION]: () => buildRemoveReaction(chat, approval(TOOL_NAMES.REMOVE_REACTION)),
    [TOOL_NAMES.SUBSCRIBE_THREAD]: () =>
      buildSubscribeThread(chat, approval(TOOL_NAMES.SUBSCRIBE_THREAD)),
    [TOOL_NAMES.UNSUBSCRIBE_THREAD]: () =>
      buildUnsubscribeThread(chat, approval(TOOL_NAMES.UNSUBSCRIBE_THREAD)),
  };

  const entries = Object.entries(factories)
    .filter(([name]) => !allowed || allowed.has(name))
    .map(([name, build]) => {
      const built = build();
      return [name, applyOverrides(built, overrides?.[name])];
    });

  return Object.fromEntries(entries);
}

// =============================================================================
// Exports
// =============================================================================

export { resolveApproval, resolvePresetTools, applyOverrides };
