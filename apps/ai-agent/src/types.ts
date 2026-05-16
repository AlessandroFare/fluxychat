// Type definitions for AI Agent Service contracts

/**
 * Incoming webhook payload from Fluxychat
 */
export interface FluxyMentionWebhook {
  type: "mention";
  projectId: string;
  payload: {
    roomId: string;
    fromUserId: string;
    toUserIds: string[];
    messageId: number;
    createdAt: string; // ISO-8601
  };
  createdAt: string; // ISO-8601
}

/**
 * Webhook headers from Fluxychat
 */
export interface FluxyWebhookHeaders {
  "x-fluxy-event": string;
  "x-fluxy-project-id": string;
  "x-fluxy-signature"?: string; // sha256=<hex>
}

/**
 * Agent mode types
 */
export type AgentMode = "chat" | "suggest" | "image";

/**
 * Agent configuration
 */
export interface AgentConfig {
  projectId: string;
  handle: string; // e.g. "chatgpt" used as @chatgpt
  botId: string; // Fluxychat bot id: "bot_chatgpt"
  provider: "openai" | "anthropic" | "azure-openai" | "vertex" | string;
  model: string; // e.g. "gpt-4o"
  defaultMode: AgentMode;
  capabilities: AgentMode[]; // e.g. ["chat", "image"]
  systemPrompt?: string;
  apiKey?: string; // Provider API key (can override global)
  // Future: per-room overrides, safety settings, etc.
}

/**
 * Message from Fluxychat API
 */
export interface FluxyMessage {
  id: number;
  roomId: string;
  userId: string;
  content: string;
  createdAt: string;
  parentId?: number | null;
  mentions?: string[];
  preview?: {
    url: string;
    title?: string;
    description?: string;
    imageUrl?: string;
  };
  attachments?: Array<{
    id: string;
    kind: string;
    url: string;
    name?: string;
    sizeBytes?: number;
    contentType?: string;
  }>;
}

/**
 * Response from Fluxychat /api/messages
 */
export interface FluxyMessagesResponse {
  messages: FluxyMessage[];
}

/**
 * Request to post bot message
 */
export interface FluxyBotMessageRequest {
  botId: string;
  content: string;
  replyTo?: number;
}

/**
 * Response from posting bot message
 */
export interface FluxyBotMessageResponse {
  message: {
    id: number;
    roomId: string;
    senderId: string;
    content: string;
    createdAt: string;
  };
}

/**
 * Context for agent invocation
 */
export interface AgentInvocationContext {
  projectId: string;
  roomId: string;
  fromUserId: string;
  messageId: number;
  mode: AgentMode;
  mentionHandle: string;
  messages: FluxyMessage[];
  createdAt: string;
  originalContent: string;
}

/**
 * Provider request
 */
export interface AgentProviderRequest {
  agent: AgentConfig;
  context: AgentInvocationContext;
}

/**
 * Provider result
 */
export interface AgentProviderResult {
  content: string;
  // Future: images, tool calls, metadata, etc.
}
