/**
 * P23-8: Cross-platform Bot Deployment
 * Adapters for Slack, Teams, Discord, Telegram, WhatsApp, Google Chat,
 * GitHub, Linear, Matrix/Beeper, Resend (email), IRC, Twitch, Line, API.
 */

export type Platform =
  | "slack"
  | "teams"
  | "discord"
  | "telegram"
  | "whatsapp"
  | "google-chat"
  | "github"
  | "linear"
  | "matrix"
  | "resend"
  | "irc"
  | "twitch"
  | "line"
  | "api";

export interface PlatformMessage {
  /** Platform-specific message ID */
  platformMessageId: string;
  /** Platform */
  platform: Platform;
  /** Sender user ID */
  senderId: string;
  /** Sender display name */
  senderName?: string;
  /** Channel/group/chat ID */
  channelId: string;
  /** Channel name */
  channelName?: string;
  /** Message content */
  content: string;
  /** Timestamp */
  timestamp: string;
  /** Thread/reply reference */
  threadId?: string;
  /** Whether the message is a reply */
  isReply?: boolean;
  /** Attachments */
  attachments?: Array<{ type: string; url?: string; name?: string; [key: string]: unknown }>;
  /** Mentions */
  mentions?: Array<{ id: string; name: string }>;
  /** Raw platform event */
  raw?: unknown;
}

export interface PlatformReply {
  content?: string;
  threadId?: string;
  attachments?: Array<{ type: string; url?: string; [key: string]: unknown }>;
  /** Platform-specific options */
  platformOptions?: Record<string, unknown>;
}

export interface PlatformAdapter {
  platform: Platform;
  /** Initialize the adapter with config */
  init(config: Record<string, unknown>): Promise<void>;
  /** Convert a platform event to PlatformMessage */
  parseEvent(event: unknown): Promise<PlatformMessage | null>;
  /** Send a reply back to the platform */
  reply(channelId: string, message: PlatformReply): Promise<string>;
  /** Send a thread reply */
  threadReply(channelId: string, threadId: string, message: PlatformReply): Promise<string>;
  /** Add a reaction to a message */
  addReaction(channelId: string, messageId: string, emoji: string): Promise<void>;
  /** Remove a reaction */
  removeReaction(channelId: string, messageId: string, emoji: string): Promise<void>;
  /** Check if adapter is connected */
  isReady(): boolean;
  /** Shutdown the adapter */
  shutdown(): Promise<void>;
}

export interface BotDeploymentConfig {
  /** Platform to deploy to */
  platform: Platform;
  /** Bot token / API key */
  token: string;
  /** App ID (for Teams, Discord) */
  appId?: string;
  /** Signing secret (for Slack) */
  signingSecret?: string;
  /** Webhook URL (for WhatsApp, Telegram) */
  webhookUrl?: string;
  /** Allowed channels/groups (empty = all) */
  allowedChannels?: string[];
  /** Required mention to trigger (empty = always) */
  requireMention?: boolean;
  /** System prompt override */
  systemPrompt?: string;
}

export interface BotDeployment {
  id: string;
  platform: Platform;
  status: "active" | "inactive" | "error";
  config: BotDeploymentConfig;
  createdAt: string;
  lastActiveAt?: string;
}

export interface BotDeploymentManager {
  /** Create a deployment */
  create(config: BotDeploymentConfig): Promise<BotDeployment>;
  /** List deployments */
  list(filter?: { platform?: Platform; status?: string }): Promise<BotDeployment[]>;
  /** Get a deployment */
  get(id: string): Promise<BotDeployment | null>;
  /** Update deployment status */
  updateStatus(id: string, status: BotDeployment["status"]): Promise<void>;
  /** Delete a deployment */
  delete(id: string): Promise<void>;
  /** Get adapter for a deployment */
  getAdapter(id: string): PlatformAdapter | null;
}

export declare function createPlatformAdapter(platform: Platform): PlatformAdapter;
export declare function createBotDeploymentManager(): BotDeploymentManager;
