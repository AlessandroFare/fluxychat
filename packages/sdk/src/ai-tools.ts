export type ToolPreset = "reader" | "messenger" | "moderator";

export type ToolName =
  | "fetchMessages"
  | "fetchThread"
  | "fetchChannelMessages"
  | "listThreads"
  | "getThreadParticipants"
  | "getChannelInfo"
  | "getUser"
  | "postMessage"
  | "postChannelMessage"
  | "sendDirectMessage"
  | "editMessage"
  | "deleteMessage"
  | "addReaction"
  | "removeReaction"
  | "startTyping"
  | "subscribeThread"
  | "unsubscribeThread";

export type ChatWriteToolName =
  | "postMessage"
  | "postChannelMessage"
  | "sendDirectMessage"
  | "editMessage"
  | "deleteMessage"
  | "addReaction"
  | "removeReaction"
  | "subscribeThread"
  | "unsubscribeThread"
  | "startTyping";

export type ApprovalConfig = boolean | Partial<Record<ChatWriteToolName, boolean>>;

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  category: "read" | "write";
}

export interface PresetConfig {
  tools: ToolName[];
  needsApproval: Record<string, boolean>;
}

export interface ChatBinding {
  thread(threadId: string): any;
  channel(channelId: string): any;
  getAdapter(name: string): any;
  getUser(userId: string): Promise<any | null>;
  openDM(userId: string): Promise<any>;
}

export interface ToolOverrides {
  description?: string;
  title?: string;
  needsApproval?: boolean;
  enabled?: boolean;
}

export interface ChatToolsOptions {
  chat: ChatBinding;
  preset?: ToolPreset | ToolPreset[];
  requireApproval?: ApprovalConfig;
  overrides?: Partial<Record<ToolName, ToolOverrides>>;
}

export interface ChatTool {
  description: string;
  parameters: Record<string, unknown>;
  execute: (args: Record<string, unknown>) => Promise<unknown>;
  needsApproval?: boolean;
}

const PRESET_TOOLS: Record<ToolPreset, ToolName[]> = {
  reader: [
    "fetchMessages",
    "fetchChannelMessages",
    "fetchThread",
    "listThreads",
    "getThreadParticipants",
    "getChannelInfo",
    "getUser",
  ],
  messenger: [
    "fetchMessages",
    "fetchThread",
    "getChannelInfo",
    "getUser",
    "postMessage",
    "postChannelMessage",
    "sendDirectMessage",
    "addReaction",
    "removeReaction",
    "startTyping",
  ],
  moderator: [
    "fetchMessages",
    "fetchChannelMessages",
    "fetchThread",
    "listThreads",
    "getThreadParticipants",
    "getChannelInfo",
    "getUser",
    "postMessage",
    "postChannelMessage",
    "sendDirectMessage",
    "editMessage",
    "deleteMessage",
    "addReaction",
    "removeReaction",
    "subscribeThread",
    "unsubscribeThread",
    "startTyping",
  ],
};

const TOOL_DEFINITIONS_RECORD: Record<ToolName, ToolDefinition> = {
  fetchMessages: {
    name: "fetchMessages",
    description: "Fetch recent messages from a thread, with pagination support",
    inputSchema: {
      type: "object",
      properties: {
        threadId: { type: "string", description: "Thread / room identifier" },
        limit: { type: "number", description: "Max messages to return (default 50)" },
        cursor: { type: "string", description: "Pagination cursor" },
        direction: { type: "string", enum: ["forward", "backward"], description: "Fetch direction" },
      },
      required: ["threadId"],
    },
    category: "read",
  },
  fetchThread: {
    name: "fetchThread",
    description: "Fetch metadata about a thread: channel id, name, visibility, DM status",
    inputSchema: {
      type: "object",
      properties: { threadId: { type: "string", description: "Thread identifier" } },
      required: ["threadId"],
    },
    category: "read",
  },
  fetchChannelMessages: {
    name: "fetchChannelMessages",
    description: "Fetch top-level channel messages (not threaded replies)",
    inputSchema: {
      type: "object",
      properties: {
        channelId: { type: "string", description: "Channel identifier" },
        limit: { type: "number", description: "Max messages" },
        cursor: { type: "string", description: "Pagination cursor" },
      },
      required: ["channelId"],
    },
    category: "read",
  },
  listThreads: {
    name: "listThreads",
    description: "List recent threads in a channel with root message summaries",
    inputSchema: {
      type: "object",
      properties: {
        channelId: { type: "string", description: "Channel identifier" },
        limit: { type: "number", description: "Max threads" },
        cursor: { type: "string", description: "Pagination cursor" },
      },
      required: ["channelId"],
    },
    category: "read",
  },
  getThreadParticipants: {
    name: "getThreadParticipants",
    description: "Get unique non-bot participants in a thread",
    inputSchema: {
      type: "object",
      properties: { threadId: { type: "string", description: "Thread identifier" } },
      required: ["threadId"],
    },
    category: "read",
  },
  getChannelInfo: {
    name: "getChannelInfo",
    description: "Fetch metadata for a channel: name, member count, DM status, visibility",
    inputSchema: {
      type: "object",
      properties: { channelId: { type: "string", description: "Full channel id" } },
      required: ["channelId"],
    },
    category: "read",
  },
  getUser: {
    name: "getUser",
    description: "Look up profile information about a user by their platform-specific id",
    inputSchema: {
      type: "object",
      properties: { userId: { type: "string", description: "Platform-specific user id" } },
      required: ["userId"],
    },
    category: "read",
  },
  startTyping: {
    name: "startTyping",
    description: "Show a typing indicator in a thread",
    inputSchema: {
      type: "object",
      properties: {
        threadId: { type: "string", description: "Thread identifier" },
        status: { type: "string", description: "Typing status override" },
      },
      required: ["threadId"],
    },
    category: "write",
  },
  postMessage: {
    name: "postMessage",
    description: "Reply to an existing thread with a text or markdown message",
    inputSchema: {
      type: "object",
      properties: {
        threadId: { type: "string", description: "Target thread" },
        message: {
          oneOf: [
            { type: "string", description: "Plain text body" },
            { type: "object", properties: { markdown: { type: "string" } } },
            { type: "object", properties: { raw: { type: "string" } } },
          ],
        },
      },
      required: ["threadId", "message"],
    },
    category: "write",
  },
  postChannelMessage: {
    name: "postChannelMessage",
    description: "Post a new top-level message to a channel (not threaded)",
    inputSchema: {
      type: "object",
      properties: {
        channelId: { type: "string", description: "Channel to post in" },
        message: {
          oneOf: [
            { type: "string", description: "Plain text body" },
            { type: "object", properties: { markdown: { type: "string" } } },
            { type: "object", properties: { raw: { type: "string" } } },
          ],
        },
      },
      required: ["channelId", "message"],
    },
    category: "write",
  },
  sendDirectMessage: {
    name: "sendDirectMessage",
    description: "Open or reuse a 1:1 direct message conversation with a user and send a message",
    inputSchema: {
      type: "object",
      properties: {
        userId: { type: "string", description: "Recipient user id" },
        message: {
          oneOf: [
            { type: "string", description: "Plain text body" },
            { type: "object", properties: { markdown: { type: "string" } } },
            { type: "object", properties: { raw: { type: "string" } } },
          ],
        },
      },
      required: ["userId", "message"],
    },
    category: "write",
  },
  editMessage: {
    name: "editMessage",
    description: "Edit a previously posted message",
    inputSchema: {
      type: "object",
      properties: {
        threadId: { type: "string", description: "Thread containing the message" },
        messageId: { type: "string", description: "Message id to edit" },
        message: { type: "string", description: "New message content" },
      },
      required: ["threadId", "messageId", "message"],
    },
    category: "write",
  },
  deleteMessage: {
    name: "deleteMessage",
    description: "Delete a message from a thread",
    inputSchema: {
      type: "object",
      properties: {
        threadId: { type: "string", description: "Thread containing the message" },
        messageId: { type: "string", description: "Message id to delete" },
      },
      required: ["threadId", "messageId"],
    },
    category: "write",
  },
  addReaction: {
    name: "addReaction",
    description: "Add an emoji reaction to a message",
    inputSchema: {
      type: "object",
      properties: {
        threadId: { type: "string", description: "Thread containing the message" },
        messageId: { type: "string", description: "Message id" },
        emoji: { type: "string", description: "Emoji to react with" },
      },
      required: ["threadId", "messageId", "emoji"],
    },
    category: "write",
  },
  removeReaction: {
    name: "removeReaction",
    description: "Remove the bot's emoji reaction from a message",
    inputSchema: {
      type: "object",
      properties: {
        threadId: { type: "string", description: "Thread containing the message" },
        messageId: { type: "string", description: "Message id" },
        emoji: { type: "string", description: "Emoji to remove" },
      },
      required: ["threadId", "messageId", "emoji"],
    },
    category: "write",
  },
  subscribeThread: {
    name: "subscribeThread",
    description: "Subscribe to all future messages in a thread (including non-mentions)",
    inputSchema: {
      type: "object",
      properties: { threadId: { type: "string", description: "Thread identifier" } },
      required: ["threadId"],
    },
    category: "write",
  },
  unsubscribeThread: {
    name: "unsubscribeThread",
    description: "Unsubscribe from a thread",
    inputSchema: {
      type: "object",
      properties: { threadId: { type: "string", description: "Thread identifier" } },
      required: ["threadId"],
    },
    category: "write",
  },
};

const WRITE_TOOL_NAMES: Set<string> = new Set<ChatWriteToolName>([
  "postMessage", "postChannelMessage", "sendDirectMessage",
  "editMessage", "deleteMessage",
  "addReaction", "removeReaction",
  "subscribeThread", "unsubscribeThread",
]);

export function getPresetTools(preset: ToolPreset): ToolName[] {
  return [...PRESET_TOOLS[preset]];
}

export function needsApproval(preset: ToolPreset, toolName: string): boolean {
  return WRITE_TOOL_NAMES.has(toolName);
}

export function getToolDefinition(toolName: string): ToolDefinition | undefined {
  return TOOL_DEFINITIONS_RECORD[toolName as ToolName];
}

export function listPresets(): Array<{
  name: string;
  description: string;
  toolCount: number;
}> {
  return [
    { name: "reader", description: "Read-only tools for fetching messages, threads, and user info", toolCount: PRESET_TOOLS.reader.length },
    { name: "messenger", description: "Basic chat tools for reading and posting messages", toolCount: PRESET_TOOLS.messenger.length },
    { name: "moderator", description: "Full set including edit, delete, and subscription management", toolCount: PRESET_TOOLS.moderator.length },
  ];
}

export function buildToolList(
  preset: ToolPreset,
  overrides?: {
    needsApproval?: Record<string, boolean>;
    description?: Record<string, string>;
    title?: Record<string, string>;
  },
): Array<ToolDefinition & { needsApproval: boolean; title: string }> {
  const toolNames = getPresetTools(preset);
  return toolNames.map((name) => {
    const def = TOOL_DEFINITIONS_RECORD[name];
    return {
      ...def,
      needsApproval: overrides?.needsApproval?.[name] ?? WRITE_TOOL_NAMES.has(name),
      title: overrides?.title?.[name] ?? name,
      description: overrides?.description?.[name] ?? def.description,
    };
  });
}

function resolvePresetTools(preset: ToolPreset | ToolPreset[] | undefined): Set<ToolName> | undefined {
  if (!preset) return undefined;
  const presets = Array.isArray(preset) ? preset : [preset];
  const tools = new Set<ToolName>();
  for (const p of presets) {
    for (const t of PRESET_TOOLS[p]) {
      tools.add(t);
    }
  }
  return tools;
}

function resolveApproval(
  toolName: ChatWriteToolName,
  config: ApprovalConfig
): boolean {
  if (typeof config === "boolean") {
    return config;
  }
  return config[toolName] ?? true;
}

const PROTECTED_TOOL_FIELDS = new Set([
  "execute", "parameters", "type",
]);

function applyOverrides(
  tool: Record<string, unknown>,
  overrides: ToolOverrides | undefined
): Record<string, unknown> {
  if (!overrides) return tool;
  const safe = Object.fromEntries(
    Object.entries(overrides).filter(
      ([key]) => !PROTECTED_TOOL_FIELDS.has(key)
    )
  );
  return { ...tool, ...safe };
}

function getMessageContent(message: unknown): string {
  if (typeof message === "string") return message;
  if (message && typeof message === "object") {
    const m = message as Record<string, unknown>;
    if (m.markdown) return m.markdown as string;
    if (m.raw) return m.raw as string;
  }
  return String(message);
}

function createToolFactories(chat: ChatBinding) {
  function getNeedsApproval(name: ChatWriteToolName) {
    return chat.getAdapter("needsApproval")?.[name] ?? true;
  }

  return {
    fetchMessages: () => ({
      description: TOOL_DEFINITIONS_RECORD.fetchMessages.description,
      parameters: TOOL_DEFINITIONS_RECORD.fetchMessages.inputSchema,
      execute: async (args: Record<string, unknown>) => {
        const thread = chat.thread(args.threadId as string);
        return thread.adapter.fetchMessages(args.threadId as string, {
          limit: (args.limit as number) ?? 50,
          cursor: args.cursor as string | undefined,
          direction: args.direction as "forward" | "backward" | undefined,
        });
      },
    }) as ChatTool,

    fetchThread: () => ({
      description: TOOL_DEFINITIONS_RECORD.fetchThread.description,
      parameters: TOOL_DEFINITIONS_RECORD.fetchThread.inputSchema,
      execute: async (args: Record<string, unknown>) => {
        const thread = chat.thread(args.threadId as string);
        const threadMeta = thread as Record<string, unknown>;
        return {
          id: args.threadId,
          channelId: typeof threadMeta.getChannelId === "function" ? await threadMeta.getChannelId() : undefined,
        };
      },
    }) as ChatTool,

    fetchChannelMessages: () => ({
      description: TOOL_DEFINITIONS_RECORD.fetchChannelMessages.description,
      parameters: TOOL_DEFINITIONS_RECORD.fetchChannelMessages.inputSchema,
      execute: async (args: Record<string, unknown>) => {
        const channel = chat.channel(args.channelId as string);
        return channel.adapter.fetchChannelMessages(args.channelId as string, {
          limit: (args.limit as number) ?? 50,
          cursor: args.cursor as string | undefined,
        });
      },
    }) as ChatTool,

    listThreads: () => ({
      description: TOOL_DEFINITIONS_RECORD.listThreads.description,
      parameters: TOOL_DEFINITIONS_RECORD.listThreads.inputSchema,
      execute: async (args: Record<string, unknown>) => {
        const channel = chat.channel(args.channelId as string);
        return channel.adapter.listThreads(args.channelId as string, {
          limit: (args.limit as number) ?? 50,
          cursor: args.cursor as string | undefined,
        });
      },
    }) as ChatTool,

    getThreadParticipants: () => ({
      description: TOOL_DEFINITIONS_RECORD.getThreadParticipants.description,
      parameters: TOOL_DEFINITIONS_RECORD.getThreadParticipants.inputSchema,
      execute: async (args: Record<string, unknown>) => {
        const thread = chat.thread(args.threadId as string);
        return thread.getParticipants();
      },
    }) as ChatTool,

    getChannelInfo: () => ({
      description: TOOL_DEFINITIONS_RECORD.getChannelInfo.description,
      parameters: TOOL_DEFINITIONS_RECORD.getChannelInfo.inputSchema,
      execute: async (args: Record<string, unknown>) => {
        const channel = chat.channel(args.channelId as string);
        return channel.fetchMetadata();
      },
    }) as ChatTool,

    getUser: () => ({
      description: TOOL_DEFINITIONS_RECORD.getUser.description,
      parameters: TOOL_DEFINITIONS_RECORD.getUser.inputSchema,
      execute: async (args: Record<string, unknown>) => {
        return chat.getUser(args.userId as string);
      },
    }) as ChatTool,

    startTyping: () => ({
      description: TOOL_DEFINITIONS_RECORD.startTyping.description,
      parameters: TOOL_DEFINITIONS_RECORD.startTyping.inputSchema,
      needsApproval: getNeedsApproval("startTyping"),
      execute: async (args: Record<string, unknown>) => {
        const thread = chat.thread(args.threadId as string);
        return thread.startTyping(args.status as string | undefined);
      },
    }) as ChatTool,

    postMessage: () => ({
      description: TOOL_DEFINITIONS_RECORD.postMessage.description,
      parameters: TOOL_DEFINITIONS_RECORD.postMessage.inputSchema,
      needsApproval: true,
      execute: async (args: Record<string, unknown>) => {
        const thread = chat.thread(args.threadId as string);
        const content = getMessageContent(args.message);
        return thread.post(content);
      },
    }) as ChatTool,

    postChannelMessage: () => ({
      description: TOOL_DEFINITIONS_RECORD.postChannelMessage.description,
      parameters: TOOL_DEFINITIONS_RECORD.postChannelMessage.inputSchema,
      needsApproval: true,
      execute: async (args: Record<string, unknown>) => {
        const channel = chat.channel(args.channelId as string);
        const content = getMessageContent(args.message);
        return channel.post(content);
      },
    }) as ChatTool,

    sendDirectMessage: () => ({
      description: TOOL_DEFINITIONS_RECORD.sendDirectMessage.description,
      parameters: TOOL_DEFINITIONS_RECORD.sendDirectMessage.inputSchema,
      needsApproval: true,
      execute: async (args: Record<string, unknown>) => {
        const dm = await chat.openDM(args.userId as string);
        const content = getMessageContent(args.message);
        return dm.post(content);
      },
    }) as ChatTool,

    editMessage: () => ({
      description: TOOL_DEFINITIONS_RECORD.editMessage.description,
      parameters: TOOL_DEFINITIONS_RECORD.editMessage.inputSchema,
      needsApproval: true,
      execute: async (args: Record<string, unknown>) => {
        const thread = chat.thread(args.threadId as string);
        return thread.adapter.editMessage(
          args.threadId as string,
          args.messageId as string,
          args.message as string
        );
      },
    }) as ChatTool,

    deleteMessage: () => ({
      description: TOOL_DEFINITIONS_RECORD.deleteMessage.description,
      parameters: TOOL_DEFINITIONS_RECORD.deleteMessage.inputSchema,
      needsApproval: true,
      execute: async (args: Record<string, unknown>) => {
        const thread = chat.thread(args.threadId as string);
        return thread.adapter.deleteMessage(
          args.threadId as string,
          args.messageId as string
        );
      },
    }) as ChatTool,

    addReaction: () => ({
      description: TOOL_DEFINITIONS_RECORD.addReaction.description,
      parameters: TOOL_DEFINITIONS_RECORD.addReaction.inputSchema,
      needsApproval: true,
      execute: async (args: Record<string, unknown>) => {
        const thread = chat.thread(args.threadId as string);
        return thread.adapter.addReaction(
          args.threadId as string,
          args.messageId as string,
          args.emoji as string
        );
      },
    }) as ChatTool,

    removeReaction: () => ({
      description: TOOL_DEFINITIONS_RECORD.removeReaction.description,
      parameters: TOOL_DEFINITIONS_RECORD.removeReaction.inputSchema,
      needsApproval: true,
      execute: async (args: Record<string, unknown>) => {
        const thread = chat.thread(args.threadId as string);
        return thread.adapter.removeReaction(
          args.threadId as string,
          args.messageId as string,
          args.emoji as string
        );
      },
    }) as ChatTool,

    subscribeThread: () => ({
      description: TOOL_DEFINITIONS_RECORD.subscribeThread.description,
      parameters: TOOL_DEFINITIONS_RECORD.subscribeThread.inputSchema,
      needsApproval: true,
      execute: async (args: Record<string, unknown>) => {
        const thread = chat.thread(args.threadId as string);
        return thread.subscribe();
      },
    }) as ChatTool,

    unsubscribeThread: () => ({
      description: TOOL_DEFINITIONS_RECORD.unsubscribeThread.description,
      parameters: TOOL_DEFINITIONS_RECORD.unsubscribeThread.inputSchema,
      needsApproval: true,
      execute: async (args: Record<string, unknown>) => {
        const thread = chat.thread(args.threadId as string);
        return thread.unsubscribe();
      },
    }) as ChatTool,
  };
}

export function createChatTools(options: ChatToolsOptions): Partial<Record<ToolName, ChatTool>> {
  const { chat, preset, requireApproval = true, overrides } = options;

  if (!chat) {
    throw new Error("createChatTools requires a `chat` instance");
  }

  const allowed = resolvePresetTools(preset);
  const factories = createToolFactories(chat);

  const entries = (Object.entries(factories) as [ToolName, () => ChatTool][])
    .filter(([name]) => !allowed || allowed.has(name))
    .map(([name, build]) => {
      const tool = build();
      if (WRITE_TOOL_NAMES.has(name) && typeof requireApproval !== "undefined") {
        tool.needsApproval = resolveApproval(name as ChatWriteToolName, requireApproval);
      }
      const overridden = applyOverrides(tool as unknown as Record<string, unknown>, overrides?.[name]);
      return [name, overridden] as const;
    });

  return Object.fromEntries(entries) as Partial<Record<ToolName, ChatTool>>;
}
