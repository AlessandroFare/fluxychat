export type ComponentFramework = "react" | "vue" | "svelte";

export interface UIComponentDefinition {
  name: string;
  framework: ComponentFramework;
  props: Record<string, unknown>;
  slots?: string[];
  events?: string[];
}

export interface ChannelListConfig {
  showUnread: boolean;
  showAvatars: boolean;
  sortBy: "name" | "lastMessage" | "unread";
  filter?: string;
}

export interface ThreadViewConfig {
  showReplies: boolean;
  showReactions: boolean;
  sortReplies: "asc" | "desc";
  maxThreadDepth: number;
}

export interface MessageListConfig {
  showTimestamps: boolean;
  showAvatars: boolean;
  showReactions: boolean;
  enableInlineReplies: boolean;
  groupByDate: boolean;
  maxVisible: number;
}

export interface ComposerConfig {
  enableMentions: boolean;
  enableEmoji: boolean;
  enableAttachments: boolean;
  enableMarkdown: boolean;
  maxLength: number;
  placeholder: string;
}

export interface ComposableUIKit {
  getComponent(name: string, framework: ComponentFramework): UIComponentDefinition | undefined;
  registerComponent(def: UIComponentDefinition): void;
  getChannelListConfig(): ChannelListConfig;
  setChannelListConfig(config: Partial<ChannelListConfig>): void;
  getThreadViewConfig(): ThreadViewConfig;
  setThreadViewConfig(config: Partial<ThreadViewConfig>): void;
  getMessageListConfig(): MessageListConfig;
  setMessageListConfig(config: Partial<MessageListConfig>): void;
  getComposerConfig(): ComposerConfig;
  setComposerConfig(config: Partial<ComposerConfig>): void;
  getRegisteredComponents(framework?: ComponentFramework): UIComponentDefinition[];
  createTheme(overrides?: Record<string, string>): Record<string, string>;
}

const DEFAULT_CHANNEL_LIST: ChannelListConfig = {
  showUnread: true, showAvatars: true, sortBy: "lastMessage",
};

const DEFAULT_THREAD_VIEW: ThreadViewConfig = {
  showReplies: true, showReactions: true, sortReplies: "asc", maxThreadDepth: 10,
};

const DEFAULT_MESSAGE_LIST: MessageListConfig = {
  showTimestamps: true, showAvatars: true, showReactions: true,
  enableInlineReplies: true, groupByDate: true, maxVisible: 50,
};

const DEFAULT_COMPOSER: ComposerConfig = {
  enableMentions: true, enableEmoji: true, enableAttachments: true,
  enableMarkdown: true, maxLength: 4000, placeholder: "Type a message...",
};

export function createComposableUIKit(): ComposableUIKit {
  const components: UIComponentDefinition[] = [
    { name: "ChannelList", framework: "react", props: {} },
    { name: "ThreadView", framework: "react", props: {} },
    { name: "MessageList", framework: "react", props: {} },
    { name: "MessageComposer", framework: "react", props: {} },
    { name: "ReactionPicker", framework: "react", props: {} },
    { name: "EmojiPicker", framework: "react", props: {} },
    { name: "UserMention", framework: "react", props: {} },
    { name: "AttachmentPreview", framework: "react", props: {} },
  ];
  let channelListConfig = { ...DEFAULT_CHANNEL_LIST };
  let threadViewConfig = { ...DEFAULT_THREAD_VIEW };
  let messageListConfig = { ...DEFAULT_MESSAGE_LIST };
  let composerConfig = { ...DEFAULT_COMPOSER };

  return {
    getComponent(name, framework) {
      const c = components.find((c) => c.name === name && c.framework === framework);
      return c ? { ...c } : undefined;
    },

    registerComponent(def) {
      components.push({ ...def });
    },

    getChannelListConfig() { return { ...channelListConfig }; },
    setChannelListConfig(config) { channelListConfig = { ...channelListConfig, ...config }; },

    getThreadViewConfig() { return { ...threadViewConfig }; },
    setThreadViewConfig(config) { threadViewConfig = { ...threadViewConfig, ...config }; },

    getMessageListConfig() { return { ...messageListConfig }; },
    setMessageListConfig(config) { messageListConfig = { ...messageListConfig, ...config }; },

    getComposerConfig() { return { ...composerConfig }; },
    setComposerConfig(config) { composerConfig = { ...composerConfig, ...config }; },

    getRegisteredComponents(framework) {
      return framework
        ? components.filter((c) => c.framework === framework).map((c) => ({ ...c }))
        : components.map((c) => ({ ...c }));
    },

    createTheme(overrides = {}) {
      const base: Record<string, string> = {
        "--bg-primary": "#ffffff", "--bg-secondary": "#f5f5f5",
        "--text-primary": "#1a1a1a", "--text-secondary": "#666666",
        "--accent": "#0066ff", "--accent-hover": "#0052cc",
        "--border": "#e0e0e0", "--danger": "#ff4444",
        "--success": "#44bb44", "--warning": "#ffaa00",
      };
      return { ...base, ...overrides };
    },
  };
}
